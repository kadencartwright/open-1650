import { describe, expect, it } from "vitest";
import {
  availablePsalms,
  catalog,
  findPsalm,
  flattenLines,
  getCleanText,
  searchCatalog,
} from "../src/data/corpus";

const canonicalPsalmNumbers = Array.from(
  { length: 150 },
  (_, index) => index + 1,
);
const alternatePsalmNumbers = [
  6, 25, 45, 50, 67, 70, 100, 102, 124, 136, 143, 145, 148,
];

describe("received-text corpus", () => {
  it("reserves all 150 Psalm slots without virtualizing the canon", () => {
    expect(catalog).toHaveLength(150);
    expect(catalog[0].number).toBe(1);
    expect(catalog.at(-1)?.number).toBe(150);
  });

  it("ships all 150 primary Psalms and all 13 printed second versions", () => {
    const primaryPsalms = availablePsalms.filter(
      (psalm) => psalm.version === "primary",
    );
    const alternatePsalms = availablePsalms.filter(
      (psalm) => psalm.version === "alternate",
    );

    expect(availablePsalms).toHaveLength(163);
    expect(primaryPsalms).toHaveLength(150);
    expect(primaryPsalms.map((psalm) => psalm.psalm_number)).toEqual(
      canonicalPsalmNumbers,
    );
    expect(alternatePsalms).toHaveLength(13);
    expect(alternatePsalms.map((psalm) => psalm.psalm_number)).toEqual(
      alternatePsalmNumbers,
    );
    expect(catalog.every((entry) => entry.status === "available")).toBe(
      true,
    );
    expect(catalog.every((entry) => entry.primary?.version === "primary")).toBe(
      true,
    );
    expect(
      catalog
        .filter((entry) => entry.alternate)
        .map((entry) => entry.number),
    ).toEqual(alternatePsalmNumbers);
    expect(
      availablePsalms.every((psalm) => psalm.editorial_status === "prototype"),
    ).toBe(true);
    expect(
      availablePsalms.every(
        (psalm) =>
          psalm.edition_status.diplomatic === "uncollated" &&
          psalm.edition_status.normalized === "provisional" &&
          psalm.edition_status.reading === "generated-preview",
      ),
    ).toBe(true);
  });

  it("keeps IDs, meter, and source lineage coherent across every record", () => {
    const ids = new Set<string>();

    for (const psalm of availablePsalms) {
      expect(psalm.id).toBe(
        `ps1650.psalm-${String(psalm.psalm_number).padStart(3, "0")}.${psalm.version}`,
      );
      expect(psalm.source.witness_id).toBe("fcos.received-text-2026");
      expect(psalm.source.facsimile_url).toMatch(/^https:\/\//);

      const meter = psalm.meter.pattern.split(".").map(Number);
      expect(meter.every(Number.isInteger)).toBe(true);
      for (const stanza of psalm.stanzas) {
        expect(stanza.lines).toHaveLength(meter.length);
        stanza.lines.forEach((line, lineIndex) => {
          expect(line.syllable_count).toBe(meter[lineIndex]);
        });
      }

      for (const line of flattenLines(psalm)) {
        expect(ids.has(line.id)).toBe(false);
        expect(line.id.startsWith(`${psalm.id}.stanza-`)).toBe(true);
        ids.add(line.id);
      }
    }
  });

  it("preserves stanza boundaries in clean exports", () => {
    const text = getCleanText(findPsalm(1)!, "normalized");
    expect(text).toContain(
      "Nor stands in sinners’ way,\n\nNor sitteth in the scorner’s chair:",
    );
    expect(text.split("\n\n")).toHaveLength(6);
  });

  it("searches number, opening line, and Psalm text", () => {
    expect(searchCatalog("23").some((entry) => entry.number === 23)).toBe(true);
    expect(
      searchCatalog("shepherd").map((entry) => entry.number),
    ).toContain(23);
    expect(
      searchCatalog("cheerful voice").map((entry) => entry.number),
    ).toContain(100);
    expect(
      searchCatalog("water-brooks").map((entry) => entry.number),
    ).toContain(42);
    expect(
      searchCatalog("lift mine eyes").map((entry) => entry.number),
    ).toContain(121);
    expect(searchCatalog("no such phrase")).toEqual([]);
  });
});
