import type { CompiledPerformance } from "./compilePerformance";
import {
  PERFORMANCE_VOICES,
  VOICE_CHANNELS,
  VOICE_LABELS,
  type PerformanceVoice,
} from "./voices";

interface MidiEvent {
  tick: number;
  order: number;
  bytes: number[];
}

const encoder = new TextEncoder();

function psalmNumber(performance: CompiledPerformance): number | undefined {
  const match = performance.psalmId.match(/\.psalm-(\d{3})\./);
  return match ? Number(match[1]) : undefined;
}

function tuneSlug(performance: CompiledPerformance): string {
  return performance.tuneId
    .replace(/^ps1650\.tune\./, "")
    .replace(/[^a-z0-9-]/gi, "-")
    .toLocaleLowerCase();
}

function ascii(value: string): number[] {
  return [...encoder.encode(value)];
}

function uint16(value: number): number[] {
  return [(value >>> 8) & 0xff, value & 0xff];
}

function uint32(value: number): number[] {
  return [
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ];
}

function variableLength(value: number): number[] {
  let buffer = value & 0x7f;
  const bytes: number[] = [];

  while ((value >>= 7) > 0) {
    buffer <<= 8;
    buffer |= (value & 0x7f) | 0x80;
  }

  while (true) {
    bytes.push(buffer & 0xff);
    if (buffer & 0x80) buffer >>= 8;
    else break;
  }

  return bytes;
}

function metaText(type: number, value: string): number[] {
  const text = ascii(value);
  return [0xff, type, ...variableLength(text.length), ...text];
}

function encodeTrack(
  events: MidiEvent[],
  durationTicks: number,
): number[] {
  events.sort(
    (left, right) =>
      left.tick - right.tick || left.order - right.order,
  );

  const track: number[] = [];
  let previousTick = 0;
  for (const event of events) {
    track.push(
      ...variableLength(event.tick - previousTick),
      ...event.bytes,
    );
    previousTick = event.tick;
  }
  track.push(
    ...variableLength(Math.max(0, durationTicks - previousTick)),
    0xff,
    0x2f,
    0x00,
  );
  return [
    ...ascii("MTrk"),
    ...uint32(track.length),
    ...track,
  ];
}

const midiVolume: Record<PerformanceVoice, number> = {
  soprano: 110,
  alto: 86,
  tenor: 91,
  bass: 100,
};

export function createMidiFile(
  performance: CompiledPerformance,
  bpm = performance.defaultBpm,
): Uint8Array {
  const tempo = Math.round(60_000_000 / bpm);
  const denominatorPower = Math.log2(performance.timeSignature[1]);
  const number = psalmNumber(performance);
  const psalmTitle = number ? `Psalm ${number}` : "Psalm";
  const conductorEvents: MidiEvent[] = [
    {
      tick: 0,
      order: 0,
      bytes: metaText(0x03, "Conductor"),
    },
    {
      tick: 0,
      order: 1,
      bytes: metaText(0x01, `${psalmTitle} · ${performance.title}`),
    },
    {
      tick: 0,
      order: 2,
      bytes: [
        0xff,
        0x51,
        0x03,
        (tempo >>> 16) & 0xff,
        (tempo >>> 8) & 0xff,
        tempo & 0xff,
      ],
    },
    {
      tick: 0,
      order: 3,
      bytes: [
        0xff,
        0x58,
        0x04,
        performance.timeSignature[0],
        denominatorPower,
        24,
        8,
      ],
    },
    {
      tick: 0,
      order: 4,
      bytes: metaText(
        0x01,
        "Historic tune and harmony: public domain · Open 1650 lyric alignment: CC0",
      ),
    },
  ];

  const voiceTracks = PERFORMANCE_VOICES.map((voice) => {
    const channel = VOICE_CHANNELS[voice];
    const events: MidiEvent[] = [
      {
        tick: 0,
        order: 0,
        bytes: metaText(0x03, VOICE_LABELS[voice]),
      },
      {
        tick: 0,
        order: 1,
        bytes: [0xc0 | channel, 19],
      },
      {
        tick: 0,
        order: 2,
        bytes: [0xb0 | channel, 7, midiVolume[voice]],
      },
    ];

    for (const note of performance.notes) {
      if (note.voice !== voice) continue;
      events.push(
        {
          tick: note.startTick,
          order: 20,
          bytes: [
            0x90 | channel,
            note.midi,
            note.velocity,
          ],
        },
        {
          tick: note.endTick,
          order: 10,
          bytes: [0x80 | channel, note.midi, 0],
        },
      );
    }
    return encodeTrack(events, performance.durationTicks);
  });

  return new Uint8Array([
    ...ascii("MThd"),
    ...uint32(6),
    ...uint16(1),
    ...uint16(1 + PERFORMANCE_VOICES.length),
    ...uint16(performance.ppq),
    ...encodeTrack(conductorEvents, performance.durationTicks),
    ...voiceTracks.flat(),
  ]);
}

export function downloadMidiFile(
  performance: CompiledPerformance,
  bpm = performance.defaultBpm,
): void {
  const bytes = createMidiFile(performance, bpm);
  const payload = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(payload).set(bytes);
  const blob = new Blob([payload], { type: "audio/midi" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  const number = psalmNumber(performance);
  const numberSlug = number
    ? String(number).padStart(3, "0")
    : "unknown";
  anchor.download = `psalm-${numberSlug}-${tuneSlug(performance)}.mid`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
