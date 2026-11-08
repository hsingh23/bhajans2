// @ts-nocheck
// Ranks bhajans for a typed query using the shared phonetic key (bkey.js), so that
// misspelt or differently transliterated names still put the intended song first.
// Tiers (best wins): exact key, key prefix, word-start substring, substring, token
// bag, fuzzy substring, trigram overlap; ties go to popularity, then shorter titles.
import { bengali, bkey, devoice } from './bkey';

const trigrams = (s) => {
  const padded = `  ${s} `;
  const out = new Set();
  for (let i = 0; i < padded.length - 2; i += 1) out.add(padded.slice(i, i + 3));
  return out;
};

const dice = (a, b) => {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const g of a) if (b.has(g)) shared += 1;
  return (2 * shared) / (a.size + b.size);
};

// Levenshtein distance with an early cut-off.
const editDistance = (a, b, max) => {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
};

// Sellers' approximate substring distance: the cheapest edit distance between the
// query and ANY substring of the text (cheap vowel confusions and 'a' gaps cost 0.5).
const CHEAP = new Set(['ei', 'ie', 'ou', 'uo', 'bv', 'vb', 'kg', 'gk', 'td', 'dt', 'pb', 'bp', 'cj', 'jc', 'sc', 'cs']);
const subDistance = (q, t) => {
  let prev = new Array(t.length + 1).fill(0);
  for (let i = 1; i <= q.length; i += 1) {
    const cur = [i];
    for (let j = 1; j <= t.length; j += 1) {
      const qc = q[i - 1];
      const tc = t[j - 1];
      const sub = qc === tc ? 0 : CHEAP.has(qc + tc) ? 0.5 : 1;
      cur[j] = Math.min(prev[j] + (qc === 'a' ? 0.5 : 1), cur[j - 1] + (tc === 'a' ? 0.5 : 1), prev[j - 1] + sub);
    }
    prev = cur;
  }
  return Math.min(...prev);
};

const popularity = (b) => 3 * Math.min(5, (b.l?.length ?? 0) + (b.cs?.length ? 1 : 0) + (b.sm?.length ? 1 : 0));

/** Precomputed search data for the whole index; build once per index load. */
export const buildSearchIndex = (bhajans) =>
  bhajans.map((b, i) => {
    const k = bkey(b.n);
    const lang = (b.lg || '').toLowerCase();
    const alt = lang === 'tamil' ? devoice(k.key) : lang === 'bengali' ? bengali(k.key) : null;
    return {
      i,
      key: k.key,
      joined: k.joined,
      tokens: k.tokens,
      alt: alt ? { key: alt, joined: alt.replace(/ /g, '') } : null,
      aliases: k.aliases,
      raw: `${b.n}${(b.l || []).join('')}${b.t || ''}`.toLowerCase(),
      tri: trigrams(k.joined),
      pop: popularity(b),
      y: b.y ?? null,
    };
  });

const tierScore = (q, key, joined, tokens) => {
  const { joined: qj, key: qk, tokens: qt } = q;
  if (!qj) return 0;
  if (joined === qj) return 1000;
  if (qj.length >= 3 && joined.startsWith(qj)) return 800;
  if (qj.length >= 3 && ` ${key}`.includes(` ${qk}`)) return 700;
  if (qj.length >= 3 && joined.includes(qj)) return 600;
  // token bag
  if (qt.length && tokens.length) {
    let total = 0;
    let lastPos = -1;
    let inOrder = 0;
    let anchored = 0;
    qt.forEach((t, qi) => {
      let best = 0;
      let bestPos = -1;
      tokens.forEach((n, ni) => {
        let s = 0;
        if (n === t) s = 1;
        else if (n.startsWith(t) || t.startsWith(n)) s = 0.8;
        else {
          const max = Math.max(1, Math.floor(t.length / 4));
          const e = editDistance(t, n, max);
          if (e <= max) s = 0.7 - 0.1 * e;
        }
        if (s > best) {
          best = s;
          bestPos = ni;
        }
      });
      total += best;
      if (best > 0) {
        if (bestPos > lastPos) inOrder += 1;
        if (qi === 0 && bestPos === 0) anchored = 1;
        lastPos = bestPos;
      }
    });
    const cov = total / qt.length;
    if (cov >= 0.6) return 300 + 200 * cov + (30 * inOrder) / qt.length + 20 * anchored;
  }
  return 0;
};

const fuzzyScore = (q, entry) => {
  const { joined: qj } = q;
  if (qj.length >= 4) {
    const e = subDistance(qj, entry.joined);
    if (e <= Math.max(1, qj.length / 5)) return 300 - 20 * e;
  }
  const d = dice(q.tri, entry.tri);
  return d > 0.35 ? 200 * d : 0;
};

// Year words in a query: "1985", decades "1980s" / "80s". Each becomes [first, last] year.
const YEAR = /^(19[5-9]\d|20[0-4]\d)$/;
const DECADE = /^(19[5-9]0|20[0-4]0)'?s$/;
const SHORT_DECADE = /^'?(\d0)'?s$/;

/** Splits year words out of a query: `{ rest, ranges }`, ranges empty when there are none. */
export const splitYears = (query) => {
  const ranges = [];
  const rest = [];
  for (const word of (query || '').trim().toLowerCase().split(/\s+/)) {
    let m;
    if ((m = word.match(YEAR))) ranges.push([+m[1], +m[1]]);
    else if ((m = word.match(DECADE))) ranges.push([+m[1], +m[1] + 9]);
    else if ((m = word.match(SHORT_DECADE))) {
      const start = (+m[1] >= 50 ? 1900 : 2000) + +m[1];
      ranges.push([start, start + 9]);
    } else if (word) rest.push(word);
  }
  return { rest: rest.join(' '), ranges };
};

/**
 * Indices of the bhajans matching `query`, best first. An empty query returns every
 * index in order. Location and tag text ("vol5-74", "ganesha") still match as plain
 * substrings of the name + locations + tags. Years ("1985", "1980s", "80s") filter by
 * the song's year, see splitYears.
 */
export const rankBhajans = (index, query) => {
  const rawQ = (query || '').trim().toLowerCase().replace(/\s+/g, '');
  if (!rawQ) return index.map((e) => e.i);
  const { rest, ranges } = splitYears(query);
  if (ranges.length) {
    // Year words keep songs first sung in that year or decade (`y`) and rank the rest
    // of the query among them. A lone year also still finds its book ("2020" ->
    // 2020supl pages), after the songs dated that year.
    const inYears = index.filter((e) => e.y != null && ranges.some(([lo, hi]) => e.y >= lo && e.y <= hi));
    const ranked = rankBhajans(inYears, rest);
    if (rest) return ranked;
    const seen = new Set(ranked);
    return ranked.concat(index.filter((e) => !seen.has(e.i) && e.raw.includes(rawQ)).map((e) => e.i));
  }
  if (/\d/.test(rawQ)) {
    // A page reference or a numbered title: plain substring search over name + locations + tags.
    return index.filter((e) => e.raw.replace(/\s+/g, '').includes(rawQ)).map((e) => e.i);
  }
  const k = bkey(query);
  const q = { ...k, alt: devoice(k.key), tri: trigrams(k.joined) };
  const qAltJoined = q.alt.replace(/ /g, '');
  const scored = [];
  const scoreEntry = (e) => {
    let s = tierScore(q, e.key, e.joined, e.tokens);
    if (e.alt) {
      const alt = tierScore({ joined: qAltJoined, key: q.alt, tokens: q.tokens }, e.alt.key, e.alt.joined, e.alt.key.split(' ')) - 5;
      if (alt > s) s = alt;
    }
    for (const a of e.aliases) {
      const as = tierScore(q, a.key, a.joined, a.tokens) - 150;
      if (as > s) s = as;
    }
    if (e.raw.replace(/\s+/g, '').includes(rawQ)) s = Math.max(s, 500);
    return s;
  };
  for (const e of index) {
    const s = scoreEntry(e);
    if (s > 0) scored.push([s, e]);
  }
  if (scored.filter(([s]) => s >= 500).length < 20) {
    const seen = new Set(scored.map(([, e]) => e.i));
    for (const e of index) {
      if (seen.has(e.i)) continue;
      const s = fuzzyScore(q, e);
      if (s > 0) scored.push([s, e]);
    }
  }
  scored.sort((a, b) => b[0] + b[1].pop - 0.5 * b[1].joined.length - (a[0] + a[1].pop - 0.5 * a[1].joined.length));
  return scored.map(([, e]) => e.i);
};
