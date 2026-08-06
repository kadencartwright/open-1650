# Contributing

Open 1650 is a singing product with a provisional editorial corpus.
Contributions should strengthen the text, tune, and underlay foundation before
expanding social features.

## Add or correct a Psalm record

1. Register the received edition or witness in
   `corpus/sources/witnesses.json`.
2. Add or update a record in `corpus/text/`, preserving the identifiers in
   [EDITORIAL_POLICY.md](./EDITORIAL_POLICY.md).
3. Keep metrical lines separate from biblical-verse mappings. A visual PDF wrap
   is not automatically a new metrical line.
4. Preserve source contractions, punctuation, capitalization, and diacritics.
5. Mark unreviewed work `prototype` or `awaiting-verification`; do not infer
   verification from OCR agreement or a clean build.
6. Document every normalized intervention and confirm authority to dedicate
   new transcription and metadata under CC0.
7. Treat source defects explicitly. The known omission of Psalm 119, section 6
   in the PlainText archive is supplied from page 173 of the official PDF and
   documented in the generated record; future repairs require equivalent
   source evidence.
8. Run `npm run check`.

All 150 primary records and 13 alternate records are reproducible with:

```sh
npm run seed:full-psalter
```

The import pins the official words-only PDF, PlainText archive, and combined
tune-recommendation edition by SHA-256. Changes to a source, version boundary,
stanza boundary, or metrical override must be intentional and reviewed in the
generator and generated JSON together.

## Add a tune

1. Cite a rights-clean score and record direct score, catalog, and rights URLs.
2. Pin downloaded source material with a cryptographic checksum in the
   importer. Never make a normal build depend on upstream availability.
3. Encode independently timed soprano, alto, tenor, and bass parts as integer
   MIDI ticks. Do not generate missing harmony or flatten the parts to chord
   snapshots.
4. Preserve source pitches, ties, and rhythmic proportions. Document any
   transposition, proportional scaling, tie consolidation, gate closure, or
   excerpt boundary.
5. Treat an excerpt as an explicit editorial fact. It must make a complete
   metrical cycle and cadence; for example, AULD LANG SYNE uses its four-line
   common-meter verse and excludes the refrain.
6. Mark historic composition, arrangement, and source transcription separately
   from new event metadata.

The sourced tunes use pinned import helpers under `scripts/music/`. Regenerate
their event records before rebuilding settings with:

```sh
npm run seed:tune-expansion
```

## Add a singable setting

1. Add a Psalm underlay in `corpus/music/settings/` and map every metrical line
   to one tune phrase.
2. Give every lyric token and syllable a stable ID. Each syllable stores its
   exact text fragment and an ordered, nonempty group of soprano note IDs.
3. Confirm that syllable fragments reconstruct each token exactly, and tokens
   joined with spaces reconstruct the selected reading line exactly.
4. Confirm that each tune phrase’s soprano notes are assigned once and that the
   Psalm and tune meters match.
5. Keep algorithmic metrical fits provisional. Log any early-modern expansion,
   contraction, or elision in the underlay audit and never modify diplomatic
   text merely to satisfy a note count.
6. Rebuild all 163 underlays with:

   ```sh
   npm run seed:full-settings
   ```

7. Test the full SATB introduction and stanza playback, first and last phrases,
   two-beat inter-stanza sustain, seek, tempo, loop boundary, and mobile layout in a browser.
   Confirm that MIDI export contains separate SATB tracks.
8. Run `npm run check`.

To regenerate all source-derived data in dependency order, run:

```sh
npm run seed:library
```

## Data and release rules

- Never import a restricted modern edition merely because its underlying words
  or tune are old.
- Never silently modernize diplomatic or normalized text.
- Never omit an alternate version to simplify the interface.
- Keep text, tune, setting, source, and rights records separate.
- Keep generated JSON deterministic and review generator and output together.
- The complete-library acceptance inventory is 150 primary Psalms, 13
  alternates, 27 SATB tunes, and 163 settings. If it changes, update
  corpus-wide assertions and require every Psalm version to have exactly one
  setting and every bundled tune to be used.

The product remains a focused sing-along and rehearsal surface. Defer accounts,
comments, rankings, notation editing, recordings, and generated arrangements
until the performance loop and editorial workflow are trustworthy.
