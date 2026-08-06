import { readFile, writeFile } from "node:fs/promises";
import {
  metricalSyllableCount,
  splitMetricalWord,
} from "./lib/metrical-syllables.mjs";

const root = new URL("../", import.meta.url);

const settingPlan = [
  [2, "dundee"],
  [3, "abbey"],
  [4, "st-anne"],
  [8, "winchester-old"],
  [15, "auld-lang-syne"],
  [19, "wigtown"],
  [24, "st-flavian"],
  [42, "dundee"],
  [46, "abbey"],
  [51, "st-anne"],
  [63, "auld-lang-syne"],
  [67, "selma"],
  [84, "wigtown"],
  [93, "winchester-old"],
  [98, "st-flavian"],
  [117, "dundee"],
  [121, "abbey"],
  [130, "st-anne"],
  [133, "auld-lang-syne"],
  [150, "wigtown"],
];

function pad(value) {
  return String(value).padStart(3, "0");
}

async function loadJson(relativePath) {
  return JSON.parse(
    await readFile(new URL(relativePath, root), "utf8"),
  );
}

function allocatePhraseNotes(notes, syllableCount) {
  if (notes.length < syllableCount) {
    throw new Error(
      `Cannot fit ${syllableCount} syllables to ${notes.length} notes.`,
    );
  }
  if (notes.length === syllableCount) return Array(syllableCount).fill(1);

  const prefixDurations = [0];
  for (const note of notes) {
    prefixDurations.push(
      prefixDurations.at(-1) + note.duration_ticks,
    );
  }
  const targetDuration = prefixDurations.at(-1) / syllableCount;
  const states = Array.from({ length: syllableCount + 1 }, () =>
    Array(notes.length + 1).fill(null),
  );
  states[0][0] = { cost: 0, previous: -1 };

  for (let group = 1; group <= syllableCount; group += 1) {
    const minimumEnd = group;
    const maximumEnd = notes.length - (syllableCount - group);
    for (let end = minimumEnd; end <= maximumEnd; end += 1) {
      for (let start = group - 1; start < end; start += 1) {
        const previous = states[group - 1][start];
        if (!previous) continue;

        const duration =
          prefixDurations[end] - prefixDurations[start];
        const noteCount = end - start;
        const durationError =
          (duration - targetDuration) / targetDuration;
        const crowdingPenalty = Math.max(0, noteCount - 3) ** 2 * 0.08;
        const cost =
          previous.cost + durationError ** 2 + crowdingPenalty;
        if (!states[group][end] || cost < states[group][end].cost) {
          states[group][end] = { cost, previous: start };
        }
      }
    }
  }

  const finalState = states[syllableCount][notes.length];
  if (!finalState) {
    throw new Error("Could not calculate a complete phrase underlay.");
  }

  const counts = [];
  let end = notes.length;
  for (let group = syllableCount; group > 0; group -= 1) {
    const start = states[group][end].previous;
    counts.unshift(end - start);
    end = start;
  }
  return counts;
}

function makeSetting(psalm, tune) {
  const tuneNotesById = new Map(
    tune.notes.map((note) => [note.id, note]),
  );
  const allocations = tune.phrases.map((phrase, lineIndex) => {
    const notes = phrase.note_ids.map((noteId) => {
      const note = tuneNotesById.get(noteId);
      if (!note) {
        throw new Error(`${phrase.id} references missing note ${noteId}.`);
      }
      return note;
    });
    return allocatePhraseNotes(
      notes,
      Number(tune.meter.split(".")[lineIndex]),
    );
  });

  const stanzas = psalm.stanzas.map((stanza) => ({
    stanza_id: stanza.id,
    lines: stanza.lines.map((line, lineIndex) => {
      const phrase = tune.phrases[lineIndex];
      const words = line.text.reading.split(/\s+/);
      const counts = words.map((word, wordIndex) =>
        metricalSyllableCount(
          word,
          `${psalm.psalm_number}.${stanza.number}.${lineIndex + 1}.${wordIndex}`,
        ),
      );
      const total = counts.reduce((sum, count) => sum + count, 0);
      if (total !== line.syllable_count) {
        throw new Error(
          `${line.id} contains ${total} reviewed syllables; expected ${line.syllable_count}.`,
        );
      }

      const fragments = words.map((word, wordIndex) =>
        splitMetricalWord(word, counts[wordIndex]),
      );
      const noteCounts = allocations[lineIndex];
      let syllableCursor = 0;
      let noteCursor = 0;

      const tokens = words.map((text, tokenIndex) => {
        const tokenId = `${line.id}.token-${String(tokenIndex + 1).padStart(2, "0")}`;
        const syllableMap = fragments[tokenIndex].map(
          (syllableText, syllableIndex) => {
            const assignedNoteCount = noteCounts[syllableCursor];
            const noteIds = phrase.note_ids.slice(
              noteCursor,
              noteCursor + assignedNoteCount,
            );
            syllableCursor += 1;
            noteCursor += assignedNoteCount;
            return {
              id: `${tokenId}.syllable-${String(syllableIndex + 1).padStart(2, "0")}`,
              text: syllableText,
              note_ids: noteIds,
            };
          },
        );

        return {
          id: tokenId,
          text,
          syllables: syllableMap.length,
          note_ids: syllableMap.flatMap((syllable) => syllable.note_ids),
          syllable_map: syllableMap,
        };
      });

      if (
        syllableCursor !== line.syllable_count ||
        noteCursor !== phrase.note_ids.length
      ) {
        throw new Error(`${line.id} did not consume its complete phrase.`);
      }

      return {
        line_id: line.id,
        phrase_id: phrase.id,
        tokens,
      };
    }),
  }));

  const tuneSlug = tune.id.replace("ps1650.tune.", "");
  return {
    $schema: "../../schemas/setting.schema.json",
    schema_version: "0.4.0",
    id: `${psalm.id}.setting.${tuneSlug}`,
    psalm_id: psalm.id,
    tune_id: tune.id,
    lead_in: "satb",
    inter_stanza_ticks: (tune.ppq * 8) / tune.time_signature[1],
    stanzas,
    rights: {
      alignment: "CC0-1.0",
      metadata: "CC0-1.0",
    },
  };
}

for (const [psalmNumber, tuneSlug] of settingPlan) {
  const psalm = await loadJson(
    `corpus/text/psalm-${pad(psalmNumber)}.primary.json`,
  );
  const tune = await loadJson(
    `corpus/music/tunes/${tuneSlug}.json`,
  );
  if (psalm.meter.pattern !== tune.meter) {
    throw new Error(
      `Psalm ${psalmNumber} (${psalm.meter.pattern}) cannot use ${tune.title} (${tune.meter}).`,
    );
  }

  const setting = makeSetting(psalm, tune);
  await writeFile(
    new URL(
      `corpus/music/settings/psalm-${pad(psalmNumber)}.${tuneSlug}.json`,
      root,
    ),
    `${JSON.stringify(setting, null, 2)}\n`,
    "utf8",
  );
}

console.log(
  `Seeded ${settingPlan.length} reviewed metrical underlays across eight source-derived SATB tunes.`,
);
