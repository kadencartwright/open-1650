import {
  mkdir,
  readFile,
  readdir,
  unlink,
  writeFile,
} from "node:fs/promises";

const root = new URL("../", import.meta.url);
const source = JSON.parse(
  await readFile(
    new URL("corpus/sources/received-text-2026.json", root),
    "utf8",
  ),
);
const outputDirectory = new URL("corpus/text/", root);

if (
  source.schema !== "open1650.received-text-source.v1" ||
  source.inventory?.primary_records !== 150 ||
  source.inventory?.alternate_records !== 13
) {
  throw new Error("The pinned received-text source is incomplete.");
}

function pad(value) {
  return String(value).padStart(3, "0");
}

function capitalizeLine(text) {
  const characters = Array.from(text);
  const index = characters.findIndex((character) => /\p{L}/u.test(character));
  if (index >= 0) characters[index] = characters[index].toLocaleUpperCase();
  return characters.join("");
}

function readingLine(text) {
  return text.replace(/\s+/gu, " ").trim();
}

function pageLabel(record) {
  const pages = record.pages.printed;
  const pageRange =
    pages.length === 1 ? String(pages[0]) : `${pages[0]}–${pages.at(-1)}`;
  return `Psalm ${record.psalm_number} · p. ${pageRange}`;
}

function makeRecord(sourceRecord) {
  const version = sourceRecord.corpus_designation;
  const id = `ps1650.psalm-${pad(sourceRecord.psalm_number)}.${version}`;
  const title =
    version === "primary"
      ? `Psalm ${sourceRecord.psalm_number}`
      : `Psalm ${sourceRecord.psalm_number} · second version`;
  const psalm119Supplement =
    sourceRecord.psalm_number === 119;

  return {
    $schema: "../schemas/psalm.schema.json",
    schema_version: "0.1.0",
    id,
    psalm_number: sourceRecord.psalm_number,
    title,
    version,
    opening_line: sourceRecord.stanzas[0].lines[0].text,
    meter: {
      pattern: sourceRecord.meter.pattern_label,
      name: sourceRecord.meter.name,
    },
    editorial_status: "prototype",
    edition_status: {
      diplomatic: "uncollated",
      normalized: "provisional",
      reading: "generated-preview",
    },
    source: {
      witness_id: "fcos.received-text-2026",
      page_label: pageLabel(sourceRecord),
      facsimile_url: source.sources.pdf.url,
      received_text_url: source.sources.plain_text_zip.url,
      printed_version: sourceRecord.printed_version,
      archive_members: sourceRecord.archive_members,
      pdf_pages: sourceRecord.pages.pdf_1_based,
      note: psalm119Supplement
        ? "Received text from the official Free Church digital edition and plain-text archive; Psalm 119 section 6 is supplied from PDF p. 173 because that section is absent from the archive."
        : "Received text from the official Free Church digital edition and plain-text archive.",
    },
    verification: {
      required_reviews: 2,
      completed_reviews: 0,
      state: "awaiting-verification",
    },
    rights: {
      historic_text: "PDM-1.0",
      transcription: "CC0-1.0",
      metadata: "CC0-1.0",
    },
    stanzas: sourceRecord.stanzas.map((stanza, stanzaIndex) => {
      const stanzaId = `${id}.stanza-${String(stanzaIndex + 1).padStart(2, "0")}`;
      return {
        id: stanzaId,
        number: stanzaIndex + 1,
        biblical_verses: stanza.biblical_verses,
        lines: stanza.lines.map((line, lineIndex) => ({
          id: `${stanzaId}.line-${String(lineIndex + 1).padStart(2, "0")}`,
          number: lineIndex + 1,
          syllable_count: sourceRecord.meter.pattern[lineIndex],
          text: {
            diplomatic: line.text,
            normalized: capitalizeLine(readingLine(line.text)),
            reading: readingLine(line.text),
          },
          ...(line.biblical_verse_start
            ? { biblical_verse_start: line.biblical_verse_start }
            : {}),
          ...(line.underlined_fragments
            ? { source_underlining: line.underlined_fragments }
            : {}),
        })),
      };
    }),
  };
}

await mkdir(outputDirectory, { recursive: true });
for (const file of await readdir(outputDirectory)) {
  if (/^psalm-\d{3}\.(?:primary|alternate)\.json$/.test(file)) {
    await unlink(new URL(file, outputDirectory));
  }
}

for (const sourceRecord of source.records) {
  const record = makeRecord(sourceRecord);
  const file = `psalm-${pad(record.psalm_number)}.${record.version}.json`;
  await writeFile(
    new URL(file, outputDirectory),
    `${JSON.stringify(record, null, 2)}\n`,
    "utf8",
  );
}

console.log(
  `Seeded ${source.inventory.primary_records} primary Psalms and ` +
    `${source.inventory.alternate_records} separately printed alternates.`,
);
