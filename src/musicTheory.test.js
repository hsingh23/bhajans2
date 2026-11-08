// @ts-nocheck
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import {
  scaleNotes,
  summaryInKey,
  swarasToNotes,
  keyName,
  kattaiFor,
  chordsInKey,
  countPhrase,
  thekaGroups,
  parseSwara,
} from './musicTheory';
import reference from './__fixtures__/music-reference.json';

const { mohanam, natabhairavi, hindolam } = reference.ragas;

describe('swaras to notes in the song key', () => {
  it('puts Mohanam on G (pc 7) as G A B D E', () => {
    expect(swarasToNotes(['S', 'R2', 'G3', 'P', 'D2'], 7)).toEqual(['G', 'A', 'B', 'D', 'E']);
    expect(swarasToNotes(mohanam.avaroha, 7).join(' ')).toBe('G E D B A G');
  });

  it('puts Natabhairavi on A as the A natural minor scale', () => {
    expect(swarasToNotes(natabhairavi.aroha, 9).join(' ')).toBe('A B C D E F G A');
  });

  it('spells each letter once, with flats or sharps as the key needs', () => {
    expect(swarasToNotes(natabhairavi.aroha, 7).join(' ')).toBe('G A Bb C D Eb F G');
    expect(swarasToNotes(natabhairavi.aroha, 6).join(' ')).toBe('F# G# A B C# D E F#');
    expect(swarasToNotes(mohanam.aroha, 1).join(' ')).toBe('Db Eb F Ab Bb Db');
    expect(swarasToNotes(hindolam.aroha, 0).join(' ')).toBe('C Eb F Ab Bb C');
  });

  it('skips unknown tokens and reads octave marks', () => {
    expect(parseSwara("S'")).toMatchObject({ semitone: 0, degree: 1 });
    expect(swarasToNotes(['S', 'X9', 'P'], 0)).toEqual(['C', 'G']);
    expect(swarasToNotes(['S', 'P'], undefined)).toEqual([]);
  });

  it('names keys and kattai', () => {
    expect(keyName(7)).toBe('G');
    expect(keyName(1, natabhairavi.aroha)).toBe('C#');
    expect(keyName(1, mohanam.aroha)).toBe('Db');
    expect(keyName(null)).toBeUndefined();
    expect(kattaiFor(7)).toBe('5');
    expect(kattaiFor(1)).toBe('1.5');
    expect(kattaiFor(12)).toBeUndefined();
  });
});

describe('chords in the song key', () => {
  it('turns Roman numerals into chords', () => {
    expect(chordsInKey(['I', 'IV', 'V', 'vi'], 7, mohanam.aroha).map((c) => c.chord)).toEqual(['G', 'C', 'D', 'Em']);
  });

  it("uses the raga's own note for each degree", () => {
    const chords = chordsInKey(['i', 'iv', 'v', 'VI'], 9, [...natabhairavi.aroha, ...natabhairavi.avaroha]);
    expect(chords.map((c) => c.chord)).toEqual(['Am', 'Dm', 'Em', 'F']);
  });

  it('handles accidentals, sevenths and diminished chords', () => {
    expect(chordsInKey(['bVII7', 'ii°', 'V7'], 0).map((c) => c.chord)).toEqual(['Bb7', 'Ddim', 'G7']);
    expect(chordsInKey(['??'], 0)).toEqual([{ numeral: '??', chord: null }]);
  });
});

describe('taal counting', () => {
  it('counts quarter-note bars beat by beat', () => {
    expect(countPhrase({ ts: '4/4', bpm: 96, pulse: 'quarter', sub: 2 })).toBe('count 1-2-3-4 at ~96 BPM');
  });

  it('counts 6/8 in two', () => {
    expect(countPhrase({ ts: '6/8', bpm: 66, pulse: 'dotted-quarter', sub: 3 })).toBe(
      'count 1-2 at ~66 BPM, each count split in three'
    );
  });

  it("falls back to the taal's time signature or beat count", () => {
    expect(countPhrase({}, { western: '7/8 (3+2+2)' })).toBe('count 1-2-3-4-5-6-7');
    expect(countPhrase({ b: 3 })).toBe('count 1-2-3');
    expect(countPhrase({})).toBeNull();
  });

  it('groups the theka by vibhag with clap and wave marks', () => {
    const groups = thekaGroups(reference.taals.keherwa);
    expect(groups.map((g) => g.mark)).toEqual(['X', '0']);
    expect(groups[1].cells.map((c) => c.bol)).toEqual(['na', 'ka', 'dhi', 'na']);
  });

  it('shows beat numbers when there are no bols, and tolerates odd data', () => {
    const adi = thekaGroups(reference.taals.adi);
    expect(adi.map((g) => g.mark)).toEqual(['I4', 'O', 'O']);
    expect(adi[2].cells.map((c) => c.beat)).toEqual([7, 8]);
    expect(thekaGroups({ vibhag: 'I4 O O', clap: 'clap, pinky' })).toBeNull();
    expect(thekaGroups({ vibhag: [4, 4], clap: 'clap on 1, wave on 5', bols: null })[0].mark).toBeNull();
    expect(thekaGroups(undefined)).toBeNull();
  });
});

describe('chord names from the data', () => {
  it('reads + as augmented only on its own or with 5; +9 is an added ninth', () => {
    expect(chordsInKey(['V+5', 'I+', 'i+9', 'I+9'], 0).map((c) => c.chord)).toEqual(['Gaug', 'Caug', 'Cmadd9', 'Cadd9']);
  });
});

describe('generated musician summaries', () => {
  // build_music_json.py writes the "en" summary; its key and notes must read
  // exactly like the app's Key line and Up / Down rows (Cb, not B, in Bb Sindhu Bhairavi).
  const read = (file) => JSON.parse(readFileSync(`${process.cwd()}/public/${file}`, 'utf8'));
  const songs = read('bhajan-music.json');
  const { ragas } = read('music-reference.json');

  it('spells the key and scale notes the way the app does', () => {
    const mismatches = [];
    for (const [name, entry] of Object.entries(songs)) {
      if (!entry.sh || !entry.en) continue;
      const raga = entry.r?.[0] && ragas[entry.r[0].id];
      const swaras = raga ? [...raga.aroha, ...raga.avaroha] : undefined;
      if (!entry.en.startsWith(`Sing in ${keyName(entry.sh.pc, swaras)} (`)) mismatches.push(name);
      if (!raga) continue;
      const notes = entry.en.match(/\): ([A-G][#b]?(?: [A-G][#b]?)*)[,.]/)?.[1].split(' ') || [];
      const app = new Set(swarasToNotes(swaras, entry.sh.pc));
      if (notes.length !== app.size || notes.some((note) => !app.has(note))) mismatches.push(name);
    }
    expect(mismatches).toEqual([]);
  });

  it('re-tells every summary unchanged in its own key, so transposing uses the same wording', () => {
    const changed = Object.entries(songs)
      .filter(([, e]) => e.sh && e.en)
      .filter(([, e]) => {
        const raga = e.r?.[0] && ragas[e.r[0].id];
        return summaryInKey(e.en, e.sh.pc, raga ? [...raga.aroha, ...raga.avaroha] : []) !== e.en;
      })
      .map(([name]) => name);
    expect(changed).toEqual([]);
  });
});

describe('transposing', () => {
  const sindhuBhairavi = ['S', 'R2', 'g2', 'M1', 'P', 'd1', 'n2', 'S', 'S', 'n2', 'd1', 'P', 'M1', 'g2', 'r1', 'S'];

  it("lists a raga's notes from Sa up, spelled like the scale rows", () => {
    expect(scaleNotes(sindhuBhairavi, 10)).toEqual(['Bb', 'Cb', 'C', 'Db', 'Eb', 'F', 'Gb', 'Ab']);
    expect(scaleNotes(sindhuBhairavi, 7)).toEqual(['G', 'Ab', 'A', 'Bb', 'C', 'D', 'Eb', 'F']);
    expect(scaleNotes(sindhuBhairavi, undefined)).toEqual([]);
  });

  it('re-tells a generated summary in another key', () => {
    const summary =
      'Sing in Bb (6.5 kattai). Raga close to Sindhu Bhairavi (Phrygian/Aeolian blend): Bb Cb C Db Eb F Gb Ab. 8-beat Keherwa (4/4): count 1-2-3-4 at about 158 BPM.';
    expect(summaryInKey(summary, 7, sindhuBhairavi)).toBe(
      'Sing in G (5 kattai). Raga close to Sindhu Bhairavi (Phrygian/Aeolian blend): G Ab A Bb C D Eb F. 8-beat Keherwa (4/4): count 1-2-3-4 at about 158 BPM.'
    );
    expect(summaryInKey('Sing in D (2 kattai). A Western-style tune rather than a raga.', 4, [])).toBe(
      'Sing in E (3 kattai). A Western-style tune rather than a raga.'
    );
  });

  it('gives up on a summary it cannot re-tell rather than show a stale key or notes', () => {
    expect(summaryInKey('Sing in G (5 kattai). Major-pentatonic tune: G A B D E, no C or F#.', 9, ['S', 'R2', 'G3', 'P', 'D2'])).toBeNull();
    expect(summaryInKey('Probably sung in Eb (2.5 kattai).', 4, [])).toBeNull();
    expect(summaryInKey('', 4, [])).toBeNull();
  });
});
