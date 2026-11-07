// @ts-nocheck
// Helpers that bring people back: what they opened recently (so they can
// resume on the same page) and a "bhajan of the day" suited to their taste.
// Everything lives in this browser's localStorage; nothing is sent anywhere.

const RECENT_KEY = "recentBhajans";
const RECENT_LIMIT = 8;
const LYRICS_LOCATION = /^(\d{4}(?:supl\d?)?-\d+|vol\d-\d+)$/i;

const readRecent = () => {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(list) ? list.filter((item) => item && item.name && item.location) : [];
  } catch {
    return [];
  }
};

/** Most recently opened first: { name, location, page, openedAt }. */
export const recentBhajans = () => readRecent();

/** Records that a bhajan was opened (or moved to another page). */
export const rememberOpened = ({ name, location, page, now = Date.now() }) => {
  if (!name || !location) return;
  const rest = readRecent().filter((item) => item.name !== name);
  const entry = { name, location, page: Number(page) || undefined, openedAt: now };
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([entry, ...rest].slice(0, RECENT_LIMIT)));
  } catch {
    // Storage full or blocked: resuming is a nicety, so carry on.
  }
};

/** Viewer URL for a bhajan, resolving its index in the current list by name. */
export const viewerPath = (bhajans, { name, location, page }) => {
  const index = bhajans.findIndex((bhajan) => bhajan?.n === name);
  if (index < 0) return null;
  const query = page ? `?page=${page}` : "";
  return `/pdf/${encodeURIComponent(location)}/${index}/${encodeURIComponent(name)}${query}`;
};

const lyricsLocation = (bhajan) => bhajan?.l?.find((loc) => LYRICS_LOCATION.test(loc));

const mostCommon = (values) => {
  const counts = new Map();
  for (const value of values) if (value) counts.set(value, (counts.get(value) || 0) + 1);
  let best = null;
  for (const [value, count] of counts) if (!best || count > best[1]) best = [value, count];
  return best?.[0] ?? null;
};

const dayNumber = (now) => Math.floor((now - new Date(now).getTimezoneOffset() * 60000) / 86400000);

/**
 * Picks one bhajan for today, the same all day. It prefers the deity, then the
 * language, that the visitor opens and favourites most, and skips ones they
 * opened recently. Returns { bhajan, location, reason } or null.
 */
export const bhajanOfTheDay = (bhajans, { favorites = {}, recent = recentBhajans(), now = Date.now() } = {}) => {
  const withLyrics = bhajans.filter((bhajan) => lyricsLocation(bhajan));
  if (!withLyrics.length) return null;
  const byName = new Map(bhajans.map((bhajan) => [bhajan.n, bhajan]));
  const liked = [...recent.map((item) => byName.get(item.name)), ...Object.keys(favorites).map((name) => byName.get(name))].filter(Boolean);
  const deity = mostCommon(liked.map((bhajan) => bhajan.d));
  const language = mostCommon(liked.map((bhajan) => bhajan.lg));
  const seen = new Set(recent.map((item) => item.name));

  const pools = [
    deity && language && withLyrics.filter((b) => b.d === deity && b.lg === language),
    deity && withLyrics.filter((b) => b.d === deity),
    language && withLyrics.filter((b) => b.lg === language),
    withLyrics,
  ].filter((pool) => pool && pool.length);
  const pool = pools[0].filter((b) => !seen.has(b.n)).length ? pools[0].filter((b) => !seen.has(b.n)) : pools[0];

  const bhajan = pool[dayNumber(now) % pool.length];
  const reason = pool === withLyrics || pools[0] === withLyrics ? null : [deity, language].filter(Boolean).join(" · ");
  return { bhajan, location: lyricsLocation(bhajan), reason };
};
