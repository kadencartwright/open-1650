import { afterEach, describe, expect, it, vi } from "vitest";
import { WebAudioBackend } from "../src/audio/webAudioBackend";

class FakeAudioParam {
  value = 0;
  readonly events: Array<{
    type: "cancel" | "set" | "linear" | "target";
    value?: number;
    time: number;
  }> = [];

  cancelScheduledValues(time: number) {
    this.events.push({ type: "cancel", time });
  }

  setValueAtTime(value: number, time: number) {
    this.value = value;
    this.events.push({ type: "set", value, time });
  }

  linearRampToValueAtTime(value: number, time: number) {
    this.value = value;
    this.events.push({ type: "linear", value, time });
  }

  setTargetAtTime(value: number, time: number) {
    this.value = value;
    this.events.push({ type: "target", value, time });
  }
}

class FakeNode {
  readonly gain = new FakeAudioParam();
  readonly frequency = new FakeAudioParam();
  readonly detune = new FakeAudioParam();
  readonly Q = new FakeAudioParam();
  type = "sine";
  buffer: FakeAudioBuffer | null = null;
  onended: (() => void) | null = null;
  disconnected = false;
  readonly starts: number[] = [];
  readonly stops: number[] = [];

  connect() {
    return this;
  }

  disconnect() {
    this.disconnected = true;
  }

  setPeriodicWave() {}

  start(when: number) {
    this.starts.push(when);
  }

  stop(when: number) {
    this.stops.push(when);
  }
}

class FakeAudioBuffer {
  readonly numberOfChannels: number;
  readonly #channels: Float32Array[];

  constructor(numberOfChannels: number, length: number) {
    this.numberOfChannels = numberOfChannels;
    this.#channels = Array.from(
      { length: numberOfChannels },
      () => new Float32Array(length),
    );
  }

  getChannelData(channel: number) {
    return this.#channels[channel];
  }
}

interface FakeTimestamp {
  contextTime: number;
  performanceTime: number;
}

class FakeAudioContext extends EventTarget {
  static instances: FakeAudioContext[] = [];

  state: AudioContextState = "running";
  currentTime = 10;
  sampleRate = 1_000;
  destination = {};
  timestamp: FakeTimestamp = {
    contextTime: 8,
    performanceTime: 1_000,
  };
  readonly gains: FakeNode[] = [];
  readonly oscillators: FakeNode[] = [];

  constructor() {
    super();
    FakeAudioContext.instances.push(this);
  }

  createGain() {
    const node = new FakeNode();
    this.gains.push(node);
    return node;
  }

  createOscillator() {
    const node = new FakeNode();
    this.oscillators.push(node);
    return node;
  }

  createBiquadFilter() {
    return new FakeNode();
  }

  createConvolver() {
    return new FakeNode();
  }

  createBuffer(numberOfChannels: number, length: number) {
    return new FakeAudioBuffer(numberOfChannels, length);
  }

  createPeriodicWave() {
    return {};
  }

  getOutputTimestamp() {
    return this.timestamp;
  }

  async resume() {
    this.state = "running";
  }

  async close() {
    this.state = "closed";
  }
}

const originalAudioContext = globalThis.AudioContext;

function installAudioContext() {
  FakeAudioContext.instances = [];
  Object.defineProperty(globalThis, "AudioContext", {
    configurable: true,
    value: FakeAudioContext,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(globalThis, "AudioContext", {
    configurable: true,
    value: originalAudioContext,
  });
});

describe("WebAudioBackend synchronized timing", () => {
  it("maps performance timestamps onto the audible AudioContext clock", () => {
    installAudioContext();
    vi.spyOn(globalThis.performance, "now").mockReturnValue(2_000);
    const backend = new WebAudioBackend();

    expect(backend.outputNow()).toBe(9);
    expect(backend.outputTimeAt(2_500)).toBe(9.5);

    const context = FakeAudioContext.instances[0];
    context.timestamp = {
      contextTime: Number.NaN,
      performanceTime: Number.NaN,
    };
    expect(backend.outputTimeAt(2_500)).toBe(10.5);
  });

  it("keeps voices connected until a requested future stop boundary", () => {
    installAudioContext();
    const backend = new WebAudioBackend();
    const context = FakeAudioContext.instances[0];
    context.currentTime = 1;

    backend.scheduleNote({
      voice: "soprano",
      midi: 60,
      velocity: 90,
      when: 2,
      duration: 5,
    });
    backend.stopAll(4);

    expect(context.oscillators).toHaveLength(2);
    expect(context.oscillators[0].stops).toEqual([7.02, 4]);
    expect(context.oscillators[1].stops).toEqual([7.02, 4]);
    expect(context.oscillators.every((node) => !node.disconnected)).toBe(
      true,
    );
    expect(context.gains[4].gain.events).toContainEqual({
      type: "set",
      value: 0,
      time: 4,
    });

    backend.startAll(4);
    expect(context.gains[4].gain.events.at(-1)).toEqual({
      type: "set",
      value: 1,
      time: 4,
    });

    context.oscillators.forEach((oscillator) => oscillator.onended?.());
    expect(context.oscillators.every((node) => node.disconnected)).toBe(
      true,
    );
  });
});
