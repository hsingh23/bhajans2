// Sheet music files are named <Song><Key>.pdf, e.g. FragranceInTheDarkDb.pdf,
// GopiyargalFsharpm.pdf (F# minor) or AmmeCo.pdf (o marks an original upload).
const FILE_RE = /^(.*?)([A-G])(sharp|#|b)?(m)?(o)?\.pdf$/;
const NATURAL = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const splitWords = (song) =>
  song
    .replace(/([a-z])([A-Z0-9])/g, '$1 $2')
    .replace(/([0-9])([A-Z])/g, '$1 $2')
    .trim();

export const parseSheetMusicName = (file) => {
  const match = FILE_RE.exec(file);
  if (!match || !match[1]) return null;
  const [, song, root, acc, minor] = match;
  const sign = acc === 'b' ? 'b' : acc ? '#' : '';
  const alter = sign === 'b' ? -1 : sign === '#' ? 1 : 0;
  return {
    file,
    song,
    key: `${root}${sign}${minor ? 'm' : ''}`,
    pitch: (NATURAL[root] + alter + 12) % 12,
    minor: Boolean(minor),
  };
};

/**
 * Groups a bhajan's sheet music files by song, keeping the order in which
 * songs first appear (so the default file's song comes first) and listing
 * each song's keys chromatically from C, majors before minors.
 */
export const groupSheetMusic = (files = []) => {
  const groups = new Map();
  const other = [];
  for (const file of files) {
    const parsed = parseSheetMusicName(file);
    if (!parsed) {
      other.push(file);
      continue;
    }
    if (!groups.has(parsed.song)) {
      groups.set(parsed.song, { song: parsed.song, label: splitWords(parsed.song), keys: [] });
    }
    groups.get(parsed.song).keys.push(parsed);
  }
  const result = [...groups.values()].map((group) => ({
    ...group,
    keys: [...group.keys].sort((a, b) => a.minor - b.minor || a.pitch - b.pitch),
  }));
  return { groups: result, other };
};

/**
 * The sheet music file to open for a bhajan: the reader's remembered key for
 * the default file's song when that key exists, otherwise the default file.
 * `rememberedKey(song)` returns a key name such as "Db", or undefined.
 */
export const preferredSheetFile = (files = [], rememberedKey) => {
  const fallback = files[0];
  const first = fallback && parseSheetMusicName(fallback);
  const wanted = first && rememberedKey(first.song);
  if (!wanted || wanted === first.key) return fallback;
  const match = files.map(parseSheetMusicName).find((p) => p && p.song === first.song && p.key === wanted);
  return match ? match.file : fallback;
};

/**
 * The key one step lower (-1) or higher (+1) than `file` in a song's
 * pitch-sorted keys, or null at either end (no wrap-around).
 */
export const stepKey = (keys = [], file, direction) => {
  const byPitch = [...keys].sort((a, b) => a.pitch - b.pitch || a.minor - b.minor);
  const index = byPitch.findIndex((k) => k.file === file);
  if (index < 0) return null;
  return byPitch[index + direction] || null;
};
