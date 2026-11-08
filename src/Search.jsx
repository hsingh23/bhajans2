// @ts-nocheck
import React, { useState, useEffect, useMemo, useRef } from 'react';
import 'react-virtualized/styles.css';
import { List, WindowScroller, AutoSizer } from 'react-virtualized';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import { track } from './analytics';
import { recentBhajans, bhajanOfTheDay, viewerPath } from './engagement';
// Push opt-in pulls in Firebase Messaging; load it only after the list is up.
const NotificationPrompt = React.lazy(() => import('./NotificationPrompt'));
import Header from './Header';
import { groupSheetMusic, preferredSheetFile } from './sheetMusicGroups';
import { useMusicianMode, SongMusicSection } from './MusicianMode';
import MusicChips from './MusicChips';
import { EMPTY_MUSIC_FILTERS, MUSIC_FACETS, activeMusicFilters, matchesMusic, musicFacetCounts, musicSearchText } from './musicFilters';
import { useViewerPrefs, rememberedSheetKey } from './prefs';
import { buildSearchIndex, rankBhajans } from './searchRank';
import { isLyricsLocation, locationLabel } from './lyricsLocation';
import { countBy, hasTag } from './categoryTags';
import { amazonTrackUrl } from './amazon';

// `y`: earliest known recording, or the 2019-2025 songbook supplement it first appears in.
const SONG_YEAR_HINT = 'Year first sung, from the earliest known recording';

// react-virtualized needs one fixed row height; musician mode adds a line of chips.
const ROW_HEIGHT = 200;
const MUSICIAN_ROW_HEIGHT = 240;

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

const FilterSelect = ({ id, label, allLabel, value, counts, onChange, optionLabel = (option) => option, order }) => (
  <label className='filter-select' htmlFor={id}>
    <span className='filter-label'>{label}</span>
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value=''>{allLabel}</option>
      {Object.entries(counts)
        .sort(([a, x], [b, y]) => (order ? order(a, b) : y - x || a.localeCompare(b)))
        .map(([option, count]) => (
          <option key={option} value={option}>
            {optionLabel(option)} ({count})
          </option>
        ))}
      {value && !counts[value] && <option value={value}>{optionLabel(value)} (0)</option>}
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

// The Typeform report form (and its ~100 KB script) loads only when asked for.
const openProblemReport = async () => {
  const [{ createPopup }] = await Promise.all([
    import('@typeform/embed'),
    import('@typeform/embed/build/css/popup.css'),
  ]);
  createPopup('EVBTgcG5', {
    onReady: () => track('report_problem'),
    onSubmit: () => track('report_problem_submitted'),
  }).open();
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
  const [musicFilters, setMusicFilters] = useState(window.searchMusic || EMPTY_MUSIC_FILTERS);
  const [musicPanelOpen, setMusicPanelOpen] = useState(() => activeMusicFilters(window.searchMusic));
  
  const audioTagRef = useRef(null);
  const { enabled: musicianMode, music } = useMusicianMode();
  const showMusic = musicianMode && Boolean(music);
  const { sheetKeys } = useViewerPrefs();
  
  useEffect(() => {
    if (!audioTagRef.current) {
      audioTagRef.current = document.querySelector('#audio');
    }
  }, []);

  // Phonetic search keys (see searchRank.js); kept on window so a remount reuses them.
  const searchable = useMemo(() => {
    const cached = window.searchableBhajans;
    if (cached && cached.length === bhajans.length && cached.every((e) => e && typeof e.joined === 'string')) {
      return cached;
    }
    return buildSearchIndex(bhajans);
  }, [bhajans]);

  useEffect(() => {
    window.searchableBhajans = searchable;
  }, [searchable]);

  // In musician mode the search box also finds raga and taal names ("mohanam", "keherwa").
  const musicSearchable = useMemo(
    () => (showMusic ? bhajans.map((b) => musicSearchText(music.songs[b?.n], music).toLowerCase()) : null),
    [showMusic, bhajans, music]
  );
  const musicFiltering = showMusic && activeMusicFilters(musicFilters);

  const filteredBhajans = useMemo(() => {
    const filterFavorites = path.includes('/my-favorites');
    const passes = (i) => {
      if (filterFavorites && !favorites[bhajans[i]?.n]) return false;
      if (language && !hasTag(bhajans[i], 'lg', language)) return false;
      if (deity && !hasTag(bhajans[i], 'd', deity)) return false;
      if (musicFiltering) {
        const entry = music.songs[bhajans[i]?.n];
        if (!entry || !matchesMusic(entry, music, musicFilters)) return false;
      }
      return true;
    };
    // Best match first; an empty filter keeps the index order.
    const ranked = rankBhajans(searchable, filter).filter(passes);
    const query = filter.trim().toLowerCase();
    if (!musicSearchable || !query) return ranked;
    // Raga and taal names typed in musician mode come after the title matches.
    const seen = new Set(ranked);
    musicSearchable.forEach((text, i) => {
      if (!seen.has(i) && text.includes(query) && passes(i)) ranked.push(i);
    });
    return ranked;
  }, [filter, favorites, path, bhajans, searchable, language, deity, musicFiltering, music, musicFilters, musicSearchable]);

  // Counts reflect the current page (all bhajans or just favorites) and the other dropdown.
  const countable = useMemo(
    () => (path.includes('/my-favorites') ? bhajans.filter((b) => favorites[b?.n]) : bhajans),
    [bhajans, favorites, path]
  );
  const languageCounts = useMemo(
    () => countBy(deity ? countable.filter((b) => hasTag(b, 'd', deity)) : countable, 'lg'),
    [countable, deity]
  );
  const deityCounts = useMemo(
    () => countBy(language ? countable.filter((b) => hasTag(b, 'lg', language)) : countable, 'd'),
    [countable, language]
  );
  const hasCategories = bhajans.some((b) => b?.lg || b?.d);
  // Music option counts follow the deity and language choices and the other music filters.
  const musicCounts = useMemo(() => {
    if (!showMusic) return null;
    const names = countable.filter((b) => (!deity || hasTag(b, 'd', deity)) && (!language || hasTag(b, 'lg', language))).map((b) => b.n);
    return musicFacetCounts(names, music, musicFilters);
  }, [showMusic, countable, deity, language, music, musicFilters]);

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
    window.searchMusic = musicFilters;
  }, [filter, language, deity, musicFilters]);

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
  const chooseMusic = (facet, value) => {
    setMusicFilters((current) => ({ ...current, [facet]: value }));
    if (value) track('filter_bhajans', { filter_type: facet, filter_value: value });
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
    return isLyricsLocation(loc) ? (
      <Link to={`/pdf/${loc}/${name}`} className='lyrics'>
        {child} <Icon name='book' className='lyrics-icon' />
      </Link>
    ) : (
      <span>{child}</span>
    );
  };

  const rowRenderer = ({ index, key, style }) => {
    const bhajan = bhajans[filteredBhajans[index]];
    if (!bhajan) return null;
    const { sm: sheetmusic, n: name, t: tags = '', l: locationArr, cs: cdbabySampleUrls, az: amazonTrack, lg: bhajanLanguage, d: bhajanDeity, y: songYear } = bhajan;
    const tagContent = tags ? ` (${tags})` : '';
    const songMusic = showMusic ? music.songs[name] : null;
    // Open sheet music in the key this reader last chose for the song.
    const sheetFile = sheetmusic && preferredSheetFile(sheetmusic, (song) => rememberedSheetKey(sheetKeys, song));

    return (
      <div key={key} style={style}>
        <div className='bhajanRow'>
          <div className='Search_LeftSide'>
            {wrappedName(
              locationArr.find(isLyricsLocation) ||
                locationArr[0],
              `${filteredBhajans[index]}/${name}`,
              <Highlight className='spaced' words={filter.split(' ')} text={`${name}${tagContent || ''}`} />
            )}
            {(bhajanLanguage || bhajanDeity || songYear) && (
              <span className='bhajan-categories'>
                {[bhajanDeity, bhajan.d2].filter(Boolean).map((value) => (
                  <button
                    key={`d-${value}`}
                    type='button'
                    className={deity === value ? 'category-chip deity active' : 'category-chip deity'}
                    aria-pressed={deity === value}
                    aria-label={`Show only ${value} bhajans`}
                    onClick={() => chooseDeity(deity === value ? '' : value)}>
                    {value}
                  </button>
                ))}
                {[bhajanLanguage, bhajan.lg2].filter(Boolean).map((value) => (
                  <button
                    key={`lg-${value}`}
                    type='button'
                    className={language === value ? 'category-chip language active' : 'category-chip language'}
                    aria-pressed={language === value}
                    aria-label={`Show only ${value} bhajans`}
                    onClick={() => chooseLanguage(language === value ? '' : value)}>
                    {value}
                  </button>
                ))}
                {songYear && (
                  <span className='category-chip year' title={SONG_YEAR_HINT}>
                    {songYear}
                  </span>
                )}
              </span>
            )}
            {songMusic && <MusicChips entry={songMusic} music={music} />}
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
                to={`/pdf/${sheetFile}/${filteredBhajans[index]}/${name}`}>
                <Icon name='music' />
              </Link>
            )}
            {amazonTrack && (
              <a
                className='button button-3d button-circle button-jumbo spaced'
                href={amazonTrackUrl(amazonTrack)}
                target='_blank'
                rel='noopener noreferrer'
                aria-label='Buy on Amazon'
                onClick={() => track('buy_click', { bhajan_name: name, store: 'amazon' })}>
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

  // The push opt-in (and the Firebase it needs) waits until the list is up and the browser is idle.
  const [promptReady, setPromptReady] = useState(false);
  const listLoaded = bhajans.length > 0;
  useEffect(() => {
    if (!listLoaded) return;
    const ready = () => setPromptReady(true);
    if (typeof window.requestIdleCallback !== 'function') {
      const timer = setTimeout(ready, 2000);
      return () => clearTimeout(timer);
    }
    const id = window.requestIdleCallback(ready, { timeout: 5000 });
    return () => window.cancelIdleCallback(id);
  }, [listLoaded]);
  const favoriteCount = useMemo(() => bhajans.filter((b) => favorites[b?.n]).length, [bhajans, favorites]);

  // Home extras: read once per visit so they don't jump around while browsing.
  const [recent] = useState(() => recentBhajans());
  const [favoritesAtVisit] = useState(() => favorites);
  const resumeItems = useMemo(
    () =>
      recent
        .map((item) => ({ ...item, path: viewerPath(bhajans, item) }))
        .filter((item) => item.path)
        .slice(0, 3),
    [recent, bhajans]
  );
  const todaysPick = useMemo(
    () => (bhajans.length ? bhajanOfTheDay(bhajans, { favorites: favoritesAtVisit, recent }) : null),
    [bhajans, favoritesAtVisit, recent]
  );
  const todaysPath = todaysPick && viewerPath(bhajans, { name: todaysPick.bhajan.n, location: todaysPick.location });
  const showHomeExtras = !myFavoritesMode && !filter && !language && !deity && !musicFiltering && (todaysPath || resumeItems.length > 0);
  const { sm: infoSheetMusic = [], n: infoName, t: infoTags = [], l: infoLocation = [], cs: infoSampleUrls = [], cn: infoNames = [], az: infoAmazon } = infoOpen || {};
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
        <div className='modal-panel' onClick={(e) => e.stopPropagation()}>
          <div className='modal-head'>
            <h1 id='modal-title' className='modal-title'>
              {infoName}
            </h1>
            <button
              type='button'
              ref={closeButtonRef}
              aria-label='close details modal'
              onClick={(e) => {
                e.stopPropagation();
                setInfo(false);
              }}
              title='Close'
              className='button button-circle modal-close'>
              <Icon name='close' />
            </button>
          </div>
          <div className='modal-body'>
            {infoLocation.length > 0 && (
              <section className='modal-section'>
                <h2 className='modal-label'>Found in books</h2>
                {infoLocation.map((pdf) => (
                  <span key={pdf} className='block'>
                    {wrappedName(
                      pdf,
                      `${infoFilteredIndex}/${infoName}`,
                      locationLabel(pdf)
                    )}
                  </span>
                ))}
              </section>
            )}

            {infoSheetMusic.length > 0 && (
              <section className='modal-section'>
                <h2 className='modal-label'>Sheet music</h2>
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
              </section>
            )}

            <SongMusicSection name={infoName} />

            {cdbabyLinks.length > 0 && (
              <section className='modal-section'>
                <h2 className='modal-label'>Song samples</h2>
                <ul className='sample-list'>
                  {cdbabyLinks.map(([sample, name], i) => {
                    const label = name || `Sample ${i + 1}`;
                    const isPlaying = playing === sample;
                    return (
                      <li key={sample} className='sample-row'>
                        <button
                          type='button'
                          className='button button-circle sample-play'
                          aria-label={`${isPlaying ? 'Stop' : 'Play'} sample: ${label}`}
                          aria-pressed={isPlaying}
                          onClick={() => (isPlaying ? stop() : play(sample, infoName))}>
                          <Icon name={isPlaying ? 'stop' : 'play'} />
                        </button>
                        <span className='sample-name'>{label}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {infoAmazon && (
              <section className='modal-section'>
                <h2 className='modal-label'>Buy</h2>
                <a
                  className='sample-buy'
                  href={amazonTrackUrl(infoAmazon)}
                  target='_blank'
                  rel='noopener noreferrer'
                  onClick={() => track('buy_click', { bhajan_name: infoName, store: 'amazon' })}>
                  <Icon name='cart' />
                  <span>Amma&apos;s recording on Amazon</span>
                </a>
              </section>
            )}

            {(infoOpen?.d || infoOpen?.lg || infoOpen?.y || infoTags.length > 0) && (
              <section className='modal-section'>
                <dl className='modal-facts'>
                  {infoOpen.d && (
                    <div>
                      <dt>Deity</dt>
                      <dd>{[infoOpen.d, infoOpen.d2].filter(Boolean).join(', ')}</dd>
                    </div>
                  )}
                  {infoOpen.lg && (
                    <div>
                      <dt>Language</dt>
                      <dd>{[infoOpen.lg, infoOpen.lg2].filter(Boolean).join(', ')}</dd>
                    </div>
                  )}
                  {infoOpen.y && (
                    <div>
                      <dt>Year</dt>
                      <dd title={SONG_YEAR_HINT}>{infoOpen.y}</dd>
                    </div>
                  )}
                  {infoTags.length > 0 && (
                    <div>
                      <dt>Tags</dt>
                      <dd>{infoTags.join(', ')}</dd>
                    </div>
                  )}
                </dl>
              </section>
            )}
          </div>
        </div>
      </div>
      <Header>
        <form role='search' className='search-form' onSubmit={(e) => e.preventDefault()}>
        <input
          type='search'
          placeholder='Search Bhajans'
          autoFocus
          autoComplete='off'
          className='form-control'
          name='search'
          id='search'
          aria-label='search'
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
          }}
        />
        </form>
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
          {!myFavoritesMode && <React.Suspense fallback={null}>{promptReady && <NotificationPrompt />}</React.Suspense>}
          {showHomeExtras && (
            <section className='home-extras' aria-label='For you'>
              {resumeItems.length > 0 && (
                <div className='resume'>
                  <h2 className='home-eyebrow'>Continue where you left off</h2>
                  <div className='resume-list'>
                    {resumeItems.map((item) => (
                      <Link
                        key={item.name}
                        to={item.path}
                        className='resume-item'
                        onClick={() => track('resume_reading', { bhajan_name: item.name })}>
                        <Icon name='book' />
                        <span className='resume-name'>{item.name}</span>
                        {item.page && <span className='resume-page'>p. {item.page}</span>}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {todaysPath && (
                <Link
                  to={todaysPath}
                  className='bhajan-of-the-day'
                  onClick={() => track('open_bhajan_of_the_day', { bhajan_name: todaysPick.bhajan.n })}>
                  <span className='home-eyebrow'>Bhajan of the day</span>
                  <span className='botd-name'>{todaysPick.bhajan.n}</span>
                  <span className='botd-meta'>
                    {[todaysPick.reason && 'Picked for you', todaysPick.bhajan.d, todaysPick.bhajan.lg]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </Link>
              )}
            </section>
          )}
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
          {showMusic && musicCounts && (
            <details className='music-filter-panel' open={musicPanelOpen} onToggle={(e) => setMusicPanelOpen(e.currentTarget.open)}>
              <summary>
                <Icon name='music' /> Music filters
                {activeMusicFilters(musicFilters) && (
                  <span className='music-filter-count'>{MUSIC_FACETS.filter((f) => musicFilters[f.id]).length} on</span>
                )}
              </summary>
            <div className='category-filters music-filters' role='group' aria-label='Filter by music'>
              {MUSIC_FACETS.map((facet) => (
                <FilterSelect
                  key={facet.id}
                  id={`music-filter-${facet.id}`}
                  label={facet.title}
                  allLabel={facet.allLabel}
                  value={musicFilters[facet.id] || ''}
                  counts={musicCounts[facet.id]}
                  optionLabel={(value) => facet.label(value, music)}
                  order={facet.order}
                  onChange={(value) => chooseMusic(facet.id, value)}
                />
              ))}
              <label className='filter-check'>
                <input
                  type='checkbox'
                  checked={Boolean(musicFilters.sureOnly)}
                  onChange={(e) => setMusicFilters((current) => ({ ...current, sureOnly: e.target.checked }))}
                />
                Only confident matches
              </label>
              {activeMusicFilters(musicFilters) && (
                <button
                  type='button'
                  className='filter-clear'
                  aria-label='Clear music filters'
                  onClick={() => setMusicFilters(EMPTY_MUSIC_FILTERS)}>
                  <Icon name='close' /> Clear
                </button>
              )}
            </div>
            </details>
          )}
          {(language || deity || filter || musicFiltering) && (
            <p className='result-count' aria-live='polite'>
              {filteredBhajans.length} {filteredBhajans.length === 1 ? 'bhajan' : 'bhajans'}
            </p>
          )}
        </nav>
        {bhajans.length === 0 ? (
          <div className='list-loading' aria-busy='true' />
        ) : (
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
                    rowHeight={showMusic ? MUSICIAN_ROW_HEIGHT : ROW_HEIGHT}
                    rowRenderer={rowRenderer}
                    scrollTop={scrollTop}
                    width={width}
                  />
                )}
              </AutoSizer>
            </>
          )}
        </WindowScroller>
        )}
        {bhajans.length > 0 && (
          <div className='report-problem'>
            <p>Wrong page, typo or missing bhajan?</p>
            <button type='button' className='report-problem-button' onClick={openProblemReport}>
              <Icon name='flag' /> Report a bhajan problem
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Search;
