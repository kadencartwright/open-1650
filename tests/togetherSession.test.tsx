import { act, renderHook } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";
import type { CompiledPerformance } from "../src/audio/compilePerformance";
import type {
  TogetherClockMessage,
  TogetherControlMessage,
  TogetherSelection,
} from "../src/sync/protocol";
import type {
  PeerGroupSnapshot,
  PeerMessage,
} from "../src/sync/peerGroup";
import {
  type TogetherPlayer,
  useTogetherSession,
} from "../src/sync/useTogetherSession";

const peerFactories = vi.hoisted(() => ({
  createHost: vi.fn(),
  createGuest: vi.fn(),
}));

vi.mock("../src/sync/peerGroup", () => ({
  createHostPeerGroup: peerFactories.createHost,
  createGuestPeerGroup: peerFactories.createGuest,
}));

const selection: TogetherSelection = {
  psalmNumber: 100,
  version: "primary",
  tuneSlug: "old-hundredth",
  performanceId: "ps100-primary-old-hundredth",
};

const otherSelection: TogetherSelection = {
  psalmNumber: 23,
  version: "primary",
  tuneSlug: "crimond",
  performanceId: "ps23-primary-crimond",
};

const compiled = {
  id: selection.performanceId,
  ppq: 100,
  durationTicks: 1_000,
} as CompiledPerformance;

interface Deferred {
  promise: Promise<void>;
  resolve(): void;
}

function deferred(): Deferred {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

interface MockTogetherPlayer extends TogetherPlayer {
  prepareAudio: Mock<TogetherPlayer["prepareAudio"]>;
  scheduleTransport: Mock<TogetherPlayer["scheduleTransport"]>;
  getTransportSnapshot: Mock<TogetherPlayer["getTransportSnapshot"]>;
  toggle: Mock<TogetherPlayer["toggle"]>;
  restart: Mock<TogetherPlayer["restart"]>;
  seek: Mock<TogetherPlayer["seek"]>;
  setBpm: Mock<TogetherPlayer["setBpm"]>;
  setLoopStanza: Mock<TogetherPlayer["setLoopStanza"]>;
}

function makePlayer(
  initial: Partial<ReturnType<TogetherPlayer["getTransportSnapshot"]>> = {},
): MockTogetherPlayer {
  let transport = {
    mode: "paused" as const,
    tick: 120,
    bpm: 90,
    sampledAtLocalMs: performance.now(),
    ...initial,
  };
  const scheduleTransport = vi.fn<TogetherPlayer["scheduleTransport"]>(
    async (command) => {
      transport = {
        mode: command.mode,
        tick: command.tick,
        bpm: command.bpm,
        sampledAtLocalMs: command.effectiveAtLocalMs,
      };
    },
  );
  return {
    status: "paused",
    currentTick: transport.tick,
    bpm: transport.bpm,
    prepareAudio: vi.fn<TogetherPlayer["prepareAudio"]>(async () => undefined),
    scheduleTransport,
    getTransportSnapshot: vi.fn(() => transport),
    toggle: vi.fn<TogetherPlayer["toggle"]>(async () => undefined),
    restart: vi.fn<TogetherPlayer["restart"]>(),
    seek: vi.fn<TogetherPlayer["seek"]>(),
    setBpm: vi.fn<TogetherPlayer["setBpm"]>(),
    setLoopStanza: vi.fn<TogetherPlayer["setLoopStanza"]>(),
  };
}

class FakePeerGroup {
  readonly role: "host" | "guest";
  readonly roomCode = "ABC234";
  ready: boolean;
  snapshot: PeerGroupSnapshot;
  readonly sendControl = vi.fn();
  readonly sendClock = vi.fn();
  readonly close = vi.fn();
  readonly controlListeners = new Set<
    (message: PeerMessage<TogetherControlMessage>) => void
  >();
  readonly clockListeners = new Set<
    (message: PeerMessage<TogetherClockMessage>) => void
  >();
  readonly errorListeners = new Set<(error: Error) => void>();
  readonly snapshotListeners = new Set<
    (snapshot: PeerGroupSnapshot) => void
  >();

  constructor(role: "host" | "guest", ready = role === "guest") {
    this.role = role;
    this.ready = ready;
    this.snapshot = makePeerSnapshot(role, ready);
  }

  onControl(
    listener: (message: PeerMessage<TogetherControlMessage>) => void,
  ) {
    this.controlListeners.add(listener);
    return () => this.controlListeners.delete(listener);
  }

  onClock(listener: (message: PeerMessage<TogetherClockMessage>) => void) {
    this.clockListeners.add(listener);
    return () => this.clockListeners.delete(listener);
  }

  onError(listener: (error: Error) => void) {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  subscribe(listener: (snapshot: PeerGroupSnapshot) => void) {
    this.snapshotListeners.add(listener);
    return () => this.snapshotListeners.delete(listener);
  }

  emitControl(payload: TogetherControlMessage) {
    const message: PeerMessage<TogetherControlMessage> = {
      peerId: this.role === "host" ? "guest-peer" : "host-peer",
      payload,
      sequence: 1,
      sentAt: performance.now(),
      receivedAt: performance.now(),
    };
    for (const listener of this.controlListeners) listener(message);
  }

  emitClock(payload: TogetherClockMessage, receivedAt = performance.now()) {
    const message: PeerMessage<TogetherClockMessage> = {
      peerId: this.role === "host" ? "guest-peer" : "host-peer",
      payload,
      sequence: 1,
      sentAt: receivedAt,
      receivedAt,
    };
    for (const listener of this.clockListeners) listener(message);
  }

  emitSnapshot(patch: Partial<PeerGroupSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.ready = this.snapshot.ready;
    for (const listener of this.snapshotListeners) listener(this.snapshot);
  }
}

function makePeerSnapshot(
  role: "host" | "guest",
  ready: boolean,
): PeerGroupSnapshot {
  return {
    role,
    roomCode: "ABC234",
    peerId: role === "host" ? "host-peer" : "guest-peer",
    state: ready ? "connected" : role === "host" ? "waiting" : "connecting",
    signalingState: "open",
    ready,
    readyPeerCount: ready ? 1 : 0,
    peerCount: ready ? 1 : 0,
    maxPeers: role === "host" ? 3 : 1,
    peers: [],
  };
}

function setupClockEstimate(group: FakePeerGroup): void {
  for (const expectedSendAt of [0, 70, 140]) {
    act(() => {
      vi.advanceTimersByTime(expectedSendAt - performance.now());
    });
    const ping = group.sendClock.mock.calls.at(-1)?.[0] as
      | Extract<TogetherClockMessage, { kind: "ping" }>
      | undefined;
    expect(ping).toMatchObject({ kind: "ping", localSendMs: expectedSendAt });

    act(() => {
      vi.advanceTimersByTime(10);
      group.emitClock({
        kind: "pong",
        id: ping!.id,
        localSendMs: ping!.localSendMs,
        hostReceiveMs: expectedSendAt + 105,
        hostSendMs: expectedSendAt + 105,
      });
    });
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.stubGlobal("RTCPeerConnection", function RTCPeerConnection() {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useTogetherSession", () => {
  it("schedules host playback in the future and broadcasts the same anchor", async () => {
    const group = new FakePeerGroup("host", false);
    peerFactories.createHost.mockReturnValue(group);
    const player = makePlayer();
    const { result, unmount } = renderHook(() =>
      useTogetherSession({ selection, onRemoteSelection: vi.fn() }),
    );
    let detach: () => void = () => undefined;
    act(() => {
      detach = result.current.attachPlayer(player, compiled, selection);
    });

    await act(async () => result.current.startGroup());
    expect(player.prepareAudio).toHaveBeenCalledOnce();
    expect(player.setLoopStanza).toHaveBeenCalledWith(false);
    expect(result.current.snapshot).toMatchObject({
      mode: "host",
      roomCode: "ABC234",
      connection: "waiting",
    });

    await act(async () => result.current.toggle());
    expect(player.scheduleTransport).toHaveBeenLastCalledWith({
      mode: "playing",
      tick: 120,
      bpm: 90,
      effectiveAtLocalMs: 2_000,
    });
    expect(group.sendControl).toHaveBeenLastCalledWith({
      kind: "transport",
      selection,
      transport: expect.objectContaining({
        revision: 1,
        playback: "playing",
        tick: 120,
        bpm: 90,
        effectiveHostMs: 2_000,
      }),
    });

    detach();
    unmount();
  });

  it("keeps the newest host intent when scheduled commands overlap", async () => {
    const group = new FakePeerGroup("host", false);
    peerFactories.createHost.mockReturnValue(group);
    const player = makePlayer();
    const first = deferred();
    player.scheduleTransport
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValue(undefined);
    const { result, unmount } = renderHook(() =>
      useTogetherSession({ selection, onRemoteSelection: vi.fn() }),
    );
    act(() => {
      result.current.attachPlayer(player, compiled, selection);
    });
    await act(async () => result.current.startGroup());

    act(() => result.current.seek(240));
    act(() => result.current.setBpm(80));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(player.scheduleTransport).toHaveBeenCalledOnce();
    expect(player.scheduleTransport).toHaveBeenLastCalledWith(
      expect.objectContaining({ mode: "paused", tick: 240, bpm: 80 }),
    );

    await act(async () => first.resolve());
    await act(async () => result.current.toggle());

    expect(player.scheduleTransport).toHaveBeenLastCalledWith(
      expect.objectContaining({ mode: "playing", tick: 240, bpm: 80 }),
    );
    unmount();
  });

  it("does not heartbeat a host command before local audio accepts it", async () => {
    const group = new FakePeerGroup("host", false);
    peerFactories.createHost.mockReturnValue(group);
    const player = makePlayer();
    const pending = deferred();
    player.scheduleTransport.mockImplementationOnce(() => pending.promise);
    const { result, unmount } = renderHook(() =>
      useTogetherSession({ selection, onRemoteSelection: vi.fn() }),
    );
    act(() => {
      result.current.attachPlayer(player, compiled, selection);
    });
    await act(async () => result.current.startGroup());
    group.sendControl.mockClear();

    act(() => result.current.seek(240));
    await act(async () => {
      await Promise.resolve();
    });
    expect(player.scheduleTransport).toHaveBeenCalledOnce();

    act(() => vi.advanceTimersByTime(1_000));
    expect(group.sendControl).toHaveBeenLastCalledWith({
      kind: "transport",
      selection,
      transport: expect.objectContaining({ revision: 0, tick: 120 }),
    });

    await act(async () => pending.resolve());
    expect(group.sendControl).toHaveBeenLastCalledWith({
      kind: "transport",
      selection,
      transport: expect.objectContaining({ revision: 1, tick: 240 }),
    });
    unmount();
  });

  it("does not resurrect a skipped host command when the latest command fails", async () => {
    const group = new FakePeerGroup("host", false);
    peerFactories.createHost.mockReturnValue(group);
    const player = makePlayer();
    player.scheduleTransport.mockRejectedValueOnce(new Error("audio failed"));
    const { result, unmount } = renderHook(() =>
      useTogetherSession({ selection, onRemoteSelection: vi.fn() }),
    );
    act(() => {
      result.current.attachPlayer(player, compiled, selection);
    });
    await act(async () => result.current.startGroup());
    group.sendControl.mockClear();

    act(() => result.current.seek(240));
    act(() => result.current.setBpm(80));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.snapshot.connection).toBe("failed");

    act(() => vi.advanceTimersByTime(1_000));
    expect(group.sendControl).toHaveBeenLastCalledWith({
      kind: "transport",
      selection,
      transport: expect.objectContaining({
        revision: 0,
        tick: 120,
        bpm: 90,
      }),
    });
    unmount();
  });

  it("commits a pause when host playback reaches the end", async () => {
    const group = new FakePeerGroup("host", false);
    peerFactories.createHost.mockReturnValue(group);
    const player = makePlayer();
    const { result, unmount } = renderHook(() =>
      useTogetherSession({ selection, onRemoteSelection: vi.fn() }),
    );
    act(() => {
      result.current.attachPlayer(player, compiled, selection);
    });
    await act(async () => result.current.startGroup());
    await act(async () => result.current.toggle());

    act(() => vi.advanceTimersByTime(9_000));
    player.status = "ended";
    player.currentTick = compiled.durationTicks;
    player.getTransportSnapshot.mockReturnValue({
      mode: "paused",
      tick: compiled.durationTicks,
      bpm: 90,
      sampledAtLocalMs: performance.now(),
    });
    group.sendControl.mockClear();
    act(() => vi.advanceTimersByTime(1_000));

    expect(result.current.snapshot.playback).toBe("paused");
    expect(group.sendControl).toHaveBeenLastCalledWith({
      kind: "transport",
      selection,
      transport: expect.objectContaining({
        revision: 2,
        playback: "paused",
        tick: compiled.durationTicks,
      }),
    });
    unmount();
  });

  it("clock-syncs a guest before scheduling the host transport locally", async () => {
    const group = new FakePeerGroup("guest", true);
    peerFactories.createGuest.mockReturnValue(group);
    const player = makePlayer();
    const { result, unmount } = renderHook(() =>
      useTogetherSession({ selection, onRemoteSelection: vi.fn() }),
    );
    act(() => {
      result.current.attachPlayer(player, compiled, selection);
    });
    await act(async () => result.current.joinGroup("abc234"));
    setupClockEstimate(group);

    await act(async () => {
      group.emitControl({
        kind: "transport",
        selection,
        transport: {
          epoch: 7,
          revision: 1,
          playback: "playing",
          tick: 200,
          bpm: 60,
          effectiveHostMs: 1_000,
        },
      });
    });

    expect(result.current.snapshot.connection).toBe("ready");
    expect(player.scheduleTransport).toHaveBeenLastCalledWith({
      mode: "playing",
      tick: 200,
      bpm: 60,
      effectiveAtLocalMs: 900,
    });
    expect(group.sendControl).toHaveBeenCalledWith({
      kind: "ready",
      performanceId: selection.performanceId,
    });
    unmount();
  });

  it("keeps a guest paused when a stale remote start resolves after leaving", async () => {
    const group = new FakePeerGroup("guest", true);
    peerFactories.createGuest.mockReturnValue(group);
    const player = makePlayer();
    const remoteStart = deferred();
    let audibleMode: "playing" | "paused" = "paused";
    let scheduleCount = 0;
    player.scheduleTransport.mockImplementation(async (command) => {
      scheduleCount += 1;
      if (scheduleCount === 1) await remoteStart.promise;
      audibleMode = command.mode;
    });
    const { result, unmount } = renderHook(() =>
      useTogetherSession({ selection, onRemoteSelection: vi.fn() }),
    );
    act(() => {
      result.current.attachPlayer(player, compiled, selection);
    });
    await act(async () => result.current.joinGroup("ABC234"));
    setupClockEstimate(group);
    act(() => {
      group.emitControl({
        kind: "transport",
        selection,
        transport: {
          epoch: 11,
          revision: 1,
          playback: "playing",
          tick: 200,
          bpm: 60,
          effectiveHostMs: 1_000,
        },
      });
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(player.scheduleTransport).toHaveBeenCalledOnce();

    let leavePromise!: Promise<void>;
    act(() => {
      leavePromise = result.current.leaveGroup();
    });
    expect(group.close).toHaveBeenCalledOnce();
    expect(audibleMode).toBe("paused");

    await act(async () => {
      remoteStart.resolve();
      await leavePromise;
    });
    expect(audibleMode).toBe("paused");
    expect(player.scheduleTransport).toHaveBeenLastCalledWith(
      expect.objectContaining({ mode: "paused" }),
    );
    unmount();
  });

  it("pauses existing guest audio when a remote schedule fails", async () => {
    const group = new FakePeerGroup("guest", true);
    peerFactories.createGuest.mockReturnValue(group);
    const player = makePlayer({ mode: "playing", tick: 300 });
    player.status = "playing";
    player.scheduleTransport.mockRejectedValueOnce(new Error("audio failed"));
    const { result, unmount } = renderHook(() =>
      useTogetherSession({ selection, onRemoteSelection: vi.fn() }),
    );
    act(() => {
      result.current.attachPlayer(player, compiled, selection);
    });
    await act(async () => result.current.joinGroup("ABC234"));
    setupClockEstimate(group);

    act(() => {
      group.emitControl({
        kind: "transport",
        selection,
        transport: {
          epoch: 12,
          revision: 1,
          playback: "playing",
          tick: 200,
          bpm: 60,
          effectiveHostMs: 1_000,
        },
      });
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.snapshot.connection).toBe("failed");
    expect(player.scheduleTransport).toHaveBeenCalledTimes(2);
    expect(player.scheduleTransport).toHaveBeenLastCalledWith(
      expect.objectContaining({ mode: "paused" }),
    );
    unmount();
  });

  it("requests a remote selection only once while waiting for it to attach", async () => {
    const group = new FakePeerGroup("guest", false);
    peerFactories.createGuest.mockReturnValue(group);
    const onRemoteSelection = vi.fn();
    const player = makePlayer();
    const { result, unmount } = renderHook(() =>
      useTogetherSession({ selection, onRemoteSelection }),
    );
    act(() => {
      result.current.attachPlayer(player, compiled, selection);
    });
    await act(async () => result.current.joinGroup("ABC234"));

    act(() => {
      group.emitControl({
        kind: "hello",
        selection: otherSelection,
        transport: {
          epoch: 9,
          revision: 0,
          playback: "paused",
          tick: 0,
          bpm: 84,
          effectiveHostMs: 100,
        },
      });
      group.emitControl({
        kind: "transport",
        selection: otherSelection,
        transport: {
          epoch: 9,
          revision: 0,
          playback: "paused",
          tick: 0,
          bpm: 84,
          effectiveHostMs: 100,
        },
      });
    });

    expect(onRemoteSelection).toHaveBeenCalledTimes(1);
    expect(onRemoteSelection).toHaveBeenCalledWith(otherSelection);
    unmount();
  });

  it("preserves a failed guest state instead of overwriting it as connecting", async () => {
    const group = new FakePeerGroup("guest", false);
    peerFactories.createGuest.mockReturnValue(group);
    const player = makePlayer();
    const { result, unmount } = renderHook(() =>
      useTogetherSession({ selection, onRemoteSelection: vi.fn() }),
    );
    act(() => {
      result.current.attachPlayer(player, compiled, selection);
    });
    await act(async () => result.current.joinGroup("ABC234"));

    act(() => {
      group.emitSnapshot({ state: "failed", signalingState: "error" });
    });

    expect(result.current.snapshot.connection).toBe("failed");
    unmount();
  });

  it("returns a guest to local playback when an established host disconnects", async () => {
    const group = new FakePeerGroup("guest", true);
    peerFactories.createGuest.mockReturnValue(group);
    const player = makePlayer({ mode: "playing" });
    const { result, unmount } = renderHook(() =>
      useTogetherSession({ selection, onRemoteSelection: vi.fn() }),
    );
    act(() => {
      result.current.attachPlayer(player, compiled, selection);
    });
    await act(async () => result.current.joinGroup("ABC234"));

    await act(async () => {
      group.emitSnapshot({
        state: "failed",
        signalingState: "open",
        ready: false,
        readyPeerCount: 0,
      });
      await Promise.resolve();
    });

    expect(group.close).toHaveBeenCalledOnce();
    expect(player.scheduleTransport).toHaveBeenLastCalledWith(
      expect.objectContaining({ mode: "paused" }),
    );
    expect(result.current.snapshot).toEqual({
      mode: "idle",
      roomCode: null,
      connection: "idle",
      deviceCount: 1,
      playback: null,
      error: null,
    });
    unmount();
  });

  it("keeps the newer group when start and join setup resolve out of order", async () => {
    const hostGroup = new FakePeerGroup("host", false);
    const guestGroup = new FakePeerGroup("guest", false);
    peerFactories.createHost.mockReturnValue(hostGroup);
    peerFactories.createGuest.mockReturnValue(guestGroup);
    const player = makePlayer();
    const oldPreparation = deferred();
    const newPreparation = deferred();
    player.prepareAudio
      .mockImplementationOnce(() => oldPreparation.promise)
      .mockImplementationOnce(() => newPreparation.promise);
    const { result, unmount } = renderHook(() =>
      useTogetherSession({ selection, onRemoteSelection: vi.fn() }),
    );
    act(() => {
      result.current.attachPlayer(player, compiled, selection);
    });

    let startPromise!: Promise<void>;
    let joinPromise!: Promise<void>;
    act(() => {
      startPromise = result.current.startGroup();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(player.prepareAudio).toHaveBeenCalledOnce();
    act(() => {
      joinPromise = result.current.joinGroup("ABC234");
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(player.prepareAudio).toHaveBeenCalledTimes(2);
    await act(async () => {
      newPreparation.resolve();
      await joinPromise;
    });
    expect(result.current.snapshot.mode).toBe("guest");

    await act(async () => {
      oldPreparation.resolve();
      await startPromise;
    });
    expect(result.current.snapshot.mode).toBe("guest");
    expect(guestGroup.close).not.toHaveBeenCalled();
    expect(
      peerFactories.createHost.mock.calls.length === 0 ||
        hostGroup.close.mock.calls.length === 1,
    ).toBe(true);
    unmount();
  });

  it("disconnects a guest before waiting for its local pause", async () => {
    const group = new FakePeerGroup("guest", false);
    peerFactories.createGuest.mockReturnValue(group);
    const player = makePlayer();
    const pause = deferred();
    player.scheduleTransport.mockImplementationOnce(() => pause.promise);
    const { result, unmount } = renderHook(() =>
      useTogetherSession({ selection, onRemoteSelection: vi.fn() }),
    );
    act(() => {
      result.current.attachPlayer(player, compiled, selection);
    });
    await act(async () => result.current.joinGroup("ABC234"));

    let leavePromise!: Promise<void>;
    act(() => {
      leavePromise = result.current.leaveGroup();
    });
    expect(group.close).toHaveBeenCalledOnce();

    await act(async () => {
      pause.resolve();
      await leavePromise;
    });
    expect(result.current.snapshot.mode).toBe("idle");
    unmount();
  });

  it("closes the peer group and clears heartbeats on unmount", async () => {
    const group = new FakePeerGroup("host", true);
    peerFactories.createHost.mockReturnValue(group);
    const player = makePlayer();
    const { result, unmount } = renderHook(() =>
      useTogetherSession({ selection, onRemoteSelection: vi.fn() }),
    );
    act(() => {
      result.current.attachPlayer(player, compiled, selection);
    });
    await act(async () => result.current.startGroup());
    act(() => vi.advanceTimersByTime(1_000));
    expect(group.sendControl).toHaveBeenCalled();
    group.sendControl.mockClear();

    unmount();
    expect(group.close).toHaveBeenCalledOnce();
    expect(group.controlListeners.size).toBe(0);
    expect(group.clockListeners.size).toBe(0);
    expect(group.snapshotListeners.size).toBe(0);
    act(() => vi.advanceTimersByTime(5_000));
    expect(group.sendControl).not.toHaveBeenCalled();
  });
});
