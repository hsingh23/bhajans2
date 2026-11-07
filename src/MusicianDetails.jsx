// @ts-nocheck
// "For musicians" section: key / shruti, raga scales in the song's key, taal
// with its theka, chords and a plain-English summary. Shown only in musician
// mode; loaded on demand so other readers never download it.
import React, { useId } from 'react';
import { KEY_NAMES, chordsInKey, countPhrase, kattaiFor, keySpelling, markMeaning, swarasToNotes, thekaGroups } from './musicTheory';
import { RAGA_SURE, SHRUTI_SURE, TAAL_SURE, firstRagaSwaras, ragaName, shrutiShort, taalName } from './MusicChips';

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
        <div className='md-scale'>
          <ScaleRow label='Up' swaras={raga.aroha} saPc={saPc} spelling={spelling} />
          <ScaleRow label='Down' swaras={raga.avaroha} saPc={saPc} spelling={spelling} />
        </div>
      )}
      {(raga?.western || raga?.mood) && (
        <p className='md-aside'>{[raga.western && `Western: ${raga.western}`, raga.mood].filter(Boolean).join(' · ')}</p>
      )}
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
  if (!entry || !music) return null;
  const { ragas = {}, taals = {} } = music;
  const saPc = entry.sh?.pc;
  const hasKey = Number.isInteger(saPc);
  const shruti = shrutiShort(entry, ragas);
  const kattai = entry.sh?.k || kattaiFor(saPc);
  const alternatives = (entry.sh?.alt || []).filter(Number.isInteger).map((pc) => `${KEY_NAMES[pc]} (${kattaiFor(pc)})`);
  const ragaParts = Array.isArray(entry.r) ? entry.r.filter((r) => r?.id) : [];
  const chords = hasKey && Array.isArray(entry.ch) && entry.ch.length ? chordsInKey(entry.ch, saPc, firstRagaSwaras(entry, ragas)) : [];
  const approximate = typeof entry.c === 'number' && entry.c < APPROXIMATE_BELOW;

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
      {entry.en && <p className='md-summary'>{entry.en}</p>}

      {shruti && (
        <div className='md-block'>
          <h3 className='md-label'>Key / Shruti</h3>
          <p className='md-heading'>
            {(entry.sh.c ?? 1) < SHRUTI_SURE && <span className='md-aside'>Probably </span>}
            <strong>{shruti.text.split(' · ')[0]}</strong>
            {kattai && <span> ({kattai} kattai)</span>}
            {SOURCE[entry.sh.src] && <span className='md-aside'> · {SOURCE[entry.sh.src]}</span>}
          </p>
          {alternatives.length > 0 && <p className='md-aside'>Also possible: {alternatives.join(', ')}</p>}
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
