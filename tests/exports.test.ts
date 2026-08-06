import { describe, expect, it } from "vitest";
import { findPsalm } from "../src/data/corpus";
import {
  buildJsonExport,
  buildPlainText,
  buildTeiExport,
  getExport,
} from "../src/lib/exports";

const psalm = findPsalm(23)!;

describe("deterministic exports", () => {
  it("emits edition-specific structured JSON", () => {
    const parsed = JSON.parse(buildJsonExport(psalm, "reading"));
    expect(parsed.id).toBe("ps1650.psalm-023.primary");
    expect(parsed.active_edition).toBe("reading");
    expect(parsed.stanzas[1].lines[3].text).toBe(
      "ev’n for his own name’s sake.",
    );
    expect(parsed.stanzas[1].lines[3].id).toBe(
      "ps1650.psalm-023.primary.stanza-02.line-04",
    );
  });

  it("emits well-formed TEI with stable XML IDs", () => {
    const xml = buildTeiExport(psalm, "normalized");
    const document = new DOMParser().parseFromString(xml, "application/xml");
    expect(document.querySelector("parsererror")).toBeNull();
    expect(document.querySelectorAll("lg")).toHaveLength(5);
    expect(document.querySelectorAll("l")).toHaveLength(20);
    expect(xml).toContain("furnishèd");
  });

  it("keeps UI labels out of plain-text export", () => {
    const text = buildPlainText(psalm, "normalized");
    expect(text).toContain("The LORD’s my shepherd");
    expect(text).toContain("Historic text: PDM-1.0");
    expect(text).not.toContain("Prototype transcription");
    expect(text).not.toContain("Inspect line");
  });

  it("uses safe, predictable filenames and UTF-8 MIME types", () => {
    expect(getExport(psalm, "normalized", "json")).toMatchObject({
      filename: "open-1650-psalm-023-primary-normalized.json",
      mime: "application/json;charset=utf-8",
    });
  });
});
