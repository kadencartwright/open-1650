import { describe, expect, it } from "vitest";
import {
  classifyTickDrift,
  compareTransportVersions,
  millisecondsToTicks,
  projectTransportState,
  reduceTransportState,
  shouldAcceptTransportUpdate,
  ticksToMilliseconds,
  type CanonicalTransportState,
} from "../src/sync/transport";

const paused: CanonicalTransportState = {
  epoch: 7,
  revision: 3,
  playback: "paused",
  tick: 960,
  bpm: 80,
  effectiveHostMs: 10_000,
};

describe("synchronized musical timeline", () => {
  it("holds future and paused anchors at their declared tick", () => {
    const playing = { ...paused, playback: "playing" as const };
    expect(projectTransportState(playing, 9_000, 480).tick).toBe(960);
    expect(projectTransportState(paused, 25_000, 480).tick).toBe(960);
  });

  it("projects a playing anchor in musical ticks and clamps its end", () => {
    const playing = { ...paused, playback: "playing" as const };
    expect(projectTransportState(playing, 11_500, 480).tick).toBe(1_920);
    expect(projectTransportState(playing, 30_000, 480, 2_400).tick).toBe(
      2_400,
    );
  });

  it("round-trips ticks and milliseconds", () => {
    const milliseconds = ticksToMilliseconds(731, 84, 480);
    expect(millisecondsToTicks(milliseconds, 84, 480)).toBeCloseTo(731, 10);
  });

  it("orders epochs before revisions and rejects stale packets", () => {
    expect(
      compareTransportVersions(
        { epoch: 8, revision: 0 },
        { epoch: 7, revision: 999 },
      ),
    ).toBeGreaterThan(0);
    expect(
      shouldAcceptTransportUpdate(paused, { epoch: 7, revision: 3 }),
    ).toBe(false);
    expect(
      reduceTransportState(paused, { ...paused, revision: 2, tick: 0 }),
    ).toBe(paused);
  });

  it("ignores sub-20ms drift and slews moderate drift", () => {
    expect(
      classifyTickDrift({
        localTick: 1_000,
        targetTick: 1_010,
        bpm: 60,
        ppq: 1_000,
      }).kind,
    ).toBe("ignore");
    const correction = classifyTickDrift({
      localTick: 1_000,
      targetTick: 1_060,
      bpm: 60,
      ppq: 1_000,
    });
    expect(correction.kind).toBe("slew");
    if (correction.kind === "slew") {
      expect(correction.rateMultiplier).toBeGreaterThan(1);
      expect(correction.rateMultiplier).toBeLessThanOrEqual(1.05);
    }
  });

  it("hard-resyncs at the 120ms boundary in either direction", () => {
    expect(
      classifyTickDrift({
        localTick: 1_000,
        targetTick: 1_120,
        bpm: 60,
        ppq: 1_000,
      }).kind,
    ).toBe("hard-resync");
    expect(
      classifyTickDrift({
        localTick: 1_120,
        targetTick: 1_000,
        bpm: 60,
        ppq: 1_000,
      }).kind,
    ).toBe("hard-resync");
  });
});
