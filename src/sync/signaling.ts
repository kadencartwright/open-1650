import {
  HOST_SIGNAL_TARGET,
  isSignalEnvelope,
  type PeerId,
  type RoomCode,
  type SignalEnvelope,
} from "./wire";

export const HMR_SIGNAL_EVENT = "open1650:sync:signal" as const;
export const HMR_REGISTER_EVENT = "open1650:sync:register" as const;
const WEB_SOCKET_OPEN = 1;

export interface HotSignalingRegistration {
  roomCode: RoomCode;
  peerId: PeerId;
}

export type SignalingState = "connecting" | "open" | "closed" | "error";
export type SignalListener = (message: SignalEnvelope) => void;
export type SignalingStateListener = (state: SignalingState) => void;

export interface SignalingTransport {
  readonly state: SignalingState;
  send(message: SignalEnvelope): boolean;
  onSignal(listener: SignalListener): () => void;
  onStateChange(listener: SignalingStateListener): () => void;
  close(): void;
}

export interface HotSignalingChannel {
  send(event: typeof HMR_SIGNAL_EVENT, data: SignalEnvelope): void;
  send(
    event: typeof HMR_REGISTER_EVENT,
    data: HotSignalingRegistration,
  ): void;
  on(
    event: typeof HMR_SIGNAL_EVENT,
    listener: (data: unknown) => void,
  ): void;
  off(
    event: typeof HMR_SIGNAL_EVENT,
    listener: (data: unknown) => void,
  ): void;
}

export interface SignalingOptions {
  roomCode: RoomCode;
  peerId: PeerId;
  /** Defaults to same-origin `/api/sync`. */
  websocketUrl?: string | URL;
  hot?: HotSignalingChannel;
  websocketFactory?: (url: string) => WebSocket;
}

/**
 * Uses Vite's already-open HMR socket during local development. Production
 * falls back to a same-origin native WebSocket relay at `/api/sync`.
 */
export function createSignalingTransport(
  options: SignalingOptions,
): SignalingTransport {
  const hot = options.hot ?? (import.meta.hot as HotSignalingChannel | undefined);
  if (hot !== undefined) {
    return new HotModuleSignaling(options.roomCode, options.peerId, hot);
  }

  return new WebSocketSignaling(options);
}

export class HotModuleSignaling implements SignalingTransport {
  readonly #roomCode: RoomCode;
  readonly #peerId: PeerId;
  readonly #hot: HotSignalingChannel;
  readonly #signalListeners = new Set<SignalListener>();
  readonly #stateListeners = new Set<SignalingStateListener>();
  #state: SignalingState = "open";

  readonly #receive = (value: unknown) => {
    if (!isSignalEnvelope(value)) return;
    if (value.roomCode !== this.#roomCode || value.from === this.#peerId) return;
    for (const listener of this.#signalListeners) listener(value);
  };

  constructor(roomCode: RoomCode, peerId: PeerId, hot: HotSignalingChannel) {
    this.#roomCode = roomCode;
    this.#peerId = peerId;
    this.#hot = hot;
    hot.on(HMR_SIGNAL_EVENT, this.#receive);
    hot.send(HMR_REGISTER_EVENT, { roomCode, peerId });
  }

  get state(): SignalingState {
    return this.#state;
  }

  send(message: SignalEnvelope): boolean {
    if (this.#state !== "open") return false;
    if (
      !isSignalEnvelope(message) ||
      message.roomCode !== this.#roomCode ||
      message.from !== this.#peerId
    ) {
      throw new TypeError("Invalid or cross-room sync signal");
    }
    this.#hot.send(HMR_SIGNAL_EVENT, message);
    return true;
  }

  onSignal(listener: SignalListener): () => void {
    this.#signalListeners.add(listener);
    return () => this.#signalListeners.delete(listener);
  }

  onStateChange(listener: SignalingStateListener): () => void {
    this.#stateListeners.add(listener);
    return () => this.#stateListeners.delete(listener);
  }

  close(): void {
    if (this.#state === "closed") return;
    this.#hot.off(HMR_SIGNAL_EVENT, this.#receive);
    this.#state = "closed";
    for (const listener of this.#stateListeners) listener(this.#state);
    this.#signalListeners.clear();
    this.#stateListeners.clear();
  }
}

export class WebSocketSignaling implements SignalingTransport {
  readonly #roomCode: RoomCode;
  readonly #peerId: PeerId;
  readonly #socket: WebSocket;
  readonly #signalListeners = new Set<SignalListener>();
  readonly #stateListeners = new Set<SignalingStateListener>();
  #state: SignalingState = "connecting";

  constructor(options: SignalingOptions) {
    this.#roomCode = options.roomCode;
    this.#peerId = options.peerId;
    const createSocket = options.websocketFactory ?? ((url: string) => new WebSocket(url));
    this.#socket = createSocket(createWebSocketUrl(options));

    this.#socket.addEventListener("open", () => this.#setState("open"));
    this.#socket.addEventListener("error", () => this.#setState("error"));
    this.#socket.addEventListener("close", () => this.#setState("closed"));
    this.#socket.addEventListener("message", (event) => {
      void this.#receive(event.data);
    });
  }

  get state(): SignalingState {
    return this.#state;
  }

  send(message: SignalEnvelope): boolean {
    if (this.#state !== "open" || this.#socket.readyState !== WEB_SOCKET_OPEN) {
      return false;
    }
    if (
      !isSignalEnvelope(message) ||
      message.roomCode !== this.#roomCode ||
      message.from !== this.#peerId
    ) {
      throw new TypeError("Invalid or cross-room sync signal");
    }
    this.#socket.send(JSON.stringify(message));
    return true;
  }

  onSignal(listener: SignalListener): () => void {
    this.#signalListeners.add(listener);
    return () => this.#signalListeners.delete(listener);
  }

  onStateChange(listener: SignalingStateListener): () => void {
    this.#stateListeners.add(listener);
    return () => this.#stateListeners.delete(listener);
  }

  close(): void {
    if (this.#state === "closed") return;
    this.#socket.close(1000, "Sync session closed");
    this.#setState("closed");
    this.#signalListeners.clear();
    this.#stateListeners.clear();
  }

  async #receive(value: unknown): Promise<void> {
    let text: string;
    if (typeof value === "string") {
      text = value;
    } else if (value instanceof Blob) {
      text = await value.text();
    } else if (value instanceof ArrayBuffer) {
      text = new TextDecoder().decode(value);
    } else {
      return;
    }

    let decoded: unknown;
    try {
      decoded = JSON.parse(text);
    } catch {
      return;
    }
    if (!isSignalEnvelope(decoded)) return;
    if (decoded.roomCode !== this.#roomCode || decoded.from === this.#peerId) return;
    for (const listener of this.#signalListeners) listener(decoded);
  }

  #setState(state: SignalingState): void {
    if (state === this.#state) return;
    this.#state = state;
    for (const listener of this.#stateListeners) listener(state);
  }
}

function createWebSocketUrl(options: SignalingOptions): string {
  const base = options.websocketUrl ?? "/api/sync";
  const fallbackOrigin =
    typeof location === "undefined" ? "http://localhost" : location.href;
  const url = new URL(base, fallbackOrigin);

  if (url.protocol === "http:") url.protocol = "ws:";
  if (url.protocol === "https:") url.protocol = "wss:";
  url.searchParams.set("room", options.roomCode);
  url.searchParams.set("peer", options.peerId);
  return url.toString();
}

export function isSignalForPeer(
  message: SignalEnvelope,
  peerId: PeerId,
  acceptHostTarget: boolean,
): boolean {
  return (
    message.to === peerId ||
    (acceptHostTarget && message.to === HOST_SIGNAL_TARGET)
  );
}
