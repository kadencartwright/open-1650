import references from "../../corpus/sources/tempo-references.json";
import type { CompiledPerformance } from "./compilePerformance";

export interface TempoReference {
  bpm: number;
  basis: string;
  label: string;
  url: string;
  note: string;
}

export function tempoReference(tuneId: string, psalmId?: string): TempoReference | undefined {
  const recording = (references.psalm_profiles as Record<string, TempoReference>)[`${psalmId}:${tuneId}`];
  if (recording) return recording;
  return (references.profiles as Record<string, TempoReference>)[tuneId.replace(/^ps1650\.tune\./, "")];
}

export function normalizeTranspose(value: number): number {
  return Number.isInteger(value) ? Math.max(-12, Math.min(12, value)) : 0;
}

export function transposedPerformanceId(id: string, semitones: number): string {
  const shift = normalizeTranspose(semitones);
  return shift ? `${id}.transpose-${shift}` : id;
}

export function transposeKey(key: string, semitones: number): string {
  const match = /^(C|D|E|F|G|A|B)(-sharp|-flat)? (major|minor)$/.exec(key);
  if (!match) return key;
  const pitch = {C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11}[match[1]]!;
  const accidental = match[2] === "-sharp" ? 1 : match[2] === "-flat" ? -1 : 0;
  const names = ["C", "D-flat", "D", "E-flat", "E", "F", "F-sharp", "G", "A-flat", "A", "B-flat", "B"];
  return `${names[((pitch + accidental + normalizeTranspose(semitones)) % 12 + 12) % 12]} ${match[3]}`;
}

/** Transpose every introduction and stanza note together; timing stays intact. */
export function transposePerformance(performance: CompiledPerformance, semitones: number): CompiledPerformance {
  const shift = normalizeTranspose(semitones);
  if (!shift) return performance;
  const notes = performance.notes.map(note => {
    const midi = note.midi + shift;
    if (midi < 0 || midi > 127) throw new RangeError("Transposition exceeds the MIDI pitch range.");
    return {...note, midi};
  });
  return {...performance, id: transposedPerformanceId(performance.id, shift), key: transposeKey(performance.key, shift), notes};
}

/** Canonical order includes each primary Psalm once, then stops at 150. */
export function nextPsalmNumber(number: number): number | null {
  return Number.isInteger(number) && number >= 1 && number < 150 ? number + 1 : null;
}

export function readPlaybackPreference<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(`open1650:${key}`);
    return stored === null ? fallback : JSON.parse(stored) as T;
  } catch { return fallback; }
}

export function savePlaybackPreference(key: string, value: unknown): void {
  try { localStorage.setItem(`open1650:${key}`, JSON.stringify(value)); } catch { /* Playback works without storage. */ }
}
