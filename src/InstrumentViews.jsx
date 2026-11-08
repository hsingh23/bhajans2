// @ts-nocheck
// Instrument views for musician mode: a raga line as sung sargam, as guitar or
// ukulele tablature and as bansuri fingerings, plus chord diagrams.
import React from 'react';
import { INSTRUMENTS, chordShape, scaleTab, tabLines } from './fretboard';
import { bansuriLine, sargamLine } from './sargam';

const KIND_WORD = { komal: 'komal ', tivra: 'tivra ' };
const OCTAVE_WORD = { '-1': ' (lower octave)', 1: ' (upper octave)' };

/** The line as a singer reads it: Sa Re Ga... with komal underlined, tivra Ma ticked, octave dots. */
export const SargamLine = ({ swaras, descending = false, names = [], label }) => {
  const line = sargamLine(swaras, descending);
  if (!line.length) return null;
  const spoken = line
    .map(({ syllable, kind, octave }, i) => `${KIND_WORD[kind] || ''}${syllable}${OCTAVE_WORD[octave] || ''}${names[i] ? ` ${names[i]}` : ''}`)
    .join(', ');
  return (
    <figure className='sargam-line'>
      {label && <figcaption className='pk-label'>{label}</figcaption>}
      <ol role='img' aria-label={`Sing${label ? ` ${label.toLowerCase()}` : ''}: ${spoken}`}>
        {line.map(({ syllable, kind, octave }, i) => (
          <li key={i} className={['sg-note', kind && `sg-${kind}`, octave > 0 && 'sg-taar', octave < 0 && 'sg-mandra'].filter(Boolean).join(' ')}>
            <span className='sg-syllable'>
              {syllable}
              {kind === 'tivra' && '′'}
            </span>
            {names[i] && <span className='sg-pitch'>{names[i]}</span>}
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
export const BansuriChart = ({ swaras, descending = false, names = [], label }) => {
  const line = bansuriLine(swaras, descending);
  if (!line.length) return null;
  const syllables = sargamLine(swaras, descending);
  const spoken = line
    .map(({ holes, register }, i) => `${names[i] || syllables[i].syllable}: ${HOLE_WORD(holes)}${register ? ', blow harder' : ''}`)
    .join('; ');
  return (
    <figure className='bansuri-chart'>
      {label && <figcaption className='pk-label'>{label}</figcaption>}
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
export const ScaleTab = ({ instrument, saPc, swaras, descending = false, names = [], label }) => {
  const placed = scaleTab(instrument, saPc, swaras, descending);
  if (!placed) return null;
  const inst = INSTRUMENTS[instrument];
  const spoken = placed
    .map(({ string, fret }, i) => `${names[i] || ''} ${inst.strings[string]} string ${fret === 0 ? 'open' : `fret ${fret}`}`.trim())
    .join(', ');
  return (
    <figure className='scale-tab'>
      {label && <figcaption className='pk-label'>{label}</figcaption>}
      <pre role='img' aria-label={`${inst.name} tab${label ? `, ${label.toLowerCase()}` : ''}: ${spoken}`}>
        {tabLines(instrument, placed, names).join('\n')}
      </pre>
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
