import {
  findDefaultSettingSummary,
  findSettingSummary,
  findTuneSummary,
  libraryManifest,
} from "./library";
import type { PsalmSetting, TuneRecord } from "./types";

type TuneLoader = () => Promise<TuneRecord>;
type SettingLoader = () => Promise<PsalmSetting>;

const tuneLoaders = import.meta.glob<TuneRecord>(
  "../../corpus/music/tunes/*.json",
  { import: "default" },
);
const settingLoaders = import.meta.glob<PsalmSetting>(
  "../../corpus/music/settings/*.json",
  { import: "default" },
);
const eagerMusicModules =
  import.meta.env.MODE === "test" ? await import("./music.eager") : undefined;
const eagerTuneModules = eagerMusicModules?.eagerTuneModules ?? {};
const eagerSettingModules = eagerMusicModules?.eagerSettingModules ?? {};

function sortSettings(records: PsalmSetting[]): PsalmSetting[] {
  return records.sort(
    (left, right) =>
      left.psalm_id.localeCompare(right.psalm_id) ||
      left.tune_id.localeCompare(right.tune_id) ||
      left.id.localeCompare(right.id),
  );
}

export const settings = sortSettings(Object.values(eagerSettingModules));

const firstSettingIndexByTune = new Map<string, number>();
for (const [index, setting] of libraryManifest.settings.entries()) {
  if (!firstSettingIndexByTune.has(setting.tune_id)) {
    firstSettingIndexByTune.set(setting.tune_id, index);
  }
}

export const tunes = Object.values(eagerTuneModules).sort(
  (left, right) =>
    (firstSettingIndexByTune.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
      (firstSettingIndexByTune.get(right.id) ?? Number.MAX_SAFE_INTEGER) ||
    left.id.localeCompare(right.id),
);

const loadedTunesById = new Map(tunes.map((tune) => [tune.id, tune]));
const loadedSettingsById = new Map(
  settings.map((setting) => [setting.id, setting]),
);
const loadedSettingsByPsalmId = new Map<string, PsalmSetting[]>();
const loadedSettingsByPsalmAndTune = new Map<string, PsalmSetting>();
const pendingTunes = new Map<string, Promise<TuneRecord | undefined>>();
const pendingSettings = new Map<
  string,
  Promise<PsalmSetting | undefined>
>();

function settingKey(psalmId: string, tuneId: string): string {
  return `${psalmId}\u0000${tuneId}`;
}

function cacheSetting(setting: PsalmSetting): void {
  loadedSettingsById.set(setting.id, setting);
  const psalmSettings = loadedSettingsByPsalmId.get(setting.psalm_id) ?? [];
  if (!psalmSettings.some((candidate) => candidate.id === setting.id)) {
    psalmSettings.push(setting);
    psalmSettings.sort(
      (left, right) =>
        left.tune_id.localeCompare(right.tune_id) ||
        left.id.localeCompare(right.id),
    );
    loadedSettingsByPsalmId.set(setting.psalm_id, psalmSettings);
  }
  loadedSettingsByPsalmAndTune.set(
    settingKey(setting.psalm_id, setting.tune_id),
    setting,
  );
}

for (const setting of settings) cacheSetting(setting);

export function findTune(id: string): TuneRecord | undefined {
  return loadedTunesById.get(id);
}

export async function loadTune(id: string): Promise<TuneRecord | undefined> {
  const loaded = loadedTunesById.get(id);
  if (loaded) return loaded;

  const pending = pendingTunes.get(id);
  if (pending) return pending;

  const summary = findTuneSummary(id);
  if (!summary) return undefined;
  const loader = tuneLoaders[
    `../../corpus/music/tunes/${summary.file}`
  ] as TuneLoader | undefined;
  if (!loader) throw new Error(`Missing tune module "${summary.file}".`);

  const request = loader()
    .then((tune) => {
      loadedTunesById.set(id, tune);
      return tune;
    })
    .finally(() => pendingTunes.delete(id));
  pendingTunes.set(id, request);
  return request;
}

export function findSetting(
  psalmId: string,
  tuneId?: string,
): PsalmSetting | undefined {
  return tuneId
    ? loadedSettingsByPsalmAndTune.get(settingKey(psalmId, tuneId))
    : loadedSettingsByPsalmId.get(psalmId)?.[0];
}

export async function loadSetting(
  id: string,
): Promise<PsalmSetting | undefined> {
  const loaded = loadedSettingsById.get(id);
  if (loaded) return loaded;

  const pending = pendingSettings.get(id);
  if (pending) return pending;

  const summary = findSettingSummary(id);
  if (!summary) return undefined;
  const loader = settingLoaders[
    `../../corpus/music/settings/${summary.file}`
  ] as SettingLoader | undefined;
  if (!loader) {
    throw new Error(`Missing setting module "${summary.file}".`);
  }

  const request = loader()
    .then((setting) => {
      cacheSetting(setting);
      return setting;
    })
    .finally(() => pendingSettings.delete(id));
  pendingSettings.set(id, request);
  return request;
}

export async function loadDefaultSetting(
  psalmId: string,
): Promise<PsalmSetting | undefined> {
  const loaded = findSetting(psalmId);
  if (loaded) return loaded;
  const summary = findDefaultSettingSummary(psalmId);
  return summary ? loadSetting(summary.id) : undefined;
}

function requireTestTune(id: string): TuneRecord {
  const tune = findTune(id);
  if (tune) return tune;
  if (import.meta.env.MODE === "test") {
    throw new Error(`Missing bundled tune "${id}".`);
  }
  return undefined as unknown as TuneRecord;
}

function requireTestSetting(id: string): PsalmSetting {
  const setting = loadedSettingsById.get(id);
  if (setting) return setting;
  if (import.meta.env.MODE === "test") {
    throw new Error(`Missing bundled setting "${id}".`);
  }
  return undefined as unknown as PsalmSetting;
}

// Stable aliases retained for the corpus test suite and seed-record callers.
// Browser code resolves records through the lazy APIs above.
export const stPeter = requireTestTune("ps1650.tune.st-peter");
export const crimond = requireTestTune("ps1650.tune.crimond");
export const oldHundredth = requireTestTune("ps1650.tune.old-hundredth");

export const psalm1StPeter = requireTestSetting(
  "ps1650.psalm-001.primary.setting.st-peter",
);
export const psalm23Crimond = requireTestSetting(
  "ps1650.psalm-023.primary.setting.crimond",
);
export const psalm100OldHundredth = requireTestSetting(
  "ps1650.psalm-100.primary.setting.old-hundredth",
);

export { findDefaultSettingSummary } from "./library";
