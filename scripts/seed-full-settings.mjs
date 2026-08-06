import {
  readdir,
  readFile,
  unlink,
  writeFile,
} from "node:fs/promises";

import { makeSetting } from "./lib/setting-builder.mjs";

const root = new URL("../", import.meta.url);
const textDirectory = new URL("../corpus/text/", import.meta.url);
const tuneDirectory = new URL(
  "../corpus/music/tunes/",
  import.meta.url,
);
const settingDirectory = new URL(
  "../corpus/music/settings/",
  import.meta.url,
);
const recommendationUrl = new URL(
  "../corpus/sources/tune-recommendations-2021.json",
  import.meta.url,
);

const legacyAssignments = new Map(
  Object.entries({
    "ps1650.psalm-001.primary": "st-peter",
    "ps1650.psalm-002.primary": "dundee",
    "ps1650.psalm-003.primary": "abbey",
    "ps1650.psalm-004.primary": "st-anne",
    "ps1650.psalm-008.primary": "winchester-old",
    "ps1650.psalm-015.primary": "auld-lang-syne",
    "ps1650.psalm-019.primary": "wigtown",
    "ps1650.psalm-023.primary": "crimond",
    "ps1650.psalm-024.primary": "st-flavian",
    "ps1650.psalm-042.primary": "dundee",
    "ps1650.psalm-046.primary": "abbey",
    "ps1650.psalm-051.primary": "st-anne",
    "ps1650.psalm-063.primary": "auld-lang-syne",
    "ps1650.psalm-067.primary": "selma",
    "ps1650.psalm-084.primary": "wigtown",
    "ps1650.psalm-093.primary": "winchester-old",
    "ps1650.psalm-098.primary": "st-flavian",
    "ps1650.psalm-100.primary": "old-hundredth",
    "ps1650.psalm-117.primary": "dundee",
    "ps1650.psalm-121.primary": "abbey",
    "ps1650.psalm-130.primary": "st-anne",
    "ps1650.psalm-133.primary": "auld-lang-syne",
    "ps1650.psalm-150.primary": "wigtown",
  }),
);

const exceptionalAssignments = new Map(
  Object.entries({
    "ps1650.psalm-124.alternate": "old-hundred-twenty-fourth",
    "ps1650.psalm-136.primary": "bishopgarth",
    "ps1650.psalm-136.alternate": "crofts-hundred-thirty-sixth",
    "ps1650.psalm-143.alternate": "st-cecilia",
    "ps1650.psalm-148.alternate": "st-john",
  }),
);

const recommendationAliases = new Map(
  Object.entries({
    avon: "martyrdom",
    french: "dundee",
    old100th: "old-hundredth",
    oldhundred: "old-hundredth",
    old124th: "old-hundred-twenty-fourth",
    old134th: "old-hundred-thirty-fourth",
    crofts136th: "crofts-hundred-thirty-sixth",
    tallis: "tallis-ordinal",
    wigton: "wigtown",
  }),
);

function normalizeName(value) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]/gu, "");
}

function pad(value) {
  return String(value).padStart(3, "0");
}

async function loadJsonFiles(directory) {
  const filenames = (await readdir(directory))
    .filter((filename) => filename.endsWith(".json"))
    .sort();
  return Promise.all(
    filenames.map(async (filename) => ({
      filename,
      record: JSON.parse(
        await readFile(new URL(filename, directory), "utf8"),
      ),
    })),
  );
}

const psalms = (await loadJsonFiles(textDirectory))
  .map(({ record }) => record)
  .sort(
    (left, right) =>
      left.psalm_number - right.psalm_number ||
      (left.version === "primary" ? -1 : 1),
  );
const tunes = (await loadJsonFiles(tuneDirectory)).map(
  ({ record }) => record,
);
const recommendations = JSON.parse(
  await readFile(recommendationUrl, "utf8"),
);

if (psalms.length !== 163 || tunes.length !== 27) {
  throw new Error(
    `Expected 163 Psalm versions and 27 tunes; found ${psalms.length} and ${tunes.length}.`,
  );
}

const tunesBySlug = new Map(
  tunes.map((tune) => [
    tune.id.replace("ps1650.tune.", ""),
    tune,
  ]),
);
const tunesByMeter = new Map();
const tuneByRecommendedName = new Map();
for (const tune of tunes) {
  const list = tunesByMeter.get(tune.meter) ?? [];
  list.push(tune);
  tunesByMeter.set(tune.meter, list);
  for (const name of [tune.title, tune.alternate_title].filter(Boolean)) {
    tuneByRecommendedName.set(normalizeName(name), tune);
  }
}
for (const list of tunesByMeter.values()) {
  list.sort((left, right) => left.title.localeCompare(right.title));
}
for (const [sourceName, slug] of recommendationAliases) {
  tuneByRecommendedName.set(sourceName, tunesBySlug.get(slug));
}

const recommendationByPsalm = new Map(
  recommendations.records.map((record) => [
    `ps1650.psalm-${pad(record.psalm_number)}.${record.corpus_designation}`,
    record,
  ]),
);
const fallbackCursor = new Map();

function chooseTune(psalm) {
  const legacySlug = legacyAssignments.get(psalm.id);
  if (legacySlug) {
    return {
      tune: tunesBySlug.get(legacySlug),
      basis: "retained-existing-setting",
    };
  }

  const sourceRecord = recommendationByPsalm.get(psalm.id);
  for (const recommendation of sourceRecord?.recommendations ?? []) {
    const tune = tuneByRecommendedName.get(
      normalizeName(recommendation.tune_name),
    );
    if (tune?.meter === psalm.meter.pattern) {
      return {
        tune,
        basis: "official-recommendation",
        matchedRecommendation: recommendation,
      };
    }
  }

  const exceptionalSlug = exceptionalAssignments.get(psalm.id);
  if (exceptionalSlug) {
    return {
      tune: tunesBySlug.get(exceptionalSlug),
      basis: "meter-specific-source-setting",
    };
  }

  const compatible = tunesByMeter.get(psalm.meter.pattern) ?? [];
  if (compatible.length === 0) {
    throw new Error(
      `${psalm.id} has unsupported meter ${psalm.meter.pattern}.`,
    );
  }
  const cursor = fallbackCursor.get(psalm.meter.pattern) ?? 0;
  fallbackCursor.set(psalm.meter.pattern, cursor + 1);
  return {
    tune: compatible[cursor % compatible.length],
    basis: "meter-compatible-fallback",
  };
}

for (const { filename } of await loadJsonFiles(settingDirectory)) {
  await unlink(new URL(filename, settingDirectory));
}

const assignments = [];
const metricalAdjustments = [];
for (const psalm of psalms) {
  const selection = chooseTune(psalm);
  if (!selection.tune) {
    throw new Error(`${psalm.id} selected a missing tune.`);
  }
  if (selection.tune.meter !== psalm.meter.pattern) {
    throw new Error(
      `${psalm.id} cannot use ${selection.tune.title}: ${psalm.meter.pattern} != ${selection.tune.meter}.`,
    );
  }

  const setting = makeSetting(psalm, selection.tune, {
    onAdjustments: (adjustment) =>
      metricalAdjustments.push(adjustment),
  });
  const tuneSlug = selection.tune.id.replace("ps1650.tune.", "");
  const filename = `psalm-${pad(psalm.psalm_number)}.${psalm.version}.${tuneSlug}.json`;
  await writeFile(
    new URL(filename, settingDirectory),
    `${JSON.stringify(setting, null, 2)}\n`,
    "utf8",
  );

  const sourceRecord = recommendationByPsalm.get(psalm.id);
  assignments.push({
    psalm_id: psalm.id,
    tune_id: selection.tune.id,
    selection_basis: selection.basis,
    matched_recommendation:
      selection.matchedRecommendation ?? null,
    source_recommendations:
      sourceRecord?.recommendations.map((item) => ({
        tune_number: item.tune_number,
        tune_name: item.tune_name,
        verse_range_annotation: item.verse_range_annotation,
      })) ?? [],
  });
}

const settingPlan = {
  schema: "open1650.setting-plan.v1",
  description:
    "One playable SATB setting for every received-text Psalm version. Official recommendations are preferred where the sourced tune is present; otherwise a compatible sourced tune is assigned. Metrical adjustments are transparent provisional underlay decisions and do not alter the received text.",
  counts: {
    psalm_versions: psalms.length,
    settings: assignments.length,
    tunes: tunes.length,
    lines: psalms
      .flatMap((psalm) => psalm.stanzas)
      .flatMap((stanza) => stanza.lines).length,
    lines_with_metrical_adjustments: metricalAdjustments.length,
    word_adjustments: metricalAdjustments.reduce(
      (sum, line) => sum + line.adjustments.length,
      0,
    ),
  },
  sources: {
    recommendations:
      "corpus/sources/tune-recommendations-2021.json",
    text: "corpus/sources/received-text-2026.json",
  },
  assignments,
  metrical_adjustments: metricalAdjustments,
};
await writeFile(
  new URL("../corpus/sources/setting-plan-2026.json", import.meta.url),
  `${JSON.stringify(settingPlan, null, 2)}\n`,
  "utf8",
);

console.log(
  `Seeded ${assignments.length} SATB settings across ${tunes.length} tunes; ${metricalAdjustments.length} of ${settingPlan.counts.lines} lines required ${settingPlan.counts.word_adjustments} transparent metrical word adjustments.`,
);
