export type TransportPlayback = "playing" | "paused";

/**
 * Versions are ordered lexicographically. A newly elected host must choose an
 * epoch greater than every epoch observed in the room; revisions then increase
 * for each command issued by that host.
 */
export interface TransportVersion {
  readonly epoch: number;
  readonly revision: number;
}

/** A transport anchor expressed entirely in the host's monotonic clock. */
export interface CanonicalTransportState extends TransportVersion {
  readonly playback: TransportPlayback;
  readonly tick: number;
  readonly bpm: number;
  readonly effectiveHostMs: number;
}

export interface ProjectedTransportState {
  readonly playback: TransportPlayback;
  readonly tick: number;
  readonly bpm: number;
  readonly hostMs: number;
}

export interface DriftPolicy {
  /** Differences through this threshold are inaudible enough to leave alone. */
  readonly ignoreThresholdMs: number;
  /** Differences at or above this threshold require a discontinuous seek. */
  readonly hardResyncThresholdMs: number;
  /** Preferred time over which a moderate difference is removed. */
  readonly slewWindowMs: number;
  /** Maximum absolute playback-rate change while slewing (0.05 = 5%). */
  readonly maximumSlewRate: number;
}

/**
 * Twenty milliseconds avoids chasing clock jitter. At 120ms, an audible echo
 * is already present, so seeking is less disruptive than a long tempo bend.
 */
export const DEFAULT_DRIFT_POLICY: Readonly<DriftPolicy> = Object.freeze({
  ignoreThresholdMs: 20,
  hardResyncThresholdMs: 120,
  slewWindowMs: 2_000,
  maximumSlewRate: 0.05,
});

// Tick-to-time conversion can land a few floating-point ULPs either side of a
// policy boundary. A microsecond tolerance keeps those boundaries stable while
// remaining far below any observable audio timing difference.
const DRIFT_BOUNDARY_EPSILON_MS = 0.000_001;

interface DriftDecisionBase {
  /** `targetTick - localTick`; positive means the local player is behind. */
  readonly driftTicks: number;
  readonly driftMs: number;
  readonly targetTick: number;
}

export interface IgnoreDriftDecision extends DriftDecisionBase {
  readonly kind: "ignore";
  readonly rateMultiplier: 1;
}

export interface SlewDriftDecision extends DriftDecisionBase {
  readonly kind: "slew";
  readonly rateMultiplier: number;
  readonly recoveryMs: number;
}

export interface HardResyncDriftDecision extends DriftDecisionBase {
  readonly kind: "hard-resync";
}

export type DriftDecision =
  | IgnoreDriftDecision
  | SlewDriftDecision
  | HardResyncDriftDecision;

export interface TickDriftInput {
  readonly localTick: number;
  readonly targetTick: number;
  readonly bpm: number;
  readonly ppq: number;
}

function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be finite.`);
  }
}

function assertPositive(value: number, name: string): void {
  assertFinite(value, name);
  if (value <= 0) {
    throw new RangeError(`${name} must be greater than 0.`);
  }
}

function assertVersion(version: TransportVersion, name: string): void {
  if (!Number.isSafeInteger(version.epoch) || version.epoch < 0) {
    throw new RangeError(`${name}.epoch must be a non-negative safe integer.`);
  }
  if (!Number.isSafeInteger(version.revision) || version.revision < 0) {
    throw new RangeError(`${name}.revision must be a non-negative safe integer.`);
  }
}

function assertPolicy(policy: DriftPolicy): void {
  assertFinite(policy.ignoreThresholdMs, "ignoreThresholdMs");
  assertFinite(policy.hardResyncThresholdMs, "hardResyncThresholdMs");
  assertPositive(policy.slewWindowMs, "slewWindowMs");
  assertFinite(policy.maximumSlewRate, "maximumSlewRate");

  if (policy.ignoreThresholdMs < 0) {
    throw new RangeError("ignoreThresholdMs must be non-negative.");
  }
  if (policy.hardResyncThresholdMs <= policy.ignoreThresholdMs) {
    throw new RangeError(
      "hardResyncThresholdMs must be greater than ignoreThresholdMs.",
    );
  }
  if (policy.maximumSlewRate <= 0 || policy.maximumSlewRate >= 1) {
    throw new RangeError("maximumSlewRate must be greater than 0 and below 1.");
  }
}

export function ticksToMilliseconds(
  ticks: number,
  bpm: number,
  ppq: number,
): number {
  assertFinite(ticks, "ticks");
  assertPositive(bpm, "bpm");
  assertPositive(ppq, "ppq");
  return (ticks * 60_000) / (bpm * ppq);
}

export function millisecondsToTicks(
  milliseconds: number,
  bpm: number,
  ppq: number,
): number {
  assertFinite(milliseconds, "milliseconds");
  assertPositive(bpm, "bpm");
  assertPositive(ppq, "ppq");
  return (milliseconds * bpm * ppq) / 60_000;
}

/**
 * Projects a canonical anchor to a host time. A future play anchor remains at
 * its start tick until its effective time, which permits coordinated starts.
 */
export function projectTransportState(
  state: CanonicalTransportState,
  hostNowMs: number,
  ppq: number,
  durationTicks = Number.POSITIVE_INFINITY,
): ProjectedTransportState {
  assertVersion(state, "state");
  assertFinite(state.tick, "state.tick");
  assertPositive(state.bpm, "state.bpm");
  assertFinite(state.effectiveHostMs, "state.effectiveHostMs");
  assertFinite(hostNowMs, "hostNowMs");
  assertPositive(ppq, "ppq");
  if (state.tick < 0) {
    throw new RangeError("state.tick must be non-negative.");
  }
  if (
    durationTicks !== Number.POSITIVE_INFINITY &&
    (!Number.isFinite(durationTicks) || durationTicks < 0)
  ) {
    throw new RangeError("durationTicks must be non-negative or Infinity.");
  }

  const elapsedMs =
    state.playback === "playing"
      ? Math.max(0, hostNowMs - state.effectiveHostMs)
      : 0;
  const projectedTick =
    state.tick + millisecondsToTicks(elapsedMs, state.bpm, ppq);

  return {
    playback: state.playback,
    tick: Math.min(projectedTick, durationTicks),
    bpm: state.bpm,
    hostMs: hostNowMs,
  };
}

/** Returns a negative number when `left` is older than `right`. */
export function compareTransportVersions(
  left: TransportVersion,
  right: TransportVersion,
): number {
  assertVersion(left, "left");
  assertVersion(right, "right");

  if (left.epoch !== right.epoch) return left.epoch - right.epoch;
  return left.revision - right.revision;
}

/** Duplicate, old-revision, and old-epoch packets are all rejected. */
export function shouldAcceptTransportUpdate(
  current: TransportVersion | null,
  incoming: TransportVersion,
): boolean {
  assertVersion(incoming, "incoming");
  return current === null || compareTransportVersions(incoming, current) > 0;
}

/** Pure reducer that keeps the current state when an update is stale. */
export function reduceTransportState<T extends TransportVersion>(
  current: T | null,
  incoming: T,
): T {
  return shouldAcceptTransportUpdate(current, incoming)
    ? incoming
    : (current as T);
}

/**
 * Chooses whether to tolerate, gradually correct, or immediately seek a
 * transport error. Slew speed is bounded even when the preferred recovery
 * window would demand too large a tempo change.
 */
export function classifyTickDrift(
  input: TickDriftInput,
  policy: DriftPolicy = DEFAULT_DRIFT_POLICY,
): DriftDecision {
  assertFinite(input.localTick, "localTick");
  assertFinite(input.targetTick, "targetTick");
  assertPolicy(policy);

  const driftTicks = input.targetTick - input.localTick;
  const driftMs = ticksToMilliseconds(driftTicks, input.bpm, input.ppq);
  const absoluteDriftMs = Math.abs(driftMs);
  const base = { driftTicks, driftMs, targetTick: input.targetTick };

  if (
    absoluteDriftMs <=
    policy.ignoreThresholdMs + DRIFT_BOUNDARY_EPSILON_MS
  ) {
    return { ...base, kind: "ignore", rateMultiplier: 1 };
  }

  if (
    absoluteDriftMs + DRIFT_BOUNDARY_EPSILON_MS >=
    policy.hardResyncThresholdMs
  ) {
    return { ...base, kind: "hard-resync" };
  }

  const recoveryMs = Math.max(
    policy.slewWindowMs,
    absoluteDriftMs / policy.maximumSlewRate,
  );
  const rateMultiplier = 1 + driftMs / recoveryMs;

  return {
    ...base,
    kind: "slew",
    rateMultiplier,
    recoveryMs,
  };
}
