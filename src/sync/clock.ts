/**
 * One four-timestamp clock exchange.
 *
 * Local timestamps must come from the joining peer's `performance.now()`
 * clock. Host timestamps must come from the host peer's `performance.now()`
 * clock. The clocks do not need to share an origin.
 */
export interface ClockExchange {
  readonly localSendMs: number;
  readonly hostReceiveMs: number;
  readonly hostSendMs: number;
  readonly localReceiveMs: number;
}

/** A measured host-minus-local clock offset and its network delay. */
export interface ClockSample extends ClockExchange {
  /** Add this value to a local timestamp to express it in host time. */
  readonly offsetMs: number;
  /** Network round-trip time with time spent processing at the host removed. */
  readonly roundTripMs: number;
  readonly localMidpointMs: number;
  readonly hostMidpointMs: number;
}

export interface ClockSelectionOptions {
  /** Fraction of the lowest-delay samples to retain. Defaults to 35%. */
  readonly lowRttFraction?: number;
  /** Retain at least this many samples when available. Defaults to 3. */
  readonly minimumSamples?: number;
  /** Never retain more than this many samples. Defaults to 8. */
  readonly maximumSamples?: number;
}

export interface ClockEstimate {
  /** Median host-minus-local offset of the retained low-RTT samples. */
  readonly offsetMs: number;
  /** Median round-trip delay of the retained samples. */
  readonly roundTripMs: number;
  /** Median absolute deviation of the retained offsets. */
  readonly offsetDeviationMs: number;
  readonly selectedSampleCount: number;
  readonly totalSampleCount: number;
}

const DEFAULT_LOW_RTT_FRACTION = 0.35;
const DEFAULT_MINIMUM_SAMPLES = 3;
const DEFAULT_MAXIMUM_SAMPLES = 8;

function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be finite.`);
  }
}

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer.`);
  }
}

function median(values: readonly number[]): number {
  if (values.length === 0) {
    throw new RangeError("Cannot take the median of an empty collection.");
  }

  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  if (ordered.length % 2 === 1) return ordered[middle];
  return (ordered[middle - 1] + ordered[middle]) / 2;
}

/**
 * Applies the standard NTP four-timestamp calculation to monotonic clocks.
 * The result's offset convention is always `hostMs - localMs`.
 */
export function calculateClockSample(exchange: ClockExchange): ClockSample {
  const {
    localSendMs,
    hostReceiveMs,
    hostSendMs,
    localReceiveMs,
  } = exchange;

  assertFinite(localSendMs, "localSendMs");
  assertFinite(hostReceiveMs, "hostReceiveMs");
  assertFinite(hostSendMs, "hostSendMs");
  assertFinite(localReceiveMs, "localReceiveMs");

  if (localReceiveMs < localSendMs) {
    throw new RangeError("localReceiveMs must not precede localSendMs.");
  }
  if (hostSendMs < hostReceiveMs) {
    throw new RangeError("hostSendMs must not precede hostReceiveMs.");
  }

  const localElapsedMs = localReceiveMs - localSendMs;
  const hostProcessingMs = hostSendMs - hostReceiveMs;
  const roundTripMs = localElapsedMs - hostProcessingMs;
  if (roundTripMs < 0) {
    throw new RangeError(
      "The host processing interval cannot exceed the local round trip.",
    );
  }

  const localMidpointMs = (localSendMs + localReceiveMs) / 2;
  const hostMidpointMs = (hostReceiveMs + hostSendMs) / 2;

  return {
    ...exchange,
    offsetMs: hostMidpointMs - localMidpointMs,
    roundTripMs,
    localMidpointMs,
    hostMidpointMs,
  };
}

/**
 * Keeps the fastest portion of a sample burst. Queueing delay can only make a
 * packet slower, so low-RTT samples are the least contaminated by asymmetry.
 */
export function selectLowRttSamples(
  samples: readonly ClockSample[],
  options: ClockSelectionOptions = {},
): ClockSample[] {
  const fraction = options.lowRttFraction ?? DEFAULT_LOW_RTT_FRACTION;
  const minimum = options.minimumSamples ?? DEFAULT_MINIMUM_SAMPLES;
  const maximum = options.maximumSamples ?? DEFAULT_MAXIMUM_SAMPLES;

  if (!Number.isFinite(fraction) || fraction <= 0 || fraction > 1) {
    throw new RangeError("lowRttFraction must be greater than 0 and at most 1.");
  }
  assertNonNegativeInteger(minimum, "minimumSamples");
  assertNonNegativeInteger(maximum, "maximumSamples");
  if (maximum === 0) {
    throw new RangeError("maximumSamples must be greater than 0.");
  }
  if (minimum > maximum) {
    throw new RangeError("minimumSamples must not exceed maximumSamples.");
  }

  for (const [index, sample] of samples.entries()) {
    assertFinite(sample.offsetMs, `samples[${index}].offsetMs`);
    assertFinite(sample.roundTripMs, `samples[${index}].roundTripMs`);
    if (sample.roundTripMs < 0) {
      throw new RangeError(`samples[${index}].roundTripMs must be non-negative.`);
    }
  }

  const desiredCount = Math.max(
    Math.min(minimum, samples.length),
    Math.ceil(samples.length * fraction),
  );
  const selectedCount = Math.min(maximum, desiredCount, samples.length);

  return [...samples]
    .sort(
      (left, right) =>
        left.roundTripMs - right.roundTripMs ||
        left.offsetMs - right.offsetMs ||
        left.localMidpointMs - right.localMidpointMs,
    )
    .slice(0, selectedCount);
}

/** Builds a robust clock transform from a burst of clock exchanges. */
export function estimateClockOffset(
  samples: readonly ClockSample[],
  options: ClockSelectionOptions = {},
): ClockEstimate {
  if (samples.length === 0) {
    throw new RangeError("At least one clock sample is required.");
  }

  const selected = selectLowRttSamples(samples, options);
  const offsetMs = median(selected.map((sample) => sample.offsetMs));

  return {
    offsetMs,
    roundTripMs: median(selected.map((sample) => sample.roundTripMs)),
    offsetDeviationMs: median(
      selected.map((sample) => Math.abs(sample.offsetMs - offsetMs)),
    ),
    selectedSampleCount: selected.length,
    totalSampleCount: samples.length,
  };
}

/** Converts a local `performance.now()` value into the host clock domain. */
export function localToHostTime(localMs: number, offsetMs: number): number {
  assertFinite(localMs, "localMs");
  assertFinite(offsetMs, "offsetMs");
  return localMs + offsetMs;
}

/** Converts a host `performance.now()` value into the local clock domain. */
export function hostToLocalTime(hostMs: number, offsetMs: number): number {
  assertFinite(hostMs, "hostMs");
  assertFinite(offsetMs, "offsetMs");
  return hostMs - offsetMs;
}
