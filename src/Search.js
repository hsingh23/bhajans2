import React, { Component } from 'react';
import 'react-virtualized/styles.css';
import { List, WindowScroller, AutoSizer } from 'react-virtualized';
import Highlighter from 'react-highlight-words';
import { Link } from 'react-router-dom';
// import { withRouter } from 'react-router';

class Search extends Component {
  constructor(props) {
    super(props);
    this.state = { filteredBhajans: [] };
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.location.pathname !== nextProps.location.pathname) {
      this.filterBhajans({ nextProps, filter: nextProps.path.includes('/my-favorites') ? '' : null });
    }
  }

  componentWillMount() {
    setTimeout(function () {
      document.scrollingElement.scrollTop = window.scrollTop || document.scrollingElement.scrollTop;
    }, 0);

    if (window.searchableBhajans) {
      this.filterBhajans();
    } else {
      window
        .fetch('./bhajan-index2.json')
        .then(data => data.json())
        .then(fetchedBhajans => {
          window.fetchedBhajans = fetchedBhajans;
          window.searchableBhajans = fetchedBhajans.map(o => this.makeSearchable(o.n + o.l.join(',')));
        })
        .then(() => this.filterBhajans());
    }
  }

  wrappedName = (location, name, child) => {
    const match = location.match(/\d{4}supl-\d+|vol\d-\d+/gi);
    return match
      ? <Link to={`/pdf/${match[0]}/${name}`}>
        {child}
      </Link>
      : { child };
  };

  audioTag = document.querySelector('#audio')

  play = (url) => {
    this.audioTag.src = url.toLowerCase();
    this.audioTag.play()
  }

  linkify = (name, location) => {
    var re = /\d{4}supl-\d+|vol\d-\d+/gi;
    var results = [];
    var lastIndex = re.lastIndex;
    var result;
    location = location.replace(/[,/]/g, ' ');
    // should I remove links from the pages
    // return <span className="spaced rightAligned">{location}</span>;
    // eslint-disable-next-line
    while ((result = re.exec(location)) !== null) {
      if (result.index > lastIndex) {
        results.push(location.slice(lastIndex, result.index));
      }
      results.push(
        <Link key={`/pdf/${result[0]}/${name}`} to={`/pdf/${result[0]}/${name}`}>
          {result[0]}
        </Link>
      );
      lastIndex = re.lastIndex;
    }
    return (
      <span className="spaced rightAligned">
        {results}
      </span>
    );
  };

  // The meat and potatoes
  // TODO: to make page load faster, we can pre compute searchable text
  makeSearchable = line =>
    line
      .toLowerCase()
      .replace(/[^A-z0-9]/g, '')
      .replace(/kr/g, 'kri')
      .replace(/hr/g, 'hri')
      .replace(/h/g, '')
      .replace(/a+/g, 'a')
      .replace(/[iey]+/g, 'iey')
      .replace(/[uo]+/g, 'uo')
      .replace(/[tdl]/g, 'tdl')
      .replace(/z/g, 'r');

  filterBhajans = ({ filter, nextProps } = {}) => {
    console.log('called');
    // fetchedBhajans is optionally passed - after fetch request
    filter = (filter !== undefined ? filter : window.searchFilter) || '';
    window.searchFilter = filter;
    const searchableFilter = this.makeSearchable(filter);
    const filterFavorites = nextProps ? nextProps.path.includes('/my-favorites') : this.props.path.includes('/my-favorites')

    const filteredBhajans = window.searchableBhajans.reduce((memo, searchableBhajan, i) => {
      if (filterFavorites) {
        if (!this.props.favorites[window.fetchedBhajans[i].n]) return memo;
      }
      if (searchableBhajan.includes(searchableFilter)) memo.push(i);
      return memo;
    }, []);

    this.setState({ filteredBhajans });
  };

  render() {
    const { filteredBhajans } = this.state;
    const filter = window.searchFilter;
    const rowRenderer = ({ index, key, style }) => {
      const { n: name, l: location, cs: cdbabySampleUrls, cu: cdbabyBuyUrls } = window.fetchedBhajans[filteredBhajans[index]];
      return (
        <div key={key} style={style} className="bhajanRow">
          {this.wrappedName(location[0], name, <Highlighter className="spaced" searchWords={filter.split(' ')} textToHighlight={name} />)}
          <span className="Search_RightSide">
            {cdbabyBuyUrls && <a className='button button-3d button-circle button-action button-jumbo' href={cdbabyBuyUrls[0]} target='_blank' >$</a>}
            {cdbabySampleUrls && <button className='button button-3d button-circle button-action button-jumbo' onClick={() => this.play(cdbabySampleUrls[0])}>▶</button>}
            {this.props.renderFavorite(name)}
          </span>
        </div>
      );
    };

    if (!window.setGAUid && localStorage.uid) {
      window.setGAUid = true;
      window.ga('set', { userId: localStorage.uid });
    }
    const myFavorites = window.location.hash.includes('/my-favorites');

    return (
      <div className="App">
        <div className="App-header">
          <Link to={+localStorage.admin ? '/admin' : '/'} className="title">
            Amma's Bhajans
          </Link>
          <input
            type="search"
            placeholder="Search Bhajans"
            autoFocus
            className="form-control"
            name="search"
            id="search"
            value={filter || ''}
            onChange={e => e && e.target && this.filterBhajans({ filter: e.target.value })}
          />
        </div>
        <div className="rest">
          <nav>
            {!myFavorites
              ? <Link to="/my-favorites" className="button button-glow button-rounded button-raised button-action">
                Only My Favorites
                </Link>
              : <Link to="/" className="button button-glow button-rounded button-raised button-primary">
                Home
                </Link>}
          </nav>
          <WindowScroller>
            {({ height, isScrolling, onChildScroll, scrollTop }) => {
              window.scrollTop = document.scrollingElement.scrollTop || window.scrollTop;
              return (
                <AutoSizer disableHeight>
                  {({ width }) =>
                    <List
                      autoHeight
                      height={height}
                      isScrolling={isScrolling}
                      onScroll={onChildScroll}
                      rowCount={filteredBhajans.length}
                      rowHeight={100}
                      rowRenderer={rowRenderer}
                      scrollTop={scrollTop}
                      width={width}
                    />}
                </AutoSizer>
              );
            }}
          </WindowScroller>
        </div>
      </div>
    );
  }
}

export default Search;
