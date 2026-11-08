// @ts-nocheck
// A small piano keyboard, Sa to the Sa above, with the raga's notes in red so
// a harmonium or keyboard player sees at a glance which keys to press.
import React from 'react';

const WHITE_PCS = new Set([0, 2, 4, 5, 7, 9, 11]);
const WHITE_W = 18;
const WHITE_H = 54;
const BLACK_W = 11;
const BLACK_H = 33;

const isWhite = (abs) => WHITE_PCS.has(((abs % 12) + 12) % 12);

/**
 * Keys for one octave from Sa (saPc) up to Sa', padded to whole white keys.
 * `semitones` are the notes above Sa to light up (0-11); Sa' lights with Sa.
 */
export const pianoLayout = (saPc, semitones = []) => {
  let first = saPc;
  while (!isWhite(first)) first -= 1;
  let last = saPc + 12;
  while (!isWhite(last)) last += 1;
  const used = new Set(semitones.map((s) => saPc + s));
  if (used.has(saPc)) used.add(saPc + 12);
  const whites = [];
  const blacks = [];
  for (let abs = first; abs <= last; abs += 1) {
    const key = { abs, on: used.has(abs), sa: abs === saPc || abs === saPc + 12 };
    if (isWhite(abs)) whites.push({ ...key, x: whites.length * WHITE_W });
    else blacks.push({ ...key, x: whites.length * WHITE_W - BLACK_W / 2 });
  }
  return { whites, blacks, width: whites.length * WHITE_W };
};

const keyClass = (base, { on, sa }) => [base, on && 'pk-on', sa && 'pk-sa'].filter(Boolean).join(' ');

const SaDot = ({ x, y, w }) => <circle className='pk-sa-dot' cx={x + w / 2} cy={y} r={3} />;

const PianoKeys = ({ saPc, semitones, label, notes }) => {
  if (!Number.isInteger(saPc) || !semitones?.length) return null;
  const { whites, blacks, width } = pianoLayout(saPc, semitones);
  const name = [label, notes?.length ? notes.join(' ') : null].filter(Boolean).join(': ');
  return (
    <figure className='piano-keys'>
      {label && <figcaption className='pk-label'>{label}</figcaption>}
      <svg
        viewBox={`-1 -1 ${width + 2} ${WHITE_H + 2}`}
        width={width + 2}
        height={WHITE_H + 2}
        role='img'
        aria-label={`Piano keys${name ? ` — ${name}` : ''}`}>
        {whites.map((k) => (
          <g key={k.abs}>
            <rect className={keyClass('pk-white', k)} x={k.x} y={0} width={WHITE_W} height={WHITE_H} rx={2} />
            {k.sa && <SaDot x={k.x} y={WHITE_H - 7} w={WHITE_W} />}
          </g>
        ))}
        {blacks.map((k) => (
          <g key={k.abs}>
            <rect className={keyClass('pk-black', k)} x={k.x} y={0} width={BLACK_W} height={BLACK_H} rx={1.5} />
            {k.sa && <SaDot x={k.x} y={BLACK_H - 6} w={BLACK_W} />}
          </g>
        ))}
      </svg>
    </figure>
  );
};

export default PianoKeys;
