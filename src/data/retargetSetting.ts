import type {
  PsalmSetting,
  SettingLine,
  TuneNote,
  TuneRecord,
} from "./types";

interface AllocationState {
  cost: number;
  previous: number;
}

/**
 * Returns whether two tunes describe the same metrical line shape.
 *
 * Attack counts may differ: extra attacks are assigned as melismas when the
 * setting is retargeted. The meter and number of lyric phrases must match
 * exactly.
 */
export function tunesHaveCompatibleSettingShape(
  sourceTune: TuneRecord,
  targetTune: TuneRecord,
): boolean {
  return (
    sourceTune.meter === targetTune.meter &&
    sourceTune.phrases.length === targetTune.phrases.length
  );
}

function assertOrderedSopranoCoverage(tune: TuneRecord): void {
  const sopranoIds = tune.notes.map((note) => note.id);
  const phraseIds = tune.phrases.flatMap((phrase) => phrase.note_ids);

  if (
    sopranoIds.length !== new Set(sopranoIds).size ||
    phraseIds.length !== sopranoIds.length ||
    phraseIds.some((noteId, index) => noteId !== sopranoIds[index])
  ) {
    throw new Error(
      `${tune.id} phrases must cover every soprano note exactly once and in order.`,
    );
  }

  for (const note of tune.notes) {
    if (!Number.isFinite(note.duration_ticks) || note.duration_ticks <= 0) {
      throw new Error(`${note.id} must have a positive duration.`);
    }
  }
}

function allocatePhraseNotes(
  notes: readonly TuneNote[],
  syllableCount: number,
): number[] {
  if (!Number.isInteger(syllableCount) || syllableCount < 1) {
    throw new Error("A lyric line must contain at least one syllable.");
  }
  if (notes.length < syllableCount) {
    throw new Error(
      `only ${notes.length} soprano attacks are available for ${syllableCount} syllables`,
    );
  }
  if (notes.length === syllableCount) {
    return Array<number>(syllableCount).fill(1);
  }

  // Balance melismas by sounding duration rather than by raw attack count.
  // Equal-cost choices resolve to the earliest boundary because the loops are
  // ascending and an existing state is replaced only by a lower cost.
  const prefixDurations = [0];
  for (const note of notes) {
    prefixDurations.push(
      prefixDurations[prefixDurations.length - 1] + note.duration_ticks,
    );
  }
  const targetDuration =
    prefixDurations[prefixDurations.length - 1] / syllableCount;
  const states: Array<Array<AllocationState | undefined>> = Array.from(
    { length: syllableCount + 1 },
    () => Array<AllocationState | undefined>(notes.length + 1),
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
        const current = states[group][end];
        if (!current || cost < current.cost) {
          states[group][end] = { cost, previous: start };
        }
      }
    }
  }

  if (!states[syllableCount][notes.length]) {
    throw new Error("could not calculate a complete phrase underlay");
  }

  const counts: number[] = [];
  let end = notes.length;
  for (let group = syllableCount; group > 0; group -= 1) {
    const state = states[group][end];
    if (!state) {
      throw new Error("could not reconstruct the phrase underlay");
    }
    counts.unshift(end - state.previous);
    end = state.previous;
  }
  return counts;
}

function retargetLine(
  line: SettingLine,
  sourcePhraseId: string,
  targetPhrase: TuneRecord["phrases"][number],
  targetNotesById: ReadonlyMap<string, TuneNote>,
): SettingLine {
  if (line.phrase_id !== sourcePhraseId) {
    throw new Error(
      `${line.line_id} references ${line.phrase_id}, expected ${sourcePhraseId}.`,
    );
  }

  const syllableCount = line.tokens.reduce(
    (count, token) => count + token.syllable_map.length,
    0,
  );
  for (const token of line.tokens) {
    if (
      token.syllables !== token.syllable_map.length ||
      token.syllable_map.length === 0
    ) {
      throw new Error(`${token.id} has an invalid syllable map.`);
    }
  }

  const targetNotes = targetPhrase.note_ids.map((noteId) => {
    const note = targetNotesById.get(noteId);
    if (!note) {
      throw new Error(`${targetPhrase.id} references missing note ${noteId}.`);
    }
    return note;
  });

  let allocation: number[];
  try {
    allocation = allocatePhraseNotes(targetNotes, syllableCount);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${targetPhrase.id}: ${detail}.`);
  }

  let syllableIndex = 0;
  let noteIndex = 0;
  const tokens = line.tokens.map((token) => {
    const syllableMap = token.syllable_map.map((syllable) => {
      const assignedNoteCount = allocation[syllableIndex];
      const noteIds = targetPhrase.note_ids.slice(
        noteIndex,
        noteIndex + assignedNoteCount,
      );
      syllableIndex += 1;
      noteIndex += assignedNoteCount;
      return {
        ...syllable,
        note_ids: noteIds,
      };
    });

    return {
      ...token,
      note_ids: syllableMap.flatMap((syllable) => syllable.note_ids),
      syllable_map: syllableMap,
    };
  });

  if (
    syllableIndex !== syllableCount ||
    noteIndex !== targetPhrase.note_ids.length
  ) {
    throw new Error(`${targetPhrase.id} was not completely allocated.`);
  }

  return {
    ...line,
    phrase_id: targetPhrase.id,
    tokens,
  };
}

function tuneSlug(tuneId: string): string {
  return tuneId.startsWith("ps1650.tune.")
    ? tuneId.slice("ps1650.tune.".length)
    : tuneId;
}

/**
 * Clones a received-text setting onto a compatible tune.
 *
 * Lyric, token, and syllable fragments retain their IDs and text. Every target
 * soprano attack is assigned once, in order, and every syllable receives at
 * least one attack. No source record is mutated.
 */
export function retargetSetting(
  setting: PsalmSetting,
  sourceTune: TuneRecord,
  targetTune: TuneRecord,
): PsalmSetting {
  if (setting.tune_id !== sourceTune.id) {
    throw new Error(
      `${setting.id} uses ${setting.tune_id}, not ${sourceTune.id}.`,
    );
  }
  if (!tunesHaveCompatibleSettingShape(sourceTune, targetTune)) {
    throw new Error(
      `${targetTune.title} (${targetTune.meter}) does not match ` +
        `${sourceTune.title} (${sourceTune.meter}) phrase shape.`,
    );
  }
  if (sourceTune.phrases.length === 0) {
    throw new Error(`${sourceTune.id} has no lyric phrases.`);
  }

  const sourcePhraseIds = new Set(
    sourceTune.phrases.map((phrase) => phrase.id),
  );
  if (sourcePhraseIds.size !== sourceTune.phrases.length) {
    throw new Error(`${sourceTune.id} has duplicate phrase IDs.`);
  }
  assertOrderedSopranoCoverage(targetTune);

  const targetNotesById = new Map(
    targetTune.notes.map((note) => [note.id, note]),
  );
  const stanzas = setting.stanzas.map((stanza) => {
    if (stanza.lines.length !== sourceTune.phrases.length) {
      throw new Error(
        `${stanza.stanza_id} has ${stanza.lines.length} lines; ` +
          `${sourceTune.id} requires ${sourceTune.phrases.length}.`,
      );
    }

    return {
      ...stanza,
      lines: stanza.lines.map((line, phraseIndex) =>
        retargetLine(
          line,
          sourceTune.phrases[phraseIndex].id,
          targetTune.phrases[phraseIndex],
          targetNotesById,
        ),
      ),
    };
  });

  return {
    ...setting,
    id: `${setting.psalm_id}.setting.${tuneSlug(targetTune.id)}`,
    tune_id: targetTune.id,
    lead_in: "satb",
    inter_stanza_ticks:
      (targetTune.ppq * 8) / targetTune.time_signature[1],
    stanzas,
    rights: { ...setting.rights },
  };
}
