import type { EditionKey, PsalmRecord } from "../data/types";
import { getCleanText } from "../data/corpus";
import { padPsalm } from "./format";

export type ExportFormat = "json" | "txt" | "tei";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function buildPlainText(
  psalm: PsalmRecord,
  edition: EditionKey,
): string {
  return [
    `${psalm.title} · ${psalm.version}`,
    `${psalm.meter.name} (${psalm.meter.pattern})`,
    `${edition} edition · ${psalm.editorial_status}`,
    "",
    getCleanText(psalm, edition),
    "",
    `Stable ID: ${psalm.id}`,
    `Historic text: ${psalm.rights.historic_text}`,
    `Transcription and metadata: ${psalm.rights.transcription}`,
  ].join("\n");
}

export function buildJsonExport(
  psalm: PsalmRecord,
  edition: EditionKey,
): string {
  const exportRecord = {
    ...psalm,
    active_edition: edition,
    stanzas: psalm.stanzas.map((stanza) => ({
      id: stanza.id,
      number: stanza.number,
      biblical_verses: stanza.biblical_verses,
      lines: stanza.lines.map((line) => ({
        id: line.id,
        number: line.number,
        syllable_count: line.syllable_count,
        text: line.text[edition],
      })),
    })),
  };

  return `${JSON.stringify(exportRecord, null, 2)}\n`;
}

export function buildTeiExport(
  psalm: PsalmRecord,
  edition: EditionKey,
): string {
  const stanzas = psalm.stanzas
    .map(
      (stanza) => `        <lg type="stanza" n="${stanza.number}" xml:id="${escapeXml(
        stanza.id,
      )}">
${stanza.lines
  .map(
    (line) =>
      `          <l n="${line.number}" xml:id="${escapeXml(line.id)}">${escapeXml(
        line.text[edition],
      )}</l>`,
  )
  .join("\n")}
        </lg>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <teiHeader>
    <fileDesc>
      <titleStmt>
        <title>${escapeXml(psalm.title)} · ${escapeXml(psalm.version)}</title>
      </titleStmt>
      <publicationStmt>
        <availability>
          <p>Historic text: ${psalm.rights.historic_text}; transcription and metadata: ${psalm.rights.transcription}.</p>
        </availability>
      </publicationStmt>
      <sourceDesc>
        <p>Witness: ${escapeXml(psalm.source.witness_id)}. ${escapeXml(psalm.source.note)}</p>
      </sourceDesc>
    </fileDesc>
  </teiHeader>
  <text>
    <body>
      <div type="psalm" n="${psalm.psalm_number}" xml:id="${escapeXml(psalm.id)}">
${stanzas}
      </div>
    </body>
  </text>
</TEI>
`;
}

export function getExport(
  psalm: PsalmRecord,
  edition: EditionKey,
  format: ExportFormat,
): { content: string; mime: string; filename: string } {
  const base = `open-1650-psalm-${padPsalm(psalm.psalm_number)}-${psalm.version}-${edition}`;

  if (format === "json") {
    return {
      content: buildJsonExport(psalm, edition),
      mime: "application/json;charset=utf-8",
      filename: `${base}.json`,
    };
  }
  if (format === "tei") {
    return {
      content: buildTeiExport(psalm, edition),
      mime: "application/tei+xml;charset=utf-8",
      filename: `${base}.xml`,
    };
  }

  return {
    content: buildPlainText(psalm, edition),
    mime: "text/plain;charset=utf-8",
    filename: `${base}.txt`,
  };
}

export function downloadExport(
  psalm: PsalmRecord,
  edition: EditionKey,
  format: ExportFormat,
): void {
  const payload = getExport(psalm, edition, format);
  const url = URL.createObjectURL(
    new Blob([payload.content], { type: payload.mime }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = payload.filename;
  anchor.click();
  queueMicrotask(() => URL.revokeObjectURL(url));
}
