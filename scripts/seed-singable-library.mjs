import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const ppq = 480;
const velocity = 88;

const wordSyllablePatterns = new Map(
  Object.entries({
    again: ["a", "gain"],
    always: ["al", "ways"],
    anoint: ["a", "noint"],
    appear: ["ap", "pear"],
    approach: ["ap", "proach"],
    assembly: ["assem", "bly"],
    astray: ["a", "stray"],
    before: ["be", "fore"],
    blessedness: ["bless", "ed", "ness"],
    cheerful: ["cheer", "ful"],
    comfort: ["com", "fort"],
    counsel: ["coun", "sel"],
    delight: ["de", "light"],
    "dwelling-place": ["dwell", "ing-", "place"],
    endure: ["en", "dure"],
    enter: ["en", "ter"],
    ever: ["ev", "er"],
    evermore: ["ev", "er", "more"],
    firmly: ["firm", "ly"],
    follow: ["fol", "low"],
    furnished: ["fur", "nish", "ed"],
    godly: ["god", "ly"],
    goodness: ["good", "ness"],
    indeed: ["in", "deed"],
    judgment: ["judg", "ment"],
    leadeth: ["lead", "eth"],
    meditates: ["med", "i", "tates"],
    mercy: ["mer", "cy"],
    never: ["nev", "er"],
    overflows: ["o", "ver", "flows"],
    overthrown: ["o", "ver", "thrown"],
    pastures: ["pas", "tures"],
    people: ["peo", "ple"],
    perfect: ["per", "fect"],
    placeth: ["plac", "eth"],
    presence: ["pres", "ence"],
    prosper: ["pros", "per"],
    quiet: ["qui", "et"],
    rejoice: ["re", "joice"],
    restore: ["re", "store"],
    righteousness: ["right", "eous", "ness"],
    river: ["riv", "er"],
    scorners: ["scorn", "ers"],
    season: ["sea", "son"],
    seemly: ["seem", "ly"],
    shepherd: ["shep", "herd"],
    sinners: ["sin", "ners"],
    sitteth: ["sit", "teth"],
    surely: ["sure", "ly"],
    table: ["ta", "ble"],
    therefore: ["there", "fore"],
    ungodly: ["un", "god", "ly"],
    unto: ["un", "to"],
    upon: ["up", "on"],
    walketh: ["walk", "eth"],
    waters: ["wa", "ters"],
    whereas: ["where", "as"],
    wicked: ["wick", "ed"],
    within: ["with", "in"],
    without: ["with", "out"],
  }),
);

function plainWord(word) {
  return word
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z-]/gi, "")
    .toLocaleLowerCase();
}

function splitWordSyllables(word) {
  const key = plainWord(word);
  const pattern = wordSyllablePatterns.get(key) ?? [key];
  if (pattern.join("") !== key) {
    throw new Error(`Syllable pattern for "${word}" does not match "${key}".`);
  }
  if (pattern.length === 1) return [word];

  const characters = Array.from(word);
  const normalizedLengths = [];
  let normalizedLength = 0;
  for (const character of characters) {
    normalizedLength += Array.from(plainWord(character)).length;
    normalizedLengths.push(normalizedLength);
  }

  const boundaries = pattern
    .slice(0, -1)
    .reduce(
      (positions, syllable) => [
        ...positions,
        (positions.at(-1) ?? 0) + syllable.length,
      ],
      [],
    );
  const parts = [];
  let characterStart = 0;
  for (const boundary of boundaries) {
    const characterEnd =
      normalizedLengths.findIndex((length) => length >= boundary) + 1;
    if (characterEnd <= characterStart) {
      throw new Error(`Could not split "${word}" at syllable ${parts.length + 1}.`);
    }
    parts.push(characters.slice(characterStart, characterEnd).join(""));
    characterStart = characterEnd;
  }
  parts.push(characters.slice(characterStart).join(""));
  return parts;
}

function makeHarmony(tuneId, lengthTicks, harmony) {
  const voices = Object.fromEntries(
    ["alto", "tenor", "bass"].map((voice) => {
      const part = harmony[voice];
      if (part.pitches.length !== part.durations.length) {
        throw new Error(
          `${tuneId} ${voice} has ${part.pitches.length} pitches and ${part.durations.length} durations.`,
        );
      }

      let startTick = 0;
      const notes = part.pitches.map((midi, noteIndex) => {
        const duration = part.durations[noteIndex];
        const note = {
          id: `${tuneId}.harmony.${voice}.note-${String(noteIndex + 1).padStart(2, "0")}`,
          midi,
          start_tick: startTick,
          duration_ticks: duration,
          velocity,
        };
        startTick += duration;
        return note;
      });

      if (startTick !== lengthTicks) {
        throw new Error(
          `${tuneId} ${voice} ends at ${startTick}; expected ${lengthTicks}.`,
        );
      }
      return [voice, notes];
    }),
  );

  return {
    voicing: "SATB",
    voices,
    editorial_transformation: harmony.editorialTransformation,
    rights: {
      arrangement: "PDM-1.0",
      event_transcription: "PDM-1.0",
    },
  };
}

function makeTune({
  slug,
  title,
  alternateTitle,
  meter,
  defaultBpm,
  timeSignature,
  key,
  phrases,
  harmony,
  source,
}) {
  const tuneId = `ps1650.tune.${slug}`;
  const notes = [];
  const tunePhrases = [];
  let startTick = 0;

  phrases.forEach((phrase, phraseIndex) => {
    if (phrase.pitches.length !== phrase.durations.length) {
      throw new Error(`${title} phrase ${phraseIndex + 1} is malformed.`);
    }

    const phraseId = `${tuneId}.phrase-${String(phraseIndex + 1).padStart(2, "0")}`;
    const phraseStart = startTick;
    const noteIds = phrase.pitches.map((midi, noteIndex) => {
      const id = `${phraseId}.note-${String(noteIndex + 1).padStart(2, "0")}`;
      const duration = phrase.durations[noteIndex];
      notes.push({
        id,
        midi,
        start_tick: startTick,
        duration_ticks: duration,
        velocity,
      });
      startTick += duration;
      return id;
    });

    tunePhrases.push({
      id: phraseId,
      start_tick: phraseStart,
      end_tick: startTick,
      note_ids: noteIds,
    });
  });

  return {
    $schema: "../../schemas/tune.schema.json",
    schema_version: "0.2.0",
    id: tuneId,
    title,
    alternate_title: alternateTitle,
    meter,
    ppq,
    default_bpm: defaultBpm,
    time_signature: timeSignature,
    key,
    length_ticks: startTick,
    notes,
    phrases: tunePhrases,
    harmony: makeHarmony(tuneId, startTick, harmony),
    source,
    rights: {
      composition: "PDM-1.0",
      source_transcription: "PDM-1.0",
      metadata: "CC0-1.0",
    },
  };
}

function makeSetting(psalm, tune, syllableNoteCounts) {
  const tuneSlug = tune.id.replace("ps1650.tune.", "");

  const stanzas = psalm.stanzas.map((stanza) => ({
    stanza_id: stanza.id,
    lines: stanza.lines.map((line, lineIndex) => {
      const phrase = tune.phrases[lineIndex];
      const noteCounts = syllableNoteCounts[lineIndex];
      if (noteCounts.length !== line.syllable_count) {
        throw new Error(
          `${tune.title} phrase ${lineIndex + 1} has ${noteCounts.length} syllable slots; ${line.id} requires ${line.syllable_count}.`,
        );
      }
      if (
        noteCounts.reduce((total, count) => total + count, 0) !==
        phrase.note_ids.length
      ) {
        throw new Error(
          `${tune.title} phrase ${lineIndex + 1} note allocation is incomplete.`,
        );
      }

      const words = line.text.reading.split(/\s+/);
      const tokenSyllables = words.map(splitWordSyllables);
      const totalSyllables = tokenSyllables.reduce(
        (total, syllables) => total + syllables.length,
        0,
      );
      if (totalSyllables !== line.syllable_count) {
        throw new Error(
          `${line.id} token syllables total ${totalSyllables}; expected ${line.syllable_count}: ${words.map((word, index) => `${word}(${tokenSyllables[index].join("|")})`).join(" ")}`,
        );
      }

      let syllableCursor = 0;
      let noteCursor = 0;
      const tokens = words.map((text, tokenIndex) => {
        const id = `${line.id}.token-${String(tokenIndex + 1).padStart(2, "0")}`;
        const syllableTexts = tokenSyllables[tokenIndex];
        const syllableMap = syllableTexts.map(
          (syllableText, syllableIndex) => {
            const assignedNoteCount = noteCounts[syllableCursor];
            const noteIds = phrase.note_ids.slice(
              noteCursor,
              noteCursor + assignedNoteCount,
            );
            syllableCursor += 1;
            noteCursor += assignedNoteCount;

            return {
              id: `${id}.syllable-${String(syllableIndex + 1).padStart(2, "0")}`,
              text: syllableText,
              note_ids: noteIds,
            };
          },
        );

        return {
          id,
          text,
          syllables: syllableMap.length,
          note_ids: syllableMap.flatMap((syllable) => syllable.note_ids),
          syllable_map: syllableMap,
        };
      });

      return {
        line_id: line.id,
        phrase_id: phrase.id,
        tokens,
      };
    }),
  }));

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

const stPeter = makeTune({
  slug: "st-peter",
  title: "St. Peter",
  alternateTitle: "Reinagle",
  meter: "8.6.8.6",
  defaultBpm: 86,
  timeSignature: [4, 4],
  key: "E-flat major",
  phrases: [
    {
      pitches: [70, 75, 74, 72, 70, 70, 68, 67],
      durations: [480, 480, 480, 480, 480, 480, 480, 480],
    },
    {
      pitches: [67, 65, 63, 68, 67, 65],
      durations: [480, 480, 480, 480, 480, 1440],
    },
    {
      pitches: [67, 68, 67, 72, 70, 70, 68, 67],
      durations: [480, 480, 480, 480, 480, 480, 480, 480],
    },
    {
      pitches: [63, 67, 65, 63, 62, 63],
      durations: [480, 480, 480, 480, 480, 1440],
    },
  ],
  harmony: {
    alto: {
      pitches: [
        63, 67, 67, 63, 63, 65, 62, 63, 63, 60, 62, 63, 62, 63, 62,
        63, 63, 63, 63, 63, 60, 62, 63, 60, 63, 60, 58, 58, 58,
      ],
      durations: [
        480, 480, 480, 480, 480, 480, 480, 480, 480, 240, 240, 480,
        480, 480, 1440, 480, 480, 480, 480, 480, 480, 480, 480, 480,
        480, 480, 480, 480, 1440,
      ],
    },
    tenor: {
      pitches: [
        55, 58, 58, 56, 58, 58, 58, 58, 58, 60, 58, 56, 58, 58, 58,
        56, 58, 60, 51, 53, 53, 51, 55, 58, 56, 55, 53, 56, 55,
      ],
      durations: [
        480, 480, 480, 480, 480, 480, 480, 480, 480, 480, 480, 480,
        480, 1440, 480, 480, 480, 480, 480, 480, 480, 480, 480, 480,
        480, 480, 240, 240, 1440,
      ],
    },
    bass: {
      pitches: [
        51, 51, 55, 56, 55, 50, 46, 51, 51, 56, 55, 53, 51, 46, 51,
        49, 48, 46, 44, 43, 41, 46, 48, 48, 43, 44, 46, 46, 51,
      ],
      durations: [
        480, 480, 480, 480, 480, 480, 480, 480, 480, 480, 480, 480,
        480, 1440, 240, 240, 480, 480, 480, 480, 480, 480, 480, 480,
        480, 480, 480, 480, 1440,
      ],
    },
    editorialTransformation:
      "Alto, tenor, and bass follow the cited full score; the 4/2 notation is proportionally diminished to 4/4, with the full-score alto passing tone retained.",
  },
  source: {
    id: "cceh.000249",
    label: "ST. PETER",
    provider: "Christian Classics Ethereal Library",
    source_work: "Christian Classics Ethereal Hymnary #249",
    date: "1836",
    record_url: "https://www.ccel.org/cceh/0002/x000249.htm",
    editable_score_url: "https://www.ccel.org/cceh/0002/000249a.nwc",
    rights_statement_url: "https://www.ccel.org/cceh/cceh_cpr.htm",
    attribution:
      "Alexander Robert Reinagle (1799-1877); first published circa 1836.",
    editorial_transformation:
      "Public-domain SATB score proportionally diminished from 4/2 to 4/4; pitches and rhythmic proportions are unchanged.",
  },
});

const crimond = makeTune({
  slug: "crimond",
  title: "Crimond",
  alternateTitle: null,
  meter: "8.6.8.6",
  defaultBpm: 80,
  timeSignature: [3, 4],
  key: "F major",
  phrases: [
    {
      pitches: [60, 69, 70, 67, 72, 70, 67, 65, 64, 65],
      durations: [480, 960, 360, 120, 960, 240, 240, 960, 480, 960],
    },
    {
      pitches: [69, 69, 67, 67, 71, 67, 71, 72],
      durations: [480, 480, 480, 480, 480, 480, 480, 960],
    },
    {
      pitches: [69, 69, 70, 69, 67, 69, 70, 72, 70, 69],
      durations: [480, 480, 480, 480, 960, 480, 480, 480, 480, 960],
    },
    {
      pitches: [69, 67, 70, 74, 65, 64, 65],
      durations: [480, 480, 480, 480, 960, 480, 960],
    },
  ],
  harmony: {
    alto: {
      pitches: [
        60, 65, 67, 64, 65, 64, 62, 60, 60, 60, 65, 65, 65, 62, 65,
        64, 65, 65, 67, 65, 64, 65, 67, 69, 67, 65, 65, 64, 62, 62,
        60, 60, 60,
      ],
      durations: [
        480, 960, 360, 120, 480, 480, 480, 960, 480, 960, 480, 960,
        480, 960, 480, 960, 480, 480, 480, 480, 960, 480, 480, 480,
        480, 960, 240, 240, 960, 480, 960, 480, 960,
      ],
    },
    tenor: {
      pitches: [
        57, 60, 58, 57, 53, 55, 57, 55, 57, 60, 59, 59, 62, 62, 60,
        60, 60, 55, 57, 58, 60, 60, 60, 60, 60, 60, 58, 55, 57, 55,
        57,
      ],
      durations: [
        480, 960, 480, 960, 240, 240, 960, 480, 960, 480, 960, 480,
        960, 480, 960, 480, 480, 480, 240, 240, 960, 480, 960, 480,
        960, 480, 960, 480, 960, 480, 960,
      ],
    },
    bass: {
      pitches: [
        53, 53, 53, 53, 45, 46, 48, 48, 53, 53, 52, 50, 50, 55, 43,
        48, 53, 48, 48, 48, 58, 57, 55, 48, 50, 52, 53, 45, 46, 46,
        48, 48, 53,
      ],
      durations: [
        480, 960, 480, 480, 480, 480, 960, 480, 960, 240, 240, 960,
        480, 960, 480, 960, 480, 960, 480, 480, 480, 480, 480, 480,
        240, 240, 960, 480, 960, 480, 960, 480, 960,
      ],
    },
    editorialTransformation:
      "Alto, tenor, and bass follow the cited full score; source PPQ 192 is rescaled exactly to PPQ 480 and notation-gate gaps are closed.",
  },
  source: {
    id: "cceh.000341",
    label: "CRIMOND",
    provider: "Christian Classics Ethereal Library",
    source_work: "Christian Classics Ethereal Hymnary #341",
    date: "1872",
    record_url: "https://www.ccel.org/cceh/0003/x000341.htm",
    editable_score_url: "https://www.ccel.org/cceh/0003/000341a.nwc",
    rights_statement_url: "https://www.ccel.org/cceh/cceh_cpr.htm",
    attribution:
      "Jessie Seymour Irvine (1836-1887), melody; David Grant (1833-1893), harmonization; first published 1872.",
    editorial_transformation:
      "Public-domain SATB score rescaled exactly from source PPQ 192 to PPQ 480, with notation-gate gaps closed without changing the notated durations.",
  },
});

const psalm1 = JSON.parse(
  await readFile(new URL("corpus/text/psalm-001.primary.json", root), "utf8"),
);
const psalm23 = JSON.parse(
  await readFile(new URL("corpus/text/psalm-023.primary.json", root), "utf8"),
);
const psalm100 = JSON.parse(
  await readFile(new URL("corpus/text/psalm-100.primary.json", root), "utf8"),
);
const oldHundredth = JSON.parse(
  await readFile(
    new URL("corpus/music/tunes/old-hundredth.json", root),
    "utf8",
  ),
);
oldHundredth.schema_version = "0.2.0";
oldHundredth.source.editorial_transformation =
  "Exact proportional diminution of the Mutopia SATB score from 4/2 to 4/4: source whole notes become half notes and source half notes become quarter notes; pitches, ties, and rhythmic proportions are unchanged.";
oldHundredth.harmony = makeHarmony(
  oldHundredth.id,
  oldHundredth.length_ticks,
  {
    alto: {
      pitches: [
        62, 62, 62, 59, 59, 59, 62, 62, 62, 62, 67, 66, 67, 67, 67,
        66, 67, 62, 62, 62, 62, 64, 60, 62, 59, 59, 64, 64, 60, 62,
        67, 66, 67,
      ],
      durations: [
        960, 480, 480, 480, 480, 960, 960, 960, 960, 480, 480, 480,
        480, 960, 960, 960, 960, 480, 480, 480, 480, 960, 960, 960,
        960, 480, 480, 480, 480, 480, 960, 480, 960,
      ],
    },
    tenor: {
      pitches: [
        59, 59, 57, 55, 54, 55, 54, 55, 55, 59, 62, 62, 59, 64, 62,
        62, 59, 57, 55, 54, 55, 55, 57, 59, 54, 55, 59, 60, 64, 62,
        60, 59,
      ],
      durations: [
        960, 480, 480, 480, 480, 960, 960, 960, 960, 480, 480, 480,
        480, 960, 960, 960, 960, 480, 480, 480, 480, 960, 960, 960,
        960, 480, 480, 480, 480, 1680, 240, 960,
      ],
    },
    bass: {
      pitches: [
        55, 55, 50, 52, 47, 52, 50, 43, 55, 55, 55, 50, 52, 48, 43,
        50, 52, 54, 55, 50, 47, 48, 45, 43, 47, 52, 50, 48, 47, 45,
        47, 48, 50, 43,
      ],
      durations: [
        960, 480, 480, 480, 480, 960, 960, 960, 960, 480, 480, 480,
        480, 960, 960, 960, 960, 480, 480, 480, 480, 960, 960, 960,
        960, 720, 240, 240, 240, 480, 720, 240, 960, 960,
      ],
    },
    editorialTransformation:
      "Alto, tenor, and bass follow the named parts in the cited LilyPond source; 4/2 durations are proportionally diminished to 4/4 and ties are preserved.",
  },
);

const psalm1StPeter = makeSetting(psalm1, stPeter, [
  Array(8).fill(1),
  Array(6).fill(1),
  Array(8).fill(1),
  Array(6).fill(1),
]);
const psalm23Crimond = makeSetting(psalm23, crimond, [
  [1, 1, 2, 1, 2, 1, 1, 1],
  [1, 2, 1, 2, 1, 1],
  [1, 2, 1, 1, 1, 2, 1, 1],
  [1, 2, 1, 1, 1, 1],
]);
const psalm100OldHundredth = makeSetting(
  psalm100,
  oldHundredth,
  Array.from({ length: 4 }, () => Array(8).fill(1)),
);

async function save(path, value) {
  await writeFile(
    new URL(path, root),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8",
  );
}

await Promise.all([
  save("corpus/music/tunes/st-peter.json", stPeter),
  save("corpus/music/tunes/crimond.json", crimond),
  save("corpus/music/tunes/old-hundredth.json", oldHundredth),
  save("corpus/music/settings/psalm-001.st-peter.json", psalm1StPeter),
  save("corpus/music/settings/psalm-023.crimond.json", psalm23Crimond),
  save(
    "corpus/music/settings/psalm-100.old-hundredth.json",
    psalm100OldHundredth,
  ),
]);

console.log(
  "Seeded Psalm 1 / ST. PETER, Psalm 23 / CRIMOND, and Psalm 100 / OLD HUNDREDTH.",
);
