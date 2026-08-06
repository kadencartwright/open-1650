import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clampTick,
  findCueAtTick,
  findNearestStanza,
  findScheduleStartIndex,
  type CompiledPerformance,
} from "./compilePerformance";
import {
  createWebAudioBackend,
  type AudioBackend,
  type VoiceHandle,
} from "./webAudioBackend";

export type SingAlongStatus =
  | "idle"
  | "unlocking"
  | "playing"
  | "paused"
  | "ended"
  | "error";

export type TransportMode = "playing" | "paused";

export interface ScheduledTransport {
  mode: TransportMode;
  tick: number;
  bpm: number;
  effectiveAtLocalMs: number;
}

export interface TransportSnapshot {
  mode: TransportMode;
  tick: number;
  bpm: number;
  sampledAtLocalMs: number;
}

interface PendingTransport extends ScheduledTransport {
  outputTime: number;
  nextNoteIndex: number;
  voices: Set<VoiceHandle>;
}

const LOOKAHEAD_SECONDS = 0.16;
const SCHEDULER_INTERVAL_MS = 25;
const START_DELAY_SECONDS = 0.045;
const MIN_SCHEDULE_LEAD_SECONDS = 0.003;

function normalizeBpm(value: number): number {
  return Math.round(Math.min(180, Math.max(30, value)));
}

export function useSingAlong(performance: CompiledPerformance) {
  const [status, setStatus] = useState<SingAlongStatus>("idle");
  const [currentTick, setCurrentTick] = useState(0);
  const [bpm, setBpmState] = useState(performance.defaultBpm);
  const [volume, setVolumeState] = useState(0.7);
  const [loopStanza, setLoopStanzaState] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const backendRef = useRef<AudioBackend | null>(null);
  const removeBackendListenerRef = useRef<(() => void) | null>(null);
  const schedulerRef = useRef<number | null>(null);
  const animationRef = useRef<number | null>(null);
  const transportTimerRef = useRef<number | null>(null);
  const pendingTransportRef = useRef<PendingTransport | null>(null);
  const nextNoteIndexRef = useRef(0);
  const anchorTickRef = useRef(0);
  const anchorTimeRef = useRef(0);
  const currentTickRef = useRef(0);
  const bpmRef = useRef(performance.defaultBpm);
  const volumeRef = useRef(0.7);
  const statusRef = useRef<SingAlongStatus>("idle");
  const loopStanzaRef = useRef(false);
  const loopTargetRef = useRef<string | null>(null);
  const audioReadyRef = useRef(false);
  const disposedRef = useRef(false);
  const stanzaById = useMemo(
    () =>
      new Map(
        performance.stanzas.map((stanza) => [stanza.stanzaId, stanza]),
      ),
    [performance.stanzas],
  );

  const updateStatus = useCallback((next: SingAlongStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const updateTick = useCallback((next: number) => {
    const clamped = clampTick(next, performance.durationTicks);
    currentTickRef.current = clamped;
    setCurrentTick(clamped);
    return clamped;
  }, [performance.durationTicks]);

  const stopTimers = useCallback(() => {
    if (schedulerRef.current !== null) {
      window.clearInterval(schedulerRef.current);
      schedulerRef.current = null;
    }
    if (animationRef.current !== null) {
      window.cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  const tickAtPlanTime = useCallback(
    (
      audioTime: number,
      anchorTick: number,
      anchorTime: number,
      planBpm: number,
    ) => {
      const elapsed = Math.max(0, audioTime - anchorTime);
      return clampTick(
        anchorTick + (elapsed * performance.ppq * planBpm) / 60,
        performance.durationTicks,
      );
    },
    [performance.durationTicks, performance.ppq],
  );

  const tickAtTime = useCallback(
    (audioTime: number) =>
      tickAtPlanTime(
        audioTime,
        anchorTickRef.current,
        anchorTimeRef.current,
        bpmRef.current,
      ),
    [tickAtPlanTime],
  );

  const readPlayingTick = useCallback(
    (outputClock = true) => {
      const backend = backendRef.current;
      if (!backend || statusRef.current !== "playing") {
        return currentTickRef.current;
      }
      return tickAtTime(outputClock ? backend.outputNow() : backend.now());
    },
    [tickAtTime],
  );

  const schedulePlanWindow = useCallback((
    backend: AudioBackend,
    plan: {
      anchorTick: number;
      anchorTime: number;
      bpm: number;
    },
    nextNoteIndex: number,
    notAfter?: number,
    handles?: Set<VoiceHandle>,
  ) => {
    const now = backend.now();
    const schedulingFloor = Math.max(
      plan.anchorTime,
      now + MIN_SCHEDULE_LEAD_SECONDS,
    );
    if (notAfter !== undefined && schedulingFloor >= notAfter) {
      return nextNoteIndex;
    }

    const windowEndTime = Math.min(
      Math.max(plan.anchorTime, now + LOOKAHEAD_SECONDS),
      notAfter ?? Number.POSITIVE_INFINITY,
    );
    const windowStartTick = tickAtPlanTime(
      schedulingFloor,
      plan.anchorTick,
      plan.anchorTime,
      plan.bpm,
    );
    const windowEndTick = tickAtPlanTime(
      windowEndTime,
      plan.anchorTick,
      plan.anchorTime,
      plan.bpm,
    );
    const secondsPerTick = 60 / (performance.ppq * plan.bpm);

    while (nextNoteIndex < performance.notes.length) {
      const note = performance.notes[nextNoteIndex];
      if (note.startTick > windowEndTick) break;

      nextNoteIndex += 1;
      if (note.endTick <= windowStartTick) continue;

      const noteStartTime =
        plan.anchorTime +
        (note.startTick - plan.anchorTick) * secondsPerTick;
      const when = Math.max(schedulingFloor, noteStartTime);
      if (notAfter !== undefined && when >= notAfter) continue;

      const noteEndTime =
        plan.anchorTime +
        (note.endTick - plan.anchorTick) * secondsPerTick;
      const end = Math.min(
        noteEndTime,
        notAfter ?? Number.POSITIVE_INFINITY,
      );
      const duration = end - when;
      if (duration <= 0) continue;

      const handle = backend.scheduleNote({
        voice: note.voice,
        midi: note.midi,
        velocity: note.velocity,
        when,
        duration,
      });
      handles?.add(handle);
    }

    return nextNoteIndex;
  }, [performance.notes, performance.ppq, tickAtPlanTime]);

  const scheduleWindow = useCallback(() => {
    const backend = backendRef.current;
    if (!backend) return;

    const pending = pendingTransportRef.current;
    if (statusRef.current === "playing") {
      nextNoteIndexRef.current = schedulePlanWindow(
        backend,
        {
          anchorTick: anchorTickRef.current,
          anchorTime: anchorTimeRef.current,
          bpm: bpmRef.current,
        },
        nextNoteIndexRef.current,
        pending?.outputTime,
      );
    }

    if (pending?.mode === "playing") {
      pending.nextNoteIndex = schedulePlanWindow(
        backend,
        {
          anchorTick: pending.tick,
          anchorTime: pending.outputTime,
          bpm: pending.bpm,
        },
        pending.nextNoteIndex,
        undefined,
        pending.voices,
      );
    }
  }, [schedulePlanWindow]);

  const reanchor = useCallback(
    (tick: number) => {
      const backend = backendRef.current;
      if (!backend) return;

      backend.stopAll();
      const nextTick = updateTick(tick);
      nextNoteIndexRef.current = findScheduleStartIndex(
        performance.notes,
        nextTick,
      );
      anchorTickRef.current = nextTick;
      anchorTimeRef.current = backend.now() + START_DELAY_SECONDS;
      backend.startAll(anchorTimeRef.current);
      scheduleWindow();
    },
    [performance.notes, scheduleWindow, updateTick],
  );

  const endPlayback = useCallback(() => {
    stopTimers();
    backendRef.current?.stopAll();
    updateTick(performance.durationTicks);
    updateStatus("ended");
  }, [
    performance.durationTicks,
    stopTimers,
    updateStatus,
    updateTick,
  ]);

  const frame = useCallback(() => {
    if (statusRef.current !== "playing") return;
    let nextTick = readPlayingTick(true);

    if (loopStanzaRef.current && loopTargetRef.current) {
      const target = stanzaById.get(loopTargetRef.current);
      if (target && nextTick >= target.endTick) {
        reanchor(target.startTick);
        nextTick = target.startTick;
      }
    }

    if (nextTick >= performance.durationTicks) {
      endPlayback();
      return;
    }

    updateTick(nextTick);
    animationRef.current = window.requestAnimationFrame(frame);
  }, [
    endPlayback,
    performance.durationTicks,
    readPlayingTick,
    reanchor,
    stanzaById,
    updateTick,
  ]);

  const startScheduler = useCallback(() => {
    scheduleWindow();
    if (schedulerRef.current === null) {
      schedulerRef.current = window.setInterval(
        scheduleWindow,
        SCHEDULER_INTERVAL_MS,
      );
    }
  }, [scheduleWindow]);

  const startTimers = useCallback(() => {
    stopTimers();
    startScheduler();
    animationRef.current = window.requestAnimationFrame(frame);
  }, [frame, startScheduler, stopTimers]);

  const ensureBackend = useCallback(() => {
    if (backendRef.current) return backendRef.current;

    const backend = createWebAudioBackend();
    backend.setVolume(volumeRef.current);
    removeBackendListenerRef.current = backend.onStateChange((audioState) => {
      const ready = audioState === "running";
      audioReadyRef.current = ready;
      setAudioReady(ready);
      if (
        statusRef.current === "playing" &&
        !ready
      ) {
        const pausedAt = readPlayingTick(false);
        stopTimers();
        backend.stopAll();
        updateTick(pausedAt);
        updateStatus("paused");
        setError("Audio was paused by the browser. Press play to resume.");
      }
    });
    backendRef.current = backend;
    return backend;
  }, [readPlayingTick, stopTimers, updateStatus, updateTick]);

  const prepareAudio = useCallback(async () => {
    const backend = ensureBackend();
    if (audioReadyRef.current && backend.state === "running") return;
    let resumeTimer: number | undefined;
    try {
      await Promise.race([
        backend.resume(),
        new Promise<never>((_, reject) => {
          resumeTimer = window.setTimeout(
            () =>
              reject(
                new Error(
                  "The browser did not unlock its audio output in time.",
                ),
              ),
            4_000,
          );
        }),
      ]);
    } finally {
      if (resumeTimer !== undefined) window.clearTimeout(resumeTimer);
    }
    if (disposedRef.current) return;
    audioReadyRef.current = true;
    setAudioReady(true);
  }, [ensureBackend]);

  const clearTransportTimer = useCallback(() => {
    if (transportTimerRef.current !== null) {
      window.clearTimeout(transportTimerRef.current);
      transportTimerRef.current = null;
    }
  }, []);

  const cancelPendingTransport = useCallback(() => {
    clearTransportTimer();
    const pending = pendingTransportRef.current;
    pendingTransportRef.current = null;
    if (!pending) return;
    for (const voice of pending.voices) voice.cancel();
    pending.voices.clear();
    if (statusRef.current !== "playing") stopTimers();
  }, [clearTransportTimer, stopTimers]);

  const applyPendingTransport = useCallback((
    pending: PendingTransport,
  ) => {
    if (pendingTransportRef.current !== pending) return;
    pendingTransportRef.current = null;
    transportTimerRef.current = null;

    bpmRef.current = pending.bpm;
    setBpmState(pending.bpm);
    updateTick(pending.tick);

    const backend = backendRef.current;
    if (pending.mode === "paused") {
      pending.voices.clear();
      stopTimers();
      backend?.stopAll();
      updateStatus("paused");
      return;
    }

    anchorTickRef.current = pending.tick;
    anchorTimeRef.current = pending.outputTime;
    nextNoteIndexRef.current = pending.nextNoteIndex;
    pending.voices.clear();
    backend?.startAll(pending.outputTime);
    updateStatus("playing");
    startTimers();
  }, [startTimers, stopTimers, updateStatus, updateTick]);

  const armTransportTimer = useCallback((pending: PendingTransport) => {
    const check = () => {
      if (pendingTransportRef.current !== pending) return;
      const remaining =
        pending.effectiveAtLocalMs - globalThis.performance.now();
      if (remaining > 1) {
        transportTimerRef.current = window.setTimeout(check, remaining);
        return;
      }
      applyPendingTransport(pending);
    };

    const delay = Math.max(
      0,
      pending.effectiveAtLocalMs - globalThis.performance.now(),
    );
    transportTimerRef.current = window.setTimeout(check, delay);
  }, [applyPendingTransport]);

  const scheduleTransport = useCallback(async (
    command: ScheduledTransport,
  ) => {
    if (!Number.isFinite(command.effectiveAtLocalMs)) {
      throw new Error("The synchronized playback time must be finite.");
    }
    if (!Number.isFinite(command.tick) || !Number.isFinite(command.bpm)) {
      throw new Error("The synchronized transport position is invalid.");
    }

    if (command.mode === "playing") await prepareAudio();
    if (disposedRef.current) return;

    const replacingActivePlan =
      pendingTransportRef.current !== null &&
      statusRef.current === "playing";
    const replacementTick = replacingActivePlan
      ? readPlayingTick(true)
      : currentTickRef.current;
    cancelPendingTransport();
    const backend = backendRef.current;
    if (replacingActivePlan && backend) {
      backend.stopAll();
      anchorTickRef.current = replacementTick;
      anchorTimeRef.current =
        backend.now() + MIN_SCHEDULE_LEAD_SECONDS;
      nextNoteIndexRef.current = findScheduleStartIndex(
        performance.notes,
        replacementTick,
      );
      backend.startAll(anchorTimeRef.current);
      updateTick(replacementTick);
    }
    const normalizedTick = clampTick(
      command.tick,
      performance.durationTicks,
    );
    const normalizedBpm = normalizeBpm(command.bpm);
    const outputTime = backend
      ? backend.outputTimeAt(command.effectiveAtLocalMs)
      : 0;
    const pending: PendingTransport = {
      mode: command.mode,
      tick: normalizedTick,
      bpm: normalizedBpm,
      effectiveAtLocalMs: command.effectiveAtLocalMs,
      outputTime,
      nextNoteIndex: findScheduleStartIndex(
        performance.notes,
        normalizedTick,
      ),
      voices: new Set(),
    };
    pendingTransportRef.current = pending;

    if (backend && statusRef.current === "playing") {
      backend.stopAll(outputTime);
    }
    if (backend && command.mode === "playing") {
      backend.startAll(outputTime);
      startScheduler();
    } else if (statusRef.current === "playing") {
      scheduleWindow();
    }

    armTransportTimer(pending);
  }, [
    armTransportTimer,
    cancelPendingTransport,
    performance.durationTicks,
    performance.notes,
    prepareAudio,
    readPlayingTick,
    scheduleWindow,
    startScheduler,
    updateTick,
  ]);

  const getTransportSnapshot = useCallback((): TransportSnapshot => {
    const sampledAtLocalMs = globalThis.performance.now();
    const pending = pendingTransportRef.current;
    const backend = backendRef.current;

    if (
      pending &&
      sampledAtLocalMs >= pending.effectiveAtLocalMs
    ) {
      const tick =
        pending.mode === "playing" && backend
          ? tickAtPlanTime(
              backend.outputTimeAt(sampledAtLocalMs),
              pending.tick,
              pending.outputTime,
              pending.bpm,
            )
          : pending.tick;
      return {
        mode: pending.mode,
        tick,
        bpm: pending.bpm,
        sampledAtLocalMs,
      };
    }

    const mode: TransportMode =
      statusRef.current === "playing" ? "playing" : "paused";
    const tick =
      mode === "playing" && backend
        ? tickAtTime(backend.outputTimeAt(sampledAtLocalMs))
        : currentTickRef.current;
    return {
      mode,
      tick,
      bpm: bpmRef.current,
      sampledAtLocalMs,
    };
  }, [tickAtPlanTime, tickAtTime]);

  const play = useCallback(async () => {
    if (
      statusRef.current === "playing" ||
      statusRef.current === "unlocking"
    ) {
      return;
    }

    try {
      cancelPendingTransport();
      setError(null);
      updateStatus("unlocking");
      await prepareAudio();
      if (disposedRef.current) return;

      const startTick =
        currentTickRef.current >= performance.durationTicks
          ? 0
          : currentTickRef.current;
      if (loopStanzaRef.current) {
        loopTargetRef.current =
          findNearestStanza(performance.stanzas, startTick)?.stanzaId ??
          null;
      }
      updateStatus("playing");
      reanchor(startTick);
      startTimers();
    } catch (reason) {
      const message =
        reason instanceof Error
          ? reason.message
          : "The browser could not start audio.";
      stopTimers();
      removeBackendListenerRef.current?.();
      removeBackendListenerRef.current = null;
      const backend = backendRef.current;
      backendRef.current = null;
      if (backend) void backend.close();
      audioReadyRef.current = false;
      setAudioReady(false);
      updateStatus("error");
      setError(`${message} Check this tab’s audio permission and try again.`);
    }
  }, [
    cancelPendingTransport,
    performance.durationTicks,
    performance.stanzas,
    prepareAudio,
    reanchor,
    startTimers,
    stopTimers,
    updateStatus,
  ]);

  const pause = useCallback(() => {
    cancelPendingTransport();
    if (statusRef.current !== "playing") return;
    const pausedAt = readPlayingTick(true);
    stopTimers();
    backendRef.current?.stopAll();
    updateTick(pausedAt);
    updateStatus("paused");
  }, [
    cancelPendingTransport,
    readPlayingTick,
    stopTimers,
    updateStatus,
    updateTick,
  ]);

  const toggle = useCallback(async () => {
    if (statusRef.current === "playing") pause();
    else await play();
  }, [pause, play]);

  const restart = useCallback(() => {
    cancelPendingTransport();
    setError(null);
    if (loopStanzaRef.current) {
      loopTargetRef.current = performance.stanzas[0]?.stanzaId ?? null;
    }
    if (statusRef.current === "playing") {
      reanchor(0);
      return;
    }
    backendRef.current?.stopAll();
    updateTick(0);
    updateStatus("idle");
  }, [
    cancelPendingTransport,
    performance.stanzas,
    reanchor,
    updateStatus,
    updateTick,
  ]);

  const seek = useCallback(
    (tick: number) => {
      cancelPendingTransport();
      const nextTick = clampTick(tick, performance.durationTicks);
      setError(null);
      if (loopStanzaRef.current) {
        loopTargetRef.current =
          findNearestStanza(performance.stanzas, nextTick)?.stanzaId ??
          null;
      }

      if (statusRef.current === "playing") {
        reanchor(nextTick);
      } else {
        backendRef.current?.stopAll();
        updateTick(nextTick);
        if (nextTick >= performance.durationTicks) {
          updateStatus("ended");
        } else if (statusRef.current === "ended") {
          updateStatus("paused");
        }
      }
    },
    [
      cancelPendingTransport,
      performance.durationTicks,
      performance.stanzas,
      reanchor,
      updateStatus,
      updateTick,
    ],
  );

  const setBpm = useCallback(
    (nextBpm: number) => {
      cancelPendingTransport();
      const normalized = normalizeBpm(nextBpm);
      const tickBeforeChange = readPlayingTick(true);
      bpmRef.current = normalized;
      setBpmState(normalized);
      if (statusRef.current === "playing") {
        reanchor(tickBeforeChange);
      }
    },
    [cancelPendingTransport, readPlayingTick, reanchor],
  );

  const setVolume = useCallback((nextVolume: number) => {
    const normalized = Math.min(1, Math.max(0, nextVolume));
    volumeRef.current = normalized;
    setVolumeState(normalized);
    backendRef.current?.setVolume(normalized);
  }, []);

  const setLoopStanza = useCallback(
    (enabled: boolean) => {
      loopStanzaRef.current = enabled;
      setLoopStanzaState(enabled);
      loopTargetRef.current = enabled
        ? (findNearestStanza(
            performance.stanzas,
            currentTickRef.current,
          )?.stanzaId ?? null)
        : null;
    },
    [performance.stanzas],
  );

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden && statusRef.current === "playing") pause();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener(
        "visibilitychange",
        onVisibilityChange,
      );
  }, [pause]);

  useEffect(() => {
    disposedRef.current = false;
    return () => {
      disposedRef.current = true;
      clearTransportTimer();
      pendingTransportRef.current = null;
      stopTimers();
      removeBackendListenerRef.current?.();
      removeBackendListenerRef.current = null;
      const backend = backendRef.current;
      backendRef.current = null;
      audioReadyRef.current = false;
      if (backend) void backend.close();
    };
  }, [clearTransportTimer, stopTimers]);

  const activeStanza = useMemo(
    () =>
      currentTick < performance.introTicks
        ? undefined
        : findCueAtTick(performance.stanzas, currentTick) ??
          findNearestStanza(performance.stanzas, currentTick),
    [currentTick, performance.introTicks, performance.stanzas],
  );
  const activeLine = useMemo(
    () => findCueAtTick(performance.lines, currentTick),
    [currentTick, performance.lines],
  );
  const activeToken = useMemo(
    () => findCueAtTick(performance.tokens, currentTick),
    [currentTick, performance.tokens],
  );
  const activeSyllable = useMemo(
    () => findCueAtTick(performance.syllables, currentTick),
    [currentTick, performance.syllables],
  );

  return {
    status,
    currentTick,
    bpm,
    volume,
    loopStanza,
    audioReady,
    error,
    activeStanza,
    activeLine,
    activeToken,
    activeSyllable,
    prepareAudio,
    scheduleTransport,
    getTransportSnapshot,
    play,
    pause,
    toggle,
    restart,
    seek,
    setBpm,
    setVolume,
    setLoopStanza,
  };
}
