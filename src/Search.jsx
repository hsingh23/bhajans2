// @ts-nocheck
import React, { useState, useEffect, useMemo, useRef } from 'react';
import 'react-virtualized/styles.css';
import { List, WindowScroller, AutoSizer } from 'react-virtualized';
import Highlighter from 'react-highlight-words';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { zip } from 'lodash-es';
import classNames from 'classnames';
import { PopupButton } from '@typeform/embed-react';
import Header from './Header';

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
    const computed = bhajans.map((o) => makeSearchable(o.n + o.l.join('') + o.t));
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
      if (searchableBhajan.includes(searchableFilter)) memo.push(i);
      return memo;
    }, []) || [];
  }, [filter, favorites, path, bhajans, searchable]);

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
  }, [filter]);

  const play = (url) => {
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

  const wrappedName = (loc, name, child) => {
    // Pattern matches: YYYYsuplN-X (supplements), volN-X (volumes), and YYYY-X (year-only like 2025-53)
    const match = loc.match(/\d{4}(?:supl\d?)?-\d+|vol\d-\d+/gi);
    return match ? (
      <Link to={`/pdf/${match[0]}/${name}`} className='lyrics'>
        {child} <FontAwesomeIcon icon='book-open' />
      </Link>
    ) : (
      <span>{child}</span>
    );
  };

  const rowRenderer = ({ index, key, style }) => {
    const bhajan = bhajans[filteredBhajans[index]];
    if (!bhajan) return null;
    const { sm: sheetmusic, n: name, t: tags = '', l: locationArr, cs: cdbabySampleUrls, cn: cdbabyNames } = bhajan;
    const tagContent = tags ? ` (${tags})` : '';

    return (
      <div key={key} style={style}>
        <div className='bhajanRow'>
          <div className='Search_LeftSide'>
            {wrappedName(
              locationArr.find((loc) => loc.match(/\d{4}(?:supl\d?)?-\d+|vol\d-\d+/gi)) ||
                locationArr[0],
              `${filteredBhajans[index]}/${name}`,
              <Highlighter
                className='spaced'
                searchWords={filter.split(' ')}
                textToHighlight={`${name}${tagContent || ''}`}
              />
            )}
          </div>
          <span className='Search_RightSide'>
            <button
              aria-label='bhajan details'
              className='button button-3d button-circle button-jumbo spaced'
              onClick={() => setInfo(bhajan, filteredBhajans[index])}>
              <FontAwesomeIcon icon='info' />
            </button>
            {sheetmusic && (
              <Link
                className='button button-3d button-circle button-jumbo spaced'
                aria-label='open sheet music'
                to={`/pdf/${sheetmusic[0]}/${filteredBhajans[index]}/${name}`}>
                <FontAwesomeIcon icon='music' />
              </Link>
            )}
            {cdbabyNames && (
              <a
                className='button button-3d button-circle button-jumbo spaced'
                href={`https://www.amazon.com/s?k=${encodeURIComponent(cdbabyNames[0])} amma`}
                target='_blank'
                rel='noopener noreferrer'
                aria-label='buy song on cdbaby'>
                <FontAwesomeIcon icon='cart-arrow-down' />
              </a>
            )}
            {cdbabySampleUrls && (
              <button
                aria-label='play sample'
                className='button button-3d button-circle button-jumbo spaced'
                onClick={() => (playing === cdbabySampleUrls[0] ? stop() : play(cdbabySampleUrls[0]))}>
                <FontAwesomeIcon icon={playing === cdbabySampleUrls[0] ? 'stop' : 'play'} />
              </button>
            )}
            {renderFavorite(name)}
          </span>
        </div>
      </div>
    );
  };

  const myFavoritesMode = path.includes('/my-favorites');
  const { sm: infoSheetMusic = [], n: infoName, t: infoTags = [], l: infoLocation = [], cs: infoSampleUrls = [], cn: infoNames = [] } = infoOpen || {};
  const cdbabyLinks = zip(infoSampleUrls, infoNames);

  return (
    <div className='App'>
      <div
        className={classNames('modal-window', { open: !!infoOpen })}
        onClick={() => setInfoOpen(false)}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div onClick={(e) => e.stopPropagation()}>
          <button
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
              {infoSheetMusic.map((pdf) => (
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
                    onClick={() => (playing === sample ? stop() : play(sample))}>
                    <FontAwesomeIcon icon={playing === sample ? 'stop' : 'play'} />
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
          {!myFavoritesMode ? (
            <Link to='/my-favorites' className='button button-rounded button-raised button-action full'>
              Filter to my Favorites
            </Link>
          ) : (
            <Link to='/' className='button full button-rounded button-raised button-primary'>
              Show All Bhajans
            </Link>
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
                    noRowsRenderer={() => (
                      <div className="no-results">
                        <p>No bhajans found matching &quot;{filter}&quot;</p>
                      </div>
                    )}
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
        <PopupButton id='EVBTgcG5' style={{ fontSize: 20 }} className='my-button'>
          Bhajan Problem
        </PopupButton>
      </div>
    </div>
  );
};

export default Search;
