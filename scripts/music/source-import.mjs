import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";

export const TARGET_PPQ = 480;
export const NOTE_VELOCITY = 88;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export async function fetchPinnedSource({ label, url, sha256 }) {
  const response = await fetch(url, {
    headers: { "user-agent": "Open1650 source importer/0.1" },
  });
  if (!response.ok) {
    throw new Error(`${label}: ${url} returned HTTP ${response.status}.`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const actualHash = createHash("sha256").update(bytes).digest("hex");
  if (sha256 && actualHash !== sha256) {
    throw new Error(
      `${label}: source checksum changed (expected ${sha256}, received ${actualHash}).`,
    );
  }
  return bytes;
}

function readVariableLength(bytes, initialOffset) {
  let offset = initialOffset;
  let value = 0;
  let byte;
  do {
    assert(offset < bytes.length, "Unexpected end of MIDI variable-length value.");
    byte = bytes[offset];
    offset += 1;
    value = (value << 7) | (byte & 0x7f);
  } while (byte & 0x80);
  return { value, offset };
}

function keySignatureName(sharps, minor) {
  const majorKeys = [
    "C-flat major",
    "G-flat major",
    "D-flat major",
    "A-flat major",
    "E-flat major",
    "B-flat major",
    "F major",
    "C major",
    "G major",
    "D major",
    "A major",
    "E major",
    "B major",
    "F-sharp major",
    "C-sharp major",
  ];
  const minorKeys = [
    "A-flat minor",
    "E-flat minor",
    "B-flat minor",
    "F minor",
    "C minor",
    "G minor",
    "D minor",
    "A minor",
    "E minor",
    "B minor",
    "F-sharp minor",
    "C-sharp minor",
    "G-sharp minor",
    "D-sharp minor",
    "A-sharp minor",
  ];
  return (minor ? minorKeys : majorKeys)[sharps + 7] ?? null;
}

export function parseMidi(bytes, label = "MIDI source") {
  assert(bytes.subarray(0, 4).toString("ascii") === "MThd", `${label}: missing MThd.`);
  const headerLength = bytes.readUInt32BE(4);
  const format = bytes.readUInt16BE(8);
  const trackCount = bytes.readUInt16BE(10);
  const division = bytes.readUInt16BE(12);
  assert((division & 0x8000) === 0, `${label}: SMPTE MIDI timing is unsupported.`);

  const tracks = [];
  const metadata = {
    format,
    ppq: division,
    timeSignatures: [],
    keySignatures: [],
    tempos: [],
    text: [],
  };
  let offset = 8 + headerLength;

  for (let trackIndex = 0; trackIndex < trackCount; trackIndex += 1) {
    assert(
      bytes.subarray(offset, offset + 4).toString("ascii") === "MTrk",
      `${label}: missing MTrk for track ${trackIndex}.`,
    );
    const trackLength = bytes.readUInt32BE(offset + 4);
    const trackEnd = offset + 8 + trackLength;
    let cursor = offset + 8;
    let tick = 0;
    let runningStatus = null;
    let name = "";
    const openNotes = new Map();
    const notes = [];

    const noteKey = (channel, pitch) => `${channel}:${pitch}`;
    const closeNote = (channel, pitch, endTick) => {
      const key = noteKey(channel, pitch);
      const queue = openNotes.get(key);
      if (!queue || queue.length === 0) return;
      const open = queue.shift();
      assert(endTick > open.start, `${label}: zero-length note at tick ${endTick}.`);
      notes.push({ ...open, end: endTick, duration: endTick - open.start });
    };

    while (cursor < trackEnd) {
      const delta = readVariableLength(bytes, cursor);
      tick += delta.value;
      cursor = delta.offset;

      let status = bytes[cursor];
      cursor += 1;
      if (status < 0x80) {
        assert(runningStatus !== null, `${label}: running status without status byte.`);
        cursor -= 1;
        status = runningStatus;
      } else if (status < 0xf0) {
        runningStatus = status;
      }

      if (status === 0xff) {
        const type = bytes[cursor];
        cursor += 1;
        const length = readVariableLength(bytes, cursor);
        cursor = length.offset;
        const data = bytes.subarray(cursor, cursor + length.value);
        cursor += length.value;

        if (type === 0x03) name = data.toString("utf8");
        if (type === 0x01 || type === 0x02) {
          metadata.text.push(data.toString("utf8"));
        }
        if (type === 0x51 && data.length === 3) {
          const microseconds = (data[0] << 16) | (data[1] << 8) | data[2];
          metadata.tempos.push({ tick, bpm: Math.round(60_000_000 / microseconds) });
        }
        if (type === 0x58 && data.length >= 2) {
          metadata.timeSignatures.push({
            tick,
            numerator: data[0],
            denominator: 2 ** data[1],
          });
        }
        if (type === 0x59 && data.length >= 2) {
          const sharps = data.readInt8(0);
          metadata.keySignatures.push({
            tick,
            sharps,
            minor: data[1] === 1,
            name: keySignatureName(sharps, data[1] === 1),
          });
        }
        continue;
      }

      if (status === 0xf0 || status === 0xf7) {
        const length = readVariableLength(bytes, cursor);
        cursor = length.offset + length.value;
        continue;
      }

      const event = status & 0xf0;
      const channel = status & 0x0f;
      const first = bytes[cursor];
      cursor += 1;
      const hasOneDataByte = event === 0xc0 || event === 0xd0;
      const second = hasOneDataByte ? null : bytes[cursor];
      if (!hasOneDataByte) cursor += 1;

      if (event === 0x90 && second > 0) {
        const key = noteKey(channel, first);
        const queue = openNotes.get(key) ?? [];
        queue.push({
          track: trackIndex,
          channel,
          pitch: first,
          velocity: second,
          start: tick,
        });
        openNotes.set(key, queue);
      } else if (event === 0x80 || (event === 0x90 && second === 0)) {
        closeNote(channel, first, tick);
      }
    }

    for (const [key, queue] of openNotes) {
      assert(queue.length === 0, `${label}: unterminated notes remain for ${key}.`);
    }
    notes.sort(
      (left, right) =>
        left.start - right.start ||
        left.end - right.end ||
        left.pitch - right.pitch,
    );
    tracks.push({ index: trackIndex, name, endTick: tick, notes });
    offset = trackEnd;
  }

  return { ...metadata, tracks };
}

export function midiNotesByTrack(midi, trackIndex) {
  const track = midi.tracks[trackIndex];
  assert(track, `MIDI track ${trackIndex} is missing.`);
  return track.notes.map((note) => ({ ...note }));
}

export function midiNotesByChannel(midi, channel) {
  return midi.tracks
    .flatMap((track) => track.notes)
    .filter((note) => note.channel === channel)
    .sort(
      (left, right) =>
        left.start - right.start ||
        left.end - right.end ||
        left.pitch - right.pitch,
    )
    .map((note) => ({ ...note }));
}

export function transformIntervals(
  intervals,
  {
    sourcePpq,
    targetPpq = TARGET_PPQ,
    rhythmicScale = 1,
    transpose = 0,
    trimStart = null,
    trimEnd = null,
  },
) {
  assert(intervals.length > 0, "Cannot transform an empty interval list.");
  const sourceStart =
    trimStart ?? Math.min(...intervals.map((interval) => interval.start));
  const sourceEnd =
    trimEnd ?? Math.max(...intervals.map((interval) => interval.end));
  const scale = (targetPpq / sourcePpq) * rhythmicScale;
  const scaleTick = (tick) => {
    const result = (tick - sourceStart) * scale;
    assert(Number.isInteger(result), `Nonintegral normalized tick ${result}.`);
    return result;
  };

  return intervals
    .filter(
      (interval) => interval.start >= sourceStart && interval.end <= sourceEnd,
    )
    .map((interval) => ({
      start: scaleTick(interval.start),
      end: scaleTick(interval.end),
      duration: scaleTick(interval.end) - scaleTick(interval.start),
      pitch: interval.pitch + transpose,
      velocity: interval.velocity,
      sourceStart: interval.start,
      sourceEnd: interval.end,
    }))
    .sort(
      (left, right) =>
        left.start - right.start ||
        left.end - right.end ||
        left.pitch - right.pitch,
    );
}

function permutations(values) {
  if (values.length <= 1) return [values];
  if (values.length === 2) return [values, [values[1], values[0]]];
  throw new Error(`Expected at most two simultaneous staff notes, received ${values.length}.`);
}

function crossingPenalty(state) {
  const [upper, lower] = state;
  if (!upper || !lower) return 0;
  const overlapStart = Math.max(upper.start, lower.start);
  const overlapEnd = Math.min(upper.end, lower.end);
  if (overlapStart >= overlapEnd || upper.pitch >= lower.pitch) return 0;
  return 1_000 + (lower.pitch - upper.pitch) * 100;
}

export function splitPairedStaff(intervals, label) {
  assert(intervals.length > 0, `${label}: paired staff is empty.`);
  const starts = new Map();
  for (const interval of intervals) {
    const group = starts.get(interval.start) ?? [];
    group.push(interval);
    starts.set(interval.start, group);
  }

  let states = [
    {
      parts: [[], []],
      active: [null, null],
      lastPitch: [null, null],
      cost: 0,
    },
  ];

  for (const [tick, group] of [...starts].sort(([a], [b]) => a - b)) {
    const nextStates = new Map();
    for (const state of states) {
      const active = state.active.map((note) =>
        note && note.end > tick ? note : null,
      );
      const available = active
        .map((note, voice) => (note ? null : voice))
        .filter((voice) => voice !== null);

      if (group.length > available.length) continue;

      let assignments;
      if (group.length === 1 && available.length === 2) {
        // A same-pitch unison may be represented once in a single MIDI staff.
        assignments = [[group[0], group[0]]];
      } else if (group.length === available.length) {
        assignments = permutations(group);
      } else {
        assignments = permutations(group).flatMap((ordered) =>
          available.map((voice) => {
            const result = Array(available.length).fill(null);
            result[available.indexOf(voice)] = ordered[0];
            return result;
          }),
        );
      }

      for (const assignment of assignments) {
        const candidate = {
          parts: state.parts.map((part) => [...part]),
          active: [...active],
          lastPitch: [...state.lastPitch],
          cost: state.cost,
        };
        let valid = true;

        for (let index = 0; index < available.length; index += 1) {
          const note = assignment[index];
          if (!note) continue;
          const voice = available[index];
          const previous = candidate.parts[voice].at(-1);
          if (previous && previous.end > note.start) {
            valid = false;
            break;
          }
          if (candidate.lastPitch[voice] !== null) {
            candidate.cost += Math.abs(note.pitch - candidate.lastPitch[voice]);
          } else {
            const target = voice === 0 ? 70 : 60;
            candidate.cost += Math.abs(note.pitch - target) * 0.1;
          }
          candidate.parts[voice].push({ ...note });
          candidate.active[voice] = note;
          candidate.lastPitch[voice] = note.pitch;
        }
        if (!valid) continue;

        candidate.cost += crossingPenalty(candidate.active);
        const key = candidate.active
          .map((note, voice) =>
            note
              ? `${note.end}:${note.pitch}:${candidate.lastPitch[voice]}`
              : `-:${candidate.lastPitch[voice]}`,
          )
          .join("|");
        const incumbent = nextStates.get(key);
        if (!incumbent || candidate.cost < incumbent.cost) {
          nextStates.set(key, candidate);
        }
      }
    }
    states = [...nextStates.values()];
    assert(states.length > 0, `${label}: could not split paired staff at tick ${tick}.`);
  }

  const sourceEnd = Math.max(...intervals.map((interval) => interval.end));
  const complete = states
    .filter((state) => state.parts.every((part) => part.length > 0))
    .sort((left, right) => left.cost - right.cost)[0];
  assert(complete, `${label}: no complete two-voice assignment was found.`);

  const closeGaps = (part) =>
    part.map((note, index) => {
      const next = part[index + 1];
      const end = next?.start ?? sourceEnd;
      assert(end > note.start, `${label}: overlapping notes at tick ${note.start}.`);
      return { ...note, end, duration: end - note.start };
    });

  const [upper, lower] = complete.parts.map(closeGaps);
  for (const [voice, part] of [
    ["upper", upper],
    ["lower", lower],
  ]) {
    assert(part[0].start === 0, `${label} ${voice}: part must start at tick 0.`);
    assert(
      part.at(-1).end === sourceEnd,
      `${label} ${voice}: part must end at tick ${sourceEnd}.`,
    );
    for (let index = 1; index < part.length; index += 1) {
      assert(
        part[index].start === part[index - 1].end,
        `${label} ${voice}: gap before tick ${part[index].start}.`,
      );
    }
  }
  return { upper, lower, end: sourceEnd };
}

export function extendFinalBoundary(intervals, paddingTicks) {
  assert(paddingTicks >= 0, "Final-boundary padding must be nonnegative.");
  if (paddingTicks === 0) return intervals.map((note) => ({ ...note }));
  const finalRelease = Math.max(...intervals.map((note) => note.end));
  return intervals.map((note) =>
    note.end === finalRelease
      ? {
          ...note,
          end: note.end + paddingTicks,
          duration: note.duration + paddingTicks,
        }
      : { ...note },
  );
}

export function makeContiguousPart(intervals, label, endTick = null) {
  assert(intervals.length > 0, `${label}: voice is empty.`);
  const sorted = [...intervals].sort(
    (left, right) =>
      left.start - right.start ||
      left.end - right.end ||
      left.pitch - right.pitch,
  );
  const start = sorted[0].start;
  assert(start === 0, `${label}: voice begins at tick ${start}, not 0.`);
  const finalEnd = endTick ?? Math.max(...sorted.map((note) => note.end));
  return sorted.map((note, index) => {
    const next = sorted[index + 1];
    const end = next?.start ?? finalEnd;
    assert(end > note.start, `${label}: overlap at tick ${note.start}.`);
    return { ...note, end, duration: end - note.start };
  });
}

function findEndOfCentralDirectory(bytes) {
  const minimum = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= minimum; offset -= 1) {
    if (bytes.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  return -1;
}

export function readZipEntry(bytes, predicate) {
  const eocd = findEndOfCentralDirectory(bytes);
  assert(eocd >= 0, "MXL source is not a readable ZIP archive.");
  const entryCount = bytes.readUInt16LE(eocd + 10);
  let offset = bytes.readUInt32LE(eocd + 16);

  for (let index = 0; index < entryCount; index += 1) {
    assert(bytes.readUInt32LE(offset) === 0x02014b50, "Invalid ZIP central directory.");
    const method = bytes.readUInt16LE(offset + 10);
    const compressedSize = bytes.readUInt32LE(offset + 20);
    const uncompressedSize = bytes.readUInt32LE(offset + 24);
    const nameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    const localOffset = bytes.readUInt32LE(offset + 42);
    const name = bytes.subarray(offset + 46, offset + 46 + nameLength).toString();

    if (predicate(name)) {
      assert(bytes.readUInt32LE(localOffset) === 0x04034b50, "Invalid ZIP local header.");
      const localNameLength = bytes.readUInt16LE(localOffset + 26);
      const localExtraLength = bytes.readUInt16LE(localOffset + 28);
      const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = bytes.subarray(dataOffset, dataOffset + compressedSize);
      const result =
        method === 0
          ? Buffer.from(compressed)
          : method === 8
            ? inflateRawSync(compressed)
            : null;
      assert(result, `Unsupported ZIP compression method ${method}.`);
      assert(result.length === uncompressedSize, `ZIP entry ${name} has wrong size.`);
      return result;
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error("Requested MXL entry was not found.");
}

function xmlValue(block, tag, fallback = null) {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`));
  if (!match) return fallback;
  return match[1].replace(/<[^>]+>/g, "").trim();
}

const PITCH_CLASS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function parseMusicXmlExcerpt(mxlBytes, { firstMeasure, lastMeasure, label }) {
  const xmlBytes = readZipEntry(
    mxlBytes,
    (name) => name.endsWith(".xml") && !name.startsWith("META-INF/"),
  );
  const xml = xmlBytes.toString("utf8");
  const divisionsMatch = xml.match(/<divisions>(\d+)<\/divisions>/);
  assert(divisionsMatch, `${label}: MusicXML divisions are missing.`);
  const divisions = Number(divisionsMatch[1]);
  const fifths = Number(xmlValue(xml, "fifths", "0"));
  const mode = xmlValue(xml, "mode", "major");
  const key = keySignatureName(fifths, mode === "minor");
  const numerator = Number(xmlValue(xml, "beats", "4"));
  const denominator = Number(xmlValue(xml, "beat-type", "4"));
  const staffNotes = { 1: [], 2: [] };
  let absoluteTick = 0;

  const measures = [...xml.matchAll(/<measure\s+number="([^"]+)"[^>]*>([\s\S]*?)<\/measure>/g)];
  for (const match of measures) {
    const measureNumber = Number(match[1]);
    const body = match[2];
    let cursor = 0;
    let lastOnset = 0;
    let lastStaff = 1;
    let measureEnd = 0;

    const tokens = [
      ...body.matchAll(/<(note|backup|forward)(?:\s[^>]*)?>[\s\S]*?<\/\1>/g),
    ];
    for (const token of tokens) {
      const type = token[1];
      const block = token[0];
      const duration = Number(xmlValue(block, "duration", "0"));
      if (type === "backup") {
        cursor -= duration;
        continue;
      }
      if (type === "forward") {
        cursor += duration;
        measureEnd = Math.max(measureEnd, cursor);
        continue;
      }

      const chord = /<chord\s*\/>/.test(block);
      const onset = chord ? lastOnset : cursor;
      if (!chord) lastOnset = onset;
      const explicitStaff = Number(xmlValue(block, "staff", "0"));
      if (explicitStaff) lastStaff = explicitStaff;
      const staff = chord ? lastStaff : explicitStaff || 1;
      const rest = /<rest(?:\s[^>]*)?\/>/.test(block);
      if (!rest && measureNumber >= firstMeasure && measureNumber <= lastMeasure) {
        const step = xmlValue(block, "step");
        const octave = Number(xmlValue(block, "octave"));
        const alter = Number(xmlValue(block, "alter", "0"));
        assert(step in PITCH_CLASS, `${label}: invalid MusicXML pitch step ${step}.`);
        staffNotes[staff].push({
          start: absoluteTick + onset,
          end: absoluteTick + onset + duration,
          duration,
          pitch: (octave + 1) * 12 + PITCH_CLASS[step] + alter,
          velocity: NOTE_VELOCITY,
        });
      }
      if (!chord) cursor += duration;
      measureEnd = Math.max(measureEnd, onset + duration, cursor);
    }

    if (measureNumber >= firstMeasure && measureNumber <= lastMeasure) {
      absoluteTick += measureEnd;
    }
  }

  return {
    ppq: divisions,
    key,
    timeSignature: [numerator, denominator],
    notesByStaff: staffNotes,
    endTick: absoluteTick,
  };
}

export function intervalsToTuneNotes(intervals, idPrefix) {
  return intervals.map((note, index) => ({
    id: `${idPrefix}.note-${String(index + 1).padStart(2, "0")}`,
    midi: note.pitch,
    start_tick: note.start,
    duration_ticks: note.duration,
    velocity: NOTE_VELOCITY,
  }));
}

export function assertPart(part, { label, endTick, range }) {
  assert(part.length > 0, `${label}: no notes.`);
  assert(part[0].start === 0, `${label}: does not begin at tick 0.`);
  assert(part.at(-1).end === endTick, `${label}: does not end at tick ${endTick}.`);
  for (let index = 0; index < part.length; index += 1) {
    const note = part[index];
    assert(Number.isInteger(note.start), `${label}: nonintegral start tick.`);
    assert(Number.isInteger(note.duration), `${label}: nonintegral duration.`);
    assert(note.duration > 0, `${label}: nonpositive duration.`);
    assert(
      note.pitch >= range[0] && note.pitch <= range[1],
      `${label}: MIDI ${note.pitch} falls outside ${range[0]}–${range[1]}.`,
    );
    if (index > 0) {
      assert(
        note.start === part[index - 1].end,
        `${label}: discontinuity at tick ${note.start}.`,
      );
    }
  }
}
