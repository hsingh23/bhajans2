// @ts-nocheck
// One-line musician summary for a song: shruti, raga and taal chips.
import React from 'react';
import { isPitchClass, keyName, kattaiFor } from './musicTheory';
import { useMyKey } from './myKey';

const titleCase = (id) => String(id || '').replace(/(^|[\s-])\w/g, (c) => c.toUpperCase());

export const ragaName = (ragas, id) => ragas?.[id]?.name || titleCase(id);
/** Raga confidence at or above which the name is stated plainly (blind re-check: 96% agreement). */
export const RAGA_SURE = 0.85;
/** Shruti and taal confidence at or above which they are stated plainly (held-out accuracy 96-99% there). */
export const SHRUTI_SURE = 0.8;
export const TAAL_SURE = 0.8;
const unsure = (part, sure) => typeof part?.c === 'number' && part.c < sure;
export const taalName = (taals, id) => taals?.[id]?.name || titleCase(id);

/** Swaras of a song's first raga, used to spell its key (C# or Db?). */
export const firstRagaSwaras = (entry, ragas) => {
  const raga = ragas?.[entry?.r?.[0]?.id];
  return raga ? [...(raga.aroha || []), ...(raga.avaroha || [])] : undefined;
};

/**
 * "G · 5": key name and kattai, or null when the song has no shruti. With the
 * reader's own key (myKey, a pitch class) it reads "Bb → G · 5": recording key,
 * then the key the song is shown in.
 */
export const shrutiShort = (entry, ragas, myKey) => {
  const pc = entry?.sh?.pc;
  const swaras = firstRagaSwaras(entry, ragas);
  const name = keyName(pc, swaras);
  if (!name) return null;
  if (isPitchClass(myKey) && myKey !== pc) {
    const mine = keyName(myKey, swaras);
    const kattai = kattaiFor(myKey);
    return {
      text: `${name} → ${mine} · ${kattai}`,
      label: `Key ${mine}, ${kattai} kattai (your key; recording in ${name})`,
    };
  }
  const kattai = entry.sh.k || kattaiFor(pc);
  const mineNote = isPitchClass(myKey) ? ' (your key)' : '';
  return {
    text: kattai ? `${name} · ${kattai}` : name,
    label: (kattai ? `Key ${name}, ${kattai} kattai` : `Key ${name}`) + mineNote,
  };
};

export const musicChips = (entry, music, myKey) => {
  if (!entry || !music) return [];
  const chips = [];
  const shruti = shrutiShort(entry, music.ragas, myKey);
  if (shruti) {
    const approx = unsure(entry.sh, SHRUTI_SURE);
    chips.push({ kind: 'shruti', text: approx ? `≈ ${shruti.text}` : shruti.text, label: approx ? `Probably ${shruti.label}` : shruti.label });
  }
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
    const plain = t.id ? [taalName(music.taals, t.id), beats].filter(Boolean).join(' ') : t.ts || `${beats} beats`;
    const approx = unsure(t, TAAL_SURE);
    const label = t.id ? `Taal ${plain}${beats ? ' beats' : ''}` : `Time ${plain}`;
    chips.push({ kind: 'taal', text: approx ? `≈ ${plain}` : plain, label: approx ? `Probably ${label}` : label });
  }
  return chips;
};

const PREFIX = { shruti: 'Key ', raga: 'Raga ', taal: 'Taal ' };

const MusicChips = ({ entry, music }) => {
  const myKey = useMyKey();
  const chips = musicChips(entry, music, myKey);
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
