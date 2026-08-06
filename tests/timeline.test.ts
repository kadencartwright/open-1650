import { describe, expect, it } from "vitest";
import {
  findCueAtTick,
  findFirstStartingAtOrAfter,
  findNearestStanza,
  findScheduleStartIndex,
  type ScheduledNote,
  type StanzaCue,
  type TimelineCue,
} from "../src/audio/compilePerformance";

function countIndexedReads<T>(items: readonly T[]) {
  let reads = 0;
  const indexed = new Proxy(items, {
    get(target, property, receiver) {
      if (
        typeof property === "string" &&
        /^\d+$/.test(property)
      ) {
        reads += 1;
      }
      return Reflect.get(target, property, receiver);
    },
  });

  return {
    indexed,
    reads: () => reads,
  };
}

function note(
  id: string,
  voice: ScheduledNote["voice"],
  startTick: number,
  endTick: number,
): ScheduledNote {
  return {
    id,
    sourceNoteId: id,
    stanzaId: "stanza-1",
    voice,
    midi: 60,
    startTick,
    durationTicks: endTick - startTick,
    endTick,
    velocity: 80,
  };
}

describe("indexed performance timelines", () => {
  it("finds active cues logarithmically while preserving half-open boundaries", () => {
    const cues: TimelineCue[] = Array.from({ length: 8_192 }, (_, index) => ({
      startTick: index * 10,
      endTick: index * 10 + 6,
    }));
    const measured = countIndexedReads(cues);

    expect(findCueAtTick(measured.indexed, 70_003)).toBe(cues[7_000]);
    expect(measured.reads()).toBeLessThan(20);
    expect(findCueAtTick(cues, cues[7_000].endTick)).toBeUndefined();
    expect(findCueAtTick(cues, cues[7_001].startTick)).toBe(cues[7_001]);
  });

  it("chooses the nearest stanza on either side of an inter-verse gap", () => {
    const stanzas: StanzaCue[] = [
      { stanzaId: "one", index: 0, startTick: 100, endTick: 200 },
      { stanzaId: "two", index: 1, startTick: 300, endTick: 400 },
      { stanzaId: "three", index: 2, startTick: 500, endTick: 600 },
    ];

    expect(findNearestStanza(stanzas, 250)?.stanzaId).toBe("one");
    expect(findNearestStanza(stanzas, 251)?.stanzaId).toBe("two");
    expect(findNearestStanza(stanzas, 50)?.stanzaId).toBe("one");
    expect(findNearestStanza(stanzas, 650)?.stanzaId).toBe("three");
  });

  it("starts a monotonic schedule cursor at notes sustaining across a seek", () => {
    const notes = [
      note("s-1", "soprano", 0, 40),
      note("a-1", "alto", 0, 10),
      note("t-1", "tenor", 0, 20),
      note("b-1", "bass", 0, 12),
      note("a-2", "alto", 10, 20),
      note("b-2", "bass", 12, 24),
      note("a-3", "alto", 20, 30),
      note("t-2", "tenor", 20, 30),
    ].sort(
      (left, right) =>
        left.startTick - right.startTick || left.id.localeCompare(right.id),
    );
    const tick = 15;
    const firstUpcoming = findFirstStartingAtOrAfter(notes, tick);
    const scheduleStart = findScheduleStartIndex(notes, tick);
    const sustaining = notes
      .slice(scheduleStart, firstUpcoming)
      .filter((candidate) => candidate.endTick > tick);

    expect(sustaining.map((candidate) => candidate.id).sort()).toEqual([
      "a-2",
      "b-2",
      "s-1",
      "t-1",
    ]);
    expect(findScheduleStartIndex(notes, 41)).toBe(notes.length);
  });
});
