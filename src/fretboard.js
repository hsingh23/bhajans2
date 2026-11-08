// @ts-nocheck
// Guitar and ukulele helpers for musician mode: where to play a raga's notes
// (tablature) and how to finger the song's chords. No dependencies.
import { parseSwara } from './musicTheory';

/** Open-string MIDI notes, lowest string first, and the range Sa is placed in. */
export const INSTRUMENTS = {
  guitar: { name: 'Guitar', open: [40, 45, 50, 55, 59, 64], strings: ['E', 'A', 'D', 'G', 'B', 'e'], saFrom: 45, bassRoot: true },
  ukulele: { name: 'Ukulele', open: [67, 60, 64, 69], strings: ['G', 'C', 'E', 'A'], saFrom: 60, bassRoot: false },
};

const MAX_FRET = 15;
const mod12 = (n) => ((n % 12) + 12) % 12;

/**
 * Semitones from Sa for a swara line in the order sung, with octaves. The
 * reference scales carry no octave marks, so the octaves are chosen for the
 * whole line at once: the path with the least total movement that stays within
 * the line's span. An aroha stays between its first note and upper Sa (Behag:
 * N3 S ... starts on lower Ni; Kadanakuthuhalam's N3 G3 P S turns back down
 * inside the octave); an avaroha starts on upper Sa (or its own first note) and
 * may dip to lower Sa. A closing S is never the Sa the line began on.
 */
export const swaraLine = (swaras = [], descending = false) => {
  const tones = swaras.map(parseSwara).filter(Boolean).map((p) => p.semitone);
  if (!tones.length) return [];
  const first = descending ? (tones[0] === 0 ? 12 : tones[0]) : tones[0] >= 7 ? tones[0] - 12 : tones[0];
  const closesOnSa = tones.length > 1 && tones[tones.length - 1] === 0;
  const [low, high] = descending ? [-12, first] : [first, Math.max(first, 0) + (closesOnSa ? 12 : 14)];
  const options = tones.map((t, i) => {
    if (i === 0) return [first];
    const out = [];
    for (let v = t - 24; v <= t + 24; v += 12) if (v >= low && v <= high) out.push(v);
    // A closing Sa is never the note the line began on (S ... S' or S' ... S).
    if (i === tones.length - 1 && closesOnSa) return out.filter((v) => v !== first);
    return out.length ? out : [t];
  });
  // Least total movement through the options (a tiny Viterbi pass).
  let cost = options[0].map(() => 0);
  const back = [];
  for (let i = 1; i < options.length; i += 1) {
    const from = [];
    cost = options[i].map((v) => {
      let best = Infinity;
      let arg = 0;
      options[i - 1].forEach((u, j) => {
        const c = cost[j] + Math.abs(v - u);
        if (c < best) {
          best = c;
          arg = j;
        }
      });
      from.push(arg);
      return best;
    });
    back.push(from);
  }
  let k = cost.indexOf(Math.min(...cost));
  const line = [options[options.length - 1][k]];
  for (let i = back.length - 1; i >= 0; i -= 1) {
    k = back[i][k];
    line.unshift(options[i][k]);
  }
  return line;
};

/** Cheapest string and fret for each pitch: few position shifts, low frets, open strings free. */
const placePitches = (pitches, open) => {
  const options = pitches.map((p) =>
    open.map((o, string) => ({ string, fret: p - o })).filter(({ fret }) => fret >= 0 && fret <= MAX_FRET)
  );
  if (options.some((o) => !o.length)) return null;
  let costs = options[0].map(({ fret }) => fret * 0.15);
  const back = [];
  for (let i = 1; i < options.length; i += 1) {
    const next = [];
    const from = [];
    options[i].forEach((cur) => {
      let best = Infinity;
      let arg = 0;
      options[i - 1].forEach((prev, j) => {
        const move = cur.fret === 0 || prev.fret === 0 ? 0 : Math.abs(cur.fret - prev.fret);
        const cost = costs[j] + move + cur.fret * 0.15;
        if (cost < best) {
          best = cost;
          arg = j;
        }
      });
      next.push(best);
      from.push(arg);
    });
    costs = next;
    back.push(from);
  }
  let k = costs.indexOf(Math.min(...costs));
  const picked = [options[options.length - 1][k]];
  for (let i = back.length - 1; i >= 0; i -= 1) {
    k = back[i][k];
    picked.unshift(options[i][k]);
  }
  return picked;
};

/**
 * Where to play a swara line on the instrument with Sa on saPc:
 * [{ string, fret }] in the order sung, or null when it does not fit.
 */
export const scaleTab = (instrument, saPc, swaras, descending = false) => {
  const inst = INSTRUMENTS[instrument];
  if (!inst || !Number.isInteger(saPc)) return null;
  const line = swaraLine(swaras, descending);
  if (!line.length) return null;
  const sa = inst.saFrom + mod12(saPc - inst.saFrom);
  for (const shift of [0, -12, 12]) {
    const placed = placePitches(line.map((v) => sa + shift + v), inst.open);
    if (placed) return placed;
  }
  // Wider than the instrument: play the notes that fall outside it an octave up or down.
  const low = Math.min(...inst.open);
  const high = Math.max(...inst.open) + MAX_FRET;
  const folded = line.map((v) => {
    let p = sa + v;
    while (p < low) p += 12;
    while (p > high) p -= 12;
    return { p, folded: p !== sa + v };
  });
  const placed = placePitches(
    folded.map(({ p }) => p),
    inst.open
  );
  return placed && placed.map((spot, i) => (folded[i].folded ? { ...spot, folded: true } : spot));
};

/**
 * Plain-text tablature, highest string on top, with the note names above the
 * frets: ["    G  A  B  D", "e|----------", ...].
 */
export const tabLines = (instrument, placed, names = []) => {
  const inst = INSTRUMENTS[instrument];
  if (!inst || !placed?.length) return [];
  const widths = placed.map(({ fret }, i) => Math.max(String(fret).length, (names[i] || '').length));
  const label = Math.max(...inst.strings.map((s) => s.length));
  const lines = [' '.repeat(label + 1) + placed.map((_, i) => ' ' + (names[i] || '').padEnd(widths[i], ' ')).join('')];
  for (let string = inst.open.length - 1; string >= 0; string -= 1) {
    const cells = placed.map(({ string: s, fret }, i) => '-' + (s === string ? String(fret) : '').padEnd(widths[i], '-'));
    lines.push(`${inst.strings[string].padEnd(label, ' ')}|${cells.join('')}-|`);
  }
  return lines;
};

const NOTE_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
// Chord quality prefixes, longest first; each consumes its text from the name.
const QUALITIES = [
  [/^(maj7|M7)/, [0, 4, 7, 11]],
  [/^(m7b5|ø7?)/, [0, 3, 6, 10]],
  [/^(dim7|°7)/, [0, 3, 6, 9]],
  [/^(dim|°)/, [0, 3, 6]],
  [/^aug/, [0, 4, 8]],
  [/^m6/, [0, 3, 7, 9]],
  [/^m7/, [0, 3, 7, 10]],
  [/^m(?!aj)/, [0, 3, 7]],
  [/^sus2/, [0, 2, 7]],
  [/^sus4?/, [0, 5, 7]],
  [/^7/, [0, 4, 7, 10]],
  [/^6/, [0, 4, 7, 9]],
  [/^(5|\(no3\))/, [0, 7]],
  [/^/, [0, 4, 7]],
];
const swapFifth = (intervals, to) => (intervals.includes(7) ? intervals.map((i) => (i === 7 ? to : i)) : null);
// What may follow the quality; anything else is a chord we cannot draw correctly.
const ALTERATIONS = [
  [/^(-5|b5|\(b5\))$/, (iv) => swapFifth(iv, 6)],
  [/^(#5|\+5|\(#5\))$/, (iv) => swapFifth(iv, 8)],
  [/^5$/, (iv) => (iv.includes(8) ? iv : null)], // "aug5" is just aug
  [/^(\+?9|add9|\(add9\))$/, (iv) => [...iv, 2]],
  [/^$/, (iv) => iv],
];

/**
 * Root and chord tones (pitch classes) of a chord name such as "Bbm7", "F#dim"
 * or "Am-5". Null when the name has a quality or alteration it cannot read,
 * so no diagram is drawn rather than a wrong one.
 */
export const chordTones = (name) => {
  const match = /^([A-G])([#b]?)(.*)$/.exec(String(name || '').trim());
  if (!match) return null;
  const [, letter, acc, quality] = match;
  const root = mod12(NOTE_PC[letter] + (acc === '#' ? 1 : acc === 'b' ? -1 : 0));
  const [re, base] = QUALITIES.find(([pattern]) => pattern.test(quality));
  const rest = quality.replace(re, '');
  const alter = ALTERATIONS.find(([pattern]) => pattern.test(rest))?.[1];
  const intervals = alter ? alter(base) : null;
  if (!intervals) return null;
  return {
    root,
    tones: intervals.map((i) => mod12(root + i)),
    fifth: intervals.length > 3 && intervals.includes(7) ? mod12(root + 7) : null,
  };
};

const product = (lists) => lists.reduce((acc, list) => acc.flatMap((a) => list.map((x) => [...a, x])), [[]]);

/**
 * A playable fingering for the chord: frets per string, lowest string first,
 * -1 = not played. Prefers open, low-position shapes with the root in the bass
 * on guitar (C = x32010, Am = x02210; ukulele C = 0003, G = 0232).
 */
export const chordShape = (instrument, name) => {
  const inst = INSTRUMENTS[instrument];
  const chord = chordTones(name);
  if (!inst || !chord) return null;
  const { root, tones, fifth } = chord;
  const needed = tones.filter((t) => t !== fifth);
  const n = inst.open.length;
  let best = null;
  for (let pos = 0; pos <= 9; pos += 1) {
    const lo = Math.max(1, pos);
    const hi = lo + 3;
    const perString = inst.open.map((o) => {
      const frets = [];
      if (pos <= 3 && tones.includes(mod12(o))) frets.push(0);
      for (let f = lo; f <= hi; f += 1) if (tones.includes(mod12(o + f))) frets.push(f);
      return inst.bassRoot ? [-1, ...frets] : frets;
    });
    for (const frets of product(perString)) {
      const sounded = frets.map((f, s) => (f < 0 ? null : mod12(inst.open[s] + f)));
      const first = frets.findIndex((f) => f >= 0);
      if (first < 0) continue;
      // Only the bass strings may be left out, and not more than two of them.
      if (frets.slice(first).some((f) => f < 0) || first > 2) continue;
      if (inst.bassRoot && sounded[first] !== root) continue;
      if (n - first < Math.min(4, n)) continue;
      if (!needed.every((t) => sounded.includes(t))) continue;
      const fretted = frets.filter((f) => f > 0);
      const low = fretted.length ? Math.min(...fretted) : 0;
      const span = fretted.length ? Math.max(...fretted) - low : 0;
      if (span > 3) continue;
      const opens = frets.filter((f) => f === 0).length;
      // On guitar, open strings only with a compact shape near the nut, not a stretch up the neck.
      if (inst.bassRoot && opens && span > 2) continue;
      const barre = fretted.length > 4;
      if (barre && (opens || fretted.filter((f) => f > low).length > 3)) continue;
      const stretch = inst.bassRoot && opens && fretted.some((f) => f >= 4) ? 3 : 0;
      const cost =
        low * 1.2 + span * 0.4 + first * 0.9 + (barre ? 1.5 : 0) + stretch - opens * 0.35 + fretted.reduce((a, f) => a + f, 0) * 0.05;
      if (!best || cost < best.cost) best = { frets, cost };
    }
  }
  return best ? best.frets : null;
};
