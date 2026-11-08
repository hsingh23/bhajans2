// @ts-nocheck
// Sung notes (sargam) and bansuri fingerings for musician mode.
import { swaraLine } from './fretboard';

// Hindustani syllable for each semitone above Sa; komal notes are underlined
// when shown, tivra Ma carries a tick.
const SYLLABLES = [
  ['Sa'],
  ['Re', 'komal'],
  ['Re'],
  ['Ga', 'komal'],
  ['Ga'],
  ['Ma'],
  ['Ma', 'tivra'],
  ['Pa'],
  ['Dha', 'komal'],
  ['Dha'],
  ['Ni', 'komal'],
  ['Ni'],
];

/** Syllable, komal / tivra and octave of the note `v` semitones from Sa (-5 = lower Pa). */
export const sargamNote = (v) => {
  const semitone = ((v % 12) + 12) % 12;
  const [syllable, kind = null] = SYLLABLES[semitone];
  return { syllable, kind, octave: Math.floor(v / 12), semitone };
};

/**
 * The sung line: syllable, komal / tivra, octave (-1 mandra, 0 madhya, 1 taar)
 * for each swara, in the order sung.
 */
export const sargamLine = (swaras = [], descending = false) =>
  swaraLine(swaras, descending).map(sargamNote);

// Bansuri named for its Sa, played with the top three holes closed. Holes from
// the mouth hole down: 1 = closed, 0.5 = half-closed, 0 = open.
const FINGERING = [
  [1, 1, 1, 0, 0, 0], // Sa
  [1, 1, 0.5, 0, 0, 0], // komal Re
  [1, 1, 0, 0, 0, 0], // Re
  [1, 0.5, 0, 0, 0, 0], // komal Ga
  [1, 0, 0, 0, 0, 0], // Ga
  [0.5, 0, 0, 0, 0, 0], // Ma
  [0, 0, 0, 0, 0, 0], // tivra Ma
  [1, 1, 1, 1, 1, 1], // Pa
  [1, 1, 1, 1, 1, 0.5], // komal Dha
  [1, 1, 1, 1, 1, 0], // Dha
  [1, 1, 1, 1, 0.5, 0], // komal Ni
  [1, 1, 1, 1, 0, 0], // Ni
];

/**
 * Fingering and breath for each swara on a bansuri whose Sa is the song's Sa.
 * Pa, Dha and Ni above Sa share the low notes' fingers and are overblown
 * (register 1); upper Sa and above likewise; notes below Sa are blown softly.
 */
export const bansuriLine = (swaras = [], descending = false) =>
  swaraLine(swaras, descending).map((v) => {
    const semitone = ((v % 12) + 12) % 12;
    // Pa, Dha, Ni sit on the all-closed tube one register up, so P..N above Sa
    // (7..11) and Sa' (12) and above are overblown; mandra P..N (below Sa) are not.
    const register = v < 0 ? 0 : v >= 7 ? Math.floor((v + 5) / 12) : 0;
    return { semitone, holes: FINGERING[semitone], register };
  });
