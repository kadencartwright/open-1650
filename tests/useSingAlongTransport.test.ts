import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CompiledPerformance } from "../src/audio/compilePerformance";
import { useSingAlong } from "../src/audio/useSingAlong";

const fakeAudio = vi.hoisted(() => {
  const handles: Array<{ cancel: ReturnType<typeof vi.fn> }> = [];
  return {
    handles,
    backend: {
      state: "running",
      now: vi.fn(() => 10 + globalThis.performance.now() / 1_000),
      outputNow: vi.fn(
        () => 10 + globalThis.performance.now() / 1_000,
      ),
      outputTimeAt: vi.fn(
        (localMs: number) => 10 + localMs / 1_000,
      ),
      resume: vi.fn(async () => undefined),
      scheduleNote: vi.fn(() => {
        const handle = { cancel: vi.fn() };
        handles.push(handle);
        return handle;
      }),
      startAll: vi.fn(),
      stopAll: vi.fn(),
      setVolume: vi.fn(),
      onStateChange: vi.fn(() => () => undefined),
      close: vi.fn(async () => undefined),
    },
  };
});

vi.mock("../src/audio/webAudioBackend", () => ({
  createWebAudioBackend: () => fakeAudio.backend,
}));

const performance: CompiledPerformance = {
  id: "sync-test",
  psalmId: "psalm-test",
  tuneId: "tune-test",
  title: "Test",
  alternateTitle: null,
  meter: "C.M.",
  key: "C major",
  ppq: 100,
  defaultBpm: 60,
  timeSignature: [4, 4],
  introTicks: 0,
  interStanzaTicks: 0,
  durationTicks: 1_000,
  notes: [
    {
      id: "long",
      sourceNoteId: "long",
      stanzaId: "one",
      voice: "soprano",
      midi: 60,
      startTick: 100,
      durationTicks: 200,
      endTick: 300,
      velocity: 90,
    },
    {
      id: "reanchor",
      sourceNoteId: "reanchor",
      stanzaId: "one",
      voice: "soprano",
      midi: 62,
      startTick: 500,
      durationTicks: 100,
      endTick: 600,
      velocity: 90,
    },
  ],
  stanzas: [],
  lines: [],
  tokens: [],
  syllables: [],
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  fakeAudio.handles.length = 0;
  fakeAudio.backend.now.mockImplementation(
    () => 10 + globalThis.performance.now() / 1_000,
  );
  fakeAudio.backend.outputNow.mockImplementation(
    () => 10 + globalThis.performance.now() / 1_000,
  );
  fakeAudio.backend.outputTimeAt.mockImplementation(
    (localMs: number) => 10 + localMs / 1_000,
  );
  fakeAudio.backend.resume.mockResolvedValue(undefined);
  fakeAudio.backend.scheduleNote.mockImplementation(() => {
    const handle = { cancel: vi.fn() };
    fakeAudio.handles.push(handle);
    return handle;
  });
  fakeAudio.backend.onStateChange.mockReturnValue(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useSingAlong scheduled transport", () => {
  it("prepares audio and anchors a paused start at the requested output time", async () => {
    const { result, unmount } = renderHook(() =>
      useSingAlong(performance),
    );

    await act(async () => result.current.prepareAudio());
    expect(result.current.audioReady).toBe(true);

    await act(async () => {
      await result.current.scheduleTransport({
        mode: "playing",
        tick: 100,
        bpm: 60,
        effectiveAtLocalMs: 1_000,
      });
    });

    expect(result.current.getTransportSnapshot()).toMatchObject({
      mode: "paused",
      tick: 0,
      bpm: 60,
      sampledAtLocalMs: 0,
    });
    expect(fakeAudio.backend.startAll).toHaveBeenCalledWith(11);
    expect(fakeAudio.backend.scheduleNote).toHaveBeenCalledWith(
      expect.objectContaining({
        midi: 60,
        when: 11,
        duration: 2,
      }),
    );

    await act(async () => vi.advanceTimersByTimeAsync(1_000));
    expect(result.current.status).toBe("playing");
    expect(result.current.getTransportSnapshot()).toMatchObject({
      mode: "playing",
      tick: 100,
      bpm: 60,
      sampledAtLocalMs: 1_000,
    });
    unmount();
  });

  it("schedules a pause at the audible boundary and freezes its tick", async () => {
    const { result, unmount } = renderHook(() =>
      useSingAlong(performance),
    );
    await act(async () => {
      await result.current.scheduleTransport({
        mode: "playing",
        tick: 100,
        bpm: 60,
        effectiveAtLocalMs: 0,
      });
      await vi.advanceTimersByTimeAsync(0);
    });

    await act(async () => {
      await result.current.scheduleTransport({
        mode: "paused",
        tick: 200,
        bpm: 60,
        effectiveAtLocalMs: 1_000,
      });
    });
    expect(fakeAudio.backend.stopAll).toHaveBeenCalledWith(11);

    await act(async () => vi.advanceTimersByTimeAsync(999));
    expect(result.current.getTransportSnapshot().mode).toBe("playing");

    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(result.current.getTransportSnapshot()).toMatchObject({
      mode: "paused",
      tick: 200,
      bpm: 60,
      sampledAtLocalMs: 1_000,
    });
    unmount();
  });

  it("pre-schedules a playing re-anchor without stopping the current plan early", async () => {
    const { result, unmount } = renderHook(() =>
      useSingAlong(performance),
    );
    await act(async () => {
      await result.current.scheduleTransport({
        mode: "playing",
        tick: 100,
        bpm: 60,
        effectiveAtLocalMs: 0,
      });
      await vi.advanceTimersByTimeAsync(0);
    });
    fakeAudio.backend.scheduleNote.mockClear();

    await act(async () => {
      await result.current.scheduleTransport({
        mode: "playing",
        tick: 500,
        bpm: 60,
        effectiveAtLocalMs: 1_000,
      });
    });

    expect(fakeAudio.backend.stopAll).toHaveBeenCalledWith(11);
    expect(fakeAudio.backend.startAll).toHaveBeenCalledWith(11);
    expect(fakeAudio.backend.scheduleNote).toHaveBeenCalledWith(
      expect.objectContaining({
        midi: 62,
        when: 11,
        duration: 1,
      }),
    );
    expect(result.current.getTransportSnapshot().mode).toBe("playing");
    unmount();
  });
});
