import {
  fitMetricalLine,
  groupMetricalTokens,
} from "./metrical-syllables.mjs";

function allocatePhraseNotes(notes, syllableCount) {
  if (notes.length < syllableCount) {
    throw new Error(
      `Cannot fit ${syllableCount} syllables to ${notes.length} notes.`,
    );
  }
  if (notes.length === syllableCount) return Array(syllableCount).fill(1);

  const prefixDurations = [0];
  for (const note of notes) {
    prefixDurations.push(prefixDurations.at(-1) + note.duration_ticks);
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

        const duration = prefixDurations[end] - prefixDurations[start];
        const noteCount = end - start;
        const durationError = (duration - targetDuration) / targetDuration;
        const crowdingPenalty = Math.max(0, noteCount - 3) ** 2 * 0.08;
        const cost =
          previous.cost + durationError ** 2 + crowdingPenalty;
        if (!states[group][end] || cost < states[group][end].cost) {
          states[group][end] = { cost, previous: start };
        }
      }
    }
  }

  if (!states[syllableCount][notes.length]) {
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

export function makeSetting(psalm, tune, options = {}) {
  if (psalm.meter.pattern !== tune.meter) {
    throw new Error(
      `${psalm.id} (${psalm.meter.pattern}) cannot use ${tune.title} (${tune.meter}).`,
    );
  }

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
    const syllableCount = Number(
      tune.meter.split(".")[lineIndex],
    );
    try {
      return allocatePhraseNotes(notes, syllableCount);
    } catch (error) {
      throw new Error(
        `${tune.title} phrase ${lineIndex + 1}: ${error.message}`,
      );
    }
  });

  const stanzas = psalm.stanzas.map((stanza) => ({
    stanza_id: stanza.id,
    lines: stanza.lines.map((line, lineIndex) => {
      const phrase = tune.phrases[lineIndex];
      const words = line.text.reading.split(/\s+/u);
      const fitted = fitMetricalLine(
        words,
        line.syllable_count,
        `${psalm.psalm_number}.${stanza.number}.${lineIndex + 1}`,
      );
      const groups = groupMetricalTokens(words, fitted.counts);
      if (fitted.adjustments.length > 0) {
        options.onAdjustments?.({
          psalmId: psalm.id,
          stanzaId: stanza.id,
          lineId: line.id,
          adjustments: fitted.adjustments,
        });
      }

      const noteCounts = allocations[lineIndex];
      let syllableCursor = 0;
      let noteCursor = 0;
      const tokens = groups.map((group, tokenIndex) => {
        const tokenId = `${line.id}.token-${String(tokenIndex + 1).padStart(2, "0")}`;
        const syllableMap = group.fragments.map(
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
          text: group.text,
          syllables: syllableMap.length,
          note_ids: syllableMap.flatMap((syllable) => syllable.note_ids),
          syllable_map: syllableMap,
        };
      });

      if (
        tokens.map((token) => token.text).join(" ") !== line.text.reading ||
        syllableCursor !== line.syllable_count ||
        noteCursor !== phrase.note_ids.length
      ) {
        throw new Error(`${line.id} did not consume its complete text and phrase.`);
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
