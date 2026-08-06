import {
  CLOCK_CHANNEL_LABEL,
  CONTROL_CHANNEL_LABEL,
  HOST_SIGNAL_TARGET,
  SYNC_PROTOCOL_VERSION,
  createPeerId,
  generateRoomCode,
  isRoomCode,
  normalizeRoomCode,
  parseDataChannelPacket,
  serializeDataChannelPacket,
  type DataChannelPacket,
  type PeerId,
  type RoomCode,
  type SignalEnvelope,
} from "./wire";
import {
  createSignalingTransport,
  isSignalForPeer,
  type SignalingState,
  type SignalingTransport,
} from "./signaling";

export const DEFAULT_RTC_CONFIGURATION: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }],
};

const MAX_CLOCK_BUFFERED_BYTES = 64 * 1024;

export type PeerGroupRole = "host" | "guest";
export type PeerGroupState =
  | "connecting"
  | "waiting"
  | "connected"
  | "failed"
  | "closed";

export interface PeerSnapshot {
  peerId: PeerId;
  connectionState: RTCPeerConnectionState;
  controlOpen: boolean;
  clockOpen: boolean;
  ready: boolean;
}

export interface PeerGroupSnapshot {
  role: PeerGroupRole;
  roomCode: RoomCode;
  peerId: PeerId;
  state: PeerGroupState;
  signalingState: SignalingState;
  ready: boolean;
  readyPeerCount: number;
  peerCount: number;
  maxPeers: number;
  peers: readonly PeerSnapshot[];
}

export interface PeerMessage<T> {
  peerId: PeerId;
  payload: T;
  sequence: number;
  sentAt: number;
  receivedAt: number;
}

export type PeerConnectionFactory = (
  configuration: RTCConfiguration,
) => RTCPeerConnection;

interface SharedPeerGroupOptions<ControlMessage, ClockMessage> {
  peerId?: PeerId;
  signaling?: SignalingTransport;
  peerConnectionFactory?: PeerConnectionFactory;
  rtcConfiguration?: RTCConfiguration;
  now?: () => number;
  onControl?: (message: PeerMessage<ControlMessage>) => void;
  onClock?: (message: PeerMessage<ClockMessage>) => void;
  onError?: (error: Error) => void;
}

export interface HostPeerGroupOptions<ControlMessage, ClockMessage>
  extends SharedPeerGroupOptions<ControlMessage, ClockMessage> {
  roomCode?: RoomCode;
  /** Host capacity is intentionally limited to a small, same-room group. */
  maxGuests?: 1 | 2 | 3;
}

export interface GuestPeerGroupOptions<ControlMessage, ClockMessage>
  extends SharedPeerGroupOptions<ControlMessage, ClockMessage> {
  roomCode: RoomCode;
}

interface PeerLink {
  key: PeerId | typeof HOST_SIGNAL_TARGET;
  remoteId: PeerId | typeof HOST_SIGNAL_TARGET;
  connection: RTCPeerConnection;
  control?: RTCDataChannel;
  clock?: RTCDataChannel;
  pendingIce: Array<RTCIceCandidateInit | null>;
  lastClockSequence: number;
}

interface ResolvedPeerGroupOptions<ControlMessage, ClockMessage> {
  role: PeerGroupRole;
  roomCode: RoomCode;
  peerId: PeerId;
  maxPeers: number;
  signaling: SignalingTransport;
  peerConnectionFactory: PeerConnectionFactory;
  rtcConfiguration: RTCConfiguration;
  now: () => number;
  onControl?: (message: PeerMessage<ControlMessage>) => void;
  onClock?: (message: PeerMessage<ClockMessage>) => void;
  onError?: (error: Error) => void;
}

export function createHostPeerGroup<
  ControlMessage = unknown,
  ClockMessage = unknown,
>(
  options: HostPeerGroupOptions<ControlMessage, ClockMessage> = {},
): PeerGroup<ControlMessage, ClockMessage> {
  const roomCode = options.roomCode ?? generateRoomCode();
  if (!isRoomCode(roomCode)) throw new TypeError("Invalid sync room code");
  const peerId = options.peerId ?? createPeerId();
  const maxPeers = options.maxGuests ?? 3;
  const signaling =
    options.signaling ?? createSignalingTransport({ roomCode, peerId });

  return new PeerGroup({
    ...resolveSharedOptions(options),
    role: "host",
    roomCode,
    peerId,
    maxPeers,
    signaling,
  });
}

export function createGuestPeerGroup<
  ControlMessage = unknown,
  ClockMessage = unknown,
>(
  options: GuestPeerGroupOptions<ControlMessage, ClockMessage>,
): PeerGroup<ControlMessage, ClockMessage> {
  const roomCode = normalizeRoomCode(options.roomCode);
  if (!isRoomCode(roomCode)) throw new TypeError("Invalid sync room code");
  const peerId = options.peerId ?? createPeerId();
  const signaling =
    options.signaling ?? createSignalingTransport({ roomCode, peerId });

  return new PeerGroup({
    ...resolveSharedOptions(options),
    role: "guest",
    roomCode,
    peerId,
    maxPeers: 1,
    signaling,
  });
}

/**
 * A host-star collection of WebRTC links. The reliable channel carries player
 * intent; the unordered/lossy channel carries disposable clock observations.
 */
export class PeerGroup<ControlMessage = unknown, ClockMessage = unknown> {
  readonly role: PeerGroupRole;
  readonly roomCode: RoomCode;
  readonly peerId: PeerId;
  readonly maxPeers: number;

  readonly #signaling: SignalingTransport;
  readonly #createPeerConnection: PeerConnectionFactory;
  readonly #rtcConfiguration: RTCConfiguration;
  readonly #now: () => number;
  readonly #links = new Map<PeerLink["key"], PeerLink>();
  readonly #earlyIce = new Map<PeerId, Array<RTCIceCandidateInit | null>>();
  readonly #stateListeners = new Set<(state: PeerGroupSnapshot) => void>();
  readonly #controlListeners = new Set<
    (message: PeerMessage<ControlMessage>) => void
  >();
  readonly #clockListeners = new Set<
    (message: PeerMessage<ClockMessage>) => void
  >();
  readonly #errorListeners = new Set<(error: Error) => void>();
  readonly #disposeSignal: () => void;
  readonly #disposeSignalState: () => void;
  #snapshot: PeerGroupSnapshot;
  #sequence = 0;
  #guestConnectionStarted = false;
  #everReady = false;
  #closed = false;

  constructor(options: ResolvedPeerGroupOptions<ControlMessage, ClockMessage>) {
    this.role = options.role;
    this.roomCode = options.roomCode;
    this.peerId = options.peerId;
    this.maxPeers = options.maxPeers;
    this.#signaling = options.signaling;
    this.#createPeerConnection = options.peerConnectionFactory;
    this.#rtcConfiguration = options.rtcConfiguration;
    this.#now = options.now;

    if (options.onControl) this.#controlListeners.add(options.onControl);
    if (options.onClock) this.#clockListeners.add(options.onClock);
    if (options.onError) this.#errorListeners.add(options.onError);

    this.#snapshot = this.#buildSnapshot();
    this.#disposeSignal = this.#signaling.onSignal((message) => {
      void this.#handleSignal(message).catch((error: unknown) =>
        this.#reportError(error),
      );
    });
    this.#disposeSignalState = this.#signaling.onStateChange((state) => {
      if (state === "open") this.#startGuestConnection();
      this.#emitState();
    });

    if (this.#signaling.state === "open") this.#startGuestConnection();
    this.#emitState();
  }

  get snapshot(): PeerGroupSnapshot {
    return this.#snapshot;
  }

  get ready(): boolean {
    return this.#snapshot.ready;
  }

  subscribe(listener: (state: PeerGroupSnapshot) => void): () => void {
    this.#stateListeners.add(listener);
    return () => this.#stateListeners.delete(listener);
  }

  onControl(
    listener: (message: PeerMessage<ControlMessage>) => void,
  ): () => void {
    this.#controlListeners.add(listener);
    return () => this.#controlListeners.delete(listener);
  }

  onClock(listener: (message: PeerMessage<ClockMessage>) => void): () => void {
    this.#clockListeners.add(listener);
    return () => this.#clockListeners.delete(listener);
  }

  onError(listener: (error: Error) => void): () => void {
    this.#errorListeners.add(listener);
    return () => this.#errorListeners.delete(listener);
  }

  sendControl(payload: ControlMessage, targetPeerId?: PeerId): number {
    return this.#broadcast("control", payload, targetPeerId);
  }

  sendClock(payload: ClockMessage, targetPeerId?: PeerId): number {
    return this.#broadcast("clock", payload, targetPeerId);
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#disposeSignal();
    this.#disposeSignalState();
    this.#signaling.close();

    for (const link of this.#links.values()) {
      link.control?.close();
      link.clock?.close();
      link.connection.close();
    }
    this.#links.clear();
    this.#earlyIce.clear();
    this.#emitState();
    this.#controlListeners.clear();
    this.#clockListeners.clear();
    this.#errorListeners.clear();
    this.#stateListeners.clear();
  }

  #startGuestConnection(): void {
    if (
      this.role !== "guest" ||
      this.#closed ||
      this.#guestConnectionStarted ||
      this.#signaling.state !== "open"
    ) {
      return;
    }
    this.#guestConnectionStarted = true;

    void (async () => {
      const link = this.#createLink(HOST_SIGNAL_TARGET);
      link.control = link.connection.createDataChannel(CONTROL_CHANNEL_LABEL, {
        ordered: true,
      });
      link.clock = link.connection.createDataChannel(CLOCK_CHANNEL_LABEL, {
        ordered: false,
        maxRetransmits: 0,
      });
      this.#attachChannel(link, "control", link.control);
      this.#attachChannel(link, "clock", link.clock);

      const offer = await link.connection.createOffer();
      await link.connection.setLocalDescription(offer);
      this.#sendSignal(HOST_SIGNAL_TARGET, {
        kind: "sdp",
        description: link.connection.localDescription ?? offer,
      });
    })().catch((error: unknown) => this.#reportError(error));
  }

  async #handleSignal(message: SignalEnvelope): Promise<void> {
    if (this.#closed || message.roomCode !== this.roomCode) return;
    if (!isSignalForPeer(message, this.peerId, this.role === "host")) return;

    if (this.role === "host") {
      await this.#handleHostSignal(message);
    } else {
      await this.#handleGuestSignal(message);
    }
  }

  async #handleHostSignal(message: SignalEnvelope): Promise<void> {
    let link = this.#links.get(message.from);

    if (message.signal.kind === "ice") {
      if (!link) {
        const candidates = this.#earlyIce.get(message.from) ?? [];
        candidates.push(message.signal.candidate);
        this.#earlyIce.set(message.from, candidates);
        return;
      }
      await this.#addOrQueueIce(link, message.signal.candidate);
      return;
    }

    if (message.signal.description.type !== "offer") return;
    if (!link) {
      if (this.#links.size >= this.maxPeers) return;
      link = this.#createLink(message.from);
      const earlyIce = this.#earlyIce.get(message.from);
      if (earlyIce) {
        link.pendingIce.push(...earlyIce);
        this.#earlyIce.delete(message.from);
      }
    }

    await link.connection.setRemoteDescription(message.signal.description);
    await this.#flushIce(link);
    const answer = await link.connection.createAnswer();
    await link.connection.setLocalDescription(answer);
    this.#sendSignal(message.from, {
      kind: "sdp",
      description: link.connection.localDescription ?? answer,
    });
  }

  async #handleGuestSignal(message: SignalEnvelope): Promise<void> {
    const link = this.#links.get(HOST_SIGNAL_TARGET);
    if (!link) return;
    if (
      link.remoteId !== HOST_SIGNAL_TARGET &&
      link.remoteId !== message.from
    ) {
      return;
    }
    link.remoteId = message.from;

    if (message.signal.kind === "ice") {
      await this.#addOrQueueIce(link, message.signal.candidate);
      return;
    }

    if (message.signal.description.type !== "answer") return;
    await link.connection.setRemoteDescription(message.signal.description);
    await this.#flushIce(link);
    this.#emitState();
  }

  #createLink(key: PeerLink["key"]): PeerLink {
    const connection = this.#createPeerConnection(this.#rtcConfiguration);
    const link: PeerLink = {
      key,
      remoteId: key,
      connection,
      pendingIce: [],
      lastClockSequence: -1,
    };
    this.#links.set(key, link);

    connection.onicecandidate = (event) => {
      const candidate = event.candidate?.toJSON() ?? null;
      this.#sendSignal(link.remoteId, { kind: "ice", candidate });
    };
    connection.onconnectionstatechange = () => {
      if (
        this.role === "host" &&
        (connection.connectionState === "failed" ||
          connection.connectionState === "closed")
      ) {
        this.#links.delete(link.key);
      }
      this.#emitState();
    };
    connection.ondatachannel = (event) => {
      if (event.channel.label === CONTROL_CHANNEL_LABEL) {
        if (link.control && link.control !== event.channel) event.channel.close();
        else {
          link.control = event.channel;
          this.#attachChannel(link, "control", event.channel);
        }
      } else if (event.channel.label === CLOCK_CHANNEL_LABEL) {
        if (link.clock && link.clock !== event.channel) event.channel.close();
        else {
          link.clock = event.channel;
          this.#attachChannel(link, "clock", event.channel);
        }
      } else {
        event.channel.close();
      }
      this.#emitState();
    };
    this.#emitState();
    return link;
  }

  #attachChannel(
    link: PeerLink,
    kind: DataChannelPacket["channel"],
    channel: RTCDataChannel,
  ): void {
    channel.binaryType = "arraybuffer";
    channel.onopen = () => this.#emitState();
    channel.onclose = () => {
      if (
        this.role === "host" &&
        link.control?.readyState === "closed" &&
        link.clock?.readyState === "closed"
      ) {
        link.connection.close();
        this.#links.delete(link.key);
      }
      this.#emitState();
    };
    channel.onerror = () =>
      this.#reportError(new Error(`${kind} sync channel failed`));
    channel.onmessage = (event) => {
      if (typeof event.data !== "string") return;
      const packet = parseDataChannelPacket(event.data, kind);
      if (!packet) return;

      const peerId =
        link.remoteId === HOST_SIGNAL_TARGET ? HOST_SIGNAL_TARGET : link.remoteId;
      const receivedAt = this.#now();
      if (kind === "clock") {
        if (packet.sequence <= link.lastClockSequence) return;
        link.lastClockSequence = packet.sequence;
        const message: PeerMessage<ClockMessage> = {
          peerId,
          payload: packet.payload as ClockMessage,
          sequence: packet.sequence,
          sentAt: packet.sentAt,
          receivedAt,
        };
        for (const listener of this.#clockListeners) listener(message);
      } else {
        const message: PeerMessage<ControlMessage> = {
          peerId,
          payload: packet.payload as ControlMessage,
          sequence: packet.sequence,
          sentAt: packet.sentAt,
          receivedAt,
        };
        for (const listener of this.#controlListeners) listener(message);
      }
    };
  }

  async #addOrQueueIce(
    link: PeerLink,
    candidate: RTCIceCandidateInit | null,
  ): Promise<void> {
    if (!link.connection.remoteDescription) {
      link.pendingIce.push(candidate);
      return;
    }
    await link.connection.addIceCandidate(candidate);
  }

  async #flushIce(link: PeerLink): Promise<void> {
    const candidates = link.pendingIce.splice(0);
    for (const candidate of candidates) {
      await link.connection.addIceCandidate(candidate);
    }
  }

  #sendSignal(to: PeerId | typeof HOST_SIGNAL_TARGET, signal: SignalEnvelope["signal"]): void {
    if (this.#closed) return;
    this.#signaling.send({
      version: SYNC_PROTOCOL_VERSION,
      roomCode: this.roomCode,
      from: this.peerId,
      to,
      signal,
    });
  }

  #broadcast(
    channelKind: DataChannelPacket["channel"],
    payload: ControlMessage | ClockMessage,
    targetPeerId?: PeerId,
  ): number {
    if (this.#closed) return 0;
    const packet: DataChannelPacket = {
      version: SYNC_PROTOCOL_VERSION,
      channel: channelKind,
      sequence: this.#sequence++,
      sentAt: this.#now(),
      payload,
    };
    const serialized = serializeDataChannelPacket(packet);
    let sent = 0;

    for (const link of this.#links.values()) {
      if (
        targetPeerId !== undefined &&
        link.remoteId !== targetPeerId &&
        !(link.remoteId === HOST_SIGNAL_TARGET && targetPeerId === HOST_SIGNAL_TARGET)
      ) {
        continue;
      }
      const channel = channelKind === "control" ? link.control : link.clock;
      if (!channel || channel.readyState !== "open") continue;
      if (
        channelKind === "clock" &&
        channel.bufferedAmount > MAX_CLOCK_BUFFERED_BYTES
      ) {
        continue;
      }
      try {
        channel.send(serialized);
        sent += 1;
      } catch (error: unknown) {
        this.#reportError(error);
      }
    }

    return sent;
  }

  #buildSnapshot(): PeerGroupSnapshot {
    const peers = Array.from(this.#links.values(), (link): PeerSnapshot => {
      const controlOpen = link.control?.readyState === "open";
      const clockOpen = link.clock?.readyState === "open";
      return {
        peerId: link.remoteId,
        connectionState: link.connection.connectionState,
        controlOpen,
        clockOpen,
        ready: controlOpen && clockOpen,
      };
    }).sort((left, right) => left.peerId.localeCompare(right.peerId));
    const readyPeerCount = peers.filter((peer) => peer.ready).length;
    if (readyPeerCount > 0) this.#everReady = true;
    const guestConnectionLost =
      this.role === "guest" && this.#everReady && readyPeerCount === 0;
    let state: PeerGroupState;
    if (this.#closed) state = "closed";
    else if (
      this.#signaling.state === "error" ||
      this.#signaling.state === "closed"
    ) {
      state = "failed";
    } else if (guestConnectionLost) state = "failed";
    else if (this.#signaling.state !== "open") state = "connecting";
    else if (readyPeerCount > 0) state = "connected";
    else if (this.role === "host") state = "waiting";
    else state = "connecting";

    return {
      role: this.role,
      roomCode: this.roomCode,
      peerId: this.peerId,
      state,
      signalingState: this.#signaling.state,
      ready: readyPeerCount > 0,
      readyPeerCount,
      peerCount: peers.length,
      maxPeers: this.maxPeers,
      peers,
    };
  }

  #emitState(): void {
    this.#snapshot = this.#buildSnapshot();
    if (this.#closed && this.#stateListeners.size === 0) return;
    for (const listener of this.#stateListeners) listener(this.#snapshot);
  }

  #reportError(error: unknown): void {
    const normalized =
      error instanceof Error ? error : new Error("Peer sync failed", { cause: error });
    for (const listener of this.#errorListeners) listener(normalized);
  }
}

function resolveSharedOptions<ControlMessage, ClockMessage>(
  options: SharedPeerGroupOptions<ControlMessage, ClockMessage>,
): Pick<
  ResolvedPeerGroupOptions<ControlMessage, ClockMessage>,
  | "peerConnectionFactory"
  | "rtcConfiguration"
  | "now"
  | "onControl"
  | "onClock"
  | "onError"
> {
  return {
    peerConnectionFactory:
      options.peerConnectionFactory ??
      ((configuration) => new RTCPeerConnection(configuration)),
    rtcConfiguration: options.rtcConfiguration ?? DEFAULT_RTC_CONFIGURATION,
    now:
      options.now ??
      (() =>
        typeof performance === "undefined" ? Date.now() : performance.now()),
    onControl: options.onControl,
    onClock: options.onClock,
    onError: options.onError,
  };
}
