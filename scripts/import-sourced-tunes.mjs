import { mkdir, writeFile } from "node:fs/promises";

import {
  NOTE_VELOCITY,
  TARGET_PPQ,
  assertPart,
  extendFinalBoundary,
  fetchPinnedSource,
  makeContiguousPart,
  midiNotesByChannel,
  midiNotesByTrack,
  parseMidi,
  parseMusicXmlExcerpt,
  splitPairedStaff,
  transformIntervals,
} from "./music/source-import.mjs";

const tuneDirectory = new URL("../corpus/music/tunes/", import.meta.url);

const CCEH_PROVIDER = "Christian Classics Ethereal Library";
const CCEH_RIGHTS = "https://www.ccel.org/cceh/cceh_cpr.htm";
const CPDL_PROVIDER = "Choral Public Domain Library";
const CPDL_RIGHTS =
  "https://www.cpdl.org/wiki/index.php/ChoralWiki:Public_Domain";

function pairedCcehTune({
  ccehNumber,
  slug,
  title,
  alternateTitle = null,
  meter,
  bpm = 84,
  timeSignature = [4, 4],
  key,
  phraseEnds,
  sha256,
  finalReleasePadding = 120,
  transpose = 0,
  repeatCount = 1,
  date,
  attribution,
  sourceMeterNote = "",
}) {
  const fileId = String(ccehNumber).padStart(6, "0");
  const directory = fileId.slice(0, 4);
  const repeatNote =
    repeatCount > 1
      ? ` The complete sourced SATB tune is repeated ${repeatCount} times to serve the doubled metrical form; no pitches or harmony are newly composed.`
      : "";
  const transposeNote =
    transpose === 0
      ? ""
      : ` Every part is transposed ${transpose > 0 ? "up" : "down"} ${Math.abs(transpose)} semitone${Math.abs(transpose) === 1 ? "" : "s"}.`;

  return {
    slug,
    title,
    alternateTitle,
    meter,
    bpm,
    timeSignature,
    key,
    phraseEnds,
    input: {
      type: "paired-midi",
      url: `https://www.ccel.org/cceh/${directory}/${fileId}a.mid`,
      sha256,
      upperTrack: 1,
      lowerTrack: 2,
      finalReleasePadding,
      transpose,
      repeatCount,
    },
    source: {
      id: `cceh.${fileId}`,
      label: title.toUpperCase(),
      provider: CCEH_PROVIDER,
      source_work: `Christian Classics Ethereal Hymnary #${Number(fileId)}`,
      date,
      record_url: `https://www.ccel.org/cceh/${directory}/x${fileId}.htm`,
      editable_score_url: `https://www.ccel.org/cceh/${directory}/${fileId}a.nwc`,
      score_url: `https://www.ccel.org/cceh/${directory}/${fileId}a.pdf`,
      rights_statement_url: CCEH_RIGHTS,
      attribution,
      editorial_transformation:
        `The final NoteWorthy MIDI release gate was extended to the written cadence and timing was normalized from 192 to 480 PPQ.${transposeNote}${repeatNote}${sourceMeterNote}`,
    },
    harmonyTransformation:
      `The public-domain two-staff MIDI was separated into soprano, alto, tenor, and bass by sustained-note continuity and minimum-motion voice leading. Its final release gate was restored to the written cadence.${transposeNote}${repeatNote}${sourceMeterNote}`,
  };
}

const tunes = [
  {
    slug: "abbey",
    title: "Abbey",
    alternateTitle: null,
    meter: "8.6.8.6",
    bpm: 84,
    timeSignature: [4, 4],
    key: "F major",
    phraseEnds: [4800, 8640, 13440, 17280],
    input: {
      type: "paired-midi",
      url: "https://www.ccel.org/cceh/0010/001098a.mid",
      sha256: "863bd8b45184a92ac1aac8b95d8897a6ada7b63007cbd374fddec19c37ec8add",
      upperTrack: 1,
      lowerTrack: 2,
      finalReleasePadding: 120,
    },
    source: {
      id: "cceh.001098",
      label: "ABBEY",
      provider: CCEH_PROVIDER,
      source_work: "Christian Classics Ethereal Hymnary #1098",
      date: "1615",
      record_url: "https://www.ccel.org/cceh/0010/x001098.htm",
      editable_score_url: "https://www.ccel.org/cceh/0010/001098a.nwc",
      score_url: "https://www.ccel.org/cceh/0010/001098a.pdf",
      rights_statement_url: CCEH_RIGHTS,
      attribution: "Anonymous tune from the Scottish Psalter, 1615.",
      editorial_transformation:
        "The source has no written or MIDI time signature; Open 1650 represents its proportional pulse as 4/4 for playback. The final NoteWorthy MIDI release gate was extended by one source sixteenth note to the written cadence, and timing was normalized from 192 to 480 PPQ.",
    },
    harmonyTransformation:
      "The public-domain two-staff MIDI was separated into soprano, alto, tenor, and bass by sustained-note continuity and minimum-motion voice leading. Its final release gate was restored to the written cadence; pitches and internal rhythmic proportions are unchanged.",
  },
  {
    slug: "wigtown",
    title: "Wigtown",
    alternateTitle: "Wigton",
    meter: "8.6.8.6",
    bpm: 84,
    timeSignature: [4, 4],
    key: "F major",
    phraseEnds: [4800, 9600, 14400, 19200],
    input: {
      type: "paired-midi",
      url: "https://www.ccel.org/cceh/0010/001069a.mid",
      sha256: "828061685c59ba9e5d05fb693b67a09e5af77305f5cccf7b3035de218afed067",
      upperTrack: 1,
      lowerTrack: 2,
      finalReleasePadding: 120,
    },
    source: {
      id: "cceh.001069",
      label: "WIGTOWN",
      provider: CCEH_PROVIDER,
      source_work: "Christian Classics Ethereal Hymnary #1069",
      date: "1635",
      record_url: "https://www.ccel.org/cceh/0010/x001069.htm",
      editable_score_url: "https://www.ccel.org/cceh/0010/001069a.nwc",
      score_url: "https://www.ccel.org/cceh/0010/001069a.pdf",
      rights_statement_url: CCEH_RIGHTS,
      attribution:
        "Anonymous tune from the Scottish Psalter, 1635. The embedded MIDI comment says 1615, while the CCEH record and Hymnary authority identify 1635.",
      editorial_transformation:
        "The final NoteWorthy MIDI release gate was extended by one source sixteenth note to the written cadence, and timing was normalized from 192 to 480 PPQ.",
    },
    harmonyTransformation:
      "The public-domain two-staff MIDI was separated into soprano, alto, tenor, and bass by sustained-note continuity and minimum-motion voice leading. Its final release gate was restored to the written cadence; pitches and internal rhythmic proportions are unchanged.",
  },
  {
    slug: "dundee",
    title: "Dundee",
    alternateTitle: "French",
    meter: "8.6.8.6",
    bpm: 84,
    timeSignature: [4, 4],
    key: "E-flat major",
    phraseEnds: [3840, 7680, 11520, 15360],
    input: {
      type: "track-parts-midi",
      url: "https://www.ccel.org/cceh/0004/000439b.mid",
      sha256: "81bc8f5d93075094b340c1f9fa786356db5180c11c9ce4a9d3f123363ba2c70d",
      tracks: [1, 2, 3, 4],
      trimStart: 2880,
      trimEnd: 33600,
      rhythmicScale: 0.5,
      transpose: -1,
    },
    source: {
      id: "cceh.000439",
      label: "DUNDEE (FRENCH)",
      provider: CCEH_PROVIDER,
      source_work: "Christian Classics Ethereal Hymnary #439",
      date: "1615/1621",
      record_url: "https://www.ccel.org/cceh/0004/x000439.htm",
      editable_score_url: "https://www.ccel.org/cceh/0004/000439a.nwc",
      score_url: "https://www.ccel.org/cceh/0004/000439a.pdf",
      rights_statement_url: CCEH_RIGHTS,
      attribution:
        "Tune from the Scottish Psalter, 1615; historic tenor-lead arrangement by Thomas Ravenscroft, 1621.",
      editorial_transformation:
        "The explicit four-part MIDI was transposed from E major to the E-flat major key of the accompanying CCEH full score, proportionally diminished from 4/2 to 4/4, trimmed of its source preroll, and normalized to 480 PPQ.",
    },
    harmonyTransformation:
      "Soprano, alto, tenor, and bass come directly from the four tracks of the public-domain part-score MIDI. Every pitch was transposed down one semitone and every duration proportionally halved; voice leading and rhythmic proportions are otherwise unchanged.",
  },
  {
    slug: "st-flavian",
    title: "St. Flavian",
    alternateTitle: null,
    meter: "8.6.8.6",
    bpm: 86,
    timeSignature: [4, 4],
    key: "F major",
    phraseEnds: [3840, 7680, 11520, 15360],
    input: {
      type: "track-parts-midi",
      url: "https://www.ccel.org/cceh/0006/000637b.mid",
      sha256: "3e24a9be38af5fb7e7a986af2785e1e7d87dead018a5088c750fa59bccc4de6d",
      tracks: [1, 2, 3, 4],
      trimStart: 2880,
      trimEnd: 33600,
      rhythmicScale: 0.5,
      transpose: 0,
    },
    source: {
      id: "cceh.000637",
      label: "ST. FLAVIAN",
      provider: CCEH_PROVIDER,
      source_work: "Christian Classics Ethereal Hymnary #637",
      date: "1562/1621",
      record_url: "https://www.ccel.org/cceh/0006/x000637.htm",
      editable_score_url: "https://www.ccel.org/cceh/0006/000637a.nwc",
      score_url: "https://www.ccel.org/cceh/0006/000637a.pdf",
      rights_statement_url: CCEH_RIGHTS,
      attribution:
        "Tune from John Day's Psalter, 1562; historic tenor-lead arrangement by Thomas Ravenscroft, 1621.",
      editorial_transformation:
        "The explicit four-part MIDI was proportionally diminished from 4/2 to 4/4, trimmed of its source preroll, and normalized to 480 PPQ.",
    },
    harmonyTransformation:
      "Soprano, alto, tenor, and bass come directly from the four tracks of the public-domain part-score MIDI. Durations were proportionally halved; pitches and voice leading are unchanged.",
  },
  {
    slug: "st-anne",
    title: "St. Anne",
    alternateTitle: null,
    meter: "8.6.8.6",
    bpm: 84,
    timeSignature: [4, 4],
    key: "C major",
    phraseEnds: [3840, 7680, 11520, 15360],
    input: {
      type: "channel-parts-midi",
      url: "https://www.ccel.org/cceh/0002/000223b.mid",
      sha256: "6501b90d81a83f9d7ba07c1735ff8ef9ba74ad574144dbf139b58bd0b61c07ee",
      channels: [0, 1, 2, 3],
      trimStart: 0,
      trimEnd: 3072,
      rhythmicScale: 1,
      transpose: 0,
    },
    source: {
      id: "cceh.000223",
      label: "ST. ANNE",
      provider: CCEH_PROVIDER,
      source_work: "Christian Classics Ethereal Hymnary #223",
      date: "1708/1720",
      record_url: "https://www.ccel.org/cceh/0002/x000223.htm",
      editable_score_url: "https://www.ccel.org/cceh/0002/000223a.nwc",
      score_url: "https://www.ccel.org/cceh/0002/000223a.pdf",
      rights_statement_url: CCEH_RIGHTS,
      attribution:
        "First published in A Supplement to the New Version of Psalms, sixth edition, 1708; first attributed to William Croft in Hart's Collection, 1720.",
      editorial_transformation:
        "The format-0 part-score MIDI was separated by channels 0–3, its two-bar Amen appendix was omitted, and timing was normalized from 96 to 480 PPQ.",
    },
    harmonyTransformation:
      "Soprano, alto, tenor, and bass come directly from channels 0–3 of the public-domain part-score MIDI. Only the appended Amen was omitted; tune pitches, voice leading, and rhythmic proportions are unchanged.",
  },
  {
    slug: "winchester-old",
    title: "Winchester Old",
    alternateTitle: null,
    meter: "8.6.8.6",
    bpm: 84,
    timeSignature: [4, 4],
    key: "F major",
    phraseEnds: [3840, 7680, 11520, 14880],
    input: {
      type: "paired-midi",
      url: "https://www.ccel.org/cceh/0000/000096a.mid",
      sha256: "f327dcb5463ffd1dcb8e0d1c3b4326cf296a03b664dcde89e65a54dc726e265b",
      upperTrack: 1,
      lowerTrack: 2,
      finalReleasePadding: 120,
    },
    source: {
      id: "cceh.000096",
      label: "WINCHESTER OLD",
      provider: CCEH_PROVIDER,
      source_work: "Christian Classics Ethereal Hymnary #96",
      date: "1592",
      record_url: "https://www.ccel.org/cceh/0000/x000096.htm",
      editable_score_url: "https://www.ccel.org/cceh/0000/000096a.nwc",
      score_url: "https://www.ccel.org/cceh/0000/000096a.pdf",
      rights_statement_url: CCEH_RIGHTS,
      attribution:
        "Published by Thomas Este in The Whole Book of Psalmes, 1592; historic tenor-lead arrangement attributed to George Kirbye.",
      editorial_transformation:
        "The final NoteWorthy MIDI release gate was extended by one source sixteenth note to the written cadence, and timing was normalized from 192 to 480 PPQ.",
    },
    harmonyTransformation:
      "The public-domain two-staff MIDI was separated into soprano, alto, tenor, and bass by sustained-note continuity and minimum-motion voice leading. Its final release gate was restored to the written cadence; pitches and internal rhythmic proportions are unchanged.",
  },
  {
    slug: "auld-lang-syne",
    title: "Auld Lang Syne",
    alternateTitle: null,
    meter: "8.6.8.6",
    bpm: 88,
    timeSignature: [4, 4],
    key: "F major",
    phraseEnds: [3840, 7680, 11520, 15360],
    input: {
      type: "musicxml",
      url: "https://www.cpdl.org/wiki/images/4/4a/Auld_Lang_Syne.mxl",
      sha256: "cab42d6a1c055e4ad64f7fcefbbf23eb1ed3f6e08684f399603efc222a85a823",
      firstMeasure: 0,
      lastMeasure: 9,
    },
    source: {
      id: "cpdl.37897",
      label: "AULD LANG SYNE",
      provider: CPDL_PROVIDER,
      source_work: "Choral Public Domain Library #37897",
      date: "1793; edition 2015",
      record_url:
        "https://www.cpdl.org/wiki/index.php/Auld_lang_syne_%28Traditional%29",
      editable_score_url:
        "https://www.cpdl.org/wiki/images/4/4a/Auld_Lang_Syne.mxl",
      score_url:
        "https://www.cpdl.org/wiki/images/2/2c/Auld_Lang_Syne.pdf",
      rights_statement_url: CPDL_RIGHTS,
      attribution:
        "Traditional Scotch air collected by Robert Burns and first published in 1793; public-domain alternative harmonization edited by Philip Rice, 2015.",
      editorial_transformation:
        "Measures 0–9, the common-meter verse strain, were excerpted from the source's verse-plus-refrain score. The two grand staves were separated into four continuous parts and normalized from 256 to 480 PPQ.",
    },
    harmonyTransformation:
      "The public-domain MusicXML grand staves were separated into soprano, alto, tenor, and bass by sustained-note continuity and minimum-motion voice leading. Only measures 0–9 (the 8.6.8.6 verse strain) are retained; pitches and rhythmic proportions within that strain are unchanged.",
  },
  {
    slug: "selma",
    title: "Selma",
    alternateTitle: null,
    meter: "6.6.8.6",
    bpm: 84,
    timeSignature: [4, 4],
    key: "E-flat major",
    phraseEnds: [3840, 7680, 11520, 15360],
    input: {
      type: "paired-midi",
      url: "https://www.ccel.org/cceh/0010/001034a.mid",
      sha256: "ae0ac2cfe8e339536e4c026d2d55b74b8be428706f159aa1d4feed74450e7ee1",
      upperTrack: 1,
      lowerTrack: 2,
      finalReleasePadding: 120,
    },
    source: {
      id: "cceh.001034",
      label: "SELMA",
      provider: CCEH_PROVIDER,
      source_work: "Christian Classics Ethereal Hymnary #1034",
      date: "1825",
      record_url: "https://www.ccel.org/cceh/0010/x001034.htm",
      editable_score_url: "https://www.ccel.org/cceh/0010/001034a.nwc",
      score_url: "https://www.ccel.org/cceh/0010/001034a.pdf",
      rights_statement_url: CCEH_RIGHTS,
      attribution:
        "Traditional melody from the Isle of Arran, adapted by Robert Archibald Smith, 1825.",
      editorial_transformation:
        "The final NoteWorthy MIDI release gate was extended by one source sixteenth note to the written cadence, and timing was normalized from 192 to 480 PPQ.",
    },
    harmonyTransformation:
      "The public-domain two-staff MIDI was separated into soprano, alto, tenor, and bass by sustained-note continuity and minimum-motion voice leading. Its final release gate was restored to the written cadence; pitches and internal rhythmic proportions are unchanged.",
  },
  pairedCcehTune({
    ccehNumber: 1067,
    slug: "bangor",
    title: "Bangor",
    meter: "8.6.8.6",
    key: "E-flat major",
    phraseEnds: [3840, 7680, 11520, 15360],
    sha256:
      "83ac863ccc2b31349ede2d1c3afb8d8592bc983741c606117cd0b4dba80393c5",
    date: "1734",
    attribution:
      "William Tans’ur; published in The Harmony of Zion, second edition, 1734.",
  }),
  pairedCcehTune({
    ccehNumber: 556,
    slug: "caithness",
    title: "Caithness",
    meter: "8.6.8.6",
    key: "D major",
    phraseEnds: [3840, 7680, 11520, 15360],
    sha256:
      "36e9ec410738da391b24ff795b0d5218f785202106f66eda64c31e5e0a1ac1a6",
    date: "1635",
    attribution: "Anonymous tune from the Scottish Psalter, 1635.",
  }),
  pairedCcehTune({
    ccehNumber: 1142,
    slug: "coleshill",
    title: "Coleshill",
    meter: "8.6.8.6",
    key: "C major",
    phraseEnds: [4320, 8160, 12000, 15360],
    sha256:
      "48bb307b909ac9469b0a6b671898ad39358d9ae1768b8d36934e5d170164753e",
    date: "1706",
    attribution: "Published in William Barton’s Psalms, 1706.",
    sourceMeterNote:
      " Phrase boundaries follow the 8.6.8.6 soprano attack groups rather than the source MIDI’s internal bar grouping.",
  }),
  pairedCcehTune({
    ccehNumber: 1155,
    slug: "culross",
    title: "Culross",
    meter: "8.6.8.6",
    key: "C major",
    phraseEnds: [4800, 8640, 13440, 17280],
    sha256:
      "73fce7ec5eb2f208fb9031e191cde45af4048ee686eff95671e54915d460248e",
    date: "1635",
    attribution: "Anonymous tune from the Scottish Psalter, 1635.",
  }),
  pairedCcehTune({
    ccehNumber: 390,
    slug: "kilmarnock",
    title: "Kilmarnock",
    meter: "8.6.8.6",
    key: "E-flat major",
    phraseEnds: [3840, 7680, 11520, 15360],
    sha256:
      "0fb3b2361bbebf3fc140b078ca7824eab59eea924997fe54df66d56a71e9f52f",
    date: "1831",
    attribution: "Neil Dougall, 1831.",
  }),
  pairedCcehTune({
    ccehNumber: 113,
    slug: "martyrdom",
    title: "Martyrdom",
    alternateTitle: "Avon",
    meter: "8.6.8.6",
    key: "A-flat major",
    timeSignature: [3, 4],
    phraseEnds: [5760, 11520, 17280, 23040],
    sha256:
      "2cf7605ba5320b5ca9517e8d4079a5dea4c6bfb788f4ffd1e4f8dfbb82f73614",
    date: "1824",
    attribution:
      "Hugh Wilson, 1824; catalogued by CCEH as Avon and also known as Martyrdom.",
  }),
  pairedCcehTune({
    ccehNumber: 402,
    slug: "tallis-ordinal",
    title: "Tallis’ Ordinal",
    meter: "8.6.8.6",
    key: "E-flat major",
    phraseEnds: [3840, 7680, 11520, 15360],
    sha256:
      "ec4381ea999939e97d12e3023c001a2214d94dc0f7f45d09a31160fda347e596",
    date: "1561",
    attribution: "Thomas Tallis; first published in 1561.",
  }),
  pairedCcehTune({
    ccehNumber: 1231,
    slug: "york",
    title: "York",
    meter: "8.6.8.6",
    key: "F major",
    phraseEnds: [3840, 7680, 11520, 15360],
    sha256:
      "a28727a6be4b4224cb0194a18d51ab73bb3cd860d3593524b414e01b14d904f7",
    date: "1615",
    attribution: "Anonymous tune from the Scottish Psalter, 1615.",
  }),
  pairedCcehTune({
    ccehNumber: 443,
    slug: "tallis-canon",
    title: "Tallis’ Canon",
    meter: "8.8.8.8",
    key: "G major",
    phraseEnds: [3840, 7680, 11520, 15360],
    sha256:
      "4ef407a39ff7a8f1780a43aa457565435276dc88cb94f954dafc4e6a28a1487d",
    finalReleasePadding: 80,
    date: "1560",
    attribution: "Thomas Tallis, 1560.",
  }),
  pairedCcehTune({
    ccehNumber: 609,
    slug: "warrington",
    title: "Warrington",
    meter: "8.8.8.8",
    key: "B-flat major",
    timeSignature: [3, 4],
    phraseEnds: [5760, 11520, 17280, 23040],
    sha256:
      "cd693097784c3264db6d5ed88e6c059f32809d07adc60962a194b6a6b7758530",
    date: "1762",
    attribution: "Ralph Harrison; the CCEH record dates the tune to 1762.",
  }),
  pairedCcehTune({
    ccehNumber: 26,
    slug: "old-hundred-thirty-fourth",
    title: "Old Hundred Thirty-Fourth",
    meter: "6.6.8.6",
    key: "G major",
    phraseEnds: [3840, 7680, 11520, 14880],
    sha256:
      "128b5204fc2f712551b1def4d148f3f34e8568559a852e62f31fcb420d942458",
    date: "1543; arrangement 1836",
    attribution:
      "Louis Bourgeois, Genevan Psalter, 1543; harmonized by William Crotch, 1836.",
  }),
  pairedCcehTune({
    ccehNumber: 555,
    slug: "bishopgarth",
    title: "Bishopgarth",
    meter: "8.7.8.7",
    key: "F major",
    phraseEnds: [7200, 14880, 22560, 30720],
    sha256:
      "db4687792e26a2b9572577a259e4db4a33d8840cf496c937af7caef2cc440d17",
    finalReleasePadding: 80,
    transpose: 1,
    date: "1897",
    attribution:
      "Arthur Sullivan, 1897; catalogued for the iambic 8.7.8.7 form.",
  }),
  pairedCcehTune({
    ccehNumber: 1335,
    slug: "old-hundred-twenty-fourth",
    title: "Old Hundred Twenty-Fourth",
    meter: "10.10.10.10.10",
    key: "F major",
    phraseEnds: [7680, 15360, 23040, 30720, 38880],
    sha256:
      "e7fa1c6c75f68ea9dd242eaa2d67aca36e8847b44371045847c1e9aa43007058",
    date: "1551",
    attribution: "Anonymous tune from the Genevan Psalter, 1551.",
  }),
  pairedCcehTune({
    ccehNumber: 1261,
    slug: "crofts-hundred-thirty-sixth",
    title: "Croft’s Hundred Thirty-Sixth",
    meter: "6.6.6.6.8.8",
    key: "C major",
    phraseEnds: [3840, 7680, 11520, 15360, 21120, 26880],
    sha256:
      "08528a6c5a640df1310380cab084dcbdd545594957ef7dd7b6c8a33195f9ab37",
    date: "before 1727",
    attribution: "William Croft; published before his death in 1727.",
    sourceMeterNote:
      " CCEH catalogues the final four short lines separately as 4.4.4.4; the official Scottish Psalter recommendation treats each adjacent pair as one 8-syllable line.",
  }),
  pairedCcehTune({
    ccehNumber: 981,
    slug: "st-cecilia",
    title: "St. Cecilia",
    meter: "6.6.6.6.6.6.6.6",
    key: "G major",
    phraseEnds: [
      3840, 7680, 11520, 15360, 19200, 23040, 26880, 30720,
    ],
    sha256:
      "afe5c40a398687afaee7fc08391268b9104cf85bb55486fe66b795f80ee6eed5",
    repeatCount: 2,
    date: "1863",
    attribution: "Leighton G. Hayne, 1863.",
  }),
  pairedCcehTune({
    ccehNumber: 1112,
    slug: "st-john",
    title: "St. John",
    meter: "6.6.6.6.8.8",
    key: "D major",
    phraseEnds: [3840, 7680, 11520, 15360, 19200, 25440],
    sha256:
      "657aee76d0e9728432710e8ce6045878bf55eb9a3fbe904a0adfac3f53bfa655",
    date: "1851",
    attribution: "Published in The Parish Choir, 1851.",
  }),
];

function sourceBounds(parts, input) {
  const allNotes = parts.flat();
  return {
    trimStart:
      input.trimStart ?? Math.min(...allNotes.map((note) => note.start)),
    trimEnd: input.trimEnd ?? Math.max(...allNotes.map((note) => note.end)),
  };
}

function normalizeExplicitParts(midi, input, label) {
  const rawParts =
    input.type === "track-parts-midi"
      ? input.tracks.map((track) => midiNotesByTrack(midi, track))
      : input.channels.map((channel) => midiNotesByChannel(midi, channel));
  const { trimStart, trimEnd } = sourceBounds(rawParts, input);
  const transformed = rawParts.map((part, index) =>
    makeContiguousPart(
      transformIntervals(part, {
        sourcePpq: midi.ppq,
        rhythmicScale: input.rhythmicScale,
        transpose: input.transpose,
        trimStart,
        trimEnd,
      }),
      `${label} part ${index + 1}`,
    ),
  );
  const end = transformed[0].at(-1).end;
  for (const part of transformed) {
    if (part.at(-1).end !== end) {
      throw new Error(`${label}: explicit parts do not share an end tick.`);
    }
  }
  return {
    soprano: transformed[0],
    alto: transformed[1],
    tenor: transformed[2],
    bass: transformed[3],
  };
}

function normalizePairedMidi(midi, input, label) {
  const rawUpper = midiNotesByTrack(midi, input.upperTrack);
  const rawLower = midiNotesByTrack(midi, input.lowerTrack);
  const { trimStart, trimEnd } = sourceBounds([rawUpper, rawLower], input);
  const normalizedUpper = extendFinalBoundary(
    transformIntervals(rawUpper, {
      sourcePpq: midi.ppq,
      trimStart,
      trimEnd,
      transpose: input.transpose ?? 0,
    }),
    input.finalReleasePadding,
  );
  const normalizedLower = extendFinalBoundary(
    transformIntervals(rawLower, {
      sourcePpq: midi.ppq,
      trimStart,
      trimEnd,
      transpose: input.transpose ?? 0,
    }),
    input.finalReleasePadding,
  );
  const upper = splitPairedStaff(normalizedUpper, `${label} treble staff`);
  const lower = splitPairedStaff(normalizedLower, `${label} bass staff`);
  if (upper.end !== lower.end) {
    throw new Error(`${label}: normalized staves do not share an end tick.`);
  }
  return {
    soprano: upper.upper,
    alto: upper.lower,
    tenor: lower.upper,
    bass: lower.lower,
  };
}

function normalizeMusicXml(bytes, input, label) {
  const excerpt = parseMusicXmlExcerpt(bytes, {
    firstMeasure: input.firstMeasure,
    lastMeasure: input.lastMeasure,
    label,
  });
  const upperIntervals = transformIntervals(excerpt.notesByStaff[1], {
    sourcePpq: excerpt.ppq,
    trimStart: 0,
    trimEnd: excerpt.endTick,
  });
  const lowerIntervals = transformIntervals(excerpt.notesByStaff[2], {
    sourcePpq: excerpt.ppq,
    trimStart: 0,
    trimEnd: excerpt.endTick,
  });
  const upper = splitPairedStaff(upperIntervals, `${label} treble staff`);
  const lower = splitPairedStaff(lowerIntervals, `${label} bass staff`);
  if (upper.end !== lower.end) {
    throw new Error(`${label}: normalized MusicXML staves have different lengths.`);
  }
  return {
    soprano: upper.upper,
    alto: upper.lower,
    tenor: lower.upper,
    bass: lower.lower,
  };
}

function repeatParts(parts, repeatCount) {
  if (!repeatCount || repeatCount === 1) return parts;

  const sourceEnd = parts.soprano.at(-1).end;
  return Object.fromEntries(
    Object.entries(parts).map(([voice, intervals]) => [
      voice,
      Array.from({ length: repeatCount }, (_, repetition) =>
        intervals.map((note) => ({
          ...note,
          start: note.start + repetition * sourceEnd,
          end: note.end + repetition * sourceEnd,
        })),
      ).flat(),
    ]),
  );
}

function makeMelodyAndPhrases(tuneId, soprano, phraseEnds) {
  const notes = [];
  const phrases = [];
  let phraseStart = 0;

  phraseEnds.forEach((phraseEnd, phraseIndex) => {
    const phraseId = `${tuneId}.phrase-${String(phraseIndex + 1).padStart(2, "0")}`;
    const phraseIntervals = soprano.filter(
      (note) => note.start >= phraseStart && note.end <= phraseEnd,
    );
    const crossing = soprano.find(
      (note) => note.start < phraseEnd && note.end > phraseEnd,
    );
    if (crossing) {
      throw new Error(`${tuneId}: note crosses phrase boundary ${phraseEnd}.`);
    }
    if (phraseIntervals.length === 0) {
      throw new Error(`${tuneId}: phrase ${phraseIndex + 1} is empty.`);
    }

    const noteIds = phraseIntervals.map((note, noteIndex) => {
      const id = `${phraseId}.note-${String(noteIndex + 1).padStart(2, "0")}`;
      notes.push({
        id,
        midi: note.pitch,
        start_tick: note.start,
        duration_ticks: note.duration,
        velocity: NOTE_VELOCITY,
      });
      return id;
    });
    phrases.push({
      id: phraseId,
      start_tick: phraseStart,
      end_tick: phraseEnd,
      note_ids: noteIds,
    });
    phraseStart = phraseEnd;
  });

  if (notes.length !== soprano.length) {
    throw new Error(`${tuneId}: phrase cuts do not cover every soprano note.`);
  }
  return { notes, phrases };
}

function harmonyNotes(tuneId, voice, intervals) {
  return intervals.map((note, index) => ({
    id: `${tuneId}.harmony.${voice}.note-${String(index + 1).padStart(2, "0")}`,
    midi: note.pitch,
    start_tick: note.start,
    duration_ticks: note.duration,
    velocity: NOTE_VELOCITY,
  }));
}

function validateParts(config, parts) {
  const endTick = config.phraseEnds.at(-1);
  const ranges = {
    soprano: [48, 84],
    alto: [53, 74],
    tenor: [48, 69],
    bass: [36, 60],
  };
  for (const voice of ["soprano", "alto", "tenor", "bass"]) {
    assertPart(parts[voice], {
      label: `${config.title} ${voice}`,
      endTick,
      range: ranges[voice],
    });
  }

  const finalPitches = [
    parts.soprano.at(-1).pitch,
    parts.alto.at(-1).pitch,
    parts.tenor.at(-1).pitch,
    parts.bass.at(-1).pitch,
  ];
  if (new Set(finalPitches.map((pitch) => pitch % 12)).size < 2) {
    throw new Error(`${config.title}: recovered final cadence is a single pitch class.`);
  }
  return finalPitches;
}

async function importTune(config) {
  const bytes = await fetchPinnedSource({
    label: config.title,
    url: config.input.url,
    sha256: config.input.sha256,
  });

  let parts;
  if (config.input.type === "musicxml") {
    parts = normalizeMusicXml(bytes, config.input, config.title);
  } else {
    const midi = parseMidi(bytes, config.title);
    parts =
      config.input.type === "paired-midi"
        ? normalizePairedMidi(midi, config.input, config.title)
        : normalizeExplicitParts(midi, config.input, config.title);
  }
  parts = repeatParts(parts, config.input.repeatCount);

  const finalPitches = validateParts(config, parts);
  const tuneId = `ps1650.tune.${config.slug}`;
  const melody = makeMelodyAndPhrases(
    tuneId,
    parts.soprano,
    config.phraseEnds,
  );
  const record = {
    $schema: "../../schemas/tune.schema.json",
    schema_version: "0.2.0",
    id: tuneId,
    title: config.title,
    alternate_title: config.alternateTitle,
    meter: config.meter,
    ppq: TARGET_PPQ,
    default_bpm: config.bpm,
    time_signature: config.timeSignature,
    key: config.key,
    length_ticks: config.phraseEnds.at(-1),
    notes: melody.notes,
    phrases: melody.phrases,
    harmony: {
      voicing: "SATB",
      voices: {
        alto: harmonyNotes(tuneId, "alto", parts.alto),
        tenor: harmonyNotes(tuneId, "tenor", parts.tenor),
        bass: harmonyNotes(tuneId, "bass", parts.bass),
      },
      editorial_transformation: config.harmonyTransformation,
      rights: {
        arrangement: "PDM-1.0",
        event_transcription: "PDM-1.0",
      },
    },
    source: {
      ...config.source,
      event_source_url: config.input.url,
      event_source_sha256: config.input.sha256,
    },
    rights: {
      composition: "PDM-1.0",
      source_transcription: "PDM-1.0",
      metadata: "CC0-1.0",
    },
  };

  await writeFile(
    new URL(`${config.slug}.json`, tuneDirectory),
    `${JSON.stringify(record, null, 2)}\n`,
    "utf8",
  );
  return {
    slug: config.slug,
    notes: [
      parts.soprano.length,
      parts.alto.length,
      parts.tenor.length,
      parts.bass.length,
    ],
    length: record.length_ticks,
    finalPitches,
  };
}

await mkdir(tuneDirectory, { recursive: true });
const summaries = [];
for (const config of tunes) summaries.push(await importTune(config));

for (const summary of summaries) {
  console.log(
    `${summary.slug}: SATB ${summary.notes.join("/")} notes, ${summary.length} ticks, cadence MIDI ${summary.finalPitches.join("/")}`,
  );
}
