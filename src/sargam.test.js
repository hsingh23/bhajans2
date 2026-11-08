// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { bansuriLine, sargamLine, sargamNote } from './sargam';
import { noteNameIn } from './musicTheory';
import { bolGuide, dugun, tablaTaal } from './tabla';

describe('sung notes', () => {
  it('names komal and tivra notes and the octave of each swara', () => {
    expect(sargamLine(['S', 'r1', 'G3', 'M2', 'P', 'd1', 'N3', 'S'])).toEqual([
      { syllable: 'Sa', kind: null, octave: 0, semitone: 0 },
      { syllable: 'Re', kind: 'komal', octave: 0, semitone: 1 },
      { syllable: 'Ga', kind: null, octave: 0, semitone: 4 },
      { syllable: 'Ma', kind: 'tivra', octave: 0, semitone: 6 },
      { syllable: 'Pa', kind: null, octave: 0, semitone: 7 },
      { syllable: 'Dha', kind: 'komal', octave: 0, semitone: 8 },
      { syllable: 'Ni', kind: null, octave: 0, semitone: 11 },
      { syllable: 'Sa', kind: null, octave: 1, semitone: 0 },
    ]);
    expect(sargamLine(['S', 'n2', 'S'], true).map((n) => n.octave)).toEqual([1, 0, 0]);
    // An aroha that opens on Pa climbs from the lower octave to middle Sa
    expect(sargamLine(['P', 'D2', 'N3', 'S']).map((n) => n.octave)).toEqual([-1, -1, -1, 0]);
  });
});

describe('range ends', () => {
  it('names a note by sargam and octave, and by note name in the key', () => {
    expect(sargamNote(-5)).toEqual({ syllable: 'Pa', kind: null, octave: -1, semitone: 7 });
    expect(sargamNote(13)).toEqual({ syllable: 'Re', kind: 'komal', octave: 1, semitone: 1 });
    const sindhuBhairavi = ['S', 'R2', 'g2', 'M1', 'P', 'd1', 'n2', 'S', 'S', 'n2', 'd1', 'P', 'M1', 'g2', 'r1', 'S'];
    expect(noteNameIn(10, 13, sindhuBhairavi)).toBe('Cb');
    expect(noteNameIn(10, -5, sindhuBhairavi)).toBe('F');
    expect(noteNameIn(7, 6, ['S', 'R2', 'G3', 'P', 'D2'])).toBe('C#'); // not in the raga: sharp key, sharp name
  });
});

describe('bansuri', () => {
  it('fingers Sa with the top three holes and overblows Pa and above', () => {
    const line = bansuriLine(['S', 'R2', 'G3', 'M1', 'P', 'D2', 'N3', 'S']);
    expect(line.map((n) => n.holes.join(''))).toEqual([
      '111000',
      '110000',
      '100000',
      '0.500000',
      '111111',
      '111110',
      '111100',
      '111000',
    ]);
    expect(line.map((n) => n.register)).toEqual([0, 0, 0, 0, 1, 1, 1, 1]);
  });

  it('half-closes a hole for komal notes and opens all for tivra Ma', () => {
    const line = bansuriLine(['S', 'r1', 'g2', 'M2', 'd1', 'n2']);
    expect(line.map((n) => n.holes.join(''))).toEqual(['111000', '110.5000', '10.50000', '000000', '111110.5', '11110.50']);
  });
});

describe('tabla', () => {
  const taals = {
    keherwa: { system: 'hindustani', beats: 8, bols: ['dha', 'ge', 'na', 'ti', 'na', 'ka', 'dhi', 'na'] },
    adi: { system: 'carnatic', beats: 8, bols: null },
    mishrachapu: { system: 'carnatic', beats: 7, bols: ['ta', 'ki', 'ta', 'ta', 'ka', 'dhi', 'mi'] },
  };

  it('plays the theka twice as fast for dugun', () => {
    expect(dugun(taals.keherwa.bols)).toEqual(['dhage', 'nati', 'naka', 'dhina', 'dhage', 'nati', 'naka', 'dhina']);
    expect(dugun(['tin', 'tin', 'na'])).toEqual(['tintin', 'natin', 'tinna']);
    expect(dugun([])).toEqual([]);
  });

  it('explains each stroke once, skipping unknown bols', () => {
    expect(bolGuide(['dha', 'ge', 'Dha', 'xyz']).map((b) => b.bol)).toEqual(['dha', 'ge']);
    expect(bolGuide(['na'])[0].stroke).toBe('dayan (right): sharp stroke on the rim');
  });

  it("uses the song's Hindustani counterpart for a Carnatic taal", () => {
    expect(tablaTaal({ id: 'keherwa', alt: 'adi' }, taals)).toEqual({ id: 'keherwa', taal: taals.keherwa, borrowed: false });
    expect(tablaTaal({ id: 'adi', alt: 'keherwa' }, taals)).toEqual({ id: 'keherwa', taal: taals.keherwa, borrowed: true });
    expect(tablaTaal({ id: 'mishrachapu' }, taals)).toBeNull();
  });
});
