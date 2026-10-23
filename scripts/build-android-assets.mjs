import { mkdir, readFile, readdir, rm, cp, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));

// Build the exact web player and lazy corpus chunks shipped by the website.
execFileSync('npm', ['run', 'build'], { stdio: 'inherit' });
const destination = resolve('mobile/android/app/src/main/assets/psalter');
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp('dist', destination, { recursive: true });
const records = await Promise.all((await readdir('corpus/text')).filter(f => f.endsWith('.json'))
  .map(async f => JSON.parse(await readFile(`corpus/text/${f}`, 'utf8'))));
const catalog = records.map(p => ({
  id: p.id, number: p.psalm_number, version: p.version,
  opening: p.opening_line, meter: p.meter.pattern,
  search: p.stanzas.flatMap(s => s.lines.map(l => l.text.reading)).join(' ').toLowerCase(),
})).sort((a, b) => a.number - b.number || b.version.localeCompare(a.version));
await mkdir('mobile/src', { recursive: true });
await writeFile('mobile/src/catalog.json', JSON.stringify(catalog));
await cp('RIGHTS.md', `${destination}/RIGHTS.txt`);
await cp('LICENSE', `${destination}/LICENSE.txt`);
console.log(`Bundled offline player, ${catalog.length} Psalm versions, and corpus rights.`);
