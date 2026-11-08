// @ts-nocheck
// Concert (Western, C) flute fingerings for musician mode: the common Boehm
// fingering for each note C4..A6 and where a raga line sits on the flute.
import { swaraLine } from './fretboard';

/**
 * Keys pressed, written "left|right|foot": T = thumb (B key), 1 2 3 = fingers,
 * g = left pinky G# key, e = right pinky Eb key, c / s = low C / C# foot keys.
 */
const FINGERINGS = {
  60: 'T123|123|c', // C4
  61: 'T123|123|s',
  62: 'T123|123|',
  63: 'T123|123e|',
  64: 'T123|12e|',
  65: 'T123|1e|',
  66: 'T123|3e|',
  67: 'T123|e|',
  68: 'T123g|e|',
  69: 'T12|e|',
  70: 'T1|1e|',
  71: 'T1|e|',
  72: '1|e|', // C5
  73: '|e|',
  74: 'T23|123|',
  75: 'T23|123e|',
  76: 'T123|12e|',
  77: 'T123|1e|',
  78: 'T123|3e|',
  79: 'T123|e|',
  80: 'T123g|e|',
  81: 'T12|e|',
  82: 'T1|1e|',
  83: 'T1|e|',
  84: '1|e|', // C6
  85: '|e|',
  86: 'T12|e|',
  87: 'T123g|123e|',
  88: 'T12|12e|',
  89: 'T13|1e|',
  90: 'T13|3e|',
  91: '123|e|',
  92: '23g|e|',
  93: 'T2|1e|', // A6
};
export const FLUTE_LOW = 60;
export const FLUTE_HIGH = 93;

/** The keys pressed for a MIDI note, or null outside C4..A6. */
export const fluteKeys = (midi) => {
  const code = FINGERINGS[midi];
  if (code === undefined) return null;
  const [left, right, foot] = code.split('|');
  return {
    thumb: left.includes('T'),
    left: [1, 2, 3].map((f) => left.includes(String(f))),
    gSharp: left.includes('g'),
    right: [1, 2, 3].map((f) => right.includes(String(f))),
    eFlat: right.includes('e'),
    lowC: foot === 'c',
    lowCSharp: foot === 's',
  };
};

/** 0 = low octave (C4-C#5), 1 = middle (D5-C#6), 2 = high (D6 up). */
export const fluteRegister = (midi) => (midi < 74 ? 0 : midi < 86 ? 1 : 2);

/**
 * The line on a concert flute with Sa on saPc: [{ midi, keys, register }], in
 * the lowest octave where every note is playable, or null when none fits.
 */
export const fluteLine = (saPc, swaras = [], descending = false) => {
  if (!Number.isInteger(saPc)) return null;
  const line = swaraLine(swaras, descending);
  if (!line.length) return null;
  const lo = Math.min(...line);
  const hi = Math.max(...line);
  for (let sa = 48 + saPc; sa + hi <= FLUTE_HIGH; sa += 12) {
    if (sa + lo < FLUTE_LOW) continue;
    return line.map((v) => ({ midi: sa + v, keys: fluteKeys(sa + v), register: fluteRegister(sa + v) }));
  }
  return null;
};
