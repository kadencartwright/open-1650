import {readFile, readdir, mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {parseMidi} from './music/source-import.mjs';

const root = new URL('../', import.meta.url);
const data = JSON.parse(await readFile(new URL('corpus/sources/tempo-references.json', root)));
const tuneFiles = await readdir(new URL('corpus/music/tunes/', root));
for (const file of tuneFiles.filter(f => f.endsWith('.json'))) {
  const slug = file.replace('.json', '');
  const profile = data.profiles[slug];
  assert(profile, `Missing tempo profile: ${slug}`);
  assert(Number.isInteger(profile.bpm) && profile.bpm >= 30 && profile.bpm <= 180);
  assert(profile.url.startsWith('https://'));
  assert(profile.basis === 'editorial' || /^[a-f0-9]{64}$/.test(profile.sha256));
  if (profile.source_bpm) assert.equal(profile.bpm, Math.round(profile.source_bpm * profile.rhythmic_scale));
}
for (const [key, profile] of Object.entries(data.psalm_profiles)) {
  const [psalmId, tuneId] = key.split(':');
  const psalm = JSON.parse(await readFile(new URL(`corpus/text/${psalmId.replace('ps1650.', '')}.json`, root)));
  const tune = JSON.parse(await readFile(new URL(`corpus/music/tunes/${tuneId.replace('ps1650.tune.', '')}.json`, root)));
  assert.equal(profile.matched_stanza_onsets_seconds.length, psalm.stanzas.length);
  assert.equal(profile.quarter_beats_per_stanza, tune.length_ticks / tune.ppq);
  const starts = profile.matched_stanza_onsets_seconds;
  assert.equal(profile.bpm, Math.round(profile.quarter_beats_per_stanza * 60 * (starts.length - 1) / (starts.at(-1) - starts[0])));
}
if (process.argv.includes('--fetch')) {
  const directory = await mkdtemp(join(tmpdir(), 'open1650-tempos-'));
  const cache = new Map();
  const download = async url => {
    if (!cache.has(url)) cache.set(url, fetch(url).then(async response => {
      assert(response.ok, `Unable to fetch ${url}: ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    }));
    return cache.get(url);
  };
  try {
    for (const [slug, profile] of Object.entries({...data.profiles, ...data.psalm_profiles})) {
      if (profile.basis === 'editorial') continue;
      let bytes = await download(profile.archive_url ?? profile.url);
      if (profile.archive_member) {
        const zipPath = join(directory, 'reference.zip');
        await writeFile(zipPath, bytes);
        bytes = execFileSync('unzip', ['-p', zipPath, profile.archive_member]);
      }
      assert.equal(createHash('sha256').update(bytes).digest('hex'), profile.sha256, `${slug}: source has changed`);
      if (profile.basis.endsWith('midi')) {
        const midi = parseMidi(bytes, slug);
        assert(midi.tempos.length, `${slug}: no explicit MIDI tempo`);
        assert.equal(midi.tempos[0].bpm, profile.source_bpm);
      }
      console.log(`Verified ${slug}: ${profile.bpm} BPM (${profile.basis})`);
    }
  } finally {await rm(directory, {recursive: true, force: true});}
}
console.log('Validated 27 tune tempo references and 2 Psalm/tune recording estimates.');
