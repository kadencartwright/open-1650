import type { PsalmRecord } from "./types";

export const eagerPsalmModules = import.meta.glob<PsalmRecord>(
  "../../corpus/text/*.json",
  {
    eager: true,
    import: "default",
  },
);
