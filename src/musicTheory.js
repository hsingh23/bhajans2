// @ts-nocheck
// Small music helpers for musician mode: swaras to note names in the song's
// key, Roman-numeral chords to chord names, and taal counting. No dependencies.

// Swara tokens (music-data-spec.md): S r1 R2 g2 G3 M1 M2 P d1 D2 n2 N3 = 0..11
// semitones above Sa. The traditional Carnatic spellings are accepted too.
const SEMITONES = {
  S: 0, r1: 1, R1: 1, R2: 2, G1: 2, g2: 3, G2: 3, R3: 3, G3: 4, M1: 5, M2: 6, P: 7,
  d1: 8, D1: 8, D2: 9, N1: 9, n2: 10, N2: 10, D3: 10, N3: 11,
};
// Scale degree of each swara letter, so a seven-note raga uses each letter name once.
const DEGREE = { S: 1, R: 2, G: 3, M: 4, P: 5, D: 6, N: 7 };

const LETTERS = 'CDEFGAB';
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
/** The usual name of each key, used when there is no raga to spell from. */
export const KEY_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const KATTAI = ['1', '1.5', '2', '2.5', '3', '4', '4.5', '5', '5.5', '6', '6.5', '7'];

const mod12 = (n) => ((n % 12) + 12) % 12;
const isPc = (pc) => Number.isInteger(pc) && pc >= 0 && pc < 12;
const accidental = (n) => (n > 0 ? '#'.repeat(n) : 'b'.repeat(-n));
// Signed distance from a letter's natural note to a pitch class, -5..6.
const offsetFrom = (pc, letterPc) => {
  const d = mod12(pc - letterPc);
  return d > 6 ? d - 12 : d;
};

/** Parses a swara token ("R2", "n2", "S'") into its semitone and scale degree. */
export const parseSwara = (token) => {
  const clean = String(token || '').replace(/[^A-Za-z0-9]/g, '');
  const semitone = SEMITONES[clean];
  if (semitone === undefined) return null;
  return { token: clean, semitone, degree: DEGREE[clean[0].toUpperCase()] };
};

export const kattaiFor = (pc) => (isPc(pc) ? KATTAI[pc] : undefined);

const spellWith = (letterIndex, saPc, semitone, degree) => {
  const li = (letterIndex + degree - 1) % 7;
  const off = offsetFrom(mod12(saPc + semitone), LETTER_PC[li]);
  return { name: LETTERS[li] + accidental(off), cost: Math.abs(off) > 1 ? 10 : Math.abs(off) };
};

/**
 * Picks how to spell a key: which letter Sa sits on (C# or Db?) so the
 * raga's notes need the fewest accidentals and never a double sharp or flat.
 */
export const keySpelling = (saPc, swaras = []) => {
  if (!isPc(saPc)) return null;
  const parsed = swaras.map(parseSwara).filter(Boolean);
  const candidates = [0, 1, 2, 3, 4, 5, 6].filter((li) => Math.abs(offsetFrom(saPc, LETTER_PC[li])) <= 1);
  let best = null;
  for (const li of candidates) {
    const tonic = LETTERS[li] + accidental(offsetFrom(saPc, LETTER_PC[li]));
    const cost =
      parsed.reduce((sum, s) => sum + spellWith(li, saPc, s.semitone, s.degree).cost, 0) +
      Math.abs(offsetFrom(saPc, LETTER_PC[li])) * 0.1 +
      (tonic === KEY_NAMES[saPc] ? 0 : 0.05);
    if (!best || cost < best.cost) best = { letterIndex: li, tonic, cost };
  }
  const flats = best.tonic.includes('b') || best.tonic === 'F';
  return { saPc, letterIndex: best.letterIndex, tonic: best.tonic, flats };
};

const nameIn = (spelling, semitone, degree) => {
  const { name, cost } = spellWith(spelling.letterIndex, spelling.saPc, semitone, degree);
  if (cost < 10) return name;
  return (spelling.flats ? FLAT_NAMES : SHARP_NAMES)[mod12(spelling.saPc + semitone)];
};

/**
 * Concrete notes for swaras in a key, e.g. Mohanam (S R2 G3 P D2) with Sa = G
 * (pc 7) gives G A B D E. Unknown tokens are skipped.
 */
export const swarasToNotes = (swaras = [], saPc, spelling = keySpelling(saPc, swaras)) => {
  if (!spelling) return [];
  return swaras
    .map(parseSwara)
    .filter(Boolean)
    .map((s) => nameIn(spelling, s.semitone, s.degree));
};

/** True for a pitch class 0-11 (0 = C). */
export const isPitchClass = isPc;

/**
 * The raga's distinct notes from Sa upward, spelled like the scale rows
 * (Sindhu Bhairavi on Bb gives Bb Cb C Db Eb F Gb Ab).
 */
export const scaleNotes = (swaras = [], saPc) => {
  const spelling = keySpelling(saPc, swaras);
  if (!spelling) return [];
  const bySemitone = new Map();
  for (const s of swaras.map(parseSwara).filter(Boolean)) {
    if (!bySemitone.has(s.semitone)) bySemitone.set(s.semitone, s);
  }
  return [...bySemitone.values()]
    .sort((a, b) => a.semitone - b.semitone)
    .map((s) => nameIn(spelling, s.semitone, s.degree));
};

/** Semitones above Sa (0-11) that the swaras use. */
export const swaraSemitones = (swaras = []) => [
  ...new Set(swaras.map(parseSwara).filter(Boolean).map((s) => s.semitone)),
];

const KEY_SENTENCE = /^Sing in [A-G][#b]? \([\d.]+ kattai\)\./;
const SUMMARY_NOTES = /(\): )[A-G][#b]?(?: [A-G][#b]?)*(?=[,.])/;

/**
 * The generated summary ("Sing in Bb (6.5 kattai). Raga ...: Bb Cb C ...") re-told
 * with Sa on saPc. Returns null when the summary does not have the generated
 * shape, so a caller never shows a key the reader did not choose.
 */
const NOTE_RUN = /(?:^|[\s:(])[A-G][#b]?(?: [A-G][#b]?){2,}(?=$|[\s,.)])/g;

export const summaryInKey = (summary, saPc, swaras = []) => {
  if (!summary || !isPc(saPc) || !KEY_SENTENCE.test(summary)) return null;
  // Every list of notes must be the generated one we can re-spell; anything else would go stale.
  const rest = summary.replace(KEY_SENTENCE, '');
  const runs = rest.match(NOTE_RUN)?.length || 0;
  if (runs > (SUMMARY_NOTES.test(rest) ? 1 : 0)) return null;
  return summary
    .replace(KEY_SENTENCE, `Sing in ${keyName(saPc, swaras)} (${kattaiFor(saPc)} kattai).`)
    .replace(SUMMARY_NOTES, (_, lead) => lead + scaleNotes(swaras, saPc).join(' '));
};

/** Name of the song's key: spelled from its first raga when there is one ("Db", "C#"). */
export const keyName = (saPc, swaras) => {
  if (!isPc(saPc)) return undefined;
  return swaras?.length ? keySpelling(saPc, swaras).tonic : KEY_NAMES[saPc];
};

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const NUMERAL = /^([b#♭♯]?)(VII|VI|V|IV|III|II|I|vii|vi|v|iv|iii|ii|i)(.*)$/;
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

const qualityFor = (lower, suffix) => {
  const s = suffix.trim();
  if (/^(°|o|dim)/.test(s)) return 'dim' + s.replace(/^(°|o|dim)/, '');
  if (/^ø/.test(s)) return 'm7b5';
  if (/^\+5?$/.test(s)) return 'aug';
  if (/^\+9$/.test(s)) return (lower ? 'm' : '') + 'add9';
  return (lower ? 'm' : '') + s;
};

/**
 * Turns Roman numerals (relative to Sa) into chord names in the song's key.
 * A degree without an accidental takes the raga's own note for that degree
 * when it has exactly one (so VI in Natabhairavi on A is F), else the major
 * scale (or natural minor when the progression starts on a minor i).
 */
export const chordsInKey = (numerals = [], saPc, swaras = []) => {
  const spelling = keySpelling(saPc, swaras);
  if (!spelling) return [];
  const parsed = swaras.map(parseSwara).filter(Boolean);
  const minorKey = /^i(?![iv])/.test(String(numerals[0] || ''));
  return numerals.map((numeral) => {
    const match = NUMERAL.exec(String(numeral).trim());
    if (!match) return { numeral, chord: null };
    const [, acc, roman, suffix] = match;
    const degree = ROMAN.indexOf(roman.toUpperCase()) + 1;
    let semitone;
    if (acc) {
      semitone = MAJOR[degree - 1] + (acc === 'b' || acc === '♭' ? -1 : 1);
    } else {
      const options = [...new Set(parsed.filter((s) => s.degree === degree).map((s) => s.semitone))];
      semitone = options.length === 1 ? options[0] : (minorKey ? MINOR : MAJOR)[degree - 1];
    }
    const root = nameIn(spelling, mod12(semitone), degree);
    return { numeral, chord: root + qualityFor(roman === roman.toLowerCase(), suffix) };
  });
};

const range = (n) => Array.from({ length: n }, (_, i) => i + 1);

/** "4/4" -> [4, 4] */
export const parseTimeSignature = (text) => {
  const match = /(\d+)\s*\/\s*(\d+)/.exec(String(text || ''));
  return match ? [Number(match[1]), Number(match[2])] : null;
};

/**
 * What to count along to, e.g. "count 1-2-3-4 at ~96 BPM". A dotted-quarter
 * pulse counts each group of three eighths once (6/8 -> "1-2").
 */
export const countPhrase = (t = {}, taal = {}) => {
  const ts = parseTimeSignature(t.ts) || parseTimeSignature(taal?.western);
  let counts;
  if (ts) counts = t.pulse === 'dotted-quarter' && ts[0] % 3 === 0 ? ts[0] / 3 : ts[0];
  else counts = t.b || taal?.beats;
  if (!counts || counts > 16) return null;
  const phrase = `count ${range(counts).join('-')}`;
  const tempo = Number(t.bpm) > 0 ? ` at ~${Math.round(t.bpm)} BPM` : '';
  const feel =
    t.sub === 3 ? (t.pulse === 'dotted-quarter' ? ', each count split in three' : ', with a triplet (swing) feel') : '';
  return phrase + tempo + feel;
};

const MARKS = [
  [/^X$/i, 'clap (sam)'],
  [/^0$/, 'wave'],
  [/^\d+$/, 'clap'],
  [/^I\d+$/, 'clap + finger counts'],
  [/^O$/, 'clap, wave'],
  [/^U$/, 'clap'],
];
export const markMeaning = (mark) => MARKS.find(([re]) => re.test(mark))?.[1];

/**
 * Splits a taal's theka into its vibhags (sections) with the clap/wave mark
 * of each. Returns null when the reference has nothing to show.
 */
export const thekaGroups = (taal) => {
  if (!taal) return null;
  const bols = Array.isArray(taal.bols) ? taal.bols : null;
  const vibhag =
    Array.isArray(taal.vibhag) && taal.vibhag.length && taal.vibhag.every((n) => Number.isInteger(n) && n > 0)
      ? taal.vibhag
      : null;
  if (!vibhag) return bols ? [{ mark: null, cells: bols.map((bol, i) => ({ beat: i + 1, bol })) }] : null;
  const marks = typeof taal.clap === 'string' ? taal.clap.trim().split(/\s+/) : [];
  const useMarks = marks.length === vibhag.length && marks.every((m) => markMeaning(m));
  let beat = 0;
  return vibhag.map((size, group) => ({
    mark: useMarks ? marks[group] : null,
    cells: range(size).map(() => {
      beat += 1;
      return { beat, bol: bols?.[beat - 1] };
    }),
  }));
};
