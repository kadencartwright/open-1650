import {describe, expect, it} from 'vitest';
import {compilePerformance} from '../src/audio/compilePerformance';
import {createMidiFile} from '../src/audio/midiFile';
import {findSetting, findTune, tunes} from '../src/data/music';
import {findPsalm} from '../src/data/corpus';
import {nextPsalmNumber, tempoReference, transposeKey, transposePerformance} from '../src/audio/performanceOptions';
import references from '../corpus/sources/tempo-references.json';

describe('sourced performance options', () => {
  it('provides honest provenance for every tune and normalizes source beat units', () => {
    expect(Object.keys(references.profiles)).toHaveLength(27);
    for (const tune of tunes) {
      const reference = tempoReference(tune.id)!;
      expect(reference).toBeDefined();
      expect(reference.bpm).toBeGreaterThanOrEqual(30);
      expect(reference.bpm).toBeLessThanOrEqual(180);
      expect(reference.url).toMatch(/^https:\/\//);
      if (reference.basis === 'editorial') expect(reference.note).toMatch(/provisional/i);
    }
    expect(tempoReference('ps1650.tune.st-flavian')?.bpm).toBe(100);
    expect(tempoReference('ps1650.tune.old-hundredth')?.bpm).toBe(120);
    expect(tempoReference('ps1650.tune.crimond')?.bpm).toBe(90);
    expect(tempoReference('ps1650.tune.crimond', 'ps1650.psalm-023.primary')?.bpm).toBe(68);
    expect(tempoReference('ps1650.tune.st-peter', 'ps1650.psalm-001.primary')?.bpm).toBe(64);
    expect(tempoReference('ps1650.tune.st-peter', 'ps1650.psalm-017.primary')?.bpm).toBe(84);
  });

  it('reproduces the recording estimates from documented stanza timing measurements', () => {
    for (const profile of Object.values(references.psalm_profiles)) {
      const starts = profile.matched_stanza_onsets_seconds;
      expect(profile.bpm).toBe(Math.round(profile.quarter_beats_per_stanza * 60 * (starts.length - 1) / (starts.at(-1)! - starts[0])));
      expect(profile.sha256).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it.each([-12, -1, 1, 12])('transposes every SATB note by %i without changing timing or lyric cues', shift => {
    const setting = findSetting(findPsalm(23)!.id)!;
    const original = compilePerformance(findTune(setting.tune_id)!, setting);
    const shifted = transposePerformance(original, shift);
    expect(shifted.id).not.toBe(original.id);
    expect(shifted.notes).toHaveLength(original.notes.length);
    expect(new Set(shifted.notes.map(n => n.voice)).size).toBe(4);
    expect(shifted.notes.some(n => n.stanzaId === null)).toBe(true);
    shifted.notes.forEach((note, index) => {
      expect(note.midi).toBe(original.notes[index].midi + shift);
      expect({...note, midi: original.notes[index].midi}).toEqual(original.notes[index]);
    });
    expect(shifted.syllables).toBe(original.syllables);
    expect(shifted.durationTicks).toBe(original.durationTicks);
    expect(Array.from(createMidiFile(shifted))).not.toEqual(Array.from(createMidiFile(original)));
  });

  it('reports the sounding key, including octave-equivalent shifts', () => {
    expect(transposeKey('F major', 2)).toBe('G major');
    expect(transposeKey('F major', -12)).toBe('F major');
    expect(transposeKey('E-flat major', -3)).toBe('C major');
  });

  it('visits all 150 primary Psalms exactly once and stops', () => {
    const queue: number[] = [];
    let current: number | null = 1;
    while (current !== null) {queue.push(current); current = nextPsalmNumber(current);}
    expect(queue).toEqual(Array.from({length: 150}, (_, i) => i + 1));
    expect(nextPsalmNumber(0)).toBeNull();
    expect(nextPsalmNumber(151)).toBeNull();
  });
});
