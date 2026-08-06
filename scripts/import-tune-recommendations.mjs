import { readFile, writeFile } from "node:fs/promises";
const outputUrl = new URL(
  "../corpus/sources/tune-recommendations-2021.json",
  import.meta.url,
);
const inputPath = process.argv[2] ?? outputUrl;

const manifest = JSON.parse(
  await readFile(inputPath, "utf8"),
);
if (
  manifest.schema !== "open1650.research.tune-recommendations.v1" ||
  manifest.records?.length !== 163 ||
  manifest.inventory?.primary_records !== 150 ||
  manifest.inventory?.alternate_records !== 13
) {
  throw new Error(
    "The prepared recommendation manifest does not contain the expected 150 primary and 13 alternate Scottish Psalter records.",
  );
}

delete manifest.source.local_pdf;
delete manifest.source.local_extracted_text;
manifest.import_note =
  "Audited extraction of the Scottish Psalter recommendation blocks. Source strings, page references, range annotations, and known print/OCR anomalies are retained.";

await writeFile(
  outputUrl,
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);
console.log(
  `Imported ${manifest.records.length} recommendation records with ${manifest.inventory.recommendation_occurrences} tune occurrences.`,
);
