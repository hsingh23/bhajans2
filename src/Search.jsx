// @ts-nocheck
import React, { useState, useEffect, useMemo, useRef } from 'react';
import 'react-virtualized/styles.css';
import { List, WindowScroller, AutoSizer } from 'react-virtualized';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import { track } from './analytics';
import { PopupButton } from '@typeform/embed-react';
import Header from './Header';
import { groupSheetMusic } from './sheetMusicGroups';

const makeSearchable = (line) =>
  line
    .toLowerCase()
    .replace(/[^A-z0-9]/g, '')
    .replace(/va/g, 'v')
    .replace(/h/g, '')
    .replace(/z/g, 'r')
    .replace(/ri?/g, 'ri')
    .replace(/a+/g, 'a')
    .replace(/ee/g, 'i')
    .replace(/oo|uu/g, 'u')
    .replace(/[kg]il/g, 'kgil')
    .replace(/[cj]al/g, 'Cal')
    .replace(/[vw]/g, 'V')
    .replace(/ny?/g, 'ny')
    .replace(/(t|k|c){2}/g, '$1')
    .replace(/(g|p|j){2}/g, '$1')
    .replace(/[ie]*y/g, 'Y')
    .replace(/[tdl]/g, 'T');

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Wraps every case-insensitive match of the search words in <mark>.
export const Highlight = ({ text, words, className }) => {
  const terms = words.filter(Boolean).map(escapeRegExp);
  if (!terms.length) return <span className={className}>{text}</span>;
  const parts = text.split(new RegExp(`(${terms.join('|')})`, 'gi'));
  return (
    <span className={className}>
      {parts.map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part))}
    </span>
  );
};

const countBy = (items, key) =>
  items.reduce((counts, item) => {
    const value = item?.[key];
    if (value) counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});

const FilterSelect = ({ id, label, allLabel, value, counts, onChange }) => (
  <label className='filter-select' htmlFor={id}>
    <span className='filter-label'>{label}</span>
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value=''>{allLabel}</option>
      {Object.entries(counts)
        .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
        .map(([option, count]) => (
          <option key={option} value={option}>
            {option} ({count})
          </option>
        ))}
      {value && !counts[value] && <option value={value}>{value} (0)</option>}
    </select>
  </label>
);

const ScrollMonitor = ({ isScrolling }) => {
  useEffect(() => {
    if (isScrolling) {
      window.scrollTop =
        (document.scrollingElement && document.scrollingElement.scrollTop) || window.pageYOffset || window.scrollTop;
    }
  }, [isScrolling]);
  return null;
};

const Search = ({ path, favorites, renderFavorite, bhajans = [] }) => {
  // const [bhajans, setBhajans] = useState(window.fetchedBhajans || []);
  // const [searchable, setSearchable] = useState(window.searchableBhajans || []);
  const [playing, setPlaying] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoFilteredIndex, setInfoFilteredIndex] = useState(false);
  const [filter, setFilter] = useState(window.searchFilter || '');
  const [language, setLanguage] = useState(window.searchLanguage || '');
  const [deity, setDeity] = useState(window.searchDeity || '');
  
  const audioTagRef = useRef(null);
  
  useEffect(() => {
    if (!audioTagRef.current) {
      audioTagRef.current = document.querySelector('#audio');
    }
  }, []);

  const searchable = useMemo(() => {
    if (window.searchableBhajans && window.searchableBhajans.length === bhajans.length) {
      return window.searchableBhajans;
    }
    const computed = bhajans.map((o) => makeSearchable(o.n + o.l.join('') + (o.t || '')));
    return computed;
  }, [bhajans]);

  useEffect(() => {
    window.searchableBhajans = searchable;
  }, [searchable]);

  const filteredBhajans = useMemo(() => {
    const searchableFilter = makeSearchable(filter);
    const filterFavorites = path.includes('/my-favorites');

    return searchable.reduce((memo, searchableBhajan, i) => {
      if (filterFavorites) {
        if (!favorites[bhajans[i]?.n]) return memo;
      }
      if (language && bhajans[i]?.lg !== language) return memo;
      if (deity && bhajans[i]?.d !== deity) return memo;
      if (searchableBhajan.includes(searchableFilter)) memo.push(i);
      return memo;
    }, []) || [];
  }, [filter, favorites, path, bhajans, searchable, language, deity]);

  // Counts reflect the current page (all bhajans or just favorites) and the other dropdown.
  const countable = useMemo(
    () => (path.includes('/my-favorites') ? bhajans.filter((b) => favorites[b?.n]) : bhajans),
    [bhajans, favorites, path]
  );
  const languageCounts = useMemo(
    () => countBy(deity ? countable.filter((b) => b.d === deity) : countable, 'lg'),
    [countable, deity]
  );
  const deityCounts = useMemo(
    () => countBy(language ? countable.filter((b) => b.lg === language) : countable, 'd'),
    [countable, language]
  );
  const hasCategories = bhajans.some((b) => b?.lg || b?.d);

  useEffect(() => {
    // Scroll restoration logic
    const scrollTimer = setTimeout(() => {
      if (document.scrollingElement) {
        document.scrollingElement.scrollTop = window.scrollTop || 0;
      } else {
        document.body.scrollTop = window.scrollTop || 0;
      }
    }, 0);

    return () => {
      clearTimeout(scrollTimer);
    };
  }, []);

  useEffect(() => {
    window.searchFilter = filter;
    window.searchLanguage = language;
    window.searchDeity = deity;
  }, [filter, language, deity]);

  // Record what people search for once they pause typing.
  useEffect(() => {
    const term = filter.trim();
    if (term.length < 2) return;
    const timer = setTimeout(() => track('search', { search_term: term }), 1500);
    return () => clearTimeout(timer);
  }, [filter]);

  const chooseDeity = (value) => {
    setDeity(value);
    if (value) track('filter_bhajans', { filter_type: 'deity', filter_value: value });
  };
  const chooseLanguage = (value) => {
    setLanguage(value);
    if (value) track('filter_bhajans', { filter_type: 'language', filter_value: value });
  };

  const play = (url, bhajanName) => {
    if (bhajanName) track('play_sample', { bhajan_name: bhajanName });
    if (audioTagRef.current) {
      audioTagRef.current.src = url;
      audioTagRef.current.play();
      setPlaying(url);
      audioTagRef.current.onended = () => setPlaying(false);
    }
  };

  const stop = () => {
    if (audioTagRef.current) {
      audioTagRef.current.pause();
      setPlaying(false);
    }
  };

  const setInfo = (data, index) => {
    setInfoOpen(data);
    setInfoFilteredIndex(index);
  };

  // While the details modal is open: focus Close, close on Escape, then hand focus back.
  const closeButtonRef = useRef(null);
  const isInfoOpen = Boolean(infoOpen);
  useEffect(() => {
    if (!isInfoOpen) return;
    const opener = document.activeElement;
    closeButtonRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setInfoOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [isInfoOpen]);

  const wrappedName = (loc, name, child) => {
    // Pattern matches: YYYYsuplN-X (supplements), volN-X (volumes), and YYYY-X (year-only like 2025-53)
    const match = loc.match(/\d{4}(?:supl\d?)?-\d+|vol\d-\d+/gi);
    return match ? (
      <Link to={`/pdf/${match[0]}/${name}`} className='lyrics'>
        {child} <Icon name='book' className='lyrics-icon' />
      </Link>
    ) : (
      <span>{child}</span>
    );
  };

  const rowRenderer = ({ index, key, style }) => {
    const bhajan = bhajans[filteredBhajans[index]];
    if (!bhajan) return null;
    const { sm: sheetmusic, n: name, t: tags = '', l: locationArr, cs: cdbabySampleUrls, cn: cdbabyNames, lg: bhajanLanguage, d: bhajanDeity } = bhajan;
    const tagContent = tags ? ` (${tags})` : '';

    return (
      <div key={key} style={style}>
        <div className='bhajanRow'>
          <div className='Search_LeftSide'>
            {wrappedName(
              locationArr.find((loc) => loc.match(/\d{4}(?:supl\d?)?-\d+|vol\d-\d+/gi)) ||
                locationArr[0],
              `${filteredBhajans[index]}/${name}`,
              <Highlight className='spaced' words={filter.split(' ')} text={`${name}${tagContent || ''}`} />
            )}
            {(bhajanLanguage || bhajanDeity) && (
              <span className='bhajan-categories'>
                {bhajanDeity && (
                  <button
                    type='button'
                    className={deity === bhajanDeity ? 'category-chip deity active' : 'category-chip deity'}
                    aria-pressed={deity === bhajanDeity}
                    aria-label={`Show only ${bhajanDeity} bhajans`}
                    onClick={() => chooseDeity(deity === bhajanDeity ? '' : bhajanDeity)}>
                    {bhajanDeity}
                  </button>
                )}
                {bhajanLanguage && (
                  <button
                    type='button'
                    className={language === bhajanLanguage ? 'category-chip language active' : 'category-chip language'}
                    aria-pressed={language === bhajanLanguage}
                    aria-label={`Show only ${bhajanLanguage} bhajans`}
                    onClick={() => chooseLanguage(language === bhajanLanguage ? '' : bhajanLanguage)}>
                    {bhajanLanguage}
                  </button>
                )}
              </span>
            )}
          </div>
          <span className='Search_RightSide'>
            <button
              aria-label='bhajan details'
              className='button button-3d button-circle button-jumbo spaced'
              onClick={() => setInfo(bhajan, filteredBhajans[index])}>
              <Icon name='info' />
            </button>
            {sheetmusic && (
              <Link
                className='button button-3d button-circle button-jumbo spaced'
                aria-label='open sheet music'
                to={`/pdf/${sheetmusic[0]}/${filteredBhajans[index]}/${name}`}>
                <Icon name='music' />
              </Link>
            )}
            {cdbabyNames && (
              <a
                className='button button-3d button-circle button-jumbo spaced'
                href={`https://www.amazon.com/s?k=${encodeURIComponent(cdbabyNames[0])} amma`}
                target='_blank'
                rel='noopener noreferrer'
                aria-label='buy song on cdbaby'>
                <Icon name='cart' />
              </a>
            )}
            {cdbabySampleUrls && (
              <button
                aria-label='play sample'
                className='button button-3d button-circle button-jumbo spaced'
                onClick={() => (playing === cdbabySampleUrls[0] ? stop() : play(cdbabySampleUrls[0], name))}>
                <Icon name={playing === cdbabySampleUrls[0] ? 'stop' : 'play'} />
              </button>
            )}
            {renderFavorite(name)}
          </span>
        </div>
      </div>
    );
  };

  const myFavoritesMode = path.includes('/my-favorites');
  const favoriteCount = useMemo(() => bhajans.filter((b) => favorites[b?.n]).length, [bhajans, favorites]);
  const { sm: infoSheetMusic = [], n: infoName, t: infoTags = [], l: infoLocation = [], cs: infoSampleUrls = [], cn: infoNames = [] } = infoOpen || {};
  const cdbabyLinks = infoSampleUrls.map((sample, i) => [sample, infoNames[i]]);
  const sheetMusicGroups = groupSheetMusic(infoSheetMusic);

  return (
    <div className='App'>
      <div
        className={infoOpen ? 'modal-window open' : 'modal-window'}
        onClick={() => setInfoOpen(false)}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-hidden={!infoOpen}
        inert={!infoOpen}
      >
        <div onClick={(e) => e.stopPropagation()}>
          <button
            ref={closeButtonRef}
            aria-label='close details modal'
            onClick={(e) => {
              e.stopPropagation();
              setInfo(false);
            }}
            title='Close'
            className='modal-close'>
            Close
          </button>
          <h1 id="modal-title">{infoName}</h1>
          {infoLocation.length > 0 && (
            <div>
              <strong>Found in Books: </strong>
              {infoLocation.map((pdf) => (
                <span key={pdf} className='block'>
                  {wrappedName(
                    pdf,
                    `${infoFilteredIndex}/${infoName}`,
                    pdf
                      .replace('voli', 'Alternate Volume ')
                      .replace('vol', 'Volume ')
                      .replace('-', ', page ')
                  )}
                </span>
              ))}
              <hr />
            </div>
          )}

          {infoSheetMusic.length > 0 && (
            <div>
              <strong>Sheet Music: </strong>
              {sheetMusicGroups.groups.map(({ song, label, keys }) => (
                <div key={song} className='sheet-music-song'>
                  <span className='sheet-music-title'>{label}</span>
                  <div className='sheet-music-keys'>
                    {keys.map(({ file, key }) => (
                      <Link
                        key={file}
                        to={`/pdf/${file}/${infoFilteredIndex}/${infoName}`}
                        className='sheet-music-key'
                        title={file}
                        aria-label={`${label} in ${key}`}>
                        {key}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
              {sheetMusicGroups.other.map((pdf) => (
                <Link key={pdf} to={`/pdf/${pdf}/${infoFilteredIndex}/${infoName}`} className='block'>
                  {pdf}
                </Link>
              ))}
              <hr />
            </div>
          )}

          {cdbabyLinks.length > 0 && (
            <div>
              <strong>Song samples: </strong>
              {cdbabyLinks.map(([sample, name]) => (
                <div key={sample}>
                  <button
                    aria-label='toggle sample'
                    onClick={() => (playing === sample ? stop() : play(sample, infoName))}>
                    <Icon name={playing === sample ? 'stop' : 'play'} />
                  </button>
                  {' Buy on Amazon (if available) '}
                  <a href={`https://www.amazon.com/s?k=${encodeURIComponent(name)} amma`} target='_blank' rel='noopener noreferrer' aria-label={`Buy ${name} on Amazon`}>
                    {name}
                  </a>
                </div>
              ))}
              <hr />
            </div>
          )}

          {(infoOpen?.lg || infoOpen?.d) && (
            <div>
              {infoOpen.d && (
                <span className='block'>
                  <strong>Deity: </strong>
                  {infoOpen.d}
                </span>
              )}
              {infoOpen.lg && (
                <span className='block'>
                  <strong>Language: </strong>
                  {infoOpen.lg}
                </span>
              )}
              <hr />
            </div>
          )}

          {infoTags.length > 0 && (
            <div>
              <strong>Tags: </strong>
              <small>{infoTags.join(', ')}</small>
            </div>
          )}
        </div>
      </div>
      <Header>
        <input
          type='search'
          placeholder='Search Bhajans'
          autoFocus
          autoComplete='off'
          className='form-control'
          name='search'
          id='search'
          role='search'
          aria-label='search'
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
          }}
        />
      </Header>
      <div className='rest'>
        <nav>
          <div className='view-switch' role='group' aria-label='Show'>
            <Link
              to='/'
              className={myFavoritesMode ? 'view-option' : 'view-option active'}
              aria-current={myFavoritesMode ? undefined : 'page'}>
              <span>All bhajans</span>
              <span className='view-count'>{bhajans.length}</span>
            </Link>
            <Link
              to='/my-favorites'
              className={myFavoritesMode ? 'view-option active' : 'view-option'}
              aria-current={myFavoritesMode ? 'page' : undefined}>
              <Icon name='heart' filled={myFavoritesMode} className='view-heart' />
              <span>Favorites</span>
              <span className='view-count'>{favoriteCount}</span>
            </Link>
          </div>
          {hasCategories && (
            <div className='category-filters' role='group' aria-label='Filter bhajans'>
              <FilterSelect
                id='deity-filter'
                label='Deity'
                allLabel='All deities'
                value={deity}
                counts={deityCounts}
                onChange={chooseDeity}
              />
              <FilterSelect
                id='language-filter'
                label='Language'
                allLabel='All languages'
                value={language}
                counts={languageCounts}
                onChange={chooseLanguage}
              />
              {(language || deity) && (
                <button
                  type='button'
                  className='filter-clear'
                  aria-label='Clear deity and language filters'
                  onClick={() => {
                    setLanguage('');
                    setDeity('');
                  }}>
                  <Icon name='close' /> Clear
                </button>
              )}
            </div>
          )}
          {(language || deity || filter) && (
            <p className='result-count' aria-live='polite'>
              {filteredBhajans.length} {filteredBhajans.length === 1 ? 'bhajan' : 'bhajans'}
            </p>
          )}
        </nav>
        <WindowScroller>
          {({ height, isScrolling, onChildScroll, scrollTop }) => (
            <>
              <ScrollMonitor isScrolling={isScrolling} />
              <AutoSizer disableHeight>
                {({ width }) => (
                  <List
                    autoHeight
                    height={height}
                    isScrolling={isScrolling}
                    noRowsRenderer={() =>
                      myFavoritesMode && favoriteCount === 0 ? (
                        <div className='no-results favorites-empty'>
                          <Icon name='heart' filled={false} size='40px' />
                          <p>No favorites yet.</p>
                          <p>
                            Tap the heart on any bhajan to keep it here. <Link to='/'>Browse all bhajans</Link>
                          </p>
                        </div>
                      ) : (
                      <div className="no-results">
                        <p>
                          {filter ? <>No bhajans found matching &quot;{filter}&quot;</> : 'No bhajans found'}
                          {(language || deity) && ` for ${[deity, language].filter(Boolean).join(' · ')}`}
                        </p>
                      </div>
                      )
                    }
                    onScroll={onChildScroll}
                    rowCount={filteredBhajans.length}
                    rowHeight={200}
                    rowRenderer={rowRenderer}
                    scrollTop={scrollTop}
                    width={width}
                  />
                )}
              </AutoSizer>
            </>
          )}
        </WindowScroller>
        <div className='report-problem'>
          <p>Wrong page, typo or missing bhajan?</p>
          <PopupButton id='EVBTgcG5' className='report-problem-button' onReady={() => track('report_problem')} onSubmit={() => track('report_problem_submitted')}>
            <Icon name='flag' /> Report a bhajan problem
          </PopupButton>
        </div>
      </div>
    </div>
  );
};

export default Search;
