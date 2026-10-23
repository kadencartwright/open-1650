import {
  VOICE_LEVELS,
  type PerformanceVoice,
} from "./voices";

export type RuntimeAudioState =
  | AudioContextState
  | "interrupted"
  | "unavailable";

export interface VoiceHandle {
  cancel: (when?: number) => void;
}

export interface NoteSchedule {
  voice: PerformanceVoice;
  midi: number;
  velocity: number;
  when: number;
  duration: number;
}

export interface AudioBackend {
  readonly state: RuntimeAudioState;
  now: () => number;
  outputNow: () => number;
  outputTimeAt: (localPerformanceTimeMs: number) => number;
  resume: () => Promise<void>;
  scheduleNote: (schedule: NoteSchedule) => VoiceHandle;
  startAll: (when?: number) => void;
  stopAll: (when?: number) => void;
  setVolume: (value: number) => void;
  onStateChange: (
    listener: (state: RuntimeAudioState) => void,
  ) => () => void;
  close: () => Promise<void>;
}

type AudioContextWithWebkit = typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function createOrganWave(
  context: AudioContext,
  harmonics: readonly number[],
): PeriodicWave {
  return context.createPeriodicWave(
    new Float32Array(harmonics.length),
    new Float32Array(harmonics),
  );
}

function createRoomImpulse(context: AudioContext): AudioBuffer {
  const seconds = 1.1;
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const impulse = context.createBuffer(2, length, context.sampleRate);

  for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
    const samples = impulse.getChannelData(channel);
    let seed = 0x1650 + channel * 0x9e37;

    for (let index = 0; index < samples.length; index += 1) {
      seed =
        (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
      const noise = (seed / 0xffff_ffff) * 2 - 1;
      const position = index / samples.length;
      const decay = (1 - position) ** 3.2;
      samples[index] = noise * decay;
    }
  }

  return impulse;
}

export class WebAudioBackend implements AudioBackend {
  readonly #context: AudioContext;
  readonly #ownsContext: boolean;
  readonly #principalWave: PeriodicWave;
  readonly #fluteWave: PeriodicWave;
  readonly #voiceBus: GainNode;
  readonly #tone: BiquadFilterNode;
  readonly #dry: GainNode;
  readonly #reverb: ConvolverNode;
  readonly #wet: GainNode;
  readonly #master: GainNode;
  readonly #outputGate: GainNode;
  readonly #voices = new Set<VoiceHandle>();

  constructor(context?: AudioContext) {
    const audioGlobal = globalThis as AudioContextWithWebkit;
    const AudioContextConstructor =
      audioGlobal.AudioContext ?? audioGlobal.webkitAudioContext;

    if (!AudioContextConstructor) {
      throw new Error("This browser does not provide the Web Audio API.");
    }

    this.#ownsContext = !context;
    this.#context = context ?? new AudioContextConstructor({
      latencyHint: "interactive",
    });
    this.#principalWave = createOrganWave(this.#context, [
      0, 1, 0.42, 0.22, 0.125, 0.072, 0.041, 0.023, 0.013,
    ]);
    this.#fluteWave = createOrganWave(this.#context, [
      0, 1, 0, 0.15, 0, 0.045, 0, 0.016, 0,
    ]);

    this.#voiceBus = this.#context.createGain();
    this.#tone = this.#context.createBiquadFilter();
    this.#tone.type = "lowpass";
    this.#tone.frequency.value = 3_600;
    this.#tone.Q.value = 0.45;

    this.#dry = this.#context.createGain();
    this.#dry.gain.value = 0.88;
    this.#reverb = this.#context.createConvolver();
    this.#reverb.buffer = createRoomImpulse(this.#context);
    this.#wet = this.#context.createGain();
    this.#wet.gain.value = 0.13;
    this.#master = this.#context.createGain();
    this.#master.gain.value = 0.75;
    this.#outputGate = this.#context.createGain();
    this.#outputGate.gain.value = 1;

    this.#voiceBus.connect(this.#tone);
    this.#tone.connect(this.#dry);
    this.#dry.connect(this.#master);
    this.#tone.connect(this.#reverb);
    this.#reverb.connect(this.#wet);
    this.#wet.connect(this.#master);
    this.#master.connect(this.#outputGate);
    this.#outputGate.connect(this.#context.destination);
  }

  get state(): RuntimeAudioState {
    return this.#context.state as RuntimeAudioState;
  }

  now(): number {
    return this.#context.currentTime;
  }

  outputNow(): number {
    return Math.min(
      this.#context.currentTime,
      this.outputTimeAt(performance.now()),
    );
  }

  #fallbackOutputTimeAt(localPerformanceTimeMs: number): number {
    const outputLatency = this.#context.outputLatency;
    const estimatedLatency =
      typeof outputLatency === "number" &&
      Number.isFinite(outputLatency) &&
      outputLatency > 0
        ? outputLatency
        : 0;
    return (
      this.#context.currentTime -
      estimatedLatency +
      (localPerformanceTimeMs - performance.now()) / 1_000
    );
  }

  outputTimeAt(localPerformanceTimeMs: number): number {
    const getOutputTimestamp = this.#context.getOutputTimestamp;
    if (typeof getOutputTimestamp !== "function") {
      return this.#fallbackOutputTimeAt(localPerformanceTimeMs);
    }

    const timestamp = getOutputTimestamp.call(this.#context);
    const contextTime = timestamp.contextTime;
    const performanceTime = timestamp.performanceTime;
    if (
      typeof contextTime !== "number" ||
      typeof performanceTime !== "number" ||
      !Number.isFinite(contextTime) ||
      !Number.isFinite(performanceTime) ||
      contextTime < 0 ||
      performanceTime < 0
    ) {
      return this.#fallbackOutputTimeAt(localPerformanceTimeMs);
    }

    return (
      contextTime +
      (localPerformanceTimeMs - performanceTime) / 1_000
    );
  }

  async resume(): Promise<void> {
    if (this.#context.state === "closed") {
      throw new Error("The audio device has already been closed.");
    }
    if (this.#context.state !== "running") {
      await this.#context.resume();
    }
  }

  scheduleNote(schedule: NoteSchedule): VoiceHandle {
    const start = Math.max(this.#context.currentTime, schedule.when);
    const duration = Math.max(0.015, schedule.duration);
    const end = start + duration;
    const attack = Math.min(0.035, duration * 0.18);
    const settle = Math.min(0.09, duration * 0.22);
    const release = Math.min(0.09, duration * 0.28);
    const releaseStart = Math.max(start + attack, end - release);
    const peak =
      clampUnit(schedule.velocity / 127) ** 0.75 *
      0.15 *
      VOICE_LEVELS[schedule.voice];
    const sustain = peak * 0.84;

    const envelope = this.#context.createGain();
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(peak, start + attack);
    envelope.gain.linearRampToValueAtTime(
      sustain,
      Math.min(releaseStart, start + attack + settle),
    );
    envelope.gain.setValueAtTime(sustain, releaseStart);
    envelope.gain.linearRampToValueAtTime(0, end);
    envelope.connect(this.#voiceBus);

    const frequency = midiToFrequency(schedule.midi);
    const ranks = [
      {
        wave: this.#principalWave,
        level: 0.72,
        detune: -1.2,
      },
      {
        wave: this.#fluteWave,
        level: 0.28,
        detune: 1.2,
      },
    ];
    const oscillators = ranks.map((rank) => {
      const oscillator = this.#context.createOscillator();
      const rankGain = this.#context.createGain();
      oscillator.setPeriodicWave(rank.wave);
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.detune.setValueAtTime(rank.detune, start);
      rankGain.gain.setValueAtTime(rank.level, start);
      oscillator.connect(rankGain);
      rankGain.connect(envelope);
      return { oscillator, rankGain };
    });

    let cancelledAt = end + 0.02;
    let endedOscillators = 0;
    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      this.#voices.delete(handle);
      for (const { oscillator, rankGain } of oscillators) {
        oscillator.onended = null;
        oscillator.disconnect();
        rankGain.disconnect();
      }
      envelope.disconnect();
    };
    const handle: VoiceHandle = {
      cancel: (when) => {
        const stopAt = Math.max(
          this.#context.currentTime,
          when ?? this.#context.currentTime,
        );
        if (stopAt >= cancelledAt) return;
        cancelledAt = stopAt;
        for (const { oscillator } of oscillators) {
          try {
            oscillator.stop(stopAt);
          } catch {
            // An oscillator that has already ended needs no further cleanup.
          }
        }
        if (stopAt <= this.#context.currentTime) cleanup();
      },
    };
    this.#voices.add(handle);
    for (const { oscillator } of oscillators) {
      oscillator.onended = () => {
        endedOscillators += 1;
        if (endedOscillators === oscillators.length) cleanup();
      };
      oscillator.start(start);
      oscillator.stop(end + 0.02);
    }
    return handle;
  }

  startAll(when = this.#context.currentTime): void {
    if (this.#context.state === "closed") return;
    const startAt = Math.max(this.#context.currentTime, when);
    this.#outputGate.gain.cancelScheduledValues(startAt);
    this.#outputGate.gain.setValueAtTime(1, startAt);
  }

  stopAll(when = this.#context.currentTime): void {
    if (this.#context.state === "closed") return;
    const stopAt = Math.max(this.#context.currentTime, when);
    this.#outputGate.gain.cancelScheduledValues(stopAt);
    this.#outputGate.gain.setValueAtTime(0, stopAt);
    for (const voice of [...this.#voices]) {
      voice.cancel(stopAt);
    }
  }

  setVolume(value: number): void {
    if (this.#context.state === "closed") return;
    const now = this.#context.currentTime;
    const volume = clampUnit(value);
    this.#master.gain.cancelScheduledValues(now);
    this.#master.gain.setTargetAtTime(volume, now, 0.012);
  }

  onStateChange(
    listener: (state: RuntimeAudioState) => void,
  ): () => void {
    const handleStateChange = () => listener(this.state);
    this.#context.addEventListener("statechange", handleStateChange);
    return () =>
      this.#context.removeEventListener(
        "statechange",
        handleStateChange,
      );
  }

  async close(): Promise<void> {
    this.stopAll();
    this.#voiceBus.disconnect();
    this.#tone.disconnect();
    this.#dry.disconnect();
    this.#reverb.disconnect();
    this.#wet.disconnect();
    this.#master.disconnect();
    this.#outputGate.disconnect();
    if (this.#ownsContext && this.#context.state !== "closed") {
      await this.#context.close();
    }
  }
}

let playbackContext: AudioContext | undefined;
let playbackConstructor: typeof AudioContext | undefined;

export function createWebAudioBackend(): AudioBackend {
  // Retain the gesture-unlocked context between Psalms in a continuous queue.
  // Each player still disposes its own notes, buses, reverb and listeners.
  const audioGlobal = globalThis as AudioContextWithWebkit;
  const Constructor = audioGlobal.AudioContext ?? audioGlobal.webkitAudioContext;
  if (!Constructor) throw new Error("This browser does not provide the Web Audio API.");
  if (!playbackContext || playbackContext.state === "closed" || playbackConstructor !== Constructor) {
    playbackContext = new Constructor({ latencyHint: "interactive" });
    playbackConstructor = Constructor;
  }
  return new WebAudioBackend(playbackContext);
}
