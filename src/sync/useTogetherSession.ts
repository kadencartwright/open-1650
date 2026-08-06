import { useCallback, useEffect, useRef, useState } from "react";
import type { CompiledPerformance } from "../audio/compilePerformance";
import {
  calculateClockSample,
  estimateClockOffset,
  hostToLocalTime,
  localToHostTime,
  type ClockEstimate,
  type ClockSample,
} from "./clock";
import {
  createGuestPeerGroup,
  createHostPeerGroup,
  type PeerGroup,
  type PeerGroupSnapshot,
  type PeerMessage,
} from "./peerGroup";
import {
  isTogetherClockMessage,
  isTogetherControlMessage,
  sameTogetherSelection,
  type TogetherClockMessage,
  type TogetherControlMessage,
  type TogetherSelection,
  type TogetherTransportMessage,
} from "./protocol";
import {
  classifyTickDrift,
  compareTransportVersions,
  projectTransportState,
  type CanonicalTransportState,
  type TransportPlayback,
} from "./transport";

const START_LEAD_MS = 2_000;
const REPOSITION_LEAD_MS = 650;
const PAUSE_LEAD_MS = 220;
const CATCH_UP_LEAD_MS = 350;
const CLOCK_REFRESH_MS = 5_000;
const HEARTBEAT_MS = 1_000;
const MINIMUM_CORRECTION_GAP_MS = 2_500;

export interface TogetherPlayerSnapshot {
  mode: TransportPlayback;
  tick: number;
  bpm: number;
  sampledAtLocalMs: number;
}

export interface TogetherPlayer {
  status: string;
  currentTick: number;
  bpm: number;
  prepareAudio(): Promise<void>;
  scheduleTransport(command: {
    mode: TransportPlayback;
    tick: number;
    bpm: number;
    effectiveAtLocalMs: number;
  }): Promise<void>;
  getTransportSnapshot(): TogetherPlayerSnapshot;
  toggle(): Promise<void>;
  pause?(): void;
  restart(): void;
  seek(tick: number): void;
  setBpm(bpm: number): void;
  setLoopStanza(enabled: boolean): void;
}

interface PlayerBinding {
  player: TogetherPlayer;
  performance: Pick<
    CompiledPerformance,
    "id" | "ppq" | "durationTicks"
  >;
  selection: TogetherSelection;
}

export type TogetherSessionMode = "idle" | "host" | "guest";
export type TogetherConnection =
  | "idle"
  | "connecting"
  | "waiting"
  | "ready"
  | "failed";

export interface TogetherSessionSnapshot {
  mode: TogetherSessionMode;
  roomCode: string | null;
  connection: TogetherConnection;
  deviceCount: number;
  playback: TransportPlayback | null;
  error: string | null;
}

export interface TogetherSession {
  snapshot: TogetherSessionSnapshot;
  attachPlayer(
    player: TogetherPlayer,
    performance: CompiledPerformance,
    selection: TogetherSelection,
  ): () => void;
  startGroup(): Promise<void>;
  joinGroup(roomCode: string): Promise<void>;
  leaveGroup(): Promise<void>;
  toggle(): Promise<void>;
  restart(): void;
  seek(tick: number): void;
  setBpm(bpm: number): void;
}

interface UseTogetherSessionOptions {
  selection: TogetherSelection | null;
  onRemoteSelection(selection: TogetherSelection): void;
}

const idleSnapshot: TogetherSessionSnapshot = {
  mode: "idle",
  roomCode: null,
  connection: "idle",
  deviceCount: 1,
  playback: null,
  error: null,
};

function createEpoch(): number {
  const values = new Uint32Array(2);
  crypto.getRandomValues(values);
  // Fifty-three random bits remain exactly representable as a JS integer.
  return values[0] * 0x20_0000 + (values[1] & 0x1f_ffff);
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error && reason.message
    ? reason.message
    : "The group connection failed.";
}

function sameVersion(
  left: CanonicalTransportState | null,
  right: CanonicalTransportState,
): boolean {
  return (
    left !== null &&
    left.epoch === right.epoch &&
    left.revision === right.revision
  );
}

export function useTogetherSession({
  selection,
  onRemoteSelection,
}: UseTogetherSessionOptions): TogetherSession {
  const [snapshot, setSnapshot] =
    useState<TogetherSessionSnapshot>(idleSnapshot);
  const snapshotRef = useRef(snapshot);
  const selectionRef = useRef(selection);
  const onRemoteSelectionRef = useRef(onRemoteSelection);
  const bindingRef = useRef<PlayerBinding | null>(null);
  const groupRef = useRef<
    PeerGroup<TogetherControlMessage, TogetherClockMessage> | null
  >(null);
  const groupDisposersRef = useRef<Array<() => void>>([]);
  const canonicalRef = useRef<CanonicalTransportState | null>(null);
  const canonicalSelectionRef = useRef<TogetherSelection | null>(null);
  const committedCanonicalRef = useRef<CanonicalTransportState | null>(null);
  const committedSelectionRef = useRef<TogetherSelection | null>(null);
  const pendingRemoteRef = useRef<TogetherTransportMessage | null>(null);
  const requestedSelectionRef = useRef<TogetherSelection | null>(null);
  const appliedRemoteRef = useRef<CanonicalTransportState | null>(null);
  const clockSamplesRef = useRef<ClockSample[]>([]);
  const clockEstimateRef = useRef<ClockEstimate | null>(null);
  const clockPingIdRef = useRef(0);
  const pendingClockPingsRef = useRef(new Map<number, number>());
  const clockTimeoutsRef = useRef(new Set<number>());
  const clockIntervalRef = useRef<number | null>(null);
  const heartbeatRef = useRef<number | null>(null);
  const clockStartedRef = useRef(false);
  const readySentForRef = useRef<string | null>(null);
  const lastCorrectionAtRef = useRef(Number.NEGATIVE_INFINITY);
  const applyingRemoteRef = useRef(false);
  const hostCommandChainRef = useRef<Promise<void>>(Promise.resolve());
  const hostCorrectionPendingRef = useRef(false);
  const guestAudioCommandChainRef = useRef<Promise<void>>(Promise.resolve());
  const guestLeaveCleanupRef = useRef<Promise<void> | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const wakeLockRequestPendingRef = useRef(false);
  const requestWakeLockFunctionRef = useRef<() => void>(() => undefined);
  const operationGenerationRef = useRef(0);

  snapshotRef.current = snapshot;
  selectionRef.current = selection;
  onRemoteSelectionRef.current = onRemoteSelection;
  if (sameTogetherSelection(selection, requestedSelectionRef.current)) {
    requestedSelectionRef.current = null;
  }

  const updateSnapshot = useCallback(
    (patch: Partial<TogetherSessionSnapshot>) => {
      const next = { ...snapshotRef.current, ...patch };
      snapshotRef.current = next;
      setSnapshot(next);
    },
    [],
  );

  const clearTimers = useCallback(() => {
    for (const timeout of clockTimeoutsRef.current) {
      window.clearTimeout(timeout);
    }
    clockTimeoutsRef.current.clear();
    if (clockIntervalRef.current !== null) {
      window.clearInterval(clockIntervalRef.current);
      clockIntervalRef.current = null;
    }
    if (heartbeatRef.current !== null) {
      window.clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  const requestWakeLock = useCallback(async () => {
    if (
      document.visibilityState !== "visible" ||
      !("wakeLock" in navigator) ||
      wakeLockRef.current ||
      wakeLockRequestPendingRef.current
    ) {
      return;
    }
    const generation = operationGenerationRef.current;
    wakeLockRequestPendingRef.current = true;
    try {
      const sentinel = await navigator.wakeLock.request("screen");
      if (
        generation !== operationGenerationRef.current ||
        snapshotRef.current.mode === "idle"
      ) {
        await sentinel.release();
        return;
      }
      wakeLockRef.current = sentinel;
      sentinel.addEventListener(
        "release",
        () => {
          if (wakeLockRef.current === sentinel) wakeLockRef.current = null;
        },
        { once: true },
      );
    } catch {
      // Playback remains usable when wake lock is unavailable or denied.
    } finally {
      wakeLockRequestPendingRef.current = false;
      if (
        generation !== operationGenerationRef.current &&
        snapshotRef.current.mode !== "idle" &&
        !wakeLockRef.current
      ) {
        queueMicrotask(() => requestWakeLockFunctionRef.current());
      }
    }
  }, []);
  requestWakeLockFunctionRef.current = () => {
    void requestWakeLock();
  };

  const closeGroup = useCallback(() => {
    operationGenerationRef.current += 1;
    clearTimers();
    for (const dispose of groupDisposersRef.current.splice(0)) dispose();
    groupRef.current?.close();
    groupRef.current = null;
    canonicalRef.current = null;
    canonicalSelectionRef.current = null;
    committedCanonicalRef.current = null;
    committedSelectionRef.current = null;
    pendingRemoteRef.current = null;
    requestedSelectionRef.current = null;
    appliedRemoteRef.current = null;
    clockSamplesRef.current = [];
    clockEstimateRef.current = null;
    pendingClockPingsRef.current.clear();
    clockStartedRef.current = false;
    readySentForRef.current = null;
    lastCorrectionAtRef.current = Number.NEGATIVE_INFINITY;
    hostCommandChainRef.current = Promise.resolve();
    hostCorrectionPendingRef.current = false;
    const wakeLock = wakeLockRef.current;
    wakeLockRef.current = null;
    if (wakeLock) void wakeLock.release();
  }, [clearTimers]);

  const setFailure = useCallback(
    (reason: unknown) => {
      updateSnapshot({ connection: "failed", error: errorMessage(reason) });
    },
    [updateSnapshot],
  );

  const broadcastCanonical = useCallback((kind: "hello" | "transport") => {
    const group = groupRef.current;
    const currentSelection = committedSelectionRef.current;
    const transport = committedCanonicalRef.current;
    if (!group || group.role !== "host" || !currentSelection || !transport) {
      return;
    }
    group.sendControl({ kind, selection: currentSelection, transport });
  }, []);

  const refreshGuestReady = useCallback(() => {
    if (snapshotRef.current.mode !== "guest") return;
    if (snapshotRef.current.connection === "failed") return;
    const group = groupRef.current;
    const binding = bindingRef.current;
    const remoteSelection = canonicalSelectionRef.current;
    const isReady = Boolean(
      group?.ready &&
        clockEstimateRef.current &&
        binding &&
        remoteSelection &&
        sameTogetherSelection(binding.selection, remoteSelection),
    );
    updateSnapshot({ connection: isReady ? "ready" : "connecting" });

    if (
      isReady &&
      binding &&
      readySentForRef.current !== binding.performance.id
    ) {
      group?.sendControl({
        kind: "ready",
        performanceId: binding.performance.id,
      });
      readySentForRef.current = binding.performance.id;
    }
  }, [updateSnapshot]);

  const requestRemoteSelection = useCallback(
    (nextSelection: TogetherSelection) => {
      if (sameTogetherSelection(selectionRef.current, nextSelection)) return;
      if (
        sameTogetherSelection(requestedSelectionRef.current, nextSelection)
      ) {
        return;
      }
      requestedSelectionRef.current = nextSelection;
      onRemoteSelectionRef.current(nextSelection);
    },
    [],
  );

  const pauseGuestAudio = useCallback((): Promise<void> => {
    const binding = bindingRef.current;
    if (!binding) return Promise.resolve();
    if (snapshotRef.current.mode === "guest") {
      updateSnapshot({ playback: "paused" });
    }
    const pauseCommand = guestAudioCommandChainRef.current.then(() => {
      const current = binding.player.getTransportSnapshot();
      return binding.player.scheduleTransport({
        mode: "paused",
        tick: current.tick,
        bpm: current.bpm,
        effectiveAtLocalMs: performance.now() + 20,
      });
    });
    const safePause = pauseCommand.then(
      () => undefined,
      () => undefined,
    );
    guestAudioCommandChainRef.current = safePause;
    return safePause;
  }, [updateSnapshot]);

  const releaseDisconnectedGuest = useCallback(() => {
    const cleanup = pauseGuestAudio();
    guestLeaveCleanupRef.current = cleanup;
    closeGroup();
    snapshotRef.current = idleSnapshot;
    setSnapshot(idleSnapshot);
    void cleanup.finally(() => {
      if (guestLeaveCleanupRef.current === cleanup) {
        guestLeaveCleanupRef.current = null;
      }
    });
  }, [closeGroup, pauseGuestAudio]);

  const applyPendingRemote = useCallback(async () => {
    if (applyingRemoteRef.current) return;
    const message = pendingRemoteRef.current;
    if (
      !message ||
      snapshotRef.current.mode !== "guest" ||
      snapshotRef.current.connection === "failed"
    ) {
      return;
    }

    const binding = bindingRef.current;
    const estimate = clockEstimateRef.current;
    if (!sameTogetherSelection(selectionRef.current, message.selection)) {
      requestRemoteSelection(message.selection);
      return;
    }
    if (
      !binding ||
      !sameTogetherSelection(binding.selection, message.selection) ||
      !estimate
    ) {
      return;
    }

    const applyGeneration = operationGenerationRef.current;
    applyingRemoteRef.current = true;
    try {
      const transport = message.transport;
      const previouslyApplied = sameVersion(appliedRemoteRef.current, transport);
      const now = performance.now();
      const originalLocalEffective = hostToLocalTime(
        transport.effectiveHostMs,
        estimate.offsetMs,
      );
      const playerSnapshot = binding.player.getTransportSnapshot();
      const beforeEffective = now + 20 < originalLocalEffective;
      let shouldSchedule = !previouslyApplied;

      if (previouslyApplied && !beforeEffective) {
        const expected = projectTransportState(
          transport,
          localToHostTime(playerSnapshot.sampledAtLocalMs, estimate.offsetMs),
          binding.performance.ppq,
          binding.performance.durationTicks,
        );
        const drift = classifyTickDrift({
          localTick: playerSnapshot.tick,
          targetTick: expected.tick,
          bpm: transport.bpm,
          ppq: binding.performance.ppq,
        });
        const modeChanged = playerSnapshot.mode !== transport.playback;
        const tempoChanged = playerSnapshot.bpm !== transport.bpm;
        const correctionDue =
          now - lastCorrectionAtRef.current >= MINIMUM_CORRECTION_GAP_MS;
        shouldSchedule =
          modeChanged ||
          tempoChanged ||
          (correctionDue &&
            (drift.kind === "hard-resync" ||
              (drift.kind === "slew" && Math.abs(drift.driftMs) >= 45)));
      }

      if (!shouldSchedule) {
        if (pendingRemoteRef.current === message) {
          pendingRemoteRef.current = null;
        }
        refreshGuestReady();
        return;
      }

      const effectiveAtLocalMs = beforeEffective
        ? originalLocalEffective
        : now +
          (transport.playback === "playing" ? CATCH_UP_LEAD_MS : 30);
      const projected = projectTransportState(
        transport,
        localToHostTime(effectiveAtLocalMs, estimate.offsetMs),
        binding.performance.ppq,
        binding.performance.durationTicks,
      );
      const command = guestAudioCommandChainRef.current.then(async () => {
        if (
          applyGeneration !== operationGenerationRef.current ||
          snapshotRef.current.mode !== "guest" ||
          snapshotRef.current.connection === "failed" ||
          bindingRef.current !== binding
        ) {
          return false;
        }
        await binding.player.scheduleTransport({
          mode: transport.playback,
          tick: projected.tick,
          bpm: transport.bpm,
          effectiveAtLocalMs,
        });
        return true;
      });
      guestAudioCommandChainRef.current = command.then(
        () => undefined,
        () => undefined,
      );
      const applied = await command;
      if (
        !applied ||
        applyGeneration !== operationGenerationRef.current ||
        snapshotRef.current.mode !== "guest" ||
        bindingRef.current !== binding
      ) {
        return;
      }
      appliedRemoteRef.current = transport;
      lastCorrectionAtRef.current = now;
      if (pendingRemoteRef.current === message) {
        pendingRemoteRef.current = null;
      }
      updateSnapshot({ error: null });
      refreshGuestReady();
    } catch (reason) {
      if (pendingRemoteRef.current === message) {
        pendingRemoteRef.current = null;
      }
      if (
        applyGeneration === operationGenerationRef.current &&
        snapshotRef.current.mode === "guest" &&
        bindingRef.current === binding
      ) {
        setFailure(reason);
        void pauseGuestAudio();
      }
    } finally {
      applyingRemoteRef.current = false;
      // A newer packet may have arrived while Web Audio was being prepared.
      if (pendingRemoteRef.current) void applyPendingRemote();
    }
  }, [
    pauseGuestAudio,
    refreshGuestReady,
    requestRemoteSelection,
    setFailure,
    updateSnapshot,
  ]);

  const receiveRemoteTransport = useCallback(
    (message: TogetherTransportMessage) => {
      if (
        snapshotRef.current.mode !== "guest" ||
        snapshotRef.current.connection === "failed"
      ) {
        return;
      }
      const current = canonicalRef.current;
      if (
        current &&
        compareTransportVersions(message.transport, current) < 0
      ) {
        return;
      }
      canonicalRef.current = message.transport;
      canonicalSelectionRef.current = message.selection;
      pendingRemoteRef.current = message;
      updateSnapshot({ playback: message.transport.playback });
      void applyPendingRemote();
    },
    [applyPendingRemote, updateSnapshot],
  );

  const handleControl = useCallback(
    (message: PeerMessage<TogetherControlMessage>) => {
      if (!isTogetherControlMessage(message.payload)) return;
      if (snapshotRef.current.mode === "host") {
        // Guests never have transport authority. `ready` is only an
        // application-level acknowledgement; channel readiness drives counts.
        if (message.payload.kind === "ready") broadcastCanonical("hello");
        return;
      }
      if (
        message.payload.kind === "hello" ||
        message.payload.kind === "transport"
      ) {
        receiveRemoteTransport({
          kind: "transport",
          selection: message.payload.selection,
          transport: message.payload.transport,
        });
      }
    },
    [broadcastCanonical, receiveRemoteTransport],
  );

  const handleClock = useCallback(
    (message: PeerMessage<TogetherClockMessage>) => {
      if (!isTogetherClockMessage(message.payload)) return;
      const group = groupRef.current;
      if (!group) return;

      if (snapshotRef.current.mode === "host") {
        if (message.payload.kind !== "ping") return;
        group.sendClock(
          {
            kind: "pong",
            id: message.payload.id,
            localSendMs: message.payload.localSendMs,
            hostReceiveMs: message.receivedAt,
            hostSendMs: performance.now(),
          },
          message.peerId,
        );
        return;
      }

      if (message.payload.kind !== "pong") return;
      const localSendMs = pendingClockPingsRef.current.get(message.payload.id);
      if (localSendMs === undefined) return;
      pendingClockPingsRef.current.delete(message.payload.id);
      try {
        const sample = calculateClockSample({
          localSendMs,
          hostReceiveMs: message.payload.hostReceiveMs,
          hostSendMs: message.payload.hostSendMs,
          localReceiveMs: message.receivedAt,
        });
        clockSamplesRef.current = [
          ...clockSamplesRef.current.slice(-31),
          sample,
        ];
        if (clockSamplesRef.current.length >= 3) {
          clockEstimateRef.current = estimateClockOffset(
            clockSamplesRef.current,
          );
          refreshGuestReady();
          void applyPendingRemote();
        }
      } catch {
        // A single delayed or malformed observation is disposable.
      }
    },
    [applyPendingRemote, refreshGuestReady],
  );

  const sendClockBurst = useCallback((count: number, spacingMs: number) => {
    for (let index = 0; index < count; index += 1) {
      const timeout = window.setTimeout(() => {
        clockTimeoutsRef.current.delete(timeout);
        const group = groupRef.current;
        if (!group || snapshotRef.current.mode !== "guest" || !group.ready) {
          return;
        }
        const id = clockPingIdRef.current++;
        const localSendMs = performance.now();
        if (pendingClockPingsRef.current.size >= 64) {
          const oldest = pendingClockPingsRef.current.keys().next().value;
          if (oldest !== undefined) {
            pendingClockPingsRef.current.delete(oldest);
          }
        }
        pendingClockPingsRef.current.set(id, localSendMs);
        group.sendClock({ kind: "ping", id, localSendMs });
      }, index * spacingMs);
      clockTimeoutsRef.current.add(timeout);
    }
  }, []);

  const handlePeerSnapshot = useCallback(
    (peerSnapshot: PeerGroupSnapshot) => {
      if (snapshotRef.current.mode === "host") {
        updateSnapshot({
          connection:
            peerSnapshot.state === "failed"
              ? "failed"
              : peerSnapshot.readyPeerCount > 0
                ? "ready"
                : "waiting",
          deviceCount: 1 + peerSnapshot.readyPeerCount,
        });
        if (peerSnapshot.readyPeerCount > 0) broadcastCanonical("hello");
        return;
      }

      updateSnapshot({
        connection: peerSnapshot.state === "failed" ? "failed" : "connecting",
        deviceCount: peerSnapshot.ready ? 2 : 1,
        ...(peerSnapshot.state === "failed" ? { playback: "paused" as const } : {}),
      });
      if (peerSnapshot.state === "failed") {
        if (peerSnapshot.signalingState === "open") {
          releaseDisconnectedGuest();
          return;
        }
        void pauseGuestAudio();
        return;
      }
      if (peerSnapshot.ready && !clockStartedRef.current) {
        clockStartedRef.current = true;
        sendClockBurst(12, 70);
        clockIntervalRef.current = window.setInterval(
          () => sendClockBurst(4, 80),
          CLOCK_REFRESH_MS,
        );
      }
      refreshGuestReady();
    },
    [
      broadcastCanonical,
      pauseGuestAudio,
      refreshGuestReady,
      releaseDisconnectedGuest,
      sendClockBurst,
      updateSnapshot,
    ],
  );

  const handlePeerError = useCallback(
    (error: Error) => {
      const wasGuest = snapshotRef.current.mode === "guest";
      setFailure(error);
      if (wasGuest) void pauseGuestAudio();
    },
    [pauseGuestAudio, setFailure],
  );

  const bindGroup = useCallback(
    (
      group: PeerGroup<TogetherControlMessage, TogetherClockMessage>,
    ) => {
      groupRef.current = group;
      groupDisposersRef.current = [
        group.onControl(handleControl),
        group.onClock(handleClock),
        group.onError(handlePeerError),
        group.subscribe(handlePeerSnapshot),
      ];
      handlePeerSnapshot(group.snapshot);
    },
    [handleClock, handleControl, handlePeerError, handlePeerSnapshot],
  );

  const heartbeatHost = useCallback(() => {
    if (snapshotRef.current.mode !== "host") return;
    const binding = bindingRef.current;
    const desired = canonicalRef.current;
    const committed = committedCanonicalRef.current;
    if (
      binding &&
      desired &&
      committed &&
      desired === committed &&
      committed.playback === "playing" &&
      binding.player.status === "ended" &&
      performance.now() >= committed.effectiveHostMs + 50
    ) {
      const ended: CanonicalTransportState = {
        epoch: committed.epoch,
        revision: committed.revision + 1,
        playback: "paused",
        tick: binding.performance.durationTicks,
        bpm: committed.bpm,
        effectiveHostMs: performance.now(),
      };
      canonicalRef.current = ended;
      committedCanonicalRef.current = ended;
      canonicalSelectionRef.current = binding.selection;
      committedSelectionRef.current = binding.selection;
      updateSnapshot({ playback: "paused" });
    }

    const activeAnchor = committedCanonicalRef.current;
    if (
      binding &&
      activeAnchor &&
      canonicalRef.current === activeAnchor &&
      activeAnchor.playback === "playing" &&
      binding.player.status !== "ended" &&
      performance.now() >= activeAnchor.effectiveHostMs + 50 &&
      !hostCorrectionPendingRef.current
    ) {
      const local = binding.player.getTransportSnapshot();
      const expected = projectTransportState(
        activeAnchor,
        local.sampledAtLocalMs,
        binding.performance.ppq,
        binding.performance.durationTicks,
      );
      const drift = classifyTickDrift({
        localTick: local.tick,
        targetTick: expected.tick,
        bpm: activeAnchor.bpm,
        ppq: binding.performance.ppq,
      });
      if (
        local.mode !== "playing" ||
        local.bpm !== activeAnchor.bpm ||
        drift.kind === "hard-resync" ||
        (drift.kind === "slew" && Math.abs(drift.driftMs) >= 45)
      ) {
        const generation = operationGenerationRef.current;
        const effectiveAtLocalMs = performance.now() + CATCH_UP_LEAD_MS;
        const target = projectTransportState(
          activeAnchor,
          effectiveAtLocalMs,
          binding.performance.ppq,
          binding.performance.durationTicks,
        );
        hostCorrectionPendingRef.current = true;
        const correction = hostCommandChainRef.current.then(async () => {
          if (
            generation !== operationGenerationRef.current ||
            snapshotRef.current.mode !== "host" ||
            bindingRef.current !== binding ||
            canonicalRef.current !== activeAnchor
          ) {
            return;
          }
          await binding.player.scheduleTransport({
            mode: "playing",
            tick: target.tick,
            bpm: activeAnchor.bpm,
            effectiveAtLocalMs,
          });
        });
        const safeCorrection = correction
          .catch((reason: unknown) => {
            if (generation === operationGenerationRef.current) {
              setFailure(reason);
            }
          })
          .finally(() => {
            hostCorrectionPendingRef.current = false;
          });
        hostCommandChainRef.current = safeCorrection;
      }
    }
    broadcastCanonical("transport");
  }, [broadcastCanonical, setFailure, updateSnapshot]);

  const startGroup = useCallback(async () => {
    const binding = bindingRef.current;
    if (!binding) throw new Error("Open a singable Psalm first.");
    if (typeof RTCPeerConnection !== "function") {
      throw new Error("This browser does not support peer playback.");
    }
    closeGroup();
    const generation = operationGenerationRef.current;
    updateSnapshot({ ...idleSnapshot, connection: "connecting", error: null });
    try {
      const priorGuestCleanup = guestLeaveCleanupRef.current;
      if (priorGuestCleanup) {
        await priorGuestCleanup;
        if (generation !== operationGenerationRef.current) return;
      }
      await binding.player.prepareAudio();
      if (generation !== operationGenerationRef.current) return;
      binding.player.setLoopStanza(false);
      const transport = binding.player.getTransportSnapshot();
      canonicalRef.current = {
        epoch: createEpoch(),
        revision: 0,
        playback: transport.mode,
        tick: transport.tick,
        bpm: transport.bpm,
        effectiveHostMs: transport.sampledAtLocalMs,
      };
      canonicalSelectionRef.current = binding.selection;
      committedCanonicalRef.current = canonicalRef.current;
      committedSelectionRef.current = binding.selection;
      const group = createHostPeerGroup<
        TogetherControlMessage,
        TogetherClockMessage
      >({ maxGuests: 3 });
      if (generation !== operationGenerationRef.current) {
        group.close();
        return;
      }
      updateSnapshot({
        mode: "host",
        roomCode: group.roomCode,
        connection: "waiting",
        deviceCount: 1,
        playback: transport.mode,
        error: null,
      });
      bindGroup(group);
      void requestWakeLock();
      heartbeatRef.current = window.setInterval(
        heartbeatHost,
        HEARTBEAT_MS,
      );
    } catch (reason) {
      if (generation !== operationGenerationRef.current) return;
      closeGroup();
      setSnapshot(idleSnapshot);
      snapshotRef.current = idleSnapshot;
      throw reason;
    }
  }, [
    bindGroup,
    closeGroup,
    heartbeatHost,
    requestWakeLock,
    updateSnapshot,
  ]);

  const joinGroup = useCallback(
    async (roomCode: string) => {
      const binding = bindingRef.current;
      if (!binding) throw new Error("Open a singable Psalm first.");
      if (typeof RTCPeerConnection !== "function") {
        throw new Error("This browser does not support peer playback.");
      }
      closeGroup();
      const generation = operationGenerationRef.current;
      updateSnapshot({ ...idleSnapshot, connection: "connecting", error: null });
      try {
        const priorGuestCleanup = guestLeaveCleanupRef.current;
        if (priorGuestCleanup) {
          await priorGuestCleanup;
          if (generation !== operationGenerationRef.current) return;
        }
        if (binding.player.getTransportSnapshot().mode === "playing") {
          binding.player.pause?.();
        }
        await binding.player.prepareAudio();
        if (generation !== operationGenerationRef.current) return;
        binding.player.setLoopStanza(false);
        const group = createGuestPeerGroup<
          TogetherControlMessage,
          TogetherClockMessage
        >({ roomCode });
        if (generation !== operationGenerationRef.current) {
          group.close();
          return;
        }
        updateSnapshot({
          mode: "guest",
          roomCode: group.roomCode,
          connection: "connecting",
          deviceCount: 1,
          playback: null,
          error: null,
        });
        bindGroup(group);
        void requestWakeLock();
      } catch (reason) {
        if (generation !== operationGenerationRef.current) return;
        closeGroup();
        setSnapshot(idleSnapshot);
        snapshotRef.current = idleSnapshot;
        throw reason;
      }
    },
    [
      bindGroup,
      closeGroup,
      requestWakeLock,
      updateSnapshot,
    ],
  );

  const leaveGroup = useCallback(async () => {
    const wasGuest = snapshotRef.current.mode === "guest";
    closeGroup();
    setSnapshot(idleSnapshot);
    snapshotRef.current = idleSnapshot;
    if (wasGuest) {
      const cleanup = pauseGuestAudio();
      guestLeaveCleanupRef.current = cleanup;
      await cleanup;
      if (guestLeaveCleanupRef.current === cleanup) {
        guestLeaveCleanupRef.current = null;
      }
    }
  }, [closeGroup, pauseGuestAudio]);

  const issueHostTransport = useCallback(
    async (
      playback: TransportPlayback,
      tick: number,
      bpm: number,
      effectiveHostMs: number,
    ) => {
      const binding = bindingRef.current;
      const current = canonicalRef.current;
      if (!binding || !current || snapshotRef.current.mode !== "host") return;
      const transport: CanonicalTransportState = {
        epoch: current.epoch,
        revision: current.revision + 1,
        playback,
        tick: Math.min(Math.max(0, tick), binding.performance.durationTicks),
        bpm,
        effectiveHostMs,
      };
      // Reserve the revision before yielding. Rapid taps then form a strict
      // sequence, and only the newest reservation reaches Web Audio.
      canonicalRef.current = transport;
      canonicalSelectionRef.current = binding.selection;
      updateSnapshot({ playback, error: null });
      const generation = operationGenerationRef.current;
      const command = hostCommandChainRef.current.then(async () => {
        if (
          generation !== operationGenerationRef.current ||
          canonicalRef.current !== transport
        ) {
          return;
        }
        try {
          await binding.player.scheduleTransport({
            mode: playback,
            tick: transport.tick,
            bpm,
            effectiveAtLocalMs: effectiveHostMs,
          });
          if (
            generation !== operationGenerationRef.current ||
            bindingRef.current !== binding
          ) {
            return;
          }
          committedCanonicalRef.current = transport;
          committedSelectionRef.current = binding.selection;
          if (canonicalRef.current === transport) {
            broadcastCanonical("transport");
          }
        } catch (reason) {
          if (
            generation === operationGenerationRef.current &&
            canonicalRef.current === transport
          ) {
            canonicalRef.current = committedCanonicalRef.current;
            canonicalSelectionRef.current = committedSelectionRef.current;
            updateSnapshot({
              playback: committedCanonicalRef.current?.playback ?? null,
            });
            broadcastCanonical("transport");
            setFailure(reason);
          }
        }
      });
      hostCommandChainRef.current = command.catch(() => undefined);
      await command;
    },
    [broadcastCanonical, setFailure, updateSnapshot],
  );

  const toggle = useCallback(async () => {
    const binding = bindingRef.current;
    if (!binding) return;
    if (snapshotRef.current.mode === "idle") {
      await binding.player.toggle();
      return;
    }
    if (snapshotRef.current.mode === "guest") return;

    const current = canonicalRef.current;
    if (!current) return;
    if (current.playback === "playing") {
      const effective = performance.now() + PAUSE_LEAD_MS;
      const tick = projectTransportState(
        current,
        effective,
        binding.performance.ppq,
        binding.performance.durationTicks,
      ).tick;
      await issueHostTransport("paused", tick, current.bpm, effective);
    } else {
      const startTick =
        current.tick >= binding.performance.durationTicks ? 0 : current.tick;
      await issueHostTransport(
        "playing",
        startTick,
        current.bpm,
        performance.now() + START_LEAD_MS,
      );
    }
  }, [issueHostTransport]);

  const restart = useCallback(() => {
    const binding = bindingRef.current;
    if (!binding) return;
    if (snapshotRef.current.mode === "idle") {
      binding.player.restart();
      return;
    }
    if (snapshotRef.current.mode === "guest") return;
    const current = canonicalRef.current;
    if (!current) return;
    void issueHostTransport(
      current.playback,
      0,
      current.bpm,
      performance.now() +
        (current.playback === "playing" ? REPOSITION_LEAD_MS : 30),
    );
  }, [issueHostTransport]);

  const seek = useCallback(
    (tick: number) => {
      const binding = bindingRef.current;
      if (!binding) return;
      if (snapshotRef.current.mode === "idle") {
        binding.player.seek(tick);
        return;
      }
      if (snapshotRef.current.mode === "guest") return;
      const current = canonicalRef.current;
      if (!current) return;
      void issueHostTransport(
        current.playback,
        tick,
        current.bpm,
        performance.now() +
          (current.playback === "playing" ? REPOSITION_LEAD_MS : 30),
      );
    },
    [issueHostTransport],
  );

  const setBpm = useCallback(
    (bpm: number) => {
      const binding = bindingRef.current;
      if (!binding) return;
      if (snapshotRef.current.mode === "idle") {
        binding.player.setBpm(bpm);
        return;
      }
      if (snapshotRef.current.mode === "guest") return;
      const current = canonicalRef.current;
      if (!current) return;
      const effective =
        performance.now() +
        (current.playback === "playing" ? REPOSITION_LEAD_MS : 30);
      const tick =
        current.playback === "playing"
          ? projectTransportState(
              current,
              effective,
              binding.performance.ppq,
              binding.performance.durationTicks,
            ).tick
          : current.tick;
      void issueHostTransport(current.playback, tick, bpm, effective);
    },
    [issueHostTransport],
  );

  const attachPlayer = useCallback(
    (
      player: TogetherPlayer,
      compiled: CompiledPerformance,
      attachedSelection: TogetherSelection,
    ) => {
      const binding: PlayerBinding = {
        player,
        performance: compiled,
        selection: attachedSelection,
      };
      bindingRef.current = binding;

      if (
        snapshotRef.current.mode === "host" &&
        !sameTogetherSelection(
          canonicalSelectionRef.current,
          attachedSelection,
        )
      ) {
        const current = canonicalRef.current;
        if (current) {
          const transport: CanonicalTransportState = {
            epoch: current.epoch,
            revision: current.revision + 1,
            playback: "paused",
            tick: 0,
            bpm: player.bpm,
            effectiveHostMs: performance.now() + 30,
          };
          canonicalRef.current = transport;
          canonicalSelectionRef.current = attachedSelection;
          updateSnapshot({ playback: "paused" });
          readySentForRef.current = null;
          const generation = operationGenerationRef.current;
          const command = hostCommandChainRef.current.then(async () => {
            if (
              generation !== operationGenerationRef.current ||
              canonicalRef.current !== transport ||
              bindingRef.current !== binding
            ) {
              return;
            }
            try {
              await player.scheduleTransport({
                mode: "paused",
                tick: 0,
                bpm: player.bpm,
                effectiveAtLocalMs: transport.effectiveHostMs,
              });
              if (
                generation !== operationGenerationRef.current ||
                bindingRef.current !== binding
              ) {
                return;
              }
              committedCanonicalRef.current = transport;
              committedSelectionRef.current = attachedSelection;
              if (canonicalRef.current === transport) {
                broadcastCanonical("hello");
              }
            } catch (reason) {
              if (
                generation === operationGenerationRef.current &&
                canonicalRef.current === transport
              ) {
                canonicalRef.current = committedCanonicalRef.current;
                canonicalSelectionRef.current = committedSelectionRef.current;
                updateSnapshot({
                  playback: committedCanonicalRef.current?.playback ?? null,
                });
                setFailure(reason);
              }
            }
          });
          hostCommandChainRef.current = command.catch(() => undefined);
        }
      } else if (snapshotRef.current.mode === "guest") {
        readySentForRef.current = null;
        void applyPendingRemote();
        refreshGuestReady();
      }

      return () => {
        if (bindingRef.current === binding) bindingRef.current = null;
      };
    },
    [
      applyPendingRemote,
      broadcastCanonical,
      refreshGuestReady,
      setFailure,
      updateSnapshot,
    ],
  );

  useEffect(() => {
    if (snapshotRef.current.mode === "guest") void applyPendingRemote();
  }, [applyPendingRemote, selection?.performanceId]);

  useEffect(
    () => () => {
      closeGroup();
    },
    [closeGroup],
  );

  useEffect(() => {
    const onVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        snapshotRef.current.mode !== "idle"
      ) {
        void requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [requestWakeLock]);

  return {
    snapshot,
    attachPlayer,
    startGroup,
    joinGroup,
    leaveGroup,
    toggle,
    restart,
    seek,
    setBpm,
  };
}
