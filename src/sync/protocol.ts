import type { VersionKey } from "../data/types";
import type { CanonicalTransportState } from "./transport";

export interface TogetherSelection {
  psalmNumber: number;
  version: VersionKey;
  /** The canonical tune slug, including the default tune. */
  tuneSlug: string;
  /** Guards against applying ticks to a performance with a different shape. */
  performanceId: string;
  transpose?: number;
}

export interface TogetherTransportMessage {
  kind: "transport";
  selection: TogetherSelection;
  transport: CanonicalTransportState;
}

export interface TogetherHelloMessage {
  kind: "hello";
  selection: TogetherSelection;
  transport: CanonicalTransportState;
}

export interface TogetherReadyMessage {
  kind: "ready";
  performanceId: string;
}

export type TogetherControlMessage =
  | TogetherHelloMessage
  | TogetherTransportMessage
  | TogetherReadyMessage;

export interface ClockPingMessage {
  kind: "ping";
  id: number;
  localSendMs: number;
}

export interface ClockPongMessage {
  kind: "pong";
  id: number;
  localSendMs: number;
  hostReceiveMs: number;
  hostSendMs: number;
}

export type TogetherClockMessage = ClockPingMessage | ClockPongMessage;

const TUNE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isTogetherSelection(
  value: unknown,
): value is TogetherSelection {
  if (!isRecord(value)) return false;
  return (
    Number.isSafeInteger(value.psalmNumber) &&
    (value.psalmNumber as number) >= 1 &&
    (value.psalmNumber as number) <= 150 &&
    (value.version === "primary" || value.version === "alternate") &&
    typeof value.tuneSlug === "string" &&
    TUNE_SLUG_PATTERN.test(value.tuneSlug) &&
    typeof value.performanceId === "string" &&
    value.performanceId.length > 0 &&
    value.performanceId.length <= 240
    && (value.transpose === undefined ||
      (Number.isInteger(value.transpose) && (value.transpose as number) >= -12 && (value.transpose as number) <= 12))
  );
}

export function isTogetherControlMessage(
  value: unknown,
): value is TogetherControlMessage {
  if (!isRecord(value) || typeof value.kind !== "string") return false;

  if (value.kind === "ready") {
    return (
      typeof value.performanceId === "string" &&
      value.performanceId.length > 0 &&
      value.performanceId.length <= 240
    );
  }

  return (
    (value.kind === "hello" || value.kind === "transport") &&
    isTogetherSelection(value.selection) &&
    isCanonicalTransportState(value.transport)
  );
}

export function isTogetherClockMessage(
  value: unknown,
): value is TogetherClockMessage {
  if (!isRecord(value) || !isNonNegativeInteger(value.id)) return false;
  if (value.kind === "ping") {
    return isFiniteNumber(value.localSendMs);
  }
  if (value.kind === "pong") {
    return (
      isFiniteNumber(value.localSendMs) &&
      isFiniteNumber(value.hostReceiveMs) &&
      isFiniteNumber(value.hostSendMs)
    );
  }
  return false;
}

export function sameTogetherSelection(
  left: TogetherSelection | null,
  right: TogetherSelection | null,
): boolean {
  return (
    left === right ||
    (left !== null &&
      right !== null &&
      left.psalmNumber === right.psalmNumber &&
      left.version === right.version &&
      left.tuneSlug === right.tuneSlug &&
      left.performanceId === right.performanceId &&
      (left.transpose ?? 0) === (right.transpose ?? 0))
  );
}

function isCanonicalTransportState(
  value: unknown,
): value is CanonicalTransportState {
  if (!isRecord(value)) return false;
  return (
    isNonNegativeInteger(value.epoch) &&
    isNonNegativeInteger(value.revision) &&
    (value.playback === "playing" || value.playback === "paused") &&
    isFiniteNumber(value.tick) &&
    value.tick >= 0 &&
    isFiniteNumber(value.bpm) &&
    value.bpm > 0 &&
    isFiniteNumber(value.effectiveHostMs)
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
