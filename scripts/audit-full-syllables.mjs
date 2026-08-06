import { readdir, readFile } from "node:fs/promises";

import {
  fitMetricalLine,
  groupMetricalTokens,
} from "./lib/metrical-syllables.mjs";

const textDirectory = new URL("../corpus/text/", import.meta.url);
const filenames = (await readdir(textDirectory))
  .filter((filename) => filename.endsWith(".json"))
  .sort();

let lineCount = 0;
let fragmentCount = 0;
let adjustedLineCount = 0;
let wordAdjustmentCount = 0;
const failures = [];

for (const filename of filenames) {
  const record = JSON.parse(
    await readFile(new URL(filename, textDirectory), "utf8"),
  );
  const meter = record.meter.pattern.split(".").map(Number);
  for (const stanza of record.stanzas) {
    if (stanza.lines.length !== meter.length) {
      failures.push(
        `${record.id} stanza ${stanza.number}: ${stanza.lines.length} lines for ${meter.length}-line meter`,
      );
      continue;
    }
    for (const [lineIndex, line] of stanza.lines.entries()) {
      lineCount += 1;
      const words = line.text.reading.split(/\s+/u);
      try {
        const fitted = fitMetricalLine(
          words,
          meter[lineIndex],
          `${record.psalm_number}.${stanza.number}.${lineIndex + 1}`,
        );
        const groups = groupMetricalTokens(words, fitted.counts);
        const reconstructed = groups
          .map((group) => group.text)
          .join(" ");
        const fragments = groups.flatMap(
          (group) => group.fragments,
        );
        if (
          reconstructed !== line.text.reading ||
          fragments.length !== line.syllable_count ||
          fragments.join("").replaceAll(" ", "") !==
            line.text.reading.replaceAll(" ", "")
        ) {
          throw new Error("underlay fragments do not reconstruct the line");
        }
        fragmentCount += fragments.length;
        if (fitted.adjustments.length > 0) {
          adjustedLineCount += 1;
          wordAdjustmentCount += fitted.adjustments.length;
        }
      } catch (error) {
        failures.push(`${line.id}: ${error.message}`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
}
console.log(
  `${failures.length} failed lines across ${filenames.length} Psalm versions, ${lineCount} lines, and ${fragmentCount} syllable fragments; ${adjustedLineCount} lines use ${wordAdjustmentCount} transparent metrical word adjustments.`,
);
