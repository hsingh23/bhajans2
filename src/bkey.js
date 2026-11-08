// @ts-nocheck
// One phonetic key for romanized Indian song titles, so that "amriteshwari",
// "amrtesvari" and "Amrteshvari" (a sheet-music file name) all become the same
// string. The rules live in bkey-rules.json and are shared with create-index/bkey.py.
import table from './bkey-rules.json';

const RULES = table.rules.map(([pattern, replacement]) => [new RegExp(pattern, 'g'), replacement]);
const TAGS = new Set(table.tags);

// Strip accents (ā -> a, ṣ -> s, ḷ -> l), apostrophes and hyphens between letters.
export const fold = (text) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’'`]/g, '')
    .replace(/(\p{L})-(\p{L})/gu, '$1$2');

// Sheet-music stems are CamelCase: OmNamahSivaya -> Om Namah Sivaya.
export const splitCamel = (text) => text.replace(/([a-z])([A-Z0-9])/g, '$1 $2').replace(/([0-9])([A-Z])/g, '$1 $2');

export const keyWord = (word) => {
  let w = word;
  for (const [re, rep] of RULES) w = w.replace(re, rep);
  return w;
};

const words = (text) => fold(text).toLowerCase().match(/[a-z]+/g) ?? [];

/**
 * Key for a song name or query. Parenthesised language/singer tags are dropped;
 * any other parenthetical is an alias title (e.g. "devi mukambike (amme amrtesvari)").
 * Returns { tokens, key (space-joined), joined (no spaces), aliases: [{tokens, key, joined}] }.
 */
export const bkey = (text, { camel = false } = {}) => {
  let s = camel ? splitCamel(text) : text;
  const aliases = [];
  s = s.replace(/\(([^)]*)\)/g, (_, inner) => {
    const toks = words(inner).filter((w) => !TAGS.has(w));
    if (toks.length >= 1 && toks.join(' ').length >= 4) aliases.push(toks.map(keyWord).filter(Boolean));
    return ' ';
  });
  const tokens = words(s)
    .filter((w) => !TAGS.has(w) || words(s).length <= 1)
    .map(keyWord)
    .filter(Boolean);
  const pack = (toks) => ({ tokens: toks, key: toks.join(' '), joined: toks.join('') });
  return { ...pack(tokens), aliases: aliases.map(pack) };
};

// Key of the whole name as one word (tags and parentheticals dropped), so names whose
// word breaks differ ("Devi Dayakari" / "devi daya kari ma") still agree.
export const oneWordKey = (text, { camel = false } = {}) => {
  const s = (camel ? splitCamel(text) : text).replace(/\([^)]*\)/g, ' ');
  const ws = words(s);
  return keyWord(ws.filter((w) => !TAGS.has(w) || ws.length <= 1).join(''));
};

// Tamil spelling writes k/t/p/c for g/d/b/j: an alternate key for Tamil entries.
export const devoice = (key) => key.replace(/g/g, 'k').replace(/d/g, 't').replace(/b/g, 'p').replace(/j/g, 'c');
// Bengali writes o where others write a (Gourango / Gauranga).
export const bengali = (key) => key.replace(/o/g, 'a');
