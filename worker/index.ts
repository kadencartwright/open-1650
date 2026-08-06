import { DurableObject } from "cloudflare:workers";

const ROOM_PATTERN = /^[2-9A-HJ-NP-Z]{6}$/u;
const PEER_PATTERN = /^[A-Za-z0-9_-]{8,80}$/u;
const MAX_SIGNAL_BYTES = 64 * 1024;
const MAX_ROOM_CONNECTIONS = 4;

interface SocketAttachment {
  roomCode: string;
  peerId: string;
}

interface SignalEnvelope {
  version: 1;
  roomCode: string;
  from: string;
  to: string;
  signal: {
    kind: "sdp" | "ice";
  };
}

interface WorkerEnv {
  ASSETS: Fetcher;
  SYNC_ROOMS: DurableObjectNamespace<SyncRoom>;
}

function websocketResponse(socket: WebSocket): Response {
  return new Response(null, {
    status: 101,
    webSocket: socket,
  } as ResponseInit & { webSocket: WebSocket });
}

export class SyncRoom extends DurableObject<WorkerEnv> {
  fetch(request: Request): Response {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket upgrade required", { status: 426 });
    }

    const url = new URL(request.url);
    const roomCode = url.searchParams.get("room")?.toUpperCase() ?? "";
    const peerId = url.searchParams.get("peer") ?? "";
    if (!ROOM_PATTERN.test(roomCode) || !PEER_PATTERN.test(peerId)) {
      return new Response("Invalid group connection", { status: 400 });
    }

    const peers = this.ctx.getWebSockets();
    if (peers.length >= MAX_ROOM_CONNECTIONS) {
      return new Response("Group is full", { status: 409 });
    }
    if (
      peers.some(
        (peer) =>
          (peer.deserializeAttachment() as SocketAttachment | null)?.peerId ===
          peerId,
      )
    ) {
      return new Response("Device is already connected", { status: 409 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.serializeAttachment({ roomCode, peerId } satisfies SocketAttachment);
    this.ctx.acceptWebSocket(server);
    return websocketResponse(client);
  }

  webSocketMessage(sender: WebSocket, message: string | ArrayBuffer): void {
    const size =
      typeof message === "string"
        ? new TextEncoder().encode(message).byteLength
        : message.byteLength;

    if (size > MAX_SIGNAL_BYTES) {
      sender.close(1009, "Signal is too large");
      return;
    }

    if (typeof message !== "string") {
      sender.close(1003, "Text signaling messages are required");
      return;
    }
    const attachment = sender.deserializeAttachment() as SocketAttachment | null;
    const signal = parseSignalEnvelope(message);
    if (
      !attachment ||
      !signal ||
      signal.roomCode !== attachment.roomCode ||
      signal.from !== attachment.peerId
    ) {
      sender.close(1008, "Invalid signaling message");
      return;
    }

    for (const peer of this.ctx.getWebSockets()) {
      if (peer === sender) continue;
      const target = peer.deserializeAttachment() as SocketAttachment | null;
      if (
        target?.roomCode === attachment.roomCode &&
        (signal.to === "host" || signal.to === target.peerId)
      ) {
        peer.send(message);
      }
    }
  }

  webSocketError(socket: WebSocket): void {
    socket.close(1011, "Signaling connection failed");
  }
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/sync") {
      const room = url.searchParams.get("room")?.toUpperCase() ?? "";
      const peer = url.searchParams.get("peer") ?? "";
      if (!ROOM_PATTERN.test(room) || !PEER_PATTERN.test(peer)) {
        return new Response("Invalid group code", { status: 400 });
      }
      return env.SYNC_ROOMS.getByName(room).fetch(request);
    }

    return env.ASSETS.fetch(request);
  },
};

function parseSignalEnvelope(value: string): SignalEnvelope | null {
  let decoded: unknown;
  try {
    decoded = JSON.parse(value);
  } catch {
    return null;
  }
  if (!isRecord(decoded) || decoded.version !== 1) return null;
  if (
    typeof decoded.roomCode !== "string" ||
    !ROOM_PATTERN.test(decoded.roomCode) ||
    typeof decoded.from !== "string" ||
    !PEER_PATTERN.test(decoded.from) ||
    typeof decoded.to !== "string" ||
    (decoded.to !== "host" && !PEER_PATTERN.test(decoded.to)) ||
    !isRecord(decoded.signal)
  ) {
    return null;
  }

  if (decoded.signal.kind === "sdp") {
    const description = decoded.signal.description;
    if (
      !isRecord(description) ||
      (description.type !== "offer" && description.type !== "answer") ||
      typeof description.sdp !== "string" ||
      description.sdp.length === 0 ||
      description.sdp.length > 1_000_000
    ) {
      return null;
    }
  } else if (decoded.signal.kind === "ice") {
    const candidate = decoded.signal.candidate;
    if (
      candidate !== null &&
      (!isRecord(candidate) ||
        typeof candidate.candidate !== "string" ||
        candidate.candidate.length > 8_192)
    ) {
      return null;
    }
  } else {
    return null;
  }

  return decoded as unknown as SignalEnvelope;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
