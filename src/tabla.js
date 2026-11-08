// @ts-nocheck
// Tabla help for musician mode: what each bol (stroke) is, the theka at double
// speed, and which theka to play when the song's taal is a Carnatic one.

// Dayan = right-hand (treble) drum, bayan = left-hand (bass) drum.
const STROKES = {
  dha: 'both drums: na on the dayan with ge on the bayan',
  dhin: 'both drums: tin on the dayan with ge on the bayan',
  dhi: 'both drums: ti on the dayan with ge on the bayan',
  ge: 'bayan (left): open, ringing bass stroke',
  ghe: 'bayan (left): open, ringing bass stroke',
  ga: 'bayan (left): open, ringing bass stroke',
  ka: 'bayan (left): flat, closed slap',
  ke: 'bayan (left): flat, closed slap',
  kat: 'bayan (left): flat, closed slap',
  na: 'dayan (right): sharp stroke on the rim',
  ta: 'dayan (right): sharp stroke on the rim',
  tin: 'dayan (right): ringing stroke just inside the rim',
  ti: 'dayan (right): closed stroke on the black centre',
  tun: 'dayan (right): open, ringing stroke on the centre',
  te: 'dayan (right): closed stroke on the centre',
};

const clean = (bol) => String(bol || '').toLowerCase().replace(/[^a-z]/g, '');

/** Each distinct bol in the theka with how it is played (unknown bols are skipped). */
export const bolGuide = (bols = []) => {
  const seen = new Set();
  const out = [];
  for (const bol of bols) {
    const key = clean(bol);
    if (!key || seen.has(key) || !STROKES[key]) continue;
    seen.add(key);
    out.push({ bol: key, stroke: STROKES[key] });
  }
  return out;
};

/** Dugun: the theka twice as fast, two bols on every beat (one cycle per beat count). */
export const dugun = (bols = []) =>
  bols.length ? bols.map((_, i) => `${bols[(2 * i) % bols.length]}${bols[(2 * i + 1) % bols.length]}`) : [];

/**
 * The taal to show as a tabla theka: the song's own when it has tabla bols,
 * else its Hindustani counterpart (Adi → Keherwa), else null.
 */
export const tablaTaal = (t, taals) => {
  const own = t?.id ? taals?.[t.id] : null;
  const alt = t?.alt ? taals?.[t.alt] : null;
  const isTabla = (taal) => taal?.system === 'hindustani' && Array.isArray(taal.bols) && taal.bols.length;
  if (isTabla(own)) return { id: t.id, taal: own, borrowed: false };
  if (isTabla(alt)) return { id: t.alt, taal: alt, borrowed: true };
  return null;
};
