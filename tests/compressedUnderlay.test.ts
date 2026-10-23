import {describe, expect, it} from 'vitest';
import {findPsalm} from '../src/data/corpus';
import {findSetting} from '../src/data/music';
import decisions from '../corpus/sources/underlay-decisions.json';

describe('Psalm 2 compressed singing groups', () => {
  it.each([
    {line: 1, text: 'appointed;', groups: ['a', 'ppointed;'], phrase: '02'},
    {line: 3, text: 'anointed.', groups: ['a', 'nointed.'], phrase: '04'},
  ])('keeps the initial a separate in $text without changing its text or note positions', ({line, text, groups, phrase}) => {
    const psalm = findPsalm(2)!;
    const setting = findSetting(psalm.id)!;
    const sourceLine = psalm.stanzas[3].lines[line];
    const singingLine = setting.stanzas[3].lines[line];
    const token = singingLine.tokens.at(-1)!;
    expect(token.text).toBe(text);
    expect(token.syllables).toBe(2);
    expect(token.syllable_map.map(part => part.text)).toEqual(groups);
    expect(groups.join('')).toBe(text);
    expect(singingLine.tokens.map(t => t.text).join(' ')).toBe(sourceLine.text.reading);
    expect(token.syllable_map.map(part => part.note_ids)).toEqual([
      [`ps1650.tune.dundee.phrase-${phrase}.note-05`],
      [`ps1650.tune.dundee.phrase-${phrase}.note-06`],
    ]);
  });

  it('retains three note positions in contexts that require three', () => {
    const anointed = findSetting(findPsalm(2)!.id)!.stanzas[1].lines[1].tokens[0];
    expect(anointed.text).toBe('Anointed,');
    expect(anointed.syllable_map).toHaveLength(3);
    const appointed = findSetting(findPsalm(81)!.id)!.stanzas[1].lines[1].tokens.find(t => t.text === 'appointed')!;
    expect(appointed.syllable_map).toHaveLength(3);
  });

  it('records the evidence and keeps this editorial underlay provisional', () => {
    const decision = decisions.decisions[0];
    expect(decision.status).toBe('awaiting-verification');
    expect(decision.source_wording_preserved).toBe(true);
    expect(decision.evidence.some(source => source.observation.includes('no lyrics'))).toBe(true);
  });
});
