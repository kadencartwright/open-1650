import { describe, expect, it } from "vitest";
import {
  calculateClockSample,
  estimateClockOffset,
  hostToLocalTime,
  localToHostTime,
  selectLowRttSamples,
  type ClockSample,
} from "../src/sync/clock";

function sample(offsetMs: number, roundTripMs: number): ClockSample {
  return {
    localSendMs: 0,
    hostReceiveMs: offsetMs + roundTripMs / 2,
    hostSendMs: offsetMs + roundTripMs / 2,
    localReceiveMs: roundTripMs,
    offsetMs,
    roundTripMs,
    localMidpointMs: roundTripMs / 2,
    hostMidpointMs: offsetMs + roundTripMs / 2,
  };
}

describe("peer clock synchronization", () => {
  it("derives host-minus-local offset and network RTT from four timestamps", () => {
    const measured = calculateClockSample({
      localSendMs: 100,
      hostReceiveMs: 1_110,
      hostSendMs: 1_114,
      localReceiveMs: 114,
    });

    expect(measured.offsetMs).toBe(1_005);
    expect(measured.roundTripMs).toBe(10);
    expect(measured.localMidpointMs).toBe(107);
    expect(measured.hostMidpointMs).toBe(1_112);
  });

  it("converts between independent performance.now clock domains", () => {
    const hostMs = localToHostTime(8_250.5, 1_005.25);

    expect(hostMs).toBe(9_255.75);
    expect(hostToLocalTime(hostMs, 1_005.25)).toBe(8_250.5);
  });

  it("selects only the low-delay portion without mutating the sample burst", () => {
    const burst = [
      sample(501, 12),
      sample(499, 8),
      sample(800, 240),
      sample(500, 10),
      sample(200, 180),
      sample(502, 14),
    ];
    const originalOrder = [...burst];

    const selected = selectLowRttSamples(burst);

    expect(selected.map(({ roundTripMs }) => roundTripMs)).toEqual([8, 10, 12]);
    expect(burst).toEqual(originalOrder);
  });

  it("uses a median of low-RTT offsets instead of queued packets", () => {
    const estimate = estimateClockOffset([
      sample(500, 8),
      sample(501, 10),
      sample(499, 12),
      sample(900, 160),
      sample(100, 180),
      sample(850, 220),
    ]);

    expect(estimate).toEqual({
      offsetMs: 500,
      roundTripMs: 10,
      offsetDeviationMs: 1,
      selectedSampleCount: 3,
      totalSampleCount: 6,
    });
  });

  it("rejects impossible or empty measurements", () => {
    expect(() =>
      calculateClockSample({
        localSendMs: 10,
        hostReceiveMs: 100,
        hostSendMs: 120,
        localReceiveMs: 20,
      }),
    ).toThrow(/processing interval/);
    expect(() => estimateClockOffset([])).toThrow(/At least one/);
  });
});
