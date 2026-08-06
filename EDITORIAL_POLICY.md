# Editorial policy

## Project label

The corpus is described as:

> The Scottish Psalter (1650), received text.

“Received text” names the form maintained in congregational use without
claiming that one surviving 1650 impression is uniquely canonical. Different
issues contain genuine variants and apparent printing errors.

## Current received-text release

The release includes primary records for Psalms 1–150 and preserves separately
printed alternate versions of Psalms 6, 25, 45, 50, 67, 70, 100, 102, 124,
136, 143, 145, and 148. Its 163 records follow the Free Church of Scotland's
[words-only digital edition](https://freechurch.org/wp-content/uploads/2026/05/Scottish-Psalter-Words-Only-Digital-Edition.pdf)
for wording, contractions, diacritics, stanza paragraphs, biblical-verse
metadata, and version boundaries. The official
[PlainText archive](https://freechurch.org/wp-content/uploads/2025/10/PlainText.zip)
confirms logical metrical lines where PDF typography wraps a line.

The PlainText archive omits Psalm 119, section 6. The import supplies that
section verbatim from page 173 of the official words-only PDF and records the
repair in source metadata. It does not reconstruct or silently invent text.

The pinned source SHA-256 values are:

```text
words-only PDF  c7242e632093f0b10042468011650374514d2ccbf9f3733055bb91ad9bd717a3
PlainText ZIP   b81ecb106b668fb648c4748d9ebcca6ff7a6d3affd6175da6abf9c0d8b2c3905
tune guide PDF b5f8110fd234de1fdd2a57709c6565bdf83295f09e580d7f39b87e908d697208
```

All records remain `prototype`, with diplomatic text `uncollated`,
normalization `provisional`, and reading text a `generated-preview`. Agreement
between modern renderings is useful transcription evidence, not verification
against a historic witness.

## Text layers

Open 1650 models three layers and never silently replaces one with another.

### 1. Diplomatic

A diplomatic record reproduces one named witness, including spelling,
capitalization, punctuation, contractions, diacritics, metrical lineation,
typographical oddities, and apparent errors. Every line identifies a witness
and, where possible, a page or image region.

### 2. Normalized

A normalized record may resolve documented printing or transcription errors
while retaining the 1650 wording. Every intervention must be traceable to an
editorial note or variant. The current normalized layer is provisional
received singing text, not completed witness collation. A normalization or
metrical-fit decision must never overwrite its diplomatic source line.

### 3. Reading

A reading edition may ease typography or punctuation for contemporary use. It
is always a generated or editorial derivative, never the archival source.

## Witnesses and variation

The historical baseline is the University of Michigan EEBO-TCP record
[A76561](https://quod.lib.umich.edu/e/eebo/A76561.0001.001?view=toc): Church of
Scotland, Edinburgh, Evan Tyler, 1650, Wing B2442, ESTC R170567, Bodleian
Library exemplar, EEBO image set 171605. Its keyboarded TCP text is CC0.

Variation must be represented rather than flattened. A76561 reads Psalm 23:3
as “Into the paths of righteousnesse,” while the received text uses “Within the
paths of righteousness.” Other issues include “The wicked are unto the chaff”
in Psalm 1 and “the Lord is good indeed” in Psalm 100. These are witness
variants, not automatic corrections.

## Lineation, stanzas, and biblical verses

- Preserve each metrical line as an independent object.
- A singing stanza follows its declared meter; common meter normally has four
  lines.
- Stanza paragraphs, not PDF display wraps, determine singing units.
- Biblical verse boundaries remain separate metadata because a stanza can
  cross them.
- Meter, biblical mapping, and wording must be independently inspectable.

## Tunes and lyric underlay

- A tune is reusable music data; a setting joins one Psalm version to one tune
  and owns the lyric-to-note underlay.
- A four-part tune preserves independently timed soprano, alto, tenor, and bass
  events from a named public-domain source. The introduction and every stanza
  use all four source parts.
- Tune timing is stored as integer MIDI ticks. Playback tempo must not rewrite
  source pitch or rhythmic relationships.
- Every sung line maps to one named phrase. Every synchronized token has an
  explicit syllable map; its exact fragments map to ordered, nonempty soprano
  note groups. Lower parts retain independent source timing.
- The current underlays are generated metrical fits and remain provisional.
  Early-modern elisions, expansions, or contractions used to fit a tune must be
  logged as underlay decisions; they do not alter diplomatic Psalm text.
- Excerpts must be musically complete and explicit. AULD LANG SYNE encodes the
  four-line 8.6.8.6 verse cycle from the cited SATB score and excludes its
  refrain.
- Composition rights, source harmonization, source transcription, event
  transformation, and Psalm underlay receive separate provenance statements.

## Stable identifiers

Identifiers are lowercase ASCII and zero-padded:

```text
ps1650.psalm-001.primary
ps1650.psalm-001.primary.stanza-01
ps1650.psalm-001.primary.stanza-01.line-01
ps1650.tune.old-hundredth
ps1650.psalm-100.primary.setting.old-hundredth
```

Alternate versions remain first-class records, for example
`ps1650.psalm-006.alternate`. Published identifiers must not be repurposed.

## Verification workflow

1. Register one or more public-domain witnesses.
2. Produce independent transcription A.
3. Produce independent transcription B.
4. Compare mechanically.
5. Reconcile every difference by human review.
6. Obtain second-person approval.
7. Mark the record verified.

OCR and metrical checks may suggest or reject a first pass. Neither is the
editorial authority. Prototype records remain visibly labeled until this
workflow is complete.
