// @ts-nocheck
// Instrument views for musician mode: a raga line as sung sargam, as guitar or
// ukulele tablature and as bansuri fingerings, plus chord diagrams.
import React from 'react';
import { INSTRUMENTS, chordShape, scaleTab, tabLines } from './fretboard';
import { bansuriLine, sargamLine } from './sargam';
import { fluteLine } from './flute';

const KIND_WORD = { komal: 'komal ', tivra: 'tivra ' };
const OCTAVE_WORD = { '-1': ' (lower octave)', 1: ' (upper octave)' };

/** The line as a singer reads it: Sa Re Ga... with komal underlined, tivra Ma ticked, octave dots. */
export const SargamLine = ({ swaras, descending = false, names = [], label, showNames = true, showLabel = true }) => {
  const line = sargamLine(swaras, descending);
  if (!line.length) return null;
  const spoken = line
    .map(({ syllable, kind, octave }, i) => `${KIND_WORD[kind] || ''}${syllable}${OCTAVE_WORD[octave] || ''}${names[i] ? ` ${names[i]}` : ''}`)
    .join(', ');
  return (
    <figure className='sargam-line'>
      {label && showLabel && <figcaption className='pk-label'>{label}</figcaption>}
      <ol role='img' aria-label={`Sing${label ? ` ${label.toLowerCase()}` : ''}: ${spoken}`}>
        {line.map(({ syllable, kind, octave }, i) => (
          <li key={i} className={['sg-note', kind && `sg-${kind}`, octave > 0 && 'sg-taar', octave < 0 && 'sg-mandra'].filter(Boolean).join(' ')}>
            <span className='sg-syllable'>
              {syllable}
              {kind === 'tivra' && '′'}
            </span>
            {showNames && names[i] && <span className='sg-pitch'>{names[i]}</span>}
          </li>
        ))}
      </ol>
    </figure>
  );
};

const HOLE_WORD = (holes) => {
  const closed = holes.filter((h) => h === 1).length;
  const half = holes.some((h) => h === 0.5);
  if (!closed && !half) return 'all holes open';
  if (!closed) return 'top hole half-closed, rest open';
  return `top ${closed} closed${half ? ', next half-closed' : ''}`;
};

/** One column per note: the six holes (filled = closed, half = half-closed), the note, ↑ = blow harder. */
export const BansuriChart = ({ swaras, descending = false, names = [], label, showLabel = true }) => {
  const line = bansuriLine(swaras, descending);
  if (!line.length) return null;
  const syllables = sargamLine(swaras, descending);
  const spoken = line
    .map(({ holes, register }, i) => `${names[i] || syllables[i].syllable}: ${HOLE_WORD(holes)}${register ? ', blow harder' : ''}`)
    .join('; ');
  return (
    <figure className='bansuri-chart'>
      {label && showLabel && <figcaption className='pk-label'>{label}</figcaption>}
      <ol role='img' aria-label={`Bansuri${label ? ` ${label.toLowerCase()}` : ''}: ${spoken}`}>
        {line.map(({ holes, register }, i) => (
          <li key={i} className='bn-note'>
            <span className='bn-register' aria-hidden='true'>
              {'↑'.repeat(register) || ' '}
            </span>
            <svg viewBox='0 0 12 64' width='12' height='64' aria-hidden='true'>
              {holes.map((h, k) => (
                <g key={k}>
                  <circle className='bn-hole' cx='6' cy={6 + k * 10.4} r='4.2' />
                  {h === 1 && <circle className='bn-closed' cx='6' cy={6 + k * 10.4} r='4.2' />}
                  {h === 0.5 && <path className='bn-closed' d={`M6 ${1.8 + k * 10.4} a4.2 4.2 0 0 0 0 8.4 z`} />}
                </g>
              ))}
            </svg>
            <span className='bn-name'>{names[i] || syllables[i].syllable}</span>
          </li>
        ))}
      </ol>
    </figure>
  );
};

/** The raga line (Up or Down) as tab, with the note names above the frets. */
const FLUTE_HOLES = [12, 21, 30, 47, 56, 65]; // L1 L2 L3, R1 R2 R3 (y)
const fluteWords = (k) =>
  [
    k.thumb && 'thumb',
    ...k.left.map((on, i) => on && `L${i + 1}`),
    k.gSharp && 'G sharp key',
    ...k.right.map((on, i) => on && `R${i + 1}`),
    k.eFlat && 'E flat key',
    k.lowC && 'low C key',
    k.lowCSharp && 'low C sharp key',
  ]
    .filter(Boolean)
    .join(' ') || 'all open';

/** One column per note: thumb, left 1-3 (+G#), right 1-3 (+Eb), foot keys; filled = pressed; ↑ = higher octave. */
export const FluteChart = ({ saPc, swaras, descending = false, names = [], label, showLabel = true }) => {
  const line = fluteLine(saPc, swaras, descending);
  if (!line) return null;
  const spoken = line.map(({ keys, register }, i) => `${names[i] || ''}: ${fluteWords(keys)}${register ? `, octave ${register + 1}` : ''}`).join('; ');
  return (
    <figure className='bansuri-chart flute-chart'>
      {label && showLabel && <figcaption className='pk-label'>{label}</figcaption>}
      <ol role='img' aria-label={`Flute${label ? ` ${label.toLowerCase()}` : ''}: ${spoken}`}>
        {line.map(({ keys, register }, i) => (
          <li key={i} className='bn-note'>
            <span className='bn-register' aria-hidden='true'>
              {'↑'.repeat(register) || ' '}
            </span>
            <svg viewBox='0 0 18 86' width='18' height='86' aria-hidden='true'>
              <circle className={keys.thumb ? 'bn-closed' : 'bn-hole'} cx='3' cy='5' r='2.4' />
              {[...keys.left, ...keys.right].map((on, k) => (
                <circle key={k} className={on ? 'bn-closed' : 'bn-hole'} cx='8' cy={FLUTE_HOLES[k]} r='3.8' />
              ))}
              <line className='fl-split' x1='2' x2='14' y1='38.5' y2='38.5' />
              <rect className={keys.gSharp ? 'bn-closed' : 'bn-hole'} x='13' y='31' width='4' height='5' rx='1' />
              <rect className={keys.eFlat ? 'bn-closed' : 'bn-hole'} x='13' y='66' width='4' height='5' rx='1' />
              <rect className={keys.lowCSharp ? 'bn-closed' : 'bn-hole'} x='3' y='76' width='5' height='5' rx='1' />
              <rect className={keys.lowC ? 'bn-closed' : 'bn-hole'} x='10' y='76' width='5' height='5' rx='1' />
            </svg>
            <span className='bn-name'>{names[i]}</span>
          </li>
        ))}
      </ol>
    </figure>
  );
};

// Notes per stave, so a long line wraps like printed tab instead of running off a phone screen.
const STAVE = 8;
const staves = (n) => {
  const count = Math.ceil(n / STAVE);
  const size = Math.ceil(n / count); // even staves: 15 notes -> 8 + 7, not 8 + 1 + ...
  return Array.from({ length: count }, (_, i) => [i * size, Math.min(n, (i + 1) * size)]);
};

export const ScaleTab = ({ instrument, saPc, swaras, descending = false, names = [], label, showLabel = true }) => {
  const placed = scaleTab(instrument, saPc, swaras, descending);
  if (!placed) return null;
  const inst = INSTRUMENTS[instrument];
  const spoken = placed
    .map(({ string, fret }, i) => `${names[i] || ''} ${inst.strings[string]} string ${fret === 0 ? 'open' : `fret ${fret}`}`.trim())
    .join(', ');
  return (
    <figure className='scale-tab'>
      {label && showLabel && <figcaption className='pk-label'>{label}</figcaption>}
      <div>
        <pre role='img' aria-label={`${inst.name} tab${label ? `, ${label.toLowerCase()}` : ''}: ${spoken}`}>
          {staves(placed.length)
            .map(([from, to]) => tabLines(instrument, placed.slice(from, to), names.slice(from, to)).join('\n'))
            .join('\n\n')}
        </pre>
        {placed.some((spot) => spot.folded) && (
          <p className='md-hint'>Wider than the {inst.name.toLowerCase()}: some notes are played an octave up or down.</p>
        )}
      </div>
    </figure>
  );
};

const GAP = { guitar: 9, ukulele: 11 };
const ROW = 11;
const ROWS = 4;
const TOP = 10;
const LEFT = 12;

/** A chord box: strings left (low) to right (high), x = not played, o = open. */
export const ChordDiagram = ({ instrument, name }) => {
  const frets = chordShape(instrument, name);
  if (!frets) return null;
  const inst = INSTRUMENTS[instrument];
  const gap = GAP[instrument];
  const fretted = frets.filter((f) => f > 0);
  const start = fretted.length && Math.max(...fretted) > ROWS ? Math.min(...fretted) : 1;
  const width = LEFT + (frets.length - 1) * gap + 6;
  const height = TOP + ROWS * ROW + 3;
  const xOf = (s) => LEFT + s * gap;
  const spoken = frets.map((f, s) => `${inst.strings[s]} ${f < 0 ? 'not played' : f === 0 ? 'open' : `fret ${f}`}`).join(', ');
  return (
    <svg
      className='chord-diagram'
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role='img'
      aria-label={`${name} on ${inst.name.toLowerCase()}: ${spoken}`}>
      {start > 1 && (
        <text className='cd-fret' x={LEFT - 5} y={TOP + ROW * 0.5 + 3} textAnchor='end'>
          {start}
        </text>
      )}
      {Array.from({ length: ROWS + 1 }, (_, r) => (
        <line
          key={`f${r}`}
          className={r === 0 && start === 1 ? 'cd-nut' : 'cd-line'}
          x1={xOf(0)}
          x2={xOf(frets.length - 1)}
          y1={TOP + r * ROW}
          y2={TOP + r * ROW}
        />
      ))}
      {frets.map((f, s) => (
        <g key={s}>
          <line className='cd-line' x1={xOf(s)} x2={xOf(s)} y1={TOP} y2={TOP + ROWS * ROW} />
          {f < 0 && (
            <text className='cd-mark' x={xOf(s)} y={TOP - 3} textAnchor='middle'>
              ×
            </text>
          )}
          {f === 0 && <circle className='cd-open' cx={xOf(s)} cy={TOP - 5} r={2.5} />}
          {f > 0 && <circle className='cd-dot' cx={xOf(s)} cy={TOP + (f - start + 0.5) * ROW} r={3.6} />}
        </g>
      ))}
    </svg>
  );
};
