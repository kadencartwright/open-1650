import rawManifest from "virtual:open1650-library";
import type {
  LibraryManifest,
  PsalmSummary,
  SettingSummary,
  TuneSummary,
} from "./types";

export const libraryManifest = rawManifest as LibraryManifest;

const psalmsById = new Map(
  libraryManifest.psalms.map((psalm) => [psalm.id, psalm]),
);
const psalmsByNumberAndVersion = new Map(
  libraryManifest.psalms.map((psalm) => [
    `${psalm.psalm_number}:${psalm.version}`,
    psalm,
  ]),
);
const tunesById = new Map(
  libraryManifest.tunes.map((tune) => [tune.id, tune]),
);
const tunesByMeter = new Map<string, TuneSummary[]>();
for (const tune of libraryManifest.tunes) {
  const compatible = tunesByMeter.get(tune.meter) ?? [];
  compatible.push(tune);
  tunesByMeter.set(tune.meter, compatible);
}
for (const compatible of tunesByMeter.values()) {
  compatible.sort((left, right) => left.title.localeCompare(right.title));
}
const settingsById = new Map(
  libraryManifest.settings.map((setting) => [setting.id, setting]),
);
const settingsByPsalmId = new Map<string, SettingSummary[]>();

for (const setting of libraryManifest.settings) {
  const psalmSettings = settingsByPsalmId.get(setting.psalm_id) ?? [];
  psalmSettings.push(setting);
  settingsByPsalmId.set(setting.psalm_id, psalmSettings);
}

export interface LibrarySongSummary {
  psalm: PsalmSummary;
  tune: TuneSummary;
  setting: SettingSummary;
}

export const primarySongSummaries: LibrarySongSummary[] =
  libraryManifest.settings.flatMap((setting) => {
    const psalm = psalmsById.get(setting.psalm_id);
    const tune = tunesById.get(setting.tune_id);

    return psalm?.version === "primary" && tune
      ? [{ psalm, tune, setting }]
      : [];
  });

export function findPsalmSummary(id: string): PsalmSummary | undefined {
  return psalmsById.get(id);
}

export function findPsalmSummaryByNumber(
  number: number,
  version: PsalmSummary["version"] = "primary",
): PsalmSummary | undefined {
  return psalmsByNumberAndVersion.get(`${number}:${version}`);
}

export function findTuneSummary(id: string): TuneSummary | undefined {
  return tunesById.get(id);
}

export function findCompatibleTuneSummaries(
  meter: string,
): TuneSummary[] {
  return tunesByMeter.get(meter) ?? [];
}

export function findSettingSummary(
  id: string,
): SettingSummary | undefined {
  return settingsById.get(id);
}

export function findDefaultSettingSummary(
  psalmId: string,
): SettingSummary | undefined {
  return settingsByPsalmId.get(psalmId)?.[0];
}

export const bundledTuneCount = libraryManifest.tunes.length;
