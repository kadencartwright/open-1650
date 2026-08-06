import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import process from "node:process";

const corpusDirectory = new URL("../corpus/text/", import.meta.url);
const sourceCatalogPath = new URL(
  "../corpus/sources/witnesses.json",
  import.meta.url,
);
const tuneDirectory = new URL("../corpus/music/tunes/", import.meta.url);
const settingDirectory = new URL("../corpus/music/settings/", import.meta.url);
const files = (await readdir(corpusDirectory))
  .filter((file) => file.endsWith(".json"))
  .sort();
const tuneFiles = (await readdir(tuneDirectory))
  .filter((file) => file.endsWith(".json"))
  .sort();
const settingFiles = (await readdir(settingDirectory))
  .filter((file) => file.endsWith(".json"))
  .sort();
const sourceCatalog = JSON.parse(await readFile(sourceCatalogPath, "utf8"));
const sourceIds = new Set(sourceCatalog.sources.map((source) => source.id));

const errors = [];
const recordIds = new Set();
const lineIds = new Set();
const psalmsById = new Map();
const linesById = new Map();
const tuneIds = new Set();
const tunesById = new Map();
const tuneNoteIds = new Set();
const settingIds = new Set();
const settingTokenIds = new Set();
const settingSyllableIds = new Set();

function expect(condition, file, message) {
  if (!condition) errors.push(`${file}: ${message}`);
}

function isHttpUrl(value) {
  if (typeof value !== "string") return false;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function arraysEqual(left, right) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

for (const file of files) {
  const path = join(corpusDirectory.pathname, file);
  const record = JSON.parse(await readFile(path, "utf8"));
  const expectedStem = `psalm-${String(record.psalm_number).padStart(3, "0")}.${record.version}`;
  const expectedId = `ps1650.${expectedStem}`;
  const meter = record.meter?.pattern?.split(".").map(Number) ?? [];

  expect(basename(file, ".json") === expectedStem, file, "filename must match Psalm number and version");
  expect(record.id === expectedId, file, `record ID must be ${expectedId}`);
  expect(!recordIds.has(record.id), file, `duplicate record ID ${record.id}`);
  expect(Number.isInteger(record.psalm_number), file, "psalm_number must be an integer");
  expect(record.psalm_number >= 1 && record.psalm_number <= 150, file, "psalm_number must be in 1…150");
  expect(["primary", "alternate"].includes(record.version), file, "version must be primary or alternate");
  expect(meter.length > 0 && meter.every(Number.isFinite), file, "meter pattern must contain numeric line lengths");
  expect(record.rights?.historic_text === "PDM-1.0", file, "historic text must declare PDM-1.0");
  expect(record.rights?.transcription === "CC0-1.0", file, "transcription must declare CC0-1.0");
  expect(record.rights?.metadata === "CC0-1.0", file, "metadata must declare CC0-1.0");
  expect(
    sourceIds.has(record.source?.witness_id),
    file,
    `source witness ${record.source?.witness_id ?? "(missing)"} must exist in witnesses.json`,
  );
  expect(record.source?.facsimile_url, file, "source facsimile URL is required");
  expect(Array.isArray(record.stanzas) && record.stanzas.length > 0, file, "at least one stanza is required");

  recordIds.add(record.id);
  psalmsById.set(record.id, record);

  for (const [stanzaIndex, stanza] of record.stanzas.entries()) {
    const stanzaNumber = stanzaIndex + 1;
    const expectedStanzaId = `${record.id}.stanza-${String(stanzaNumber).padStart(2, "0")}`;
    expect(stanza.number === stanzaNumber, file, `stanza numbers must be sequential at ${stanza.id}`);
    expect(stanza.id === expectedStanzaId, file, `stanza ID must be ${expectedStanzaId}`);
    expect(
      stanza.lines.length === meter.length,
      file,
      `${stanza.id} must contain ${meter.length} metrical lines`,
    );

    for (const [lineIndex, line] of stanza.lines.entries()) {
      const lineNumber = lineIndex + 1;
      const expectedLineId = `${stanza.id}.line-${String(lineNumber).padStart(2, "0")}`;
      expect(line.number === lineNumber, file, `line numbers must be sequential at ${line.id}`);
      expect(line.id === expectedLineId, file, `line ID must be ${expectedLineId}`);
      expect(!lineIds.has(line.id), file, `duplicate line ID ${line.id}`);
      expect(
        line.syllable_count === meter[lineIndex],
        file,
        `${line.id} declares ${line.syllable_count} syllables; meter requires ${meter[lineIndex]}`,
      );

      for (const edition of ["diplomatic", "normalized", "reading"]) {
        expect(
          typeof line.text?.[edition] === "string" &&
            line.text[edition].trim().length > 0,
          file,
          `${line.id} requires nonempty ${edition} text`,
        );
      }

      lineIds.add(line.id);
      linesById.set(line.id, line);
    }
  }
}

for (const file of tuneFiles) {
  const path = join(tuneDirectory.pathname, file);
  const tune = JSON.parse(await readFile(path, "utf8"));
  const slug = basename(file, ".json");
  const expectedId = `ps1650.tune.${slug}`;
  const meter = tune.meter?.split(".").map(Number) ?? [];
  const notes = Array.isArray(tune.notes) ? tune.notes : [];
  const phrases = Array.isArray(tune.phrases) ? tune.phrases : [];
  const noteById = new Map();
  const phraseIds = new Set();
  const assignedNoteIds = new Set();

  expect(tune.id === expectedId, file, `tune ID must be ${expectedId}`);
  expect(
    tune.schema_version === "0.2.0",
    file,
    "tune schema_version must be 0.2.0",
  );
  expect(!tuneIds.has(tune.id), file, `duplicate tune ID ${tune.id}`);
  expect(
    typeof tune.title === "string" && tune.title.trim().length > 0,
    file,
    "tune title is required",
  );
  expect(
    tune.alternate_title === null ||
      (typeof tune.alternate_title === "string" &&
        tune.alternate_title.trim().length > 0),
    file,
    "alternate_title must be a nonempty string or null",
  );
  expect(
    meter.length > 0 && meter.every(Number.isFinite),
    file,
    "tune meter must contain numeric line lengths",
  );
  expect(tune.ppq === 480, file, "tune ppq must be the corpus standard of 480");
  expect(
    Number.isInteger(tune.default_bpm) &&
      tune.default_bpm >= 20 &&
      tune.default_bpm <= 300,
    file,
    "tune default_bpm must be an integer in 20…300",
  );
  expect(
    Array.isArray(tune.time_signature) &&
      tune.time_signature.length === 2 &&
      Number.isInteger(tune.time_signature[0]) &&
      tune.time_signature[0] > 0 &&
      [1, 2, 4, 8, 16].includes(tune.time_signature[1]),
    file,
    "tune time_signature must contain a positive numerator and supported denominator",
  );
  const beatTicks =
    Array.isArray(tune.time_signature) && tune.time_signature.length === 2
      ? (tune.ppq * 4) / tune.time_signature[1]
      : Number.NaN;
  expect(
    Number.isInteger(beatTicks) && beatTicks > 0,
    file,
    "time_signature denominator must produce a positive whole-tick beat",
  );
  expect(
    typeof tune.key === "string" && tune.key.trim().length > 0,
    file,
    "tune key is required",
  );
  expect(
    Number.isInteger(tune.length_ticks) && tune.length_ticks > 0,
    file,
    "length_ticks must be a positive integer",
  );
  expect(notes.length > 0, file, "at least one tune note is required");
  expect(
    phrases.length === meter.length,
    file,
    `tune must contain ${meter.length} phrases for meter ${tune.meter}`,
  );

  expect(
    tune.rights?.composition === "PDM-1.0",
    file,
    "tune composition must declare PDM-1.0",
  );
  expect(
    tune.rights?.source_transcription === "PDM-1.0",
    file,
    "tune source transcription must declare PDM-1.0",
  );
  expect(
    tune.rights?.metadata === "CC0-1.0",
    file,
    "tune metadata must declare CC0-1.0",
  );
  for (const field of [
    "id",
    "label",
    "provider",
    "source_work",
    "date",
    "attribution",
    "editorial_transformation",
  ]) {
    expect(
      typeof tune.source?.[field] === "string" &&
        tune.source[field].trim().length > 0,
      file,
      `tune source ${field} is required`,
    );
  }
  for (const field of [
    "record_url",
    "editable_score_url",
    "rights_statement_url",
  ]) {
    expect(
      isHttpUrl(tune.source?.[field]),
      file,
      `tune source ${field} must be an HTTP(S) URL`,
    );
  }

  let previousNoteEnd = 0;
  for (const [noteIndex, note] of notes.entries()) {
    expect(
      typeof note.id === "string" && note.id.trim().length > 0,
      file,
      `note ${noteIndex + 1} requires an ID`,
    );
    expect(!noteById.has(note.id), file, `duplicate note ID ${note.id}`);
    expect(!tuneNoteIds.has(note.id), file, `duplicate corpus note ID ${note.id}`);
    expect(
      Number.isInteger(note.midi) && note.midi >= 0 && note.midi <= 127,
      file,
      `${note.id} midi must be an integer in 0…127`,
    );
    expect(
      Number.isInteger(note.start_tick) && note.start_tick >= 0,
      file,
      `${note.id} start_tick must be a nonnegative integer`,
    );
    expect(
      Number.isInteger(note.duration_ticks) && note.duration_ticks > 0,
      file,
      `${note.id} duration_ticks must be a positive integer`,
    );
    expect(
      Number.isInteger(note.velocity) &&
        note.velocity >= 1 &&
        note.velocity <= 127,
      file,
      `${note.id} velocity must be an integer in 1…127`,
    );
    expect(
      note.start_tick === previousNoteEnd,
      file,
      `${note.id} must begin at tick ${previousNoteEnd} for a contiguous monophonic melody`,
    );

    previousNoteEnd = note.start_tick + note.duration_ticks;
    noteById.set(note.id, note);
    tuneNoteIds.add(note.id);
  }
  expect(
    previousNoteEnd === tune.length_ticks,
    file,
    `last note must end at length_ticks ${tune.length_ticks}`,
  );

  const harmonyVoices = tune.harmony?.voices ?? {};
  expect(
    tune.harmony?.voicing === "SATB",
    file,
    "tune harmony voicing must be SATB",
  );
  expect(
    arraysEqual(
      Object.keys(harmonyVoices).sort(),
      ["alto", "bass", "tenor"],
    ),
    file,
    "tune harmony must contain exactly alto, tenor, and bass",
  );
  expect(
    typeof tune.harmony?.editorial_transformation === "string" &&
      tune.harmony.editorial_transformation.trim().length > 0,
    file,
    "tune harmony editorial transformation is required",
  );
  expect(
    tune.harmony?.rights?.arrangement === "PDM-1.0",
    file,
    "historic harmony arrangement must declare PDM-1.0",
  );
  expect(
    tune.harmony?.rights?.event_transcription === "PDM-1.0",
    file,
    "harmony event transcription must declare PDM-1.0",
  );

  const voiceRanges = {
    alto: [53, 74],
    tenor: [48, 69],
    bass: [36, 60],
  };
  for (const voice of ["alto", "tenor", "bass"]) {
    const voiceNotes = Array.isArray(harmonyVoices[voice])
      ? harmonyVoices[voice]
      : [];
    let previousVoiceEnd = 0;

    expect(
      voiceNotes.length > 0,
      file,
      `${voice} must contain at least one note`,
    );
    for (const [noteIndex, note] of voiceNotes.entries()) {
      expect(
        typeof note.id === "string" && note.id.trim().length > 0,
        file,
        `${voice} note ${noteIndex + 1} requires an ID`,
      );
      expect(
        !tuneNoteIds.has(note.id),
        file,
        `duplicate corpus note ID ${note.id}`,
      );
      expect(
        Number.isInteger(note.midi) &&
          note.midi >= voiceRanges[voice][0] &&
          note.midi <= voiceRanges[voice][1],
        file,
        `${note.id} midi must be in the supported ${voice} range ${voiceRanges[voice][0]}…${voiceRanges[voice][1]}`,
      );
      expect(
        Number.isInteger(note.start_tick) &&
          note.start_tick === previousVoiceEnd,
        file,
        `${note.id} must begin at tick ${previousVoiceEnd} for a contiguous monophonic ${voice} part`,
      );
      expect(
        Number.isInteger(note.duration_ticks) &&
          note.duration_ticks > 0,
        file,
        `${note.id} duration_ticks must be a positive integer`,
      );
      expect(
        Number.isInteger(note.velocity) &&
          note.velocity >= 1 &&
          note.velocity <= 127,
        file,
        `${note.id} velocity must be an integer in 1…127`,
      );

      previousVoiceEnd = note.start_tick + note.duration_ticks;
      tuneNoteIds.add(note.id);
    }
    expect(
      previousVoiceEnd === tune.length_ticks,
      file,
      `${voice} must end at length_ticks ${tune.length_ticks}`,
    );
    expect(
      new Set(voiceNotes.map((note) => note.midi)).size > 1,
      file,
      `${voice} must contain more than one pitch`,
    );
  }

  const finalChordStarts = [
    notes.at(-1)?.start_tick,
    harmonyVoices.alto?.at(-1)?.start_tick,
    harmonyVoices.tenor?.at(-1)?.start_tick,
    harmonyVoices.bass?.at(-1)?.start_tick,
  ];
  expect(
    finalChordStarts[0] !== undefined &&
      finalChordStarts.every(
        (startTick) => startTick === finalChordStarts[0],
      ),
    file,
    "final SATB chord must begin together in all four voices",
  );

  let previousPhraseEnd = 0;
  for (const [phraseIndex, phrase] of phrases.entries()) {
    const phraseNumber = phraseIndex + 1;
    const expectedPhraseId = `${tune.id}.phrase-${String(phraseNumber).padStart(2, "0")}`;
    const expectedSyllables = meter[phraseIndex];
    const phraseNoteIds = Array.isArray(phrase.note_ids)
      ? phrase.note_ids
      : [];
    const phraseNotes = phraseNoteIds
      .map((noteId) => noteById.get(noteId))
      .filter(Boolean);
    const notesInRange = notes.filter(
      (note) =>
        note.start_tick >= phrase.start_tick &&
        note.start_tick + note.duration_ticks <= phrase.end_tick,
    );
    expect(
      phrase.id === expectedPhraseId,
      file,
      `phrase ID must be ${expectedPhraseId}`,
    );
    expect(!phraseIds.has(phrase.id), file, `duplicate phrase ID ${phrase.id}`);
    expect(
      Number.isInteger(phrase.start_tick) &&
        phrase.start_tick === previousPhraseEnd,
      file,
      `${phrase.id} must begin at tick ${previousPhraseEnd}`,
    );
    expect(
      Number.isInteger(phrase.end_tick) &&
        phrase.end_tick > phrase.start_tick &&
        phrase.end_tick <= tune.length_ticks,
      file,
      `${phrase.id} must have a valid increasing tick range`,
    );
    expect(
      phraseNoteIds.length >= expectedSyllables,
      file,
      `${phrase.id} must contain at least ${expectedSyllables} notes for its metrical line`,
    );
    expect(
      new Set(phraseNoteIds).size === phraseNoteIds.length,
      file,
      `${phrase.id} must not repeat note IDs`,
    );

    for (const noteId of phraseNoteIds) {
      expect(noteById.has(noteId), file, `${phrase.id} references missing note ${noteId}`);
      expect(
        !assignedNoteIds.has(noteId),
        file,
        `${noteId} must belong to exactly one phrase`,
      );
      assignedNoteIds.add(noteId);
    }
    expect(
      arraysEqual(
        phraseNoteIds,
        notesInRange.map((note) => note.id),
      ),
      file,
      `${phrase.id} note IDs must exactly cover its tick range in order`,
    );
    if (phraseNotes.length > 0) {
      const firstNote = phraseNotes[0];
      const lastNote = phraseNotes.at(-1);
      expect(
        firstNote.start_tick === phrase.start_tick,
        file,
        `${phrase.id} first note must begin at the phrase start`,
      );
      expect(
        lastNote.start_tick + lastNote.duration_ticks === phrase.end_tick,
        file,
        `${phrase.id} last note must end at the phrase end`,
      );
    }

    phraseIds.add(phrase.id);
    previousPhraseEnd = phrase.end_tick;
  }
  expect(
    previousPhraseEnd === tune.length_ticks,
    file,
    "phrases must cover the complete tune",
  );
  expect(
    assignedNoteIds.size === notes.length,
    file,
    "every tune note must belong to exactly one phrase",
  );

  tuneIds.add(tune.id);
  tunesById.set(tune.id, tune);
}

for (const file of settingFiles) {
  const path = join(settingDirectory.pathname, file);
  const setting = JSON.parse(await readFile(path, "utf8"));
  const psalm = psalmsById.get(setting.psalm_id);
  const tune = tunesById.get(setting.tune_id);
  const tuneSlug =
    typeof setting.tune_id === "string"
      ? setting.tune_id.replace(/^ps1650\.tune\./, "")
      : "(missing)";
  const expectedFilename = psalm
    ? `psalm-${String(psalm.psalm_number).padStart(3, "0")}.${psalm.version}.${tuneSlug}`
    : null;

  expect(!settingIds.has(setting.id), file, `duplicate setting ID ${setting.id}`);
  expect(
    setting.schema_version === "0.4.0",
    file,
    "setting schema_version must be 0.4.0",
  );
  expect(
    setting.lead_in === "satb",
    file,
    "lead_in must play all four parts once",
  );
  expect(psalm, file, `setting Psalm ${setting.psalm_id ?? "(missing)"} must exist`);
  expect(tune, file, `setting tune ${setting.tune_id ?? "(missing)"} must exist`);
  if (expectedFilename) {
    expect(
      basename(file, ".json") === expectedFilename,
      file,
      `filename must be ${expectedFilename}.json`,
    );
  }
  if (psalm && tune) {
    const settingBeatTicks =
      (tune.ppq * 4) / tune.time_signature[1];
    expect(
      setting.id === `${psalm.id}.setting.${tuneSlug}`,
      file,
      `setting ID must be ${psalm.id}.setting.${tuneSlug}`,
    );
    expect(
      psalm.meter?.pattern === tune.meter,
      file,
      `Psalm meter ${psalm.meter?.pattern} must match tune meter ${tune.meter}`,
    );
    expect(
      setting.inter_stanza_ticks === settingBeatTicks * 2,
      file,
      `inter_stanza_ticks must provide two beats (${settingBeatTicks * 2} ticks)`,
    );
  }
  expect(
    setting.rights?.alignment === "CC0-1.0",
    file,
    "setting alignment must declare CC0-1.0",
  );
  expect(
    setting.rights?.metadata === "CC0-1.0",
    file,
    "setting metadata must declare CC0-1.0",
  );

  if (!psalm || !tune) {
    settingIds.add(setting.id);
    continue;
  }

  const stanzaMappings = Array.isArray(setting.stanzas)
    ? setting.stanzas
    : [];
  const expectedLineIds = psalm.stanzas.flatMap((stanza) =>
    stanza.lines.map((line) => line.id),
  );
  const mappedLineIds = [];
  const mappedStanzaIds = new Set();
  const tuneNoteById = new Map(tune.notes.map((note) => [note.id, note]));
  const phraseById = new Map(
    tune.phrases.map((phrase) => [phrase.id, phrase]),
  );
  const stanzaStrideTicks =
    tune.length_ticks + setting.inter_stanza_ticks;
  let previousPlaybackLineStart = -1;

  expect(
    stanzaMappings.length === psalm.stanzas.length,
    file,
    `setting must map all ${psalm.stanzas.length} Psalm stanzas`,
  );

  for (const [stanzaIndex, stanzaMapping] of stanzaMappings.entries()) {
    const psalmStanza = psalm.stanzas[stanzaIndex];
    const lines = Array.isArray(stanzaMapping.lines)
      ? stanzaMapping.lines
      : [];
    const stanzaStart =
      tune.length_ticks +
      stanzaIndex * stanzaStrideTicks;

    expect(
      stanzaMapping.stanza_id === psalmStanza?.id,
      file,
      `stanza ${stanzaIndex + 1} must map ${psalmStanza?.id}`,
    );
    expect(
      !mappedStanzaIds.has(stanzaMapping.stanza_id),
      file,
      `duplicate stanza mapping ${stanzaMapping.stanza_id}`,
    );
    mappedStanzaIds.add(stanzaMapping.stanza_id);
    expect(
      lines.length === psalmStanza?.lines.length,
      file,
      `${stanzaMapping.stanza_id} must map all ${psalmStanza?.lines.length} lines`,
    );

    for (const [lineIndex, lineMapping] of lines.entries()) {
      const psalmLine = psalmStanza?.lines[lineIndex];
      const expectedPhrase = tune.phrases[lineIndex];
      const phrase = phraseById.get(lineMapping.phrase_id);
      const tokens = Array.isArray(lineMapping.tokens)
        ? lineMapping.tokens
        : [];
      const referencedNoteIds = tokens.flatMap((token) =>
        Array.isArray(token.note_ids) ? token.note_ids : [],
      );
      const joinedText = tokens.map((token) => token.text).join(" ");
      const syllableCount = tokens.reduce(
        (total, token) =>
          total + (Number.isInteger(token.syllables) ? token.syllables : 0),
        0,
      );
      const playbackLineStart =
        stanzaStart + (phrase?.start_tick ?? Number.NaN);

      expect(
        lineMapping.line_id === psalmLine?.id,
        file,
        `stanza ${stanzaIndex + 1} line ${lineIndex + 1} must map ${psalmLine?.id}`,
      );
      expect(
        !mappedLineIds.includes(lineMapping.line_id),
        file,
        `duplicate line mapping ${lineMapping.line_id}`,
      );
      mappedLineIds.push(lineMapping.line_id);
      expect(
        lineMapping.phrase_id === expectedPhrase?.id,
        file,
        `${lineMapping.line_id} must map exact phrase ${expectedPhrase?.id}`,
      );
      expect(
        phrase,
        file,
        `${lineMapping.line_id} references missing phrase ${lineMapping.phrase_id}`,
      );
      expect(
        Number.isFinite(playbackLineStart) &&
          playbackLineStart > previousPlaybackLineStart,
        file,
        `${lineMapping.line_id} must have a monotonically increasing playback tick`,
      );
      previousPlaybackLineStart = playbackLineStart;
      expect(
        joinedText === psalmLine?.text.reading,
        file,
        `${lineMapping.line_id} tokens must join exactly to its reading text`,
      );
      expect(
        syllableCount === psalmLine?.syllable_count,
        file,
        `${lineMapping.line_id} token syllables must total ${psalmLine?.syllable_count}`,
      );
      expect(
        referencedNoteIds.length === (phrase?.note_ids.length ?? 0),
        file,
        `${lineMapping.line_id} must assign every note in its phrase`,
      );
      expect(
        arraysEqual(referencedNoteIds, phrase?.note_ids ?? []),
        file,
        `${lineMapping.line_id} must cover its phrase notes exactly once and in order`,
      );

      for (const [tokenIndex, token] of tokens.entries()) {
        const expectedTokenId = `${lineMapping.line_id}.token-${String(tokenIndex + 1).padStart(2, "0")}`;
        const tokenNoteIds = Array.isArray(token.note_ids)
          ? token.note_ids
          : [];
        const syllableMap = Array.isArray(token.syllable_map)
          ? token.syllable_map
          : [];
        const syllableNoteIds = syllableMap.flatMap((syllable) =>
          Array.isArray(syllable.note_ids) ? syllable.note_ids : [],
        );

        expect(
          token.id === expectedTokenId,
          file,
          `token ID must be ${expectedTokenId}`,
        );
        expect(
          !settingTokenIds.has(token.id),
          file,
          `duplicate setting token ID ${token.id}`,
        );
        settingTokenIds.add(token.id);
        expect(
          typeof token.text === "string" &&
            token.text.trim() === token.text &&
            token.text.length > 0,
          file,
          `${token.id} must contain nonempty lyric text`,
        );
        expect(
          Number.isInteger(token.syllables) && token.syllables > 0,
          file,
          `${token.id} syllables must be a positive integer`,
        );
        expect(
          tokenNoteIds.length >= token.syllables,
          file,
          `${token.id} must map at least one note per declared syllable`,
        );
        expect(
          syllableMap.length === token.syllables,
          file,
          `${token.id} must map all ${token.syllables} syllables`,
        );
        expect(
          syllableMap.map((syllable) => syllable.text).join("") ===
            token.text,
          file,
          `${token.id} syllable text must join exactly to its word`,
        );
        expect(
          arraysEqual(syllableNoteIds, tokenNoteIds),
          file,
          `${token.id} syllables must cover its notes exactly once and in order`,
        );

        for (const [syllableIndex, syllable] of syllableMap.entries()) {
          const expectedSyllableId = `${token.id}.syllable-${String(syllableIndex + 1).padStart(2, "0")}`;
          const noteIds = Array.isArray(syllable.note_ids)
            ? syllable.note_ids
            : [];

          expect(
            syllable.id === expectedSyllableId,
            file,
            `syllable ID must be ${expectedSyllableId}`,
          );
          expect(
            !settingSyllableIds.has(syllable.id),
            file,
            `duplicate setting syllable ID ${syllable.id}`,
          );
          settingSyllableIds.add(syllable.id);
          expect(
            typeof syllable.text === "string" &&
              syllable.text.trim().length > 0,
            file,
            `${syllable.id} must contain a nonempty text fragment`,
          );
          expect(
            noteIds.length > 0,
            file,
            `${syllable.id} must map at least one note`,
          );
          for (const noteId of noteIds) {
            expect(
              tuneNoteById.has(noteId),
              file,
              `${syllable.id} references missing note ${noteId}`,
            );
            expect(
              phrase?.note_ids.includes(noteId),
              file,
              `${syllable.id} note ${noteId} must belong to ${lineMapping.phrase_id}`,
            );
          }
        }

        for (const noteId of tokenNoteIds) {
          expect(
            tuneNoteById.has(noteId),
            file,
            `${token.id} references missing note ${noteId}`,
          );
          expect(
            phrase?.note_ids.includes(noteId),
            file,
            `${token.id} note ${noteId} must belong to ${lineMapping.phrase_id}`,
          );
        }
      }
    }
  }

  expect(
    arraysEqual(mappedLineIds, expectedLineIds),
    file,
    "setting must cover every Psalm line exactly once and in source order",
  );
  expect(
    mappedStanzaIds.size === psalm.stanzas.length,
    file,
    "setting must cover every Psalm stanza exactly once",
  );

  settingIds.add(setting.id);
}

if (errors.length) {
  console.error(`Corpus validation failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `Validated ${recordIds.size} Psalm records, ${lineIds.size} stable line IDs, ${sourceIds.size} text sources, ${tuneIds.size} tunes with ${tuneNoteIds.size} notes, ${settingIds.size} settings with ${settingTokenIds.size} lyric tokens and ${settingSyllableIds.size} timed syllables, and all rights metadata.`,
);
