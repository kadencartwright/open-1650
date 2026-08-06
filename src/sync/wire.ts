export const SYNC_PROTOCOL_VERSION = 1 as const;
export const HOST_SIGNAL_TARGET = "host" as const;
export const CONTROL_CHANNEL_LABEL = "open1650-control-v1" as const;
export const CLOCK_CHANNEL_LABEL = "open1650-clock-v1" as const;

const ROOM_CODE_LENGTH = 6;
const ROOM_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const ROOM_CODE_PATTERN = /^[2-9A-HJ-NP-Z]{6}$/;
const PEER_ID_PATTERN = /^[A-Za-z0-9_-]{8,80}$/;
const MAX_SDP_LENGTH = 1_000_000;
const MAX_CANDIDATE_LENGTH = 8_192;

export type RoomCode = string;
export type PeerId = string;

export interface SdpSignal {
  kind: "sdp";
  description: RTCSessionDescriptionInit;
}

export interface IceSignal {
  kind: "ice";
  candidate: RTCIceCandidateInit | null;
}

export type PeerSignal = SdpSignal | IceSignal;

/**
 * The signaling plane is intentionally restricted to peer negotiation. Player
 * commands and clock samples travel over the peer-to-peer data channels.
 */
export interface SignalEnvelope {
  version: typeof SYNC_PROTOCOL_VERSION;
  roomCode: RoomCode;
  from: PeerId;
  to: PeerId | typeof HOST_SIGNAL_TARGET;
  signal: PeerSignal;
}

export interface DataChannelPacket<T = unknown> {
  version: typeof SYNC_PROTOCOL_VERSION;
  channel: "control" | "clock";
  sequence: number;
  sentAt: number;
  payload: T;
}

export function normalizeRoomCode(value: string): RoomCode {
  return value.toUpperCase().replace(/[\s-]+/g, "");
}

export function isRoomCode(value: unknown): value is RoomCode {
  return typeof value === "string" && ROOM_CODE_PATTERN.test(value);
}

export function generateRoomCode(
  getRandomValues: (values: Uint8Array<ArrayBuffer>) => void = (values) => {
    crypto.getRandomValues(values);
  },
): RoomCode {
  // Rejection sampling avoids bias because the alphabet length is not a power
  // of two. Room codes are conveniences, not authorization secrets.
  const code: string[] = [];
  const limit = Math.floor(256 / ROOM_CODE_ALPHABET.length) * ROOM_CODE_ALPHABET.length;

  while (code.length < ROOM_CODE_LENGTH) {
    const values = new Uint8Array(new ArrayBuffer(ROOM_CODE_LENGTH));
    getRandomValues(values);
    for (const value of values) {
      if (value >= limit) continue;
      code.push(ROOM_CODE_ALPHABET[value % ROOM_CODE_ALPHABET.length]);
      if (code.length === ROOM_CODE_LENGTH) break;
    }
  }

  return code.join("");
}

export function createPeerId(): PeerId {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const values = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(values, (value) => value.toString(16).padStart(2, "0")).join("");
}

export function isSignalEnvelope(value: unknown): value is SignalEnvelope {
  if (!isRecord(value)) return false;
  if (value.version !== SYNC_PROTOCOL_VERSION) return false;
  if (!isRoomCode(value.roomCode)) return false;
  if (!isPeerId(value.from)) return false;
  if (value.to !== HOST_SIGNAL_TARGET && !isPeerId(value.to)) return false;
  if (!isRecord(value.signal)) return false;

  if (value.signal.kind === "sdp") {
    return isSessionDescription(value.signal.description);
  }

  if (value.signal.kind === "ice") {
    return value.signal.candidate === null || isIceCandidate(value.signal.candidate);
  }

  return false;
}

export function serializeDataChannelPacket<T>(
  packet: DataChannelPacket<T>,
): string {
  const serialized = JSON.stringify(packet);
  if (serialized === undefined) {
    throw new TypeError("Sync messages must be JSON-serializable");
  }
  return serialized;
}

export function parseDataChannelPacket<T = unknown>(
  value: unknown,
  expectedChannel?: DataChannelPacket["channel"],
): DataChannelPacket<T> | undefined {
  let decoded: unknown = value;
  if (typeof value === "string") {
    try {
      decoded = JSON.parse(value);
    } catch {
      return undefined;
    }
  }

  if (!isRecord(decoded)) return undefined;
  if (decoded.version !== SYNC_PROTOCOL_VERSION) return undefined;
  if (decoded.channel !== "control" && decoded.channel !== "clock") {
    return undefined;
  }
  if (expectedChannel !== undefined && decoded.channel !== expectedChannel) {
    return undefined;
  }
  if (!Number.isSafeInteger(decoded.sequence) || (decoded.sequence as number) < 0) {
    return undefined;
  }
  if (typeof decoded.sentAt !== "number" || !Number.isFinite(decoded.sentAt)) {
    return undefined;
  }
  if (!("payload" in decoded)) return undefined;

  return decoded as unknown as DataChannelPacket<T>;
}

export function isPeerId(value: unknown): value is PeerId {
  return typeof value === "string" && PEER_ID_PATTERN.test(value);
}

function isSessionDescription(value: unknown): value is RTCSessionDescriptionInit {
  if (!isRecord(value)) return false;
  if (value.type !== "offer" && value.type !== "answer") return false;
  return (
    typeof value.sdp === "string" &&
    value.sdp.length > 0 &&
    value.sdp.length <= MAX_SDP_LENGTH
  );
}

function isIceCandidate(value: unknown): value is RTCIceCandidateInit {
  if (!isRecord(value)) return false;
  if (
    typeof value.candidate !== "string" ||
    value.candidate.length > MAX_CANDIDATE_LENGTH
  ) {
    return false;
  }

  return optionalString(value.sdpMid) && optionalNumber(value.sdpMLineIndex);
}

function optionalString(value: unknown): boolean {
  return value === undefined || value === null || typeof value === "string";
}

function optionalNumber(value: unknown): boolean {
  return value === undefined || value === null || Number.isInteger(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
