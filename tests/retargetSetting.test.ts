import { describe, expect, it } from "vitest";
import { compilePerformance } from "../src/audio/compilePerformance";
import { findTune, psalm1StPeter, stPeter } from "../src/data/music";
import {
  retargetSetting,
  tunesHaveCompatibleSettingShape,
} from "../src/data/retargetSetting";
import type { PsalmSetting, TuneRecord } from "../src/data/types";

function lyricFragments(setting: PsalmSetting) {
  return setting.stanzas.map((stanza) => ({
    id: stanza.stanza_id,
    lines: stanza.lines.map((line) => ({
      id: line.line_id,
      tokens: line.tokens.map((token) => ({
        id: token.id,
        text: token.text,
        syllables: token.syllables,
        fragments: token.syllable_map.map((syllable) => ({
          id: syllable.id,
          text: syllable.text,
        })),
      })),
    })),
  }));
}

describe("retargetSetting", () => {
  const bangor = findTune("ps1650.tune.bangor");
  const oldHundredth = findTune("ps1650.tune.old-hundredth");

  if (!bangor || !oldHundredth) {
    throw new Error("Expected test tunes to be loaded.");
  }

  it("retargets a default CM setting without changing lyric fragments", () => {
    const retargeted = retargetSetting(
      psalm1StPeter,
      stPeter,
      bangor,
    );

    expect(tunesHaveCompatibleSettingShape(stPeter, bangor)).toBe(true);
    expect(retargeted).not.toBe(psalm1StPeter);
    expect(retargeted.id).toBe(
      "ps1650.psalm-001.primary.setting.bangor",
    );
    expect(retargeted.tune_id).toBe("ps1650.tune.bangor");
    expect(retargeted.psalm_id).toBe(psalm1StPeter.psalm_id);
    expect(retargeted.inter_stanza_ticks).toBe(
      (bangor.ppq * 8) / bangor.time_signature[1],
    );
    expect(lyricFragments(retargeted)).toEqual(
      lyricFragments(psalm1StPeter),
    );
  });

  it("allocates every target soprano attack once and in order", () => {
    const first = retargetSetting(psalm1StPeter, stPeter, bangor);
    const second = retargetSetting(psalm1StPeter, stPeter, bangor);

    expect(first).toEqual(second);
    for (const stanza of first.stanzas) {
      stanza.lines.forEach((line, phraseIndex) => {
        const phrase = bangor.phrases[phraseIndex];
        expect(line.phrase_id).toBe(phrase.id);
        expect(
          line.tokens.flatMap((token) => token.note_ids),
        ).toEqual(phrase.note_ids);
        expect(
          line.tokens.flatMap((token) =>
            token.syllable_map.flatMap(
              (syllable) => syllable.note_ids,
            ),
          ),
        ).toEqual(phrase.note_ids);
        expect(
          line.tokens
            .flatMap((token) => token.syllable_map)
            .every((syllable) => syllable.note_ids.length >= 1),
        ).toBe(true);
      });
    }
  });

  it("retains a full SATB introduction", () => {
    const retargeted = retargetSetting(
      psalm1StPeter,
      stPeter,
      bangor,
    );
    const performance = compilePerformance(bangor, retargeted);
    const intro = performance.notes.filter(
      (note) => note.stanzaId === null,
    );

    expect(retargeted.lead_in).toBe("satb");
    expect(performance.introTicks).toBe(bangor.length_ticks);
    expect(new Set(intro.map((note) => note.voice))).toEqual(
      new Set(["soprano", "alto", "tenor", "bass"]),
    );
  });

  it("rejects a tune with a different meter", () => {
    expect(
      tunesHaveCompatibleSettingShape(stPeter, oldHundredth),
    ).toBe(false);
    expect(() =>
      retargetSetting(psalm1StPeter, stPeter, oldHundredth),
    ).toThrow(/does not match.*phrase shape/i);
  });

  it("rejects a phrase with fewer attacks than lyric syllables", () => {
    const omittedIds = new Set(
      stPeter.phrases[0].note_ids.slice(-1),
    );
    const shortTune: TuneRecord = {
      ...stPeter,
      id: "ps1650.tune.short-common-meter",
      title: "Short Common Meter",
      notes: stPeter.notes.filter((note) => !omittedIds.has(note.id)),
      phrases: stPeter.phrases.map((phrase, index) => ({
        ...phrase,
        note_ids:
          index === 0
            ? phrase.note_ids.slice(0, -1)
            : [...phrase.note_ids],
      })),
    };

    expect(() =>
      retargetSetting(psalm1StPeter, stPeter, shortTune),
    ).toThrow(/only 7 soprano attacks are available for 8 syllables/i);
  });
});
