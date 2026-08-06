import { readFile } from "node:fs/promises";
import Hypher from "hypher";
import english from "hyphenation.en-us";
import {
  bareWord,
  metricalSyllableCount,
  splitMetricalWord,
} from "./lib/metrical-syllables.mjs";

const root = new URL("../", import.meta.url);
const psalmNumbers = [
  2, 3, 4, 8, 15, 19, 24, 42, 46, 51, 63, 67, 84, 93, 98, 117, 121,
  130, 133, 150,
];
const records = await Promise.all(
  psalmNumbers.map(async (number) =>
    JSON.parse(
      await readFile(
        new URL(
          `corpus/text/psalm-${String(number).padStart(3, "0")}.primary.json`,
          root,
        ),
        "utf8",
      ),
    ),
  ),
);

let bad = 0;
let fragmentCount = 0;
const hypher = new Hypher(english);
const hyphenationDifferences = new Map();
for (const record of records) {
  const expected = record.meter.pattern.split(".").map(Number);
  for (const stanza of record.stanzas) {
    for (const [lineIndex, line] of stanza.lines.entries()) {
      const words = line.text.reading.split(/\s+/);
      const counts = words.map((word, wordIndex) =>
        metricalSyllableCount(
          word,
          `${record.psalm_number}.${stanza.number}.${lineIndex + 1}.${wordIndex}`,
        ),
      );
      words.forEach((word, wordIndex) => {
        const fragments = splitMetricalWord(word, counts[wordIndex]);
        if (
          fragments.length !== counts[wordIndex] ||
          fragments.join("") !== word
        ) {
          throw new Error(
            `${line.id}: ${word} did not split into ${counts[wordIndex]} exact fragments.`,
          );
        }
        fragmentCount += fragments.length;

        const plain = bareWord(word);
        const parts = hypher.hyphenate(plain);
        if (parts.length !== counts[wordIndex] && counts[wordIndex] > 0) {
          hyphenationDifferences.set(
            `${plain}:${counts[wordIndex]}`,
            `${word}(${counts[wordIndex]}) -> ${parts.join("|")}`,
          );
        }
      });
      const total = counts.reduce((sum, count) => sum + count, 0);
      if (total !== expected[lineIndex]) {
        bad += 1;
        console.log(
          `${record.psalm_number}.${stanza.number}.${lineIndex + 1}: ${total}/${expected[lineIndex]} ${words
            .map((word, index) => `${word}(${counts[index]})`)
            .join(" ")}`,
        );
      }
    }
  }
}

if (bad > 0) process.exitCode = 1;
console.log(
  `${bad} mismatched lines across ${fragmentCount} reviewed syllable fragments.`,
);
if (process.env.REPORT_HYPHER) {
  console.log(
    [...hyphenationDifferences.values()].sort().join("\n"),
  );
}
