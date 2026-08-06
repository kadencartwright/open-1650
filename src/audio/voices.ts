export const PERFORMANCE_VOICES = [
  "soprano",
  "alto",
  "tenor",
  "bass",
] as const;

export type PerformanceVoice = (typeof PERFORMANCE_VOICES)[number];

export const VOICE_LABELS: Record<PerformanceVoice, string> = {
  soprano: "Soprano",
  alto: "Alto",
  tenor: "Tenor",
  bass: "Bass",
};

export const VOICE_CHANNELS: Record<PerformanceVoice, number> = {
  soprano: 0,
  alto: 1,
  tenor: 2,
  bass: 3,
};

export const VOICE_LEVELS: Record<PerformanceVoice, number> = {
  soprano: 1,
  alto: 0.72,
  tenor: 0.76,
  bass: 0.84,
};
