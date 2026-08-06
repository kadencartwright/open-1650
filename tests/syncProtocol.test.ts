import { describe, expect, it } from "vitest";
import {
  isTogetherClockMessage,
  isTogetherControlMessage,
  isTogetherSelection,
  sameTogetherSelection,
  type TogetherSelection,
} from "../src/sync/protocol";

const selection: TogetherSelection = {
  psalmNumber: 100,
  version: "primary",
  tuneSlug: "old-hundredth",
  performanceId: "ps1650.psalm.100.primary.setting.old-hundredth",
};

describe("together protocol", () => {
  it("validates a complete musical selection", () => {
    expect(isTogetherSelection(selection)).toBe(true);
    expect(isTogetherSelection({ ...selection, psalmNumber: 151 })).toBe(false);
    expect(isTogetherSelection({ ...selection, tuneSlug: "Old Hundredth" })).toBe(
      false,
    );
  });

  it("accepts canonical transport messages and rejects malformed data", () => {
    expect(
      isTogetherControlMessage({
        kind: "transport",
        selection,
        transport: {
          epoch: 9,
          revision: 3,
          playback: "playing",
          tick: 1_920,
          bpm: 84,
          effectiveHostMs: 12_345,
        },
      }),
    ).toBe(true);
    expect(
      isTogetherControlMessage({
        kind: "transport",
        selection,
        transport: {
          epoch: 9,
          revision: 3,
          playback: "stopped",
          tick: 0,
          bpm: 84,
          effectiveHostMs: 12_345,
        },
      }),
    ).toBe(false);
  });

  it("validates clock packets", () => {
    expect(
      isTogetherClockMessage({
        kind: "pong",
        id: 4,
        localSendMs: 100,
        hostReceiveMs: 108,
        hostSendMs: 109,
      }),
    ).toBe(true);
    expect(
      isTogetherClockMessage({
        kind: "ping",
        id: -1,
        localSendMs: 100,
      }),
    ).toBe(false);
  });

  it("compares every field that identifies a performance", () => {
    expect(sameTogetherSelection(selection, { ...selection })).toBe(true);
    expect(
      sameTogetherSelection(selection, {
        ...selection,
        tuneSlug: "kilmarnock",
      }),
    ).toBe(false);
    expect(sameTogetherSelection(selection, null)).toBe(false);
  });
});
