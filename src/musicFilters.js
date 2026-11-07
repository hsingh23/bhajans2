// @ts-nocheck
// Musician filters for the search page: key, raga, scale type, major/minor, taal, tempo and chords.
// Each facet turns a song's music entry into the values it can be filtered by, so the
// dropdown counts and the filtering share one definition.
import { KEY_NAMES, kattaiFor } from './musicTheory';
import { RAGA_SURE, SHRUTI_SURE, TAAL_SURE, ragaName, taalName } from './MusicChips';

const sure = (part, threshold) => typeof part?.c !== 'number' || part.c >= threshold;
const ragaParts = (entry) => (Array.isArray(entry?.r) ? entry.r.filter((r) => r?.id) : []);

const TEMPOS = [
  ['slow', 'Slow (under 80 BPM)', (bpm) => bpm < 80],
  ['medium', 'Medium (80-129 BPM)', (bpm) => bpm >= 80 && bpm < 130],
  ['fast', 'Fast (130+ BPM)', (bpm) => bpm >= 130],
];

const THIRDS = { major: 'Major (natural 3rd)', minor: 'Minor (flat 3rd)', both: 'Both 3rds', none: 'No 3rd' };
const SCALE_SIZES = { 5: 'Pentatonic (5 notes)', 6: 'Hexatonic (6 notes)', 7: 'Heptatonic (7 notes)' };
const scaleLabel = (n) => SCALE_SIZES[n] || (n > 7 ? 'Mixed (both forms of a note)' : `${n} notes`);

/**
 * Facet definitions, in display order. `values(entry, music, { sureOnly })` lists the
 * filter values a song has; `label(value, music)` names a value, `title` names the dropdown; `order` sorts the options
 * (default: most songs first).
 */
export const MUSIC_FACETS = [
  {
    id: 'key',
    title: 'Key',
    allLabel: 'Any key',
    values: (e, _m, { sureOnly }) => (Number.isInteger(e?.sh?.pc) && (!sureOnly || sure(e.sh, SHRUTI_SURE)) ? [String(e.sh.pc)] : []),
    label: (v) => `${KEY_NAMES[v]} · ${kattaiFor(Number(v))} kattai`,
    order: (a, b) => Number(a) - Number(b),
  },
  {
    id: 'raga',
    title: 'Raga',
    allLabel: 'Any raga',
    values: (e, _m, { sureOnly }) => ragaParts(e).filter((r) => !sureOnly || sure(r, RAGA_SURE)).map((r) => r.id),
    label: (v, m) => ragaName(m?.ragas, v),
  },
  {
    id: 'scale',
    title: 'Scale',
    allLabel: 'Any scale',
    values: (e, m) => {
      const pcs = m?.ragas?.[ragaParts(e)[0]?.id]?.pcs;
      return Array.isArray(pcs) && pcs.length ? [String(pcs.length)] : [];
    },
    label: (v) => scaleLabel(Number(v)),
    order: (a, b) => Number(a) - Number(b),
  },
  {
    id: 'third',
    title: 'Major / minor',
    allLabel: 'Major or minor',
    // The raga's 3rd decides whether a Western ear hears it as major or minor.
    values: (e, m) => {
      const pcs = m?.ragas?.[ragaParts(e)[0]?.id]?.pcs;
      if (!Array.isArray(pcs) || !pcs.length) return [];
      const major = pcs.includes(4);
      const minor = pcs.includes(3);
      return [major && minor ? 'both' : major ? 'major' : minor ? 'minor' : 'none'];
    },
    label: (v) => THIRDS[v] || v,
    order: (a, b) => Object.keys(THIRDS).indexOf(a) - Object.keys(THIRDS).indexOf(b),
  },
  {
    id: 'taal',
    title: 'Taal',
    allLabel: 'Any taal',
    values: (e, _m, { sureOnly }) => (e?.t?.id && (!sureOnly || sure(e.t, TAAL_SURE)) ? [e.t.id] : []),
    label: (v, m) => {
      const beats = m?.taals?.[v]?.beats;
      return beats ? `${taalName(m?.taals, v)} · ${beats} beats` : taalName(m?.taals, v);
    },
  },
  {
    id: 'tempo',
    title: 'Tempo',
    allLabel: 'Any tempo',
    values: (e, _m, { sureOnly }) => {
      const bpm = e?.t?.bpm;
      if (typeof bpm !== 'number' || (sureOnly && !sure(e.t, TAAL_SURE))) return [];
      return TEMPOS.filter(([, , test]) => test(bpm)).map(([id]) => id);
    },
    label: (v) => TEMPOS.find(([id]) => id === v)?.[1] || v,
    order: (a, b) => TEMPOS.findIndex(([id]) => id === a) - TEMPOS.findIndex(([id]) => id === b),
  },
  {
    id: 'chords',
    title: 'Chords',
    allLabel: 'Any',
    values: (e) => (Array.isArray(e?.ch) && e.ch.length ? ['yes'] : []),
    label: () => 'Has chords',
  },
];

export const EMPTY_MUSIC_FILTERS = Object.freeze({ sureOnly: false });

export const activeMusicFilters = (filters = {}) => MUSIC_FACETS.some((f) => filters[f.id]);

/** Does this song's music entry pass every chosen facet (optionally ignoring one)? */
export const matchesMusic = (entry, music, filters = {}, skip) =>
  MUSIC_FACETS.every((f) => f.id === skip || !filters[f.id] || f.values(entry, music, filters).includes(filters[f.id]));

/** Option counts per facet over the given song names, each facet ignoring its own choice. */
export const musicFacetCounts = (names, music, filters = {}) => {
  const counts = Object.fromEntries(MUSIC_FACETS.map((f) => [f.id, {}]));
  for (const name of names) {
    const entry = music?.songs?.[name];
    if (!entry) continue;
    for (const f of MUSIC_FACETS) {
      if (!matchesMusic(entry, music, filters, f.id)) continue;
      for (const v of f.values(entry, music, filters)) counts[f.id][v] = (counts[f.id][v] || 0) + 1;
    }
  }
  return counts;
};

/** Words a musician might type for this song: raga names (and Hindustani names), taal names. */
export const musicSearchText = (entry, music) => {
  if (!entry) return '';
  const words = [];
  for (const r of ragaParts(entry)) {
    const raga = music?.ragas?.[r.id];
    words.push(r.id, raga?.name, raga?.hi);
  }
  if (entry.t?.id) words.push(entry.t.id, music?.taals?.[entry.t.id]?.name);
  if (entry.t?.alt) words.push(entry.t.alt, music?.taals?.[entry.t.alt]?.name);
  return words.filter(Boolean).join(' ');
};
