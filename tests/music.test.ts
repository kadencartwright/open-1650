import { describe, expect, it } from "vitest";
import {
  compilePerformance,
  findCueAtTick,
  ticksToSeconds,
} from "../src/audio/compilePerformance";
import { createMidiFile } from "../src/audio/midiFile";
import {
  availablePsalms,
  findPsalm,
  flattenLines,
} from "../src/data/corpus";
import {
  crimond,
  findSetting,
  findTune,
  oldHundredth,
  psalm1StPeter,
  psalm23Crimond,
  psalm100OldHundredth,
  settings,
  stPeter,
  tunes,
} from "../src/data/music";
import type {
  PsalmRecord,
  PsalmSetting,
  TuneRecord,
} from "../src/data/types";

interface SongCase {
  number: number;
  tune: TuneRecord;
  setting: PsalmSetting;
  expected: {
    title: string;
    meter: string;
    timeSignature: [number, number];
    bpm: number;
    notes: number;
    stanzas: number;
    lines: number;
    tokens: number;
    syllables: number;
    durationTicks: number;
    firstChord: number[];
  };
}

const songs: SongCase[] = [
  {
    number: 1,
    tune: stPeter,
    setting: psalm1StPeter,
    expected: {
      title: "St. Peter",
      meter: "8.6.8.6",
      timeSignature: [4, 4],
      bpm: 86,
      notes: 805,
      stanzas: 6,
      lines: 24,
      tokens: 132,
      syllables: 168,
      durationTicks: 112_320,
      firstChord: [51, 55, 63, 70],
    },
  },
  {
    number: 23,
    tune: crimond,
    setting: psalm23Crimond,
    expected: {
      title: "Crimond",
      meter: "8.6.8.6",
      timeSignature: [3, 4],
      bpm: 80,
      notes: 792,
      stanzas: 5,
      lines: 20,
      tokens: 114,
      syllables: 140,
      durationTicks: 124_800,
      firstChord: [53, 57, 60, 60],
    },
  },
  {
    number: 100,
    tune: oldHundredth,
    setting: psalm100OldHundredth,
    expected: {
      title: "Old Hundredth",
      meter: "8.8.8.8",
      timeSignature: [4, 4],
      bpm: 84,
      notes: 655,
      stanzas: 4,
      lines: 16,
      tokens: 113,
      syllables: 128,
      durationTicks: 118_080,
      firstChord: [55, 59, 62, 67],
    },
  },
];

interface LibrarySong {
  number: number;
  psalm: PsalmRecord;
  tune: TuneRecord;
  setting: PsalmSetting;
}

const librarySongs: LibrarySong[] = settings.map((setting) => {
  const psalm = availablePsalms.find(
    (candidate) => candidate.id === setting.psalm_id,
  );
  const tune = findTune(setting.tune_id);

  if (!psalm) {
    throw new Error(`Missing Psalm record "${setting.psalm_id}".`);
  }
  if (!tune) {
    throw new Error(`Missing tune record "${setting.tune_id}".`);
  }

  return {
    number: psalm.psalm_number,
    psalm,
    tune,
    setting,
  };
});

function psalmFor(song: SongCase): PsalmRecord {
  const psalm = findPsalm(song.number);
  if (!psalm) throw new Error(`Missing Psalm ${song.number}.`);
  return psalm;
}

function getBeatTicks(tune: TuneRecord): number {
  return (tune.ppq * 4) / tune.time_signature[1];
}

function getFinalChordStartTick(tune: TuneRecord): number {
  const starts = [
    tune.notes.at(-1)?.start_tick,
    tune.harmony.voices.alto.at(-1)?.start_tick,
    tune.harmony.voices.tenor.at(-1)?.start_tick,
    tune.harmony.voices.bass.at(-1)?.start_tick,
  ];
  expect(new Set(starts).size).toBe(1);

  const startTick = starts[0];
  if (startTick === undefined) throw new Error(`${tune.id} has no cadence.`);
  return startTick;
}

describe("expanded musical library", () => {
  it("registers one setting for every received-text version across 27 tunes", () => {
    expect(tunes).toHaveLength(27);
    expect(settings).toHaveLength(163);
    expect(new Set(tunes.map((tune) => tune.id))).toEqual(
      new Set([
        "ps1650.tune.abbey",
        "ps1650.tune.auld-lang-syne",
        "ps1650.tune.bangor",
        "ps1650.tune.bishopgarth",
        "ps1650.tune.caithness",
        "ps1650.tune.coleshill",
        "ps1650.tune.crimond",
        "ps1650.tune.crofts-hundred-thirty-sixth",
        "ps1650.tune.culross",
        "ps1650.tune.dundee",
        "ps1650.tune.kilmarnock",
        "ps1650.tune.martyrdom",
        "ps1650.tune.old-hundred-thirty-fourth",
        "ps1650.tune.old-hundred-twenty-fourth",
        "ps1650.tune.old-hundredth",
        "ps1650.tune.selma",
        "ps1650.tune.st-anne",
        "ps1650.tune.st-cecilia",
        "ps1650.tune.st-flavian",
        "ps1650.tune.st-john",
        "ps1650.tune.st-peter",
        "ps1650.tune.tallis-canon",
        "ps1650.tune.tallis-ordinal",
        "ps1650.tune.warrington",
        "ps1650.tune.wigtown",
        "ps1650.tune.winchester-old",
        "ps1650.tune.york",
      ]),
    );
    expect(new Set(settings.map((setting) => setting.id)).size).toBe(
      settings.length,
    );

    const settingCountByPsalm = new Map<string, number>();
    for (const setting of settings) {
      settingCountByPsalm.set(
        setting.psalm_id,
        (settingCountByPsalm.get(setting.psalm_id) ?? 0) + 1,
      );
    }

    expect(new Set(settings.map((setting) => setting.psalm_id))).toEqual(
      new Set(availablePsalms.map((psalm) => psalm.id)),
    );
    for (const psalm of availablePsalms) {
      expect(settingCountByPsalm.get(psalm.id)).toBe(1);
    }
    expect(new Set(settings.map((setting) => setting.tune_id))).toEqual(
      new Set(tunes.map((tune) => tune.id)),
    );

    for (const song of librarySongs) {
      expect(findSetting(song.psalm.id)).toBe(song.setting);
      expect(findSetting(song.psalm.id, song.tune.id)).toBe(song.setting);
      expect(findTune(song.tune.id)).toBe(song.tune);
      expect(song.tune.meter).toBe(song.psalm.meter.pattern);
      expect(
        new Set(Object.keys(song.tune.harmony.voices)),
      ).toEqual(new Set(["alto", "tenor", "bass"]));
      expect(song.tune.notes).not.toBe(
        song.tune.harmony.voices.alto,
      );
    }
  });

  it.each(librarySongs)(
    "maps every lyric and musical event for Psalm $number · $tune.title",
    ({ psalm, tune, setting }) => {
      const sourceLines = flattenLines(psalm);
      const settingLines = setting.stanzas.flatMap(
        (stanza) => stanza.lines,
      );
      const performance = compilePerformance(tune, setting);
      const harmonyNoteCount =
        tune.harmony.voices.alto.length +
        tune.harmony.voices.tenor.length +
        tune.harmony.voices.bass.length;

      expect(settingLines.map((line) => line.line_id)).toEqual(
        sourceLines.map((line) => line.id),
      );
      expect(performance.stanzas).toHaveLength(psalm.stanzas.length);
      expect(performance.lines).toHaveLength(sourceLines.length);
      expect(performance.notes).toHaveLength(
        (setting.stanzas.length + 1) *
          (tune.notes.length + harmonyNoteCount),
      );
      expect(performance.introTicks).toBe(tune.length_ticks);
      expect(performance.durationTicks).toBe(
        (setting.stanzas.length + 1) * tune.length_ticks +
          (setting.stanzas.length - 1) *
            setting.inter_stanza_ticks,
      );

      expect(
        new Set(
          performance.notes
            .filter((note) => note.stanzaId === null)
            .map((note) => note.voice),
        ),
      ).toEqual(new Set(["soprano", "alto", "tenor", "bass"]));
      for (const stanza of performance.stanzas) {
        expect(
          new Set(
            performance.notes
              .filter((note) => note.stanzaId === stanza.stanzaId)
              .map((note) => note.voice),
          ),
        ).toEqual(new Set(["soprano", "alto", "tenor", "bass"]));
      }

      for (const [lineIndex, line] of settingLines.entries()) {
        const sourceLine = sourceLines[lineIndex];
        const phrase = tune.phrases.find(
          (candidate) => candidate.id === line.phrase_id,
        );

        expect(line.tokens.map((token) => token.text).join(" ")).toBe(
          sourceLine.text.reading,
        );
        expect(
          line.tokens.reduce(
            (sum, token) => sum + token.syllables,
            0,
          ),
        ).toBe(sourceLine.syllable_count);
        expect(line.tokens.flatMap((token) => token.note_ids)).toEqual(
          phrase?.note_ids,
        );

        for (const token of line.tokens) {
          expect(token.syllable_map).toHaveLength(token.syllables);
          expect(
            token.syllable_map
              .map((syllable) => syllable.text)
              .join(""),
          ).toBe(token.text);
          expect(
            token.syllable_map.flatMap(
              (syllable) => syllable.note_ids,
            ),
          ).toEqual(token.note_ids);
        }
      }
    },
  );

  it("preserves internal timing and sustains the final chord to the next stanza", () => {
    for (const { tune, setting } of librarySongs) {
      const performance = compilePerformance(tune, setting);
      const beatTicks = getBeatTicks(tune);
      const finalChordStartTick = getFinalChordStartTick(tune);
      const stanzaStrideTicks =
        tune.length_ticks + setting.inter_stanza_ticks;

      expect(Number.isInteger(beatTicks)).toBe(true);
      expect(setting.inter_stanza_ticks).toBe(beatTicks * 2);
      for (const [stanzaIndex, stanza] of performance.stanzas.entries()) {
        const sustainTicks =
          stanzaIndex === performance.stanzas.length - 1
            ? 0
            : setting.inter_stanza_ticks;
        expect(stanza.startTick).toBe(
          tune.length_ticks + stanzaIndex * stanzaStrideTicks,
        );
        expect(stanza.endTick - stanza.startTick).toBe(
          tune.length_ticks + sustainTicks,
        );

        const stanzaLines = performance.lines.filter(
          (line) => line.stanzaId === stanza.stanzaId,
        );
        expect(stanzaLines).toHaveLength(tune.phrases.length);

        stanzaLines.forEach((line, index) => {
          const phrase = tune.phrases[index];
          expect(line.startTick - stanza.startTick).toBe(
            phrase.start_tick,
          );
          expect(line.endTick - stanza.startTick).toBe(
            phrase.end_tick +
              (phrase.end_tick === tune.length_ticks
                ? sustainTicks
                : 0),
          );

          const nextLine = stanzaLines[index + 1];
          const nextPhrase = tune.phrases[index + 1];
          if (nextLine && nextPhrase) {
            expect(nextLine.startTick - line.endTick).toBe(
              nextPhrase.start_tick - phrase.end_tick,
            );
          }
        });

        const stanzaNotes = performance.notes.filter(
          (note) => note.stanzaId === stanza.stanzaId,
        );
        for (const note of stanzaNotes) {
          const sourceVoice =
            note.voice === "soprano"
              ? tune.notes
              : tune.harmony.voices[note.voice];
          const sourceNote = sourceVoice.find(
            (candidate) => candidate.id === note.sourceNoteId,
          );
          expect(sourceNote).toBeDefined();
          const sourceEndTick =
            (sourceNote?.start_tick ?? 0) +
            (sourceNote?.duration_ticks ?? 0);
          expect(note.startTick - stanza.startTick).toBe(
            sourceNote?.start_tick,
          );
          expect(note.endTick - stanza.startTick).toBe(
            sourceEndTick +
              (sourceEndTick === tune.length_ticks
                ? sustainTicks
                : 0),
          );
        }
      }

      for (let index = 0; index < performance.stanzas.length - 1; index += 1) {
        const stanza = performance.stanzas[index];
        const nextStanza = performance.stanzas[index + 1];
        const finalSoundingTick = Math.max(
          ...performance.notes
            .filter((note) => note.stanzaId === stanza.stanzaId)
            .map((note) => note.endTick),
        );
        const nextOnsetTick = Math.min(
          ...performance.notes
            .filter((note) => note.stanzaId === nextStanza.stanzaId)
            .map((note) => note.startTick),
        );

        const finalChord = performance.notes.filter(
          (note) =>
            note.stanzaId === stanza.stanzaId &&
            note.startTick === stanza.startTick + finalChordStartTick,
        );
        expect(new Set(finalChord.map((note) => note.voice))).toEqual(
          new Set(["soprano", "alto", "tenor", "bass"]),
        );
        expect(
          finalChord.map((note) => note.durationTicks),
        ).toEqual(
          Array(4).fill(
            tune.length_ticks - finalChordStartTick +
              setting.inter_stanza_ticks,
          ),
        );
        const originalCadenceTicks =
          tune.length_ticks - finalChordStartTick;
        const writtenStanzaEndTick =
          stanza.startTick + tune.length_ticks;
        expect(
          stanza.endTick -
            (stanza.startTick + finalChordStartTick),
        ).toBe(originalCadenceTicks + setting.inter_stanza_ticks);
        expect(stanza.endTick - writtenStanzaEndTick).toBe(
          beatTicks * 2,
        );
        expect(nextStanza.startTick - stanza.endTick).toBe(
          0,
        );
        expect(nextOnsetTick - finalSoundingTick).toBe(0);
        expect(finalSoundingTick).toBe(stanza.endTick);
        expect(nextOnsetTick).toBe(nextStanza.startTick);
        expect(
          findCueAtTick(performance.syllables, writtenStanzaEndTick)
            ?.stanzaId,
        ).toBe(stanza.stanzaId);
        expect(
          findCueAtTick(performance.syllables, nextOnsetTick - 1)
            ?.stanzaId,
        ).toBe(stanza.stanzaId);
        expect(
          findCueAtTick(performance.syllables, nextOnsetTick)
            ?.stanzaId,
        ).toBe(nextStanza.stanzaId);
        expect(
          Math.max(
            ...performance.tokens
              .filter((cue) => cue.stanzaId === stanza.stanzaId)
              .map((cue) => cue.endTick),
          ),
        ).toBe(stanza.endTick);
        expect(
          Math.max(
            ...performance.syllables
              .filter((cue) => cue.stanzaId === stanza.stanzaId)
              .map((cue) => cue.endTick),
          ),
        ).toBe(stanza.endTick);
      }

      const finalStanza = performance.stanzas.at(-1);
      expect(finalStanza).toBeDefined();
      expect(finalStanza!.endTick - finalStanza!.startTick).toBe(
        tune.length_ticks,
      );
    }
  }, 15_000);

  describe.each(songs)(
    "Psalm $number · $expected.title",
    (song) => {
      const psalm = psalmFor(song);
      const performance = compilePerformance(song.tune, song.setting);

      it("compiles one SATB introduction followed by every stanza", () => {
        expect(performance.title).toBe(song.expected.title);
        expect(performance.meter).toBe(song.expected.meter);
        expect(performance.timeSignature).toEqual(
          song.expected.timeSignature,
        );
        expect(performance.defaultBpm).toBe(song.expected.bpm);
        expect(performance.notes).toHaveLength(song.expected.notes);
        const harmonyNoteCount =
          song.tune.harmony.voices.alto.length +
          song.tune.harmony.voices.tenor.length +
          song.tune.harmony.voices.bass.length;
        expect(performance.notes).toHaveLength(
          (song.setting.stanzas.length + 1) *
            (song.tune.notes.length + harmonyNoteCount),
        );
        expect(performance.stanzas).toHaveLength(song.expected.stanzas);
        expect(performance.lines).toHaveLength(song.expected.lines);
        expect(performance.tokens).toHaveLength(song.expected.tokens);
        expect(performance.syllables).toHaveLength(
          song.expected.syllables,
        );
        expect(performance.durationTicks).toBe(
          song.expected.durationTicks,
        );
      });

      it("maps every source line and every phrase note exactly once", () => {
        const sourceLines = flattenLines(psalm);
        const mappedLineIds = performance.lines.map((line) => line.lineId);

        expect(new Set(mappedLineIds).size).toBe(sourceLines.length);
        expect(mappedLineIds).toEqual(sourceLines.map((line) => line.id));

        for (const stanza of song.setting.stanzas) {
          for (const line of stanza.lines) {
            const sourceLine = sourceLines.find(
              (candidate) => candidate.id === line.line_id,
            );
            const phrase = song.tune.phrases.find(
              (candidate) => candidate.id === line.phrase_id,
            );

            expect(line.tokens.map((token) => token.text).join(" ")).toBe(
              sourceLine?.text.reading,
            );
            expect(
              line.tokens.reduce(
                (sum, token) => sum + token.syllables,
                0,
              ),
            ).toBe(sourceLine?.syllable_count);
            expect(line.tokens.flatMap((token) => token.note_ids)).toEqual(
              phrase?.note_ids,
            );
            for (const token of line.tokens) {
              expect(token.syllable_map).toHaveLength(token.syllables);
              expect(
                token.syllable_map
                  .map((syllable) => syllable.text)
                  .join(""),
              ).toBe(token.text);
              expect(
                token.syllable_map.flatMap(
                  (syllable) => syllable.note_ids,
                ),
              ).toEqual(token.note_ids);
            }
          }
        }
      });

      it("aligns the SATB introduction, stanza, line, and token timing", () => {
        expect(song.setting.lead_in).toBe("satb");
        expect(performance.introTicks).toBe(song.tune.length_ticks);

        const introNotes = performance.notes.filter(
          (note) => note.stanzaId === null,
        );
        const tuneVoices = {
          soprano: song.tune.notes,
          alto: song.tune.harmony.voices.alto,
          tenor: song.tune.harmony.voices.tenor,
          bass: song.tune.harmony.voices.bass,
        } as const;
        expect(introNotes).toHaveLength(
          Object.values(tuneVoices).reduce(
            (sum, voiceNotes) => sum + voiceNotes.length,
            0,
          ),
        );
        expect(new Set(introNotes.map((note) => note.voice))).toEqual(
          new Set(["soprano", "alto", "tenor", "bass"]),
        );
        for (const [voice, sourceNotes] of Object.entries(tuneVoices)) {
          expect(
            introNotes
              .filter((note) => note.voice === voice)
              .map((note) => ({
                sourceNoteId: note.sourceNoteId,
                voice: note.voice,
                startTick: note.startTick,
                durationTicks: note.durationTicks,
                endTick: note.endTick,
              })),
          ).toEqual(
            sourceNotes.map((note) => ({
              sourceNoteId: note.id,
              voice,
              startTick: note.start_tick,
              durationTicks: note.duration_ticks,
              endTick: note.start_tick + note.duration_ticks,
            })),
          );
        }

        performance.stanzas.forEach((stanza, index) => {
          const stanzaStrideTicks =
            song.tune.length_ticks + song.setting.inter_stanza_ticks;
          const sustainTicks =
            index === performance.stanzas.length - 1
              ? 0
              : song.setting.inter_stanza_ticks;
          const expectedStart =
            song.tune.length_ticks +
            index * stanzaStrideTicks;
          expect(stanza.startTick).toBe(expectedStart);
          expect(stanza.endTick).toBe(
            expectedStart + song.tune.length_ticks + sustainTicks,
          );

          const stanzaNotes = performance.notes.filter(
            (note) => note.stanzaId === stanza.stanzaId,
          );
          expect(
            new Set(stanzaNotes.map((note) => note.voice)),
          ).toEqual(new Set(["soprano", "alto", "tenor", "bass"]));
        });

        expect(
          performance.notes
            .filter(
              (note) =>
                note.stanzaId === performance.stanzas[0].stanzaId &&
                note.startTick === performance.introTicks,
            )
            .map((note) => note.midi)
            .sort((left, right) => left - right),
        ).toEqual(song.expected.firstChord);

        const firstLine = performance.lines[0];
        const secondLine = performance.lines[1];
        const firstPhrase = song.tune.phrases[0];
        expect(firstLine.startTick).toBe(
          song.tune.length_ticks + firstPhrase.start_tick,
        );
        expect(firstLine.endTick).toBe(
          song.tune.length_ticks + firstPhrase.end_tick,
        );
        expect(
          findCueAtTick(performance.lines, performance.introTicks - 1),
        ).toBeUndefined();
        expect(
          findCueAtTick(performance.lines, firstLine.startTick),
        ).toBe(firstLine);
        expect(
          findCueAtTick(performance.lines, firstLine.endTick),
        ).toBe(secondLine);

        for (const token of performance.tokens) {
          const notes = token.noteIds.map((noteId) =>
            performance.notes.find((note) => note.id === noteId),
          );
          expect(notes.every(Boolean)).toBe(true);
          expect(token.startTick).toBe(
            Math.min(...notes.map((note) => note!.startTick)),
          );
          expect(token.endTick).toBe(
            Math.max(...notes.map((note) => note!.endTick)),
          );
        }

        for (const syllable of performance.syllables) {
          const notes = syllable.noteIds.map((noteId) =>
            performance.notes.find((note) => note.id === noteId),
          );
          expect(notes.every(Boolean)).toBe(true);
          expect(syllable.startTick).toBe(
            Math.min(...notes.map((note) => note!.startTick)),
          );
          expect(syllable.endTick).toBe(
            Math.max(...notes.map((note) => note!.endTick)),
          );
        }
      });

      it("exports a named, standards-shaped MIDI file", () => {
        const bytes = createMidiFile(
          performance,
          performance.defaultBpm,
        );
        const text = new TextDecoder().decode(bytes);

        expect(text.slice(0, 4)).toBe("MThd");
        expect([...bytes.slice(8, 10)]).toEqual([0, 1]);
        expect([...bytes.slice(10, 12)]).toEqual([0, 5]);
        expect(text).toContain("MTrk");
        expect(text).toContain(
          `Psalm ${song.number} · ${song.expected.title}`,
        );
        for (const trackName of [
          "Conductor",
          "Soprano",
          "Alto",
          "Tenor",
          "Bass",
        ]) {
          expect(text).toContain(trackName);
        }
        expect([...bytes.slice(-4)]).toEqual([0, 255, 47, 0]);
        expect(bytes.byteLength).toBeGreaterThan(1_000);
      });
    },
  );
});

describe("tune-specific source checks", () => {
  it("keeps the first syllable of blessedness intact", () => {
    const blessedness = psalm1StPeter.stanzas[0].lines[0].tokens.find(
      (token) => token.text === "blessedness",
    );

    expect(
      blessedness?.syllable_map.map((syllable) => syllable.text),
    ).toEqual(["bless", "ed", "ness"]);
  });

  it("keeps the first syllable of scorner’s intact", () => {
    const scorners = psalm1StPeter.stanzas[1].lines[0].tokens.find(
      (token) => token.text === "scorner’s",
    );

    expect(
      scorners?.syllable_map.map((syllable) => syllable.text),
    ).toEqual(["scor", "ner’s"]);
  });

  it("holds a highlighted Crimond syllable across every assigned note", () => {
    const performance = compilePerformance(crimond, psalm23Crimond);
    const shepherd =
      psalm23Crimond.stanzas[0].lines[0].tokens[3];
    expect(
      shepherd.syllable_map.map((syllable) => syllable.text),
    ).toEqual(["shep", "herd,"]);
    expect(
      shepherd.syllable_map.map(
        (syllable) => syllable.note_ids.length,
      ),
    ).toEqual([1, 2]);

    const shep = performance.syllables.find(
      (syllable) =>
        syllable.syllableId === shepherd.syllable_map[0].id,
    );
    const herd = performance.syllables.find(
      (syllable) =>
        syllable.syllableId === shepherd.syllable_map[1].id,
    );
    expect(shep).toMatchObject({
      startTick: 22_080,
      endTick: 23_040,
    });
    expect(herd).toMatchObject({
      startTick: 23_040,
      endTick: 23_520,
    });
    expect(
      findCueAtTick(performance.syllables, 23_039),
    ).toBe(shep);
    expect(
      findCueAtTick(performance.syllables, 23_040),
    ).toBe(herd);
    expect(
      findCueAtTick(performance.syllables, 23_519),
    ).toBe(herd);

    const my = performance.syllables.find(
      (syllable) =>
        syllable.syllableId ===
        psalm23Crimond.stanzas[0].lines[0].tokens[2]
          .syllable_map[0].id,
    );
    expect(my?.noteIds).toHaveLength(2);
    expect(
      findCueAtTick(performance.syllables, 21_960),
    ).toBe(my);
    expect(
      findCueAtTick(performance.syllables, 20_159),
    ).toBeUndefined();
  });

  it("uses the verified OLD HUNDREDTH melody and rhythmic proportions", () => {
    expect(oldHundredth.notes.slice(0, 8).map((note) => note.midi)).toEqual([
      67, 67, 66, 64, 62, 67, 69, 71,
    ]);
    expect(
      oldHundredth.notes
        .slice(0, 8)
        .map((note) => note.duration_ticks),
    ).toEqual([960, 480, 480, 480, 480, 960, 960, 960]);
  });

  it("converts the same tick position predictably at different tempos", () => {
    expect(ticksToSeconds(4_032, 480, 84)).toBeCloseTo(6);
    expect(ticksToSeconds(4_032, 480, 96)).toBeCloseTo(5.25);
  });
});
