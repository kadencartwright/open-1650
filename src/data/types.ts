export type EditionKey = "diplomatic" | "normalized" | "reading";
export type VersionKey = "primary" | "alternate";
export type EditorialState =
  | "prototype"
  | "transcribing"
  | "awaiting-verification"
  | "verified";

export interface EditionStatus {
  diplomatic: "uncollated" | "provisional" | "verified";
  normalized: "provisional" | "verified";
  reading: "generated-preview" | "reviewed";
}

export interface LineText {
  diplomatic: string;
  normalized: string;
  reading: string;
}

export interface PsalmLine {
  id: string;
  number: number;
  syllable_count: number;
  text: LineText;
}

export interface PsalmStanza {
  id: string;
  number: number;
  biblical_verses: number[];
  lines: PsalmLine[];
}

export interface PsalmRecord {
  $schema: string;
  schema_version: string;
  id: string;
  psalm_number: number;
  title: string;
  version: VersionKey;
  opening_line: string;
  meter: {
    pattern: string;
    name: string;
  };
  editorial_status: EditorialState;
  edition_status: EditionStatus;
  source: {
    witness_id: string;
    page_label: string | null;
    facsimile_url: string | null;
    note: string;
  };
  verification: {
    required_reviews: number;
    completed_reviews: number;
    state: "awaiting-verification" | "verified";
  };
  rights: {
    historic_text: "PDM-1.0";
    transcription: "CC0-1.0";
    metadata: "CC0-1.0";
  };
  stanzas: PsalmStanza[];
}

export interface PsalmCatalogEntry {
  number: number;
  primary?: PsalmSummary;
  alternate?: PsalmSummary;
  status: "available" | "awaiting-transcription";
}

export interface PsalmSummary {
  id: string;
  psalm_number: number;
  title: string;
  version: VersionKey;
  opening_line: string;
  meter: PsalmRecord["meter"];
  search_text: string;
  file: string;
}

export interface TuneSummary {
  id: string;
  title: string;
  alternate_title: string | null;
  meter: string;
  file: string;
}

export interface SettingSummary {
  id: string;
  psalm_id: string;
  tune_id: string;
  file: string;
}

export interface LibraryManifest {
  psalms: PsalmSummary[];
  tunes: TuneSummary[];
  settings: SettingSummary[];
}

export interface AppRoute {
  view: "reader" | "sources" | "downloads" | "about";
  psalmNumber: number;
  version: VersionKey;
  edition: EditionKey;
  tuneSlug?: string;
  transpose?: number;
}

export interface TuneNote {
  id: string;
  midi: number;
  start_tick: number;
  duration_ticks: number;
  velocity: number;
}

export interface TunePhrase {
  id: string;
  start_tick: number;
  end_tick: number;
  note_ids: string[];
}

export type TuneHarmonyVoice = "alto" | "tenor" | "bass";

export interface TuneHarmony {
  voicing: "SATB";
  voices: Record<TuneHarmonyVoice, TuneNote[]>;
  editorial_transformation: string;
  rights: {
    arrangement: "PDM-1.0";
    event_transcription: "PDM-1.0";
  };
}

export interface TuneSource {
  id: string;
  label: string;
  provider: string;
  source_work: string;
  date: string;
  record_url: string;
  editable_score_url: string;
  rights_statement_url: string;
  attribution: string;
  editorial_transformation: string;
}

export interface TuneRights {
  composition: "PDM-1.0";
  source_transcription: "PDM-1.0";
  metadata: "CC0-1.0";
}

export interface TuneRecord {
  $schema: string;
  schema_version: string;
  id: string;
  title: string;
  alternate_title: string | null;
  meter: string;
  ppq: number;
  default_bpm: number;
  time_signature: [number, number];
  key: string;
  length_ticks: number;
  notes: TuneNote[];
  phrases: TunePhrase[];
  harmony: TuneHarmony;
  source: TuneSource;
  rights: TuneRights;
}

export interface SettingToken {
  id: string;
  text: string;
  syllables: number;
  note_ids: string[];
  syllable_map: SettingSyllable[];
}

export interface SettingSyllable {
  id: string;
  text: string;
  note_ids: string[];
}

export interface SettingLine {
  line_id: string;
  phrase_id: string;
  tokens: SettingToken[];
}

export interface SettingStanza {
  stanza_id: string;
  lines: SettingLine[];
}

export interface PsalmSetting {
  id: string;
  psalm_id: string;
  tune_id: string;
  lead_in: "satb";
  inter_stanza_ticks: number;
  stanzas: SettingStanza[];
  rights: Record<string, unknown>;
}
