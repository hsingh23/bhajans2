// @ts-nocheck
// "For musicians" section: key / shruti, raga scales in the song's key, taal
// with its theka, chords and a plain-English summary. Shown only in musician
// mode; loaded on demand so other readers never download it.
import React, { useId, useState } from 'react';
import {
  KEY_NAMES,
  chordsInKey,
  countPhrase,
  isPitchClass,
  kattaiFor,
  keyName,
  keySpelling,
  markMeaning,
  summaryInKey,
  swaraSemitones,
  swarasToNotes,
  thekaGroups,
} from './musicTheory';
import { RAGA_SURE, SHRUTI_SURE, TAAL_SURE, firstRagaSwaras, ragaName, taalName } from './MusicChips';
import PianoKeys from './PianoKeys';
import { setMyKey, useMyKey } from './myKey';

const SOURCE = { box: 'from the full recording', cd: 'from a CD sample', sheet: 'from the sheet music' };
const SYSTEM = { carnatic: 'Carnatic', hindustani: 'Hindustani' };
const APPROXIMATE_BELOW = 0.7;

const ScaleRow = ({ label, swaras, saPc, spelling }) => {
  if (!Array.isArray(swaras) || !swaras.length) return null;
  const notes = swarasToNotes(swaras, saPc, spelling);
  return (
    <div className='md-scale-row'>
      <span className='md-scale-label'>{label}</span>
      <span className='md-swaras'>{swaras.join(' ')}</span>
      {notes.length > 0 && <span className='md-notes'>{notes.join(' ')}</span>}
    </div>
  );
};

const sameNotes = (a, b) => a.length === b.length && a.every((s) => b.includes(s));

/** Piano keys beside the scale rows: one keyboard, or Up and Down when the notes differ. */
const RagaPianos = ({ raga, saPc, spelling }) => {
  if (!isPitchClass(saPc)) return null;
  const up = swaraSemitones(raga.aroha);
  const down = swaraSemitones(raga.avaroha);
  if (!up.length && !down.length) return null;
  const notes = (swaras) => swarasToNotes(swaras, saPc, spelling);
  return (
    <div className='md-pianos'>
      {sameNotes(up, down) || !down.length ? (
        <PianoKeys saPc={saPc} semitones={up} notes={notes(raga.aroha)} />
      ) : !up.length ? (
        <PianoKeys saPc={saPc} semitones={down} notes={notes(raga.avaroha)} />
      ) : (
        <>
          <PianoKeys saPc={saPc} semitones={up} label='Up' notes={notes(raga.aroha)} />
          <PianoKeys saPc={saPc} semitones={down} label='Down' notes={notes(raga.avaroha)} />
        </>
      )}
    </div>
  );
};

const Raga = ({ part, raga, saPc }) => {
  const sec = part.sec && part.sec !== 'all' ? part.sec : null;
  const swaras = raga ? [...(raga.aroha || []), ...(raga.avaroha || [])] : [];
  const spelling = keySpelling(saPc, swaras);
  return (
    <div className='md-raga'>
      <p className='md-heading'>
        {sec && <span className='md-section'>{sec}: </span>}
        {(part.c ?? 1) < RAGA_SURE && <span className='md-aside'>Close to </span>}
        <strong>{ragaName({ [part.id]: raga }, part.id)}</strong>
        {raga?.hi && <span className='md-aside'> · Hindustani: {raga.hi}</span>}
      </p>
      {raga && (
        <div className='md-scale-wrap'>
          <div className='md-scale'>
            <ScaleRow label='Up' swaras={raga.aroha} saPc={saPc} spelling={spelling} />
            <ScaleRow label='Down' swaras={raga.avaroha} saPc={saPc} spelling={spelling} />
          </div>
          <RagaPianos raga={raga} saPc={saPc} spelling={spelling} />
        </div>
      )}
      {(raga?.western || raga?.mood) && (
        <p className='md-aside'>{[raga.western && `Western: ${raga.western}`, raga.mood].filter(Boolean).join(' · ')}</p>
      )}
    </div>
  );
};

const keyLabel = (pc, swaras) => `${keyName(pc, swaras)} (${kattaiFor(pc)} kattai)`;

/** Semitone steps and a key list, plus saving the key as the reader's own for every song. */
const Transpose = ({ saPc, recordingPc, myKey, swaras, onChange }) => {
  const id = useId();
  const hasKey = isPitchClass(saPc);
  const step = (by) => onChange(((hasKey ? saPc : (recordingPc ?? 0)) + by + 12) % 12);
  return (
    <div className='md-transpose'>
      <div className='md-transpose-row' role='group' aria-label='Transpose'>
        <button type='button' className='md-step' aria-label='Down a semitone' title='Down a semitone' onClick={() => step(-1)}>
          −
        </button>
        <label className='visually-hidden' htmlFor={`${id}-key`}>
          Show in key
        </label>
        <select
          id={`${id}-key`}
          className='md-key-select'
          value={hasKey ? String(saPc) : ''}
          onChange={(e) => e.target.value !== '' && onChange(Number(e.target.value))}>
          {!hasKey && <option value=''>Pick a key</option>}
          {KEY_NAMES.map((name, pc) => (
            <option key={name} value={String(pc)}>
              {`${name} · ${kattaiFor(pc)}`}
              {pc === recordingPc ? ' (recording)' : ''}
              {pc === myKey ? ' (my key)' : ''}
            </option>
          ))}
        </select>
        <button type='button' className='md-step' aria-label='Up a semitone' title='Up a semitone' onClick={() => step(1)}>
          +
        </button>
        {isPitchClass(recordingPc) && hasKey && saPc !== recordingPc && (
          <button type='button' className='md-text-button' onClick={() => onChange(recordingPc)}>
            Recording key
          </button>
        )}
      </div>
      <div className='md-transpose-row'>
        {hasKey && saPc !== myKey && (
          <button type='button' className='md-text-button md-save-key' onClick={() => setMyKey(saPc)}>
            Show every song in {keyLabel(saPc, swaras)}
          </button>
        )}
        {isPitchClass(myKey) && (
          <span className='md-aside md-my-key'>
            {saPc === myKey ? 'This is your key for every song.' : `Your key for every song: ${keyLabel(myKey, swaras)}.`}{' '}
            <button type='button' className='md-text-button' onClick={() => setMyKey(undefined)}>
              Use recording keys
            </button>
          </span>
        )}
      </div>
    </div>
  );
};

const Theka = ({ taal }) => {
  const groups = thekaGroups(taal);
  if (!groups) return null;
  return (
    <div className='md-theka' role='group' aria-label='Theka by section'>
      {groups.map(({ mark, cells }, i) => (
        <div key={i} className='md-vibhag'>
          <span className='md-mark' title={mark ? markMeaning(mark) : undefined}>
            {mark || ' '}
            {mark && markMeaning(mark) && <span className='md-mark-meaning'> {markMeaning(mark)}</span>}
          </span>
          <span className='md-bols'>
            {cells.map(({ beat, bol }, i) => (
              <React.Fragment key={beat}>
                {i > 0 && ' '}
                <span className='md-bol'>{bol || beat}</span>
              </React.Fragment>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
};

const Taal = ({ t, taals }) => {
  const taal = t.id ? taals?.[t.id] : null;
  const alt = t.alt ? taals?.[t.alt] : null;
  const beats = t.b || taal?.beats;
  const altLabel = t.alt ? `${SYSTEM[alt?.system] || 'Also'}: ${taalName(taals, t.alt)}` : null;
  const ts = t.ts || taal?.western;
  const count = countPhrase(t, taal);
  return (
    <div className='md-taal'>
      <p className='md-heading'>
        {(t.c ?? 1) < TAAL_SURE && <span className='md-aside'>Probably </span>}
        <strong>{t.id ? taalName(taals, t.id) : 'Rhythm'}</strong>
        {beats && <span className='md-aside'> · {beats} beats</span>}
        {altLabel && <span className='md-aside'> · {altLabel}</span>}
      </p>
      <Theka taal={taal} />
      {(ts || count) && (
        <p className='md-count'>
          {ts && <span className='md-ts'>{ts}</span>}
          {ts && count && ' · '}
          {count && count[0].toUpperCase() + count.slice(1)}
        </p>
      )}
      {taal?.feel && <p className='md-aside'>{taal.feel}</p>}
    </div>
  );
};

const MusicianDetails = ({ entry, music }) => {
  const id = useId();
  const myKey = useMyKey();
  // A key picked for this song only; null follows the reader's key, else the recording's.
  const [chosenPc, setChosenPc] = useState(null);
  if (!entry || !music) return null;
  const { ragas = {}, taals = {} } = music;
  const recordingPc = isPitchClass(entry.sh?.pc) ? entry.sh.pc : undefined;
  const saPc = chosenPc ?? myKey ?? recordingPc;
  const hasKey = isPitchClass(saPc);
  const transposed = hasKey && saPc !== recordingPc;
  const swaras = firstRagaSwaras(entry, ragas);
  const alternatives = (entry.sh?.alt || []).filter(Number.isInteger).map((pc) => `${KEY_NAMES[pc]} (${kattaiFor(pc)})`);
  const ragaParts = Array.isArray(entry.r) ? entry.r.filter((r) => r?.id) : [];
  const chords = hasKey && Array.isArray(entry.ch) && entry.ch.length ? chordsInKey(entry.ch, saPc, swaras) : [];
  const approximate = typeof entry.c === 'number' && entry.c < APPROXIMATE_BELOW;
  // The summary names the recording's key and notes; re-tell it in the shown key, or leave it out.
  const summary = transposed && isPitchClass(recordingPc) ? summaryInKey(entry.en, saPc, swaras) : entry.en;
  const showKey = isPitchClass(recordingPc) || ragaParts.length > 0;

  return (
    <section className='musician-details' aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className='md-title'>
        For musicians
        {approximate && (
          <span className='md-approx' title='Low confidence: treat these details as a starting point'>
            approximate
          </span>
        )}
      </h2>
      {summary && <p className='md-summary'>{summary}</p>}

      {showKey && (
        <div className='md-block'>
          <h3 className='md-label'>Key / Shruti</h3>
          {hasKey ? (
            <p className='md-heading'>
              {!transposed && (entry.sh.c ?? 1) < SHRUTI_SURE && <span className='md-aside'>Probably </span>}
              <strong>{keyName(saPc, swaras)}</strong>
              <span> ({kattaiFor(saPc)} kattai)</span>
              {!transposed && SOURCE[entry.sh.src] && <span className='md-aside'> · {SOURCE[entry.sh.src]}</span>}
              {transposed && saPc === myKey && <span className='md-aside'> · your key</span>}
            </p>
          ) : (
            <p className='md-aside'>Recording key unknown. Pick a key to see the notes.</p>
          )}
          {transposed && isPitchClass(recordingPc) && (
            <p className='md-aside'>
              Transposed from the recording: {keyLabel(recordingPc, swaras)}
              {(entry.sh.c ?? 1) < SHRUTI_SURE ? ', probably' : ''}
              {SOURCE[entry.sh.src] ? `, ${SOURCE[entry.sh.src]}` : ''}
            </p>
          )}
          {!transposed && alternatives.length > 0 && <p className='md-aside'>Also possible: {alternatives.join(', ')}</p>}
          <Transpose saPc={saPc} recordingPc={recordingPc} myKey={myKey} swaras={swaras} onChange={setChosenPc} />
        </div>
      )}

      {(ragaParts.length > 0 || entry.rn === 'none') && (
        <div className='md-block'>
          <h3 className='md-label'>{ragaParts.length > 1 ? 'Ragas' : 'Raga'}</h3>
          {ragaParts.length === 0 && <p className='md-aside'>No raga: a Western-style or light-music tune.</p>}
          {ragaParts.map((part, i) => (
            <Raga key={`${part.id}-${i}`} part={part} raga={ragas[part.id]} saPc={hasKey ? saPc : undefined} />
          ))}
          {ragaParts.length > 0 && !hasKey && <p className='md-aside'>Key unknown, so notes are shown as swaras only.</p>}
        </div>
      )}

      {entry.t && (entry.t.id || entry.t.ts || entry.t.b) && (
        <div className='md-block'>
          <h3 className='md-label'>Taal</h3>
          <Taal t={entry.t} taals={taals} />
        </div>
      )}

      {chords.length > 0 && (
        <div className='md-block'>
          <h3 className='md-label'>Chords</h3>
          <ol className='md-chords'>
            {chords.map(({ numeral, chord }, i) => (
              <li key={`${numeral}-${i}`}>
                <span className='md-numeral'>{numeral}</span>
                {chord && ' '}
                {chord && <span className='md-chord'>{chord}</span>}
              </li>
            ))}
          </ol>
        </div>
      )}

      <p className='md-footnote'>
        Worked out automatically from recordings and sheet music, so some details may be imperfect.
      </p>
    </section>
  );
};

export default MusicianDetails;
