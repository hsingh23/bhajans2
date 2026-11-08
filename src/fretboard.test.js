// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { chordShape, chordTones, scaleTab, swaraLine, tabLines } from './fretboard';

const shape = (instrument, name) => chordShape(instrument, name)?.map((f) => (f < 0 ? 'x' : f)).join('');

describe('chord tones', () => {
  it('reads the root and quality of a chord name', () => {
    expect(chordTones('C')).toEqual({ root: 0, tones: [0, 4, 7], fifth: null });
    expect(chordTones('Bbm7')).toEqual({ root: 10, tones: [10, 1, 5, 8], fifth: 5 });
    expect(chordTones('F#dim').tones).toEqual([6, 9, 0]);
    expect(chordTones('Gsus4').tones).toEqual([7, 0, 2]);
    expect(chordTones('Gaug5').tones).toEqual([7, 11, 3]);
    expect(chordTones('Cadd9').tones).toEqual([0, 4, 7, 2]);
    expect(chordTones('nope')).toBeNull();
  });

  it('honours an altered fifth and refuses what it cannot read', () => {
    expect(chordTones('Am-5').tones).toEqual([9, 0, 3]);
    expect(chordTones('F-5').tones).toEqual([5, 9, 11]);
    expect(chordTones('C#5').tones).toEqual([1, 8]); // C# power chord, not an altered C
    expect(chordTones('Cm#5').tones).toEqual([0, 3, 8]);
    expect(chordTones('Dm-')).toBeNull();
    expect(chordTones('Amn')).toBeNull();
    expect(chordShape('guitar', 'Am-5')).not.toEqual(chordShape('guitar', 'Am'));
    expect(chordShape('guitar', 'Dm(')).toBeNull();
  });
});

describe('chord shapes', () => {
  it('finds the usual open guitar shapes, root in the bass', () => {
    expect(shape('guitar', 'C')).toBe('x32010');
    expect(shape('guitar', 'G')).toBe('320003');
    expect(shape('guitar', 'D')).toBe('xx0232');
    expect(shape('guitar', 'A')).toBe('x02220');
    expect(shape('guitar', 'E')).toBe('022100');
    expect(shape('guitar', 'Am')).toBe('x02210');
    expect(shape('guitar', 'Em')).toBe('022000');
    expect(shape('guitar', 'Dm')).toBe('xx0231');
    expect(shape('guitar', 'E7')).toBe('020100');
    expect(shape('guitar', 'B7')).toBe('x21202');
  });

  it('uses a barre rather than a stretch with open strings', () => {
    expect(shape('guitar', 'F')).toBe('133211');
    expect(shape('guitar', 'Bm')).toBe('x24432');
    expect(shape('guitar', 'C#m')).toBe('x46654');
  });

  it('finds the usual ukulele shapes', () => {
    expect(shape('ukulele', 'C')).toBe('0003');
    expect(shape('ukulele', 'G')).toBe('0232');
    expect(shape('ukulele', 'F')).toBe('2010');
    expect(shape('ukulele', 'Am')).toBe('2000');
    expect(shape('ukulele', 'Dm')).toBe('2210');
    expect(shape('ukulele', 'D')).toBe('2220');
    expect(shape('ukulele', 'G7')).toBe('0212');
    expect(shape('ukulele', 'Bb')).toBe('3211');
  });

  it('returns null for an unknown instrument or chord', () => {
    expect(chordShape('banjo', 'C')).toBeNull();
    expect(chordShape('guitar', '?')).toBeNull();
  });
});

describe('scale tabs', () => {
  it('follows the sung line up and down an octave, including zig-zag steps', () => {
    expect(swaraLine(['S', 'R2', 'G3', 'P', 'D2', 'S'])).toEqual([0, 2, 4, 7, 9, 12]);
    expect(swaraLine(['S', 'D2', 'P', 'G3', 'R2', 'S'], true)).toEqual([12, 9, 7, 4, 2, 0]);
    expect(swaraLine(['S', 'R2', 'G3', 'R2', 'M1', 'P', 'S'])).toEqual([0, 2, 4, 2, 5, 7, 12]);
  });

  it('keeps vakra turns inside the octave, large or small (Desh, Kadanakuthuhalam)', () => {
    const deshDown = ['S', 'n2', 'D2', 'P', 'D2', 'M1', 'G3', 'R2', 'P', 'M1', 'G3', 'R2', 'G3', 'N3', 'S'];
    expect(swaraLine(deshDown, true)).toEqual([12, 10, 9, 7, 9, 5, 4, 2, 7, 5, 4, 2, 4, -1, 0]);
    expect(swaraLine(['S', 'R2', 'M1', 'D2', 'N3', 'G3', 'P', 'S'])).toEqual([0, 2, 5, 9, 11, 4, 7, 12]);
    expect(swaraLine(['S', 'd1', 'n2', 'P', 'M1', 'P', 'g2', 'M1', 'R2', 'S'], true)).toEqual([12, 8, 10, 7, 5, 7, 3, 5, 2, 0]);
  });

  it('keeps an ascending leap going up (Hamirkalyani: S P M2 P D2 N3 S)', () => {
    expect(swaraLine(['S', 'P', 'M2', 'P', 'D2', 'N3', 'S'])).toEqual([0, 7, 6, 7, 9, 11, 12]);
  });

  it('starts below Sa when an aroha opens on Pa-Ni, and follows an avaroha past lower Sa', () => {
    expect(swaraLine(['N3', 'S', 'G3', 'M1', 'P', 'N3', 'S'])).toEqual([-1, 0, 4, 5, 7, 11, 12]); // Behag
    expect(swaraLine(['n2', 'S', 'R2', 'g2', 'R2', 'S', 'M1', 'P', 'd1', 'n2', 'S'])).toEqual([-2, 0, 2, 3, 2, 0, 5, 7, 8, 10, 12]); // Darbari
    expect(swaraLine(['n2', 'D2', 'P', 'M1', 'G3', 'R2', 'S', 'n2', 'D2', 'P', 'D2', 'S'], true)).toEqual([
      10, 9, 7, 5, 4, 2, 0, -2, -3, -5, -3, 0,
    ]); // Chenchurutti
    expect(swaraLine(['M1', 'G3', 'R2', 'S', 'N3', 'D2', 'P'], true)).toEqual([5, 4, 2, 0, -1, -3, -5]); // Navaroj
  });

  it('writes Mohanam in G as guitar tab with the note names on top', () => {
    const placed = scaleTab('guitar', 7, ['S', 'R2', 'G3', 'P', 'D2', 'S']);
    expect(tabLines('guitar', placed, ['G', 'A', 'B', 'D', 'E', 'G'])).toEqual([
      '   G A B D E G',
      'e|---------0-3-|',
      'B|-----0-3-----|',
      'G|-0-2---------|',
      'D|-------------|',
      'A|-------------|',
      'E|-------------|',
    ]);
  });

  it('keeps every note on the ukulele, re-entrant G string included', () => {
    const placed = scaleTab('ukulele', 0, ['S', 'R2', 'G3', 'M1', 'P', 'D2', 'N3', 'S']);
    expect(placed).toHaveLength(8);
    const open = [67, 60, 64, 69];
    expect(placed.map(({ string, fret }) => open[string] + fret)).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
  });

  it('folds notes outside the instrument by an octave rather than giving up (Chenchurutti down in Eb on ukulele)', () => {
    const chenchurutti = ['n2', 'D2', 'P', 'M1', 'G3', 'R2', 'S', 'n2', 'D2', 'P', 'D2', 'S'];
    const placed = scaleTab('ukulele', 3, chenchurutti, true);
    expect(placed).toHaveLength(12);
    expect(placed.some((spot) => spot.folded)).toBe(true);
    expect(placed.every(({ fret }) => fret >= 0 && fret <= 15)).toBe(true);
  });

  it('gives nothing without a key or an instrument', () => {
    expect(scaleTab('guitar', undefined, ['S'])).toBeNull();
    expect(scaleTab('banjo', 0, ['S'])).toBeNull();
    expect(tabLines('guitar', null)).toEqual([]);
  });
});
