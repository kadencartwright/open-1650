import type { PsalmSetting, TuneRecord } from "./types";

export const eagerTuneModules = import.meta.glob<TuneRecord>(
  "../../corpus/music/tunes/*.json",
  {
    eager: true,
    import: "default",
  },
);

export const eagerSettingModules = import.meta.glob<PsalmSetting>(
  "../../corpus/music/settings/*.json",
  {
    eager: true,
    import: "default",
  },
);
