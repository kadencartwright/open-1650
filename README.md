# Open 1650

Open 1650 is a web-based sing-along for the 1650 Scottish Psalter. It combines
received Psalm text, source-derived SATB tune data, and syllable-level lyric
underlay in one Web Audio performance and one downloadable MIDI file.

The library contains all 150 primary Psalms, the 13 separately printed
alternate versions, 27 public-domain SATB tunes, and one generated singable
setting for each of the 163 Psalm versions. Every performance begins with its
full SATB tune once through, then repeats all four parts for each stanza while
the active syllable is highlighted.

## Included library

The 150 primary records cover the complete canonical Psalter. Alternate records
preserve the separately printed second versions of Psalms 6, 25, 45, 50, 67,
70, 100, 102, 124, 136, 143, 145, and 148.

The tune library is:

- Common meter: ST. PETER, CRIMOND, ABBEY, WIGTOWN, DUNDEE (FRENCH),
  ST. FLAVIAN, ST. ANNE, WINCHESTER OLD, AULD LANG SYNE, BANGOR, CAITHNESS,
  COLESHILL, CULROSS, KILMARNOCK, MARTYRDOM, TALLIS' ORDINAL, and YORK
- Long meter: OLD HUNDREDTH, TALLIS' CANON, and WARRINGTON
- Short meter: SELMA and OLD HUNDRED THIRTY-FOURTH
- Special meters: BISHOPGARTH, OLD HUNDRED TWENTY-FOURTH, CROFT'S HUNDRED
  THIRTY-SIXTH, ST. CECILIA, and ST. JOHN (PARISH CHOIR)

The interface includes play/pause, restart, seek, tempo, volume, stanza looping,
phrase rehearsal, warm synthesized organ ranks, and responsive navigation over
all 150 canonical Psalm slots. Format-1 MIDI export carries separate soprano,
alto, tenor, and bass tracks generated from the same events used in the browser.

All received-text records and generated lyric underlays remain **prototype** and
**awaiting verification**. The source text is retained as a diplomatic layer;
algorithmic metrical adjustments affect only the provisional performance
underlay.

## Run it

```sh
npm install
npm run dev
```

Open <http://127.0.0.1:4173>. Run the complete local release check with:

```sh
npm run check
```

## Rebuild generated corpus data

Generated JSON is checked in, so the site has no build-time network dependency.
The pinned source imports and all 163 settings can be rebuilt with:

```sh
npm run seed:library
npm run check
```

The equivalent individual stages are:

```sh
npm run seed:full-psalter
npm run seed:tune-expansion
npm run seed:full-settings
```

Tune importers verify upstream files against pinned SHA-256 values before
writing normalized event data.

## Repository shape

```text
open-1650/
├── corpus/
│   ├── schemas/            # Machine-readable record contracts
│   ├── music/
│   │   ├── tunes/          # Reusable melody and SATB event data
│   │   └── settings/       # Psalm-to-tune syllable underlay
│   ├── sources/            # Witness, received-edition, and import provenance
│   └── text/               # Primary and alternate Psalm records
├── scripts/
│   ├── lib/                # Metrical and source-import helpers
│   ├── music/              # Reproducible score import pipeline
│   ├── import-received-text-source.mjs
│   ├── seed-full-psalter.mjs
│   ├── import-sourced-tunes.mjs
│   ├── seed-full-settings.mjs
│   └── validate-corpus.mjs
├── src/
│   ├── audio/              # Timeline, MIDI, and Web Audio compilation
│   └── components/         # Sing-along and supporting views
└── tests/
```

The browser loads corpus records on demand. Audio, lyric cues, and MIDI files
are compiled from the same tune and setting records rather than from rendered
DOM or duplicated timestamps.

## Textual basis

The library is labeled **“The Scottish Psalter (1650), received text.”** This
names a form maintained in congregational use without treating one surviving
1650 impression as uniquely canonical.

The received text comes from the Free Church of Scotland's official resources:

| Source | Use | SHA-256 |
| --- | --- | --- |
| [Scottish Psalter Words Only, digital edition](https://freechurch.org/wp-content/uploads/2026/05/Scottish-Psalter-Words-Only-Digital-Edition.pdf) | Page, stanza, and printed-version authority | `c7242e632093f0b10042468011650374514d2ccbf9f3733055bb91ad9bd717a3` |
| [PlainText archive](https://freechurch.org/wp-content/uploads/2025/10/PlainText.zip) | Logical metrical lines and reproducible import | `b81ecb106b668fb648c4748d9ebcca6ff7a6d3affd6175da6abf9c0d8b2c3905` |
| [Combined edition with tune recommendations](https://freechurch.org/wp-content/uploads/2021/06/Sing-Psalms-Combined-Words-Edition-incl.-Scottish-Psalter-with-bookmarks-Tune-Reccomendations.pdf) | Historical tune-name recommendations | `b5f8110fd234de1fdd2a57709c6565bdf83295f09e580d7f39b87e908d697208` |

The PlainText archive omits Psalm 119, section 6. That section is supplied from
page 173 of the official words-only PDF and identified as a source repair in the
generated record; no text was inferred. The [Free Church praise resources
page](https://freechurch.org/praise-resources/) provides the text reproduction
statement.

The [University of Michigan EEBO-TCP A76561
witness](https://quod.lib.umich.edu/e/eebo/A76561.0001.001?view=toc) remains the
named 1650 baseline for future diplomatic collation; its keyboarded TCP text is
CC0. See [EDITORIAL_POLICY.md](./EDITORIAL_POLICY.md) for the separation between
received text, witness transcription, normalization, reading text, and
performance underlay.

## Musical basis

Twenty-five tunes use public-domain SATB records and MIDI events from the
[Christian Classics Ethereal Hymnary](https://www.ccel.org/cceh/), whose
[archive rights statement](https://www.ccel.org/cceh/cceh_cpr.htm) permits
copying, modification, distribution, publication, and performance. Catalog
metadata records the exact score and import transformation for each tune.

The original CCEH sources are [ST. PETER](https://www.ccel.org/cceh/0002/x000249.htm),
[CRIMOND](https://www.ccel.org/cceh/0003/x000341.htm),
[ABBEY](https://www.ccel.org/cceh/0010/x001098.htm),
[WIGTOWN](https://www.ccel.org/cceh/0010/x001069.htm),
[DUNDEE](https://www.ccel.org/cceh/0004/x000439.htm),
[ST. FLAVIAN](https://www.ccel.org/cceh/0006/x000637.htm),
[ST. ANNE](https://www.ccel.org/cceh/0002/x000223.htm),
[WINCHESTER OLD](https://www.ccel.org/cceh/0000/x000096.htm), and
[SELMA](https://www.ccel.org/cceh/0010/x001034.htm).

The expanded CCEH sources are [BANGOR](https://www.ccel.org/cceh/0010/x001067.htm),
[CAITHNESS](https://www.ccel.org/cceh/0005/x000556.htm),
[COLESHILL](https://www.ccel.org/cceh/0011/x001142.htm),
[CULROSS](https://www.ccel.org/cceh/0011/x001155.htm),
[KILMARNOCK](https://www.ccel.org/cceh/0003/x000390.htm),
[MARTYRDOM (AVON)](https://www.ccel.org/cceh/0001/x000113.htm),
[TALLIS' ORDINAL](https://www.ccel.org/cceh/0004/x000402.htm),
[YORK](https://www.ccel.org/cceh/0012/x001231.htm),
[TALLIS' CANON](https://www.ccel.org/cceh/0004/x000443.htm),
[WARRINGTON](https://www.ccel.org/cceh/0006/x000609.htm),
[OLD HUNDRED THIRTY-FOURTH](https://www.ccel.org/cceh/0000/x000026.htm),
[BISHOPGARTH](https://www.ccel.org/cceh/0005/x000555.htm),
[OLD HUNDRED TWENTY-FOURTH](https://www.ccel.org/cceh/0013/x001335.htm),
[CROFT'S HUNDRED THIRTY-SIXTH](https://www.ccel.org/cceh/0012/x001261.htm),
[ST. CECILIA](https://www.ccel.org/cceh/0009/x000981.htm), and
[ST. JOHN](https://www.ccel.org/cceh/0011/x001112.htm).

OLD HUNDREDTH follows the [Mutopia public-domain
edition](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=194) of the
1551 Genevan Psalter melody. AULD LANG SYNE follows Philip Rice's public-domain
[CPDL MusicXML edition](https://www.cpdl.org/wiki/index.php/Auld_lang_syne_(Traditional));
the record encodes its complete four-line 8.6.8.6 verse cycle and excludes the
refrain.

Corpus metadata records historic compositions, source harmonizations, and
source transcriptions as PDM-1.0. New tune metadata and Psalm-to-tune lyric
alignments are dedicated to CC0-1.0. Documented timing transformations preserve
source pitches and rhythmic proportions while producing a consistent browser
timeline.

## Scope

Open 1650 is a focused singing and rehearsal surface. Text collation and
generated underlays remain provisional. Transposition, notation editing,
recordings, accounts, voting, and generated harmonizations are outside this
release.

See [RIGHTS.md](./RIGHTS.md) before reusing or publishing corpus material.

## License

Open 1650's platform software and original software tooling are licensed under
the [MIT License](./LICENSE). The Psalter text, tune data, transcriptions,
metadata, and generated lyric underlays have separate public-domain, PDM, or
CC0 declarations documented in [RIGHTS.md](./RIGHTS.md).
