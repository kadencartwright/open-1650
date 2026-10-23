import type {
  PsalmSetting,
  SettingSyllable,
  SettingToken,
  TuneNote,
  TuneRecord,
} from "../data/types";
import {
  PERFORMANCE_VOICES,
  type PerformanceVoice,
} from "./voices";
import { tempoReference } from "./performanceOptions";

export interface ScheduledNote {
  id: string;
  sourceNoteId: string;
  stanzaId: string | null;
  voice: PerformanceVoice;
  midi: number;
  startTick: number;
  durationTicks: number;
  endTick: number;
  velocity: number;
}

export interface TimelineCue {
  startTick: number;
  endTick: number;
}

export interface StanzaCue extends TimelineCue {
  stanzaId: string;
  index: number;
}

export interface LineCue extends TimelineCue {
  stanzaId: string;
  lineId: string;
  phraseId: string;
  index: number;
}

export interface TokenCue extends TimelineCue {
  stanzaId: string;
  lineId: string;
  tokenId: string;
  text: string;
  syllables: number;
  noteIds: string[];
  index: number;
}

export interface SyllableCue extends TimelineCue {
  stanzaId: string;
  lineId: string;
  tokenId: string;
  syllableId: string;
  text: string;
  noteIds: string[];
  tokenIndex: number;
  index: number;
}

export interface CompiledPerformance {
  id: string;
  psalmId: string;
  tuneId: string;
  title: string;
  alternateTitle: string | null;
  meter: string;
  key: string;
  ppq: number;
  defaultBpm: number;
  timeSignature: [number, number];
  introTicks: number;
  interStanzaTicks: number;
  durationTicks: number;
  notes: ScheduledNote[];
  stanzas: StanzaCue[];
  lines: LineCue[];
  tokens: TokenCue[];
  syllables: SyllableCue[];
}

function assertFiniteInteger(
  value: number,
  label: string,
  minimum = 0,
): void {
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`${label} must be an integer of at least ${minimum}.`);
  }
}

function assertTune(tune: TuneRecord): void {
  assertFiniteInteger(tune.ppq, `${tune.id}.ppq`, 1);
  assertFiniteInteger(tune.length_ticks, `${tune.id}.length_ticks`, 1);

  if (!Number.isFinite(tune.default_bpm) || tune.default_bpm <= 0) {
    throw new Error(`${tune.id}.default_bpm must be greater than zero.`);
  }

  const noteIds = new Set<string>();
  const assertVoice = (
    notes: readonly TuneNote[],
    voice: PerformanceVoice,
  ) => {
    if (notes.length === 0) {
      throw new Error(`${tune.id}.${voice} must contain at least one note.`);
    }

    let previousEnd = 0;
    for (const note of notes) {
      if (noteIds.has(note.id)) {
        throw new Error(`Duplicate note ID "${note.id}" in ${tune.id}.`);
      }
      noteIds.add(note.id);
      assertFiniteInteger(note.midi, `${note.id}.midi`);
      assertFiniteInteger(note.start_tick, `${note.id}.start_tick`);
      assertFiniteInteger(
        note.duration_ticks,
        `${note.id}.duration_ticks`,
        1,
      );
      assertFiniteInteger(note.velocity, `${note.id}.velocity`);

      if (note.midi > 127 || note.velocity > 127) {
        throw new Error(`${note.id} contains a MIDI value above 127.`);
      }
      if (note.start_tick + note.duration_ticks > tune.length_ticks) {
        throw new Error(`${note.id} extends beyond ${tune.id}.length_ticks.`);
      }
      if (note.start_tick !== previousEnd) {
        throw new Error(
          `${note.id} must begin at tick ${previousEnd} in the ${voice} part.`,
        );
      }
      previousEnd = note.start_tick + note.duration_ticks;
    }
    if (previousEnd !== tune.length_ticks) {
      throw new Error(
        `${tune.id}.${voice} must end at tick ${tune.length_ticks}.`,
      );
    }
  };

  assertVoice(tune.notes, "soprano");
  if (
    !tune.harmony ||
    tune.harmony.voicing !== "SATB" ||
    !tune.harmony.voices
  ) {
    throw new Error(`${tune.id} must provide SATB harmony.`);
  }
  for (const voice of ["alto", "tenor", "bass"] as const) {
    assertVoice(tune.harmony.voices[voice] ?? [], voice);
  }

  const phraseIds = new Set<string>();
  for (const phrase of tune.phrases) {
    if (phraseIds.has(phrase.id)) {
      throw new Error(`Duplicate phrase ID "${phrase.id}" in ${tune.id}.`);
    }
    phraseIds.add(phrase.id);
    assertFiniteInteger(phrase.start_tick, `${phrase.id}.start_tick`);
    assertFiniteInteger(phrase.end_tick, `${phrase.id}.end_tick`, 1);

    if (
      phrase.end_tick <= phrase.start_tick ||
      phrase.end_tick > tune.length_ticks
    ) {
      throw new Error(`${phrase.id} has an invalid tick range.`);
    }
    for (const noteId of phrase.note_ids) {
      if (!noteIds.has(noteId)) {
        throw new Error(`${phrase.id} references missing note "${noteId}".`);
      }
    }
  }
}

function scheduledNoteId(stanzaId: string, noteId: string): string {
  return `${stanzaId}.${noteId}`;
}

function compileTokenCue(
  token: SettingToken,
  stanzaId: string,
  lineId: string,
  stanzaOffset: number,
  phraseStart: number,
  phraseEnd: number,
  noteById: Map<string, TuneNote>,
  phraseNoteIds: Set<string>,
  index: number,
): TokenCue {
  const tokenNotes = token.note_ids.map((noteId) => {
    const note = noteById.get(noteId);
    if (!note) {
      throw new Error(
        `Token "${token.id}" references missing note "${noteId}".`,
      );
    }
    if (!phraseNoteIds.has(noteId)) {
      throw new Error(
        `Token "${token.id}" assigns note "${noteId}" outside its phrase.`,
      );
    }
    return note;
  });

  const relativeStart =
    tokenNotes.length > 0
      ? Math.min(...tokenNotes.map((note) => note.start_tick))
      : phraseStart;
  const relativeEnd =
    tokenNotes.length > 0
      ? Math.max(
          ...tokenNotes.map(
            (note) => note.start_tick + note.duration_ticks,
          ),
        )
      : phraseEnd;

  return {
    stanzaId,
    lineId,
    tokenId: token.id,
    text: token.text,
    syllables: token.syllables,
    noteIds: token.note_ids.map((noteId) =>
      scheduledNoteId(stanzaId, noteId),
    ),
    startTick: stanzaOffset + relativeStart,
    endTick: stanzaOffset + relativeEnd,
    index,
  };
}

function compileSyllableCue(
  syllable: SettingSyllable,
  tokenId: string,
  stanzaId: string,
  lineId: string,
  stanzaOffset: number,
  noteById: Map<string, TuneNote>,
  phraseNoteIds: Set<string>,
  tokenIndex: number,
  index: number,
): SyllableCue {
  const syllableNotes = syllable.note_ids.map((noteId) => {
    const note = noteById.get(noteId);
    if (!note) {
      throw new Error(
        `Syllable "${syllable.id}" references missing note "${noteId}".`,
      );
    }
    if (!phraseNoteIds.has(noteId)) {
      throw new Error(
        `Syllable "${syllable.id}" assigns note "${noteId}" outside its phrase.`,
      );
    }
    return note;
  });
  if (syllableNotes.length === 0) {
    throw new Error(`Syllable "${syllable.id}" must assign at least one note.`);
  }

  return {
    stanzaId,
    lineId,
    tokenId,
    syllableId: syllable.id,
    text: syllable.text,
    noteIds: syllable.note_ids.map((noteId) =>
      scheduledNoteId(stanzaId, noteId),
    ),
    startTick:
      stanzaOffset +
      Math.min(...syllableNotes.map((note) => note.start_tick)),
    endTick:
      stanzaOffset +
      Math.max(
        ...syllableNotes.map(
          (note) => note.start_tick + note.duration_ticks,
        ),
      ),
    tokenIndex,
    index,
  };
}

export function compilePerformance(
  tune: TuneRecord,
  setting: PsalmSetting,
): CompiledPerformance {
  assertTune(tune);
  assertFiniteInteger(
    setting.inter_stanza_ticks,
    `${setting.id}.inter_stanza_ticks`,
  );

  if (setting.lead_in !== "satb") {
    throw new Error(`${setting.id}.lead_in must be "satb".`);
  }
  if (setting.tune_id !== tune.id) {
    throw new Error(
      `${setting.id} targets tune "${setting.tune_id}", not "${tune.id}".`,
    );
  }
  if (setting.stanzas.length === 0) {
    throw new Error(`${setting.id} must contain at least one stanza.`);
  }

  const phraseById = new Map(
    tune.phrases.map((phrase) => [phrase.id, phrase]),
  );
  const noteById = new Map(tune.notes.map((note) => [note.id, note]));
  const introTicks = tune.length_ticks;
  const tuneVoices = {
    soprano: tune.notes,
    ...tune.harmony.voices,
  };
  const stanzaStrideTicks =
    tune.length_ticks + setting.inter_stanza_ticks;
  const notes: ScheduledNote[] = [];
  for (const voice of PERFORMANCE_VOICES) {
    for (const note of tuneVoices[voice]) {
      notes.push({
        id: `${setting.id}.intro.${note.id}`,
        sourceNoteId: note.id,
        stanzaId: null,
        voice,
        midi: note.midi,
        startTick: note.start_tick,
        durationTicks: note.duration_ticks,
        endTick: note.start_tick + note.duration_ticks,
        velocity: note.velocity,
      });
    }
  }
  const stanzas: StanzaCue[] = [];
  const lines: LineCue[] = [];
  const tokens: TokenCue[] = [];
  const syllables: SyllableCue[] = [];

  setting.stanzas.forEach((stanza, stanzaIndex) => {
    const isFinalStanza = stanzaIndex === setting.stanzas.length - 1;
    const sustainTicks = isFinalStanza
      ? 0
      : setting.inter_stanza_ticks;
    const stanzaOffset =
      introTicks +
      stanzaIndex * stanzaStrideTicks;
    const writtenStanzaEndTick = stanzaOffset + tune.length_ticks;
    const stanzaEndTick = writtenStanzaEndTick + sustainTicks;

    stanzas.push({
      stanzaId: stanza.stanza_id,
      index: stanzaIndex,
      startTick: stanzaOffset,
      endTick: stanzaEndTick,
    });

    for (const voice of PERFORMANCE_VOICES) {
      for (const note of tuneVoices[voice]) {
        const sourceEndTick = note.start_tick + note.duration_ticks;
        const durationTicks =
          note.duration_ticks +
          (sourceEndTick === tune.length_ticks ? sustainTicks : 0);
        notes.push({
          id: scheduledNoteId(stanza.stanza_id, note.id),
          sourceNoteId: note.id,
          stanzaId: stanza.stanza_id,
          voice,
          midi: note.midi,
          startTick: stanzaOffset + note.start_tick,
          durationTicks,
          endTick: stanzaOffset + note.start_tick + durationTicks,
          velocity: note.velocity,
        });
      }
    }

    stanza.lines.forEach((line, lineIndex) => {
      const phrase = phraseById.get(line.phrase_id);
      if (!phrase) {
        throw new Error(
          `Line "${line.line_id}" references missing phrase "${line.phrase_id}".`,
        );
      }

      lines.push({
        stanzaId: stanza.stanza_id,
        lineId: line.line_id,
        phraseId: phrase.id,
        index: lineIndex,
        startTick: stanzaOffset + phrase.start_tick,
        endTick:
          stanzaOffset +
          phrase.end_tick +
          (phrase.end_tick === tune.length_ticks ? sustainTicks : 0),
      });

      const phraseNoteIds = new Set(phrase.note_ids);
      line.tokens.forEach((token, tokenIndex) => {
        const tokenCue = compileTokenCue(
          token,
          stanza.stanza_id,
          line.line_id,
          stanzaOffset,
          phrase.start_tick,
          phrase.end_tick,
          noteById,
          phraseNoteIds,
          tokenIndex,
        );
        if (tokenCue.endTick === writtenStanzaEndTick) {
          tokenCue.endTick += sustainTicks;
        }
        tokens.push(tokenCue);
        token.syllable_map.forEach((syllable, syllableIndex) => {
          const syllableCue = compileSyllableCue(
            syllable,
            token.id,
            stanza.stanza_id,
            line.line_id,
            stanzaOffset,
            noteById,
            phraseNoteIds,
            tokenIndex,
            syllableIndex,
          );
          if (syllableCue.endTick === writtenStanzaEndTick) {
            syllableCue.endTick += sustainTicks;
          }
          syllables.push(syllableCue);
        });
      });
    });
  });

  const lastStanza = stanzas.at(-1);

  return {
    id: setting.id,
    psalmId: setting.psalm_id,
    tuneId: tune.id,
    title: tune.title,
    alternateTitle: tune.alternate_title,
    meter: tune.meter,
    key: tune.key,
    ppq: tune.ppq,
    defaultBpm: tempoReference(tune.id, setting.psalm_id)?.bpm ?? tune.default_bpm,
    timeSignature: tune.time_signature,
    introTicks,
    interStanzaTicks: setting.inter_stanza_ticks,
    durationTicks: lastStanza?.endTick ?? introTicks,
    notes: notes.sort(
      (a, b) =>
        a.startTick - b.startTick ||
        PERFORMANCE_VOICES.indexOf(a.voice) -
          PERFORMANCE_VOICES.indexOf(b.voice) ||
        a.midi - b.midi ||
        a.id.localeCompare(b.id),
    ),
    stanzas,
    lines: lines.sort((a, b) => a.startTick - b.startTick),
    tokens: tokens.sort((a, b) => a.startTick - b.startTick),
    syllables: syllables.sort((a, b) => a.startTick - b.startTick),
  };
}

export function ticksToSeconds(
  ticks: number,
  ppq: number,
  bpm: number,
): number {
  return (ticks * 60) / (ppq * bpm);
}

export function secondsToTicks(
  seconds: number,
  ppq: number,
  bpm: number,
): number {
  return (seconds * ppq * bpm) / 60;
}

export function clampTick(tick: number, durationTicks: number): number {
  return Math.min(Math.max(0, tick), durationTicks);
}

/**
 * Return the first item whose start tick is not less than `tick`.
 *
 * Compiled timeline collections are sorted once by `startTick`, so playback
 * lookups can stay logarithmic even for long psalms.
 */
export function findFirstStartingAtOrAfter<
  T extends Pick<TimelineCue, "startTick">,
>(items: readonly T[], tick: number): number {
  let low = 0;
  let high = items.length;

  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    if (items[middle].startTick < tick) low = middle + 1;
    else high = middle;
  }

  return low;
}

export function findCueAtTick<T extends TimelineCue>(
  cues: readonly T[],
  tick: number,
): T | undefined {
  const insertionIndex = findFirstStartingAtOrAfter(cues, tick);
  const exactStart = cues[insertionIndex];
  if (
    exactStart?.startTick === tick &&
    tick < exactStart.endTick
  ) {
    return exactStart;
  }

  const previous = cues[insertionIndex - 1];
  return previous && tick < previous.endTick ? previous : undefined;
}

/**
 * Find the earliest note the scheduler must inspect after a seek.
 *
 * SATB parts are monophonic, so only the latest note in each voice can be
 * sustaining across the seek point. Subsequent scheduling advances from this
 * index and never rescans notes that have already passed.
 */
export function findScheduleStartIndex(
  notes: readonly ScheduledNote[],
  tick: number,
): number {
  const firstUpcoming = findFirstStartingAtOrAfter(notes, tick);
  const inspectedVoices = new Set<PerformanceVoice>();
  let earliestActive = firstUpcoming;

  for (
    let index = firstUpcoming - 1;
    index >= 0 && inspectedVoices.size < PERFORMANCE_VOICES.length;
    index -= 1
  ) {
    const note = notes[index];
    if (inspectedVoices.has(note.voice)) continue;

    inspectedVoices.add(note.voice);
    if (note.endTick > tick) earliestActive = index;
  }

  return earliestActive;
}

export function findNearestStanza(
  stanzas: readonly StanzaCue[],
  tick: number,
): StanzaCue | undefined {
  if (stanzas.length === 0) return undefined;

  const active = findCueAtTick(stanzas, tick);
  if (active) return active;

  const insertionIndex = findFirstStartingAtOrAfter(stanzas, tick);
  const previous = stanzas[insertionIndex - 1];
  const next = stanzas[insertionIndex];
  if (!previous) return next;
  if (!next) return previous;

  const previousDistance = Math.min(
    Math.abs(tick - previous.startTick),
    Math.abs(tick - previous.endTick),
  );
  const nextDistance = Math.min(
    Math.abs(tick - next.startTick),
    Math.abs(tick - next.endTick),
  );
  return nextDistance < previousDistance ? next : previous;
}
