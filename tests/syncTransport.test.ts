import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_RTC_CONFIGURATION,
  createGuestPeerGroup,
  createHostPeerGroup,
} from "../src/sync/peerGroup";
import type {
  SignalListener,
  SignalingState,
  SignalingStateListener,
  SignalingTransport,
} from "../src/sync/signaling";
import {
  CLOCK_CHANNEL_LABEL,
  CONTROL_CHANNEL_LABEL,
  HOST_SIGNAL_TARGET,
  SYNC_PROTOCOL_VERSION,
  generateRoomCode,
  isSignalEnvelope,
  parseDataChannelPacket,
  type SignalEnvelope,
} from "../src/sync/wire";

const ROOM = "ABC234";
const HOST_ID = "host-peer-id";
const GUEST_ID = "guest-peer-id";

describe("sync wire protocol", () => {
  it("generates unambiguous six-character room codes", () => {
    expect(
      generateRoomCode((values) => {
        values.fill(0);
      }),
    ).toBe("222222");
  });

  it("accepts only room-scoped SDP and ICE signaling", () => {
    expect(
      isSignalEnvelope({
        version: SYNC_PROTOCOL_VERSION,
        roomCode: ROOM,
        from: GUEST_ID,
        to: HOST_SIGNAL_TARGET,
        signal: {
          kind: "sdp",
          description: { type: "offer", sdp: "test offer" },
        },
      }),
    ).toBe(true);
    expect(
      isSignalEnvelope({
        version: SYNC_PROTOCOL_VERSION,
        roomCode: ROOM,
        from: GUEST_ID,
        to: HOST_SIGNAL_TARGET,
        signal: { kind: "control", command: "play" },
      }),
    ).toBe(false);
  });

  it("rejects malformed and channel-confused data packets", () => {
    const packet = JSON.stringify({
      version: 1,
      channel: "clock",
      sequence: 2,
      sentAt: 42,
      payload: { audioTime: 12 },
    });
    expect(parseDataChannelPacket(packet, "clock")?.sequence).toBe(2);
    expect(parseDataChannelPacket(packet, "control")).toBeUndefined();
    expect(parseDataChannelPacket("not json")).toBeUndefined();
  });
});

describe("PeerGroup", () => {
  it("has a guest create reliable control and lossy clock channels", async () => {
    const signaling = new FakeSignaling();
    const connection = new FakePeerConnection();
    const factory = vi.fn(() => connection as unknown as RTCPeerConnection);
    const group = createGuestPeerGroup({
      roomCode: "abc-234",
      peerId: GUEST_ID,
      signaling,
      peerConnectionFactory: factory,
    });

    await settle();

    expect(group.roomCode).toBe(ROOM);
    expect(factory).toHaveBeenCalledWith(DEFAULT_RTC_CONFIGURATION);
    expect(connection.createdChannels).toEqual([
      [CONTROL_CHANNEL_LABEL, { ordered: true }],
      [CLOCK_CHANNEL_LABEL, { ordered: false, maxRetransmits: 0 }],
    ]);
    expect(signaling.sent).toContainEqual(
      expect.objectContaining({
        from: GUEST_ID,
        to: HOST_SIGNAL_TARGET,
        signal: expect.objectContaining({ kind: "sdp" }),
      }),
    );

    group.close();
    expect(connection.closed).toBe(true);
    expect(signaling.state).toBe("closed");
    expect(group.snapshot.state).toBe("closed");
  });

  it("answers no more than the configured number of guests", async () => {
    const signaling = new FakeSignaling();
    const connections: FakePeerConnection[] = [];
    const group = createHostPeerGroup({
      roomCode: ROOM,
      peerId: HOST_ID,
      maxGuests: 1,
      signaling,
      peerConnectionFactory: () => {
        const connection = new FakePeerConnection();
        connections.push(connection);
        return connection as unknown as RTCPeerConnection;
      },
    });

    signaling.receive(offerFrom(GUEST_ID));
    signaling.receive(offerFrom("second-guest-id"));
    await settle();

    expect(connections).toHaveLength(1);
    expect(group.snapshot.peerCount).toBe(1);
    expect(signaling.sent).toContainEqual(
      expect.objectContaining({
        from: HOST_ID,
        to: GUEST_ID,
        signal: expect.objectContaining({ kind: "sdp" }),
      }),
    );
    expect(
      signaling.sent.some((message) => message.to === "second-guest-id"),
    ).toBe(false);
    group.close();
  });
});

class FakeSignaling implements SignalingTransport {
  state: SignalingState = "open";
  readonly sent: SignalEnvelope[] = [];
  readonly #signals = new Set<SignalListener>();
  readonly #states = new Set<SignalingStateListener>();

  send(message: SignalEnvelope): boolean {
    this.sent.push(message);
    return this.state === "open";
  }

  onSignal(listener: SignalListener): () => void {
    this.#signals.add(listener);
    return () => this.#signals.delete(listener);
  }

  onStateChange(listener: SignalingStateListener): () => void {
    this.#states.add(listener);
    return () => this.#states.delete(listener);
  }

  receive(message: SignalEnvelope): void {
    for (const listener of this.#signals) listener(message);
  }

  close(): void {
    this.state = "closed";
    for (const listener of this.#states) listener(this.state);
  }
}

class FakeDataChannel {
  readyState: RTCDataChannelState = "connecting";
  bufferedAmount = 0;
  binaryType: BinaryType = "blob";
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  close(): void {
    this.readyState = "closed";
    this.onclose?.(new Event("close"));
  }

  send(): void {}
}

class FakePeerConnection {
  connectionState: RTCPeerConnectionState = "new";
  localDescription: RTCSessionDescription | null = null;
  remoteDescription: RTCSessionDescription | null = null;
  onicecandidate: ((event: RTCPeerConnectionIceEvent) => void) | null = null;
  onconnectionstatechange: ((event: Event) => void) | null = null;
  ondatachannel: ((event: RTCDataChannelEvent) => void) | null = null;
  readonly createdChannels: Array<[string, RTCDataChannelInit | undefined]> = [];
  closed = false;

  createDataChannel(label: string, options?: RTCDataChannelInit): RTCDataChannel {
    this.createdChannels.push([label, options]);
    return new FakeDataChannel() as unknown as RTCDataChannel;
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    return { type: "offer", sdp: "test offer" };
  }

  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    return { type: "answer", sdp: "test answer" };
  }

  async setLocalDescription(description: RTCLocalSessionDescriptionInit): Promise<void> {
    this.localDescription = description as RTCSessionDescription;
  }

  async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    this.remoteDescription = description as RTCSessionDescription;
  }

  async addIceCandidate(): Promise<void> {}

  close(): void {
    this.closed = true;
    this.connectionState = "closed";
  }
}

function offerFrom(from: string): SignalEnvelope {
  return {
    version: SYNC_PROTOCOL_VERSION,
    roomCode: ROOM,
    from,
    to: HOST_SIGNAL_TARGET,
    signal: {
      kind: "sdp",
      description: { type: "offer", sdp: "test offer" },
    },
  };
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
