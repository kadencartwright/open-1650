import { libraryManifest } from "./library";
import type {
  EditionKey,
  PsalmCatalogEntry,
  PsalmLine,
  PsalmRecord,
  VersionKey,
} from "./types";

type PsalmLoader = () => Promise<PsalmRecord>;

const psalmLoaders = import.meta.glob<PsalmRecord>(
  "../../corpus/text/*.json",
  { import: "default" },
);
const eagerPsalmModules =
  import.meta.env.MODE === "test"
    ? (await import("./corpus.eager")).eagerPsalmModules
    : {};

const versionOrder: Record<VersionKey, number> = {
  primary: 0,
  alternate: 1,
};

function sortPsalms(records: PsalmRecord[]): PsalmRecord[] {
  return records.sort(
    (left, right) =>
      left.psalm_number - right.psalm_number ||
      versionOrder[left.version] - versionOrder[right.version] ||
      left.id.localeCompare(right.id),
  );
}

// These synchronous exports remain populated in the test build for corpus-wide
// validation. The browser uses the compact manifest and the lazy loaders below.
export const availablePsalms = sortPsalms(
  Object.values(eagerPsalmModules),
);

function psalmKey(number: number, version: VersionKey): string {
  return `${number}:${version}`;
}

const summariesByNumberAndVersion = new Map(
  libraryManifest.psalms.map((psalm) => [
    psalmKey(psalm.psalm_number, psalm.version),
    psalm,
  ]),
);
const loadedPsalmsByNumberAndVersion = new Map(
  availablePsalms.map((psalm) => [
    psalmKey(psalm.psalm_number, psalm.version),
    psalm,
  ]),
);
const pendingPsalms = new Map<string, Promise<PsalmRecord | undefined>>();

export const catalog: PsalmCatalogEntry[] = Array.from(
  { length: 150 },
  (_, index) => {
    const number = index + 1;
    const primary = summariesByNumberAndVersion.get(
      psalmKey(number, "primary"),
    );
    const alternate = summariesByNumberAndVersion.get(
      psalmKey(number, "alternate"),
    );

    return {
      number,
      primary,
      alternate,
      status: primary || alternate ? "available" : "awaiting-transcription",
    };
  },
);

export function findPsalm(
  number: number,
  version: VersionKey = "primary",
): PsalmRecord | undefined {
  return loadedPsalmsByNumberAndVersion.get(psalmKey(number, version));
}

export async function loadPsalm(
  number: number,
  version: VersionKey = "primary",
): Promise<PsalmRecord | undefined> {
  const key = psalmKey(number, version);
  const loaded = loadedPsalmsByNumberAndVersion.get(key);
  if (loaded) return loaded;

  const pending = pendingPsalms.get(key);
  if (pending) return pending;

  const summary = summariesByNumberAndVersion.get(key);
  if (!summary) return undefined;

  const loader = psalmLoaders[
    `../../corpus/text/${summary.file}`
  ] as PsalmLoader | undefined;
  if (!loader) {
    throw new Error(`Missing Psalm module "${summary.file}".`);
  }

  const request = loader()
    .then((psalm) => {
      loadedPsalmsByNumberAndVersion.set(key, psalm);
      return psalm;
    })
    .finally(() => pendingPsalms.delete(key));
  pendingPsalms.set(key, request);
  return request;
}

export function flattenLines(psalm: PsalmRecord): PsalmLine[] {
  return psalm.stanzas.flatMap((stanza) => stanza.lines);
}

export function getCleanText(
  psalm: PsalmRecord,
  edition: EditionKey,
): string {
  return psalm.stanzas
    .map((stanza) =>
      stanza.lines.map((line) => line.text[edition]).join("\n"),
    )
    .join("\n\n");
}

export function searchCatalog(query: string): PsalmCatalogEntry[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return catalog;

  return catalog.filter((entry) => {
    if (String(entry.number).includes(normalized)) return true;

    return [entry.primary, entry.alternate]
      .filter(Boolean)
      .some((summary) => {
        if (summary!.search_text.toLocaleLowerCase().includes(normalized)) {
          return true;
        }

        const loaded = findPsalm(summary!.psalm_number, summary!.version);
        return loaded
          ? getCleanText(loaded, "normalized")
              .toLocaleLowerCase()
              .includes(normalized)
          : false;
      });
  });
}
