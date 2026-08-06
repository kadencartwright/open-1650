import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";

const inputPath = process.argv[2];
if (!inputPath) {
  throw new Error(
    "Usage: node scripts/import-received-text-source.mjs <research-manifest.json>",
  );
}

const research = JSON.parse(await readFile(inputPath, "utf8"));
if (
  research.schema !== "open1650.research.full-psalter-manifest.v1" ||
  research.inventory?.primary_records !== 150 ||
  research.inventory?.alternate_records !== 13
) {
  throw new Error("The input is not the reviewed complete-Psalter manifest.");
}

const receivedText = {
  schema: "open1650.received-text-source.v1",
  scope: research.scope,
  sources: research.sources,
  inventory: research.inventory,
  meter_summary: research.meter_summary,
  anomalies_and_layout_notes: research.anomalies_and_layout_notes,
  records: research.records.map((record) => ({
    psalm_number: record.psalm_number,
    corpus_designation: record.corpus_designation,
    printed_version: record.printed_version,
    source_header: record.source_header,
    meter: record.meter,
    pages: record.pages,
    archive_members: record.archive_members,
    stanzas: record.stanzas.map((stanza) => ({
      number: stanza.number,
      biblical_verses: stanza.biblical_verses,
      lines: stanza.lines.map((line) => ({
        biblical_verse_start: line.biblical_verse_start,
        text: line.text,
        ...(line.underlined_fragments
          ? { underlined_fragments: line.underlined_fragments }
          : {}),
      })),
    })),
  })),
};

const output = new URL(
  "../corpus/sources/received-text-2026.json",
  import.meta.url,
);
await writeFile(output, `${JSON.stringify(receivedText, null, 2)}\n`, "utf8");

console.log(
  `Imported ${receivedText.records.length} received-text records with ` +
    `${receivedText.inventory.total_logical_lines} logical lines.`,
);
