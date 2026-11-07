// @ts-nocheck
// One-line musician summary for a song: shruti, raga and taal chips.
import React from 'react';
import { keyName, kattaiFor } from './musicTheory';

const titleCase = (id) => String(id || '').replace(/(^|[\s-])\w/g, (c) => c.toUpperCase());

export const ragaName = (ragas, id) => ragas?.[id]?.name || titleCase(id);
/** Raga confidence at or above which the name is stated plainly (blind re-check: 96% agreement). */
export const RAGA_SURE = 0.85;
export const taalName = (taals, id) => taals?.[id]?.name || titleCase(id);

/** Swaras of a song's first raga, used to spell its key (C# or Db?). */
export const firstRagaSwaras = (entry, ragas) => {
  const raga = ragas?.[entry?.r?.[0]?.id];
  return raga ? [...(raga.aroha || []), ...(raga.avaroha || [])] : undefined;
};

/** "G · 5": key name and kattai, or null when the song has no shruti. */
export const shrutiShort = (entry, ragas) => {
  const pc = entry?.sh?.pc;
  const name = keyName(pc, firstRagaSwaras(entry, ragas));
  if (!name) return null;
  const kattai = entry.sh.k || kattaiFor(pc);
  return { text: kattai ? `${name} · ${kattai}` : name, label: kattai ? `Key ${name}, ${kattai} kattai` : `Key ${name}` };
};

export const musicChips = (entry, music) => {
  if (!entry || !music) return [];
  const chips = [];
  const shruti = shrutiShort(entry, music.ragas);
  if (shruti) chips.push({ kind: 'shruti', ...shruti });
  const ragas = Array.isArray(entry.r) ? entry.r.filter((r) => r?.id) : [];
  if (ragas.length) {
    const names = ragas.map((r) => ragaName(music.ragas, r.id)).join(' + ');
    // Below this the name is a best guess (close ragas share the scale); say so on the chip too.
    const approximate = (ragas[0].c ?? 1) < RAGA_SURE;
    const text = approximate ? `≈ ${names}` : names;
    chips.push({ kind: 'raga', text, label: approximate ? `Raga close to ${names}` : `Raga ${names}` });
  }
  const t = entry.t;
  if (t && (t.id || t.ts || t.b)) {
    const beats = t.b || music.taals?.[t.id]?.beats;
    const text = t.id ? [taalName(music.taals, t.id), beats].filter(Boolean).join(' ') : t.ts || `${beats} beats`;
    chips.push({ kind: 'taal', text, label: t.id ? `Taal ${text}${beats ? ' beats' : ''}` : `Time ${text}` });
  }
  return chips;
};

const PREFIX = { shruti: 'Key ', raga: 'Raga ', taal: 'Taal ' };

const MusicChips = ({ entry, music }) => {
  const chips = musicChips(entry, music);
  if (!chips.length) return null;
  return (
    <span className='music-chips' data-testid='music-chips'>
      {chips.map(({ kind, text, label }) => (
        <span key={kind} className={`category-chip music ${kind}`} title={label}>
          <span className='visually-hidden'>{PREFIX[kind]}</span>
          {text}
        </span>
      ))}
    </span>
  );
};

export default MusicChips;
