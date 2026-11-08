// @ts-nocheck
// A small piano keyboard, Sa to the Sa above, with the raga's notes in red so
// a harmonium or keyboard player sees at a glance which keys to press.
import React from 'react';

const WHITE_PCS = new Set([0, 2, 4, 5, 7, 9, 11]);
const WHITE_W = 20;
const WHITE_H = 62;
const BLACK_W = 13;
const BLACK_H = 38;
const LETTERS = { 0: 'C', 2: 'D', 4: 'E', 5: 'F', 7: 'G', 9: 'A', 11: 'B' };

const isWhite = (abs) => WHITE_PCS.has(((abs % 12) + 12) % 12);

/**
 * Keys for one octave from Sa (saPc) up to Sa', padded to whole white keys, or
 * with `twoOctaves` C to C two octaves up. `semitones` are the notes above Sa to
 * light up (0-11); Sa' lights with Sa.
 */
export const pianoLayout = (saPc, semitones = [], twoOctaves = false) => {
  let first = saPc;
  while (!isWhite(first)) first -= 1;
  let last = saPc + 12;
  while (!isWhite(last)) last += 1;
  if (twoOctaves) {
    // Two octaves from C, so the keyboard always starts on C (Sa..Sa' always fits).
    first = 0;
    last = 24;
  }
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

/**
 * `labels` names the lit notes by semitone above Sa ({ 0: 'Bb', 1: 'Cb', ... }),
 * spelled like the scale rows; unlit white keys show their plain letter.
 */
const PianoKeys = ({ saPc, semitones, label, notes, labels = {}, twoOctaves = false, className, showLabel = true }) => {
  if (!Number.isInteger(saPc) || !semitones?.length) return null;
  const { whites, blacks, width } = pianoLayout(saPc, semitones, twoOctaves);
  const name = [label, notes?.length ? notes.join(' ') : null].filter(Boolean).join(': ');
  const text = (k) => (k.on ? labels[(((k.abs - saPc) % 12) + 12) % 12] : null);
  return (
    <figure className={['piano-keys', className].filter(Boolean).join(' ')}>
      {label && showLabel && <figcaption className='pk-label'>{label}</figcaption>}
      <svg
        viewBox={`-1 -1 ${width + 2} ${WHITE_H + 2}`}
        width={width + 2}
        height={WHITE_H + 2}
        role='img'
        aria-label={`Piano keys${name ? ` — ${name}` : ''}`}>
        {whites.map((k) => (
          <g key={k.abs}>
            <rect className={keyClass('pk-white', k)} x={k.x} y={0} width={WHITE_W} height={WHITE_H} rx={2} />
            {k.sa && <SaDot x={k.x} y={WHITE_H - 20} w={WHITE_W} />}
            <text className={k.on ? 'pk-name pk-name-on' : 'pk-name'} x={k.x + WHITE_W / 2} y={WHITE_H - 5} textAnchor='middle'>
              {text(k) || LETTERS[((k.abs % 12) + 12) % 12]}
            </text>
          </g>
        ))}
        {blacks.map((k) => (
          <g key={k.abs}>
            <rect className={keyClass('pk-black', k)} x={k.x} y={0} width={BLACK_W} height={BLACK_H} rx={1.5} />
            {k.sa && <SaDot x={k.x} y={BLACK_H - 17} w={BLACK_W} />}
            {text(k) && (
              <text className='pk-name pk-name-black' x={k.x + BLACK_W / 2} y={BLACK_H - 4} textAnchor='middle'>
                {text(k)}
              </text>
            )}
          </g>
        ))}
      </svg>
    </figure>
  );
};

export default PianoKeys;
