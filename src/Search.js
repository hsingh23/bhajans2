import React, { Component } from 'react';
import 'react-virtualized/styles.css';
import { List, WindowScroller, AutoSizer } from 'react-virtualized';
import Highlighter from 'react-highlight-words';
import { Link } from 'react-router-dom';
import ReactGA from 'react-ga';
import { withRouter } from 'react-router';

class Search extends Component {
  constructor(props) {
    super(props);
    this.state = { filteredBhajans: [] };
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.location.pathname !== nextProps.location.pathname) {
      this.filterBhajans();
    }
  }

  componentWillMount() {
    setTimeout(function() {
      document.scrollingElement.scrollTop = window.scrollTop || document.scrollingElement.scrollTop;
    }, 0);

    if (window.searchableBhajans) {
      this.filterBhajans();
    } else {
      window
        .fetch('./bhajan-index.json')
        .then(data => data.json())
        .then(fetchedBhajans => {
          window.fetchedBhajans = fetchedBhajans;
          window.searchableBhajans = fetchedBhajans.map(this.makeSearchable);
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
  makeSearchable = line =>
    line
      .toLowerCase()
      .replace(/ /g, '')
      .replace('krs', 'kris')
      .replace('hr', 'hri')
      .replace('h', '')
      .replace(/a+/g, 'a')
      .replace(/[iey]+/g, 'iey')
      .replace(/[uo]+/g, 'uo')
      .replace(/[tdl]/g, 'tdl')
      .replace('z', 'r');

  filterBhajans = ({ filter } = {}) => {
    // fetchedBhajans is optionally passed - after fetch request
    filter = (filter !== undefined ? filter : window.searchFilter) || '';
    window.searchFilter = filter;
    const searchableFilter = this.makeSearchable(filter);
    const filterFavorites = window.location.hash.includes('/my-favorites');

    const filteredBhajans = window.searchableBhajans.reduce((memo, bhajan, i) => {
      if (filterFavorites) {
        const bhajanNameIndex = window.fetchedBhajans[i].indexOf('##');
        const name = window.fetchedBhajans[i].slice(0, bhajanNameIndex).trim().toLowerCase();
        if (!this.props.favorites[name]) return memo;
      }
      if (bhajan.includes(searchableFilter)) memo.push(i);
      return memo;
    }, []);

    this.setState({ filteredBhajans });
  };

  render() {
    const { filteredBhajans } = this.state;
    const filter = window.searchFilter;
    const rowRenderer = ({ index, key, style }) => {
      const [name, location] = window.fetchedBhajans[filteredBhajans[index]].split(' ## ');
      return (
        <div key={key} style={style} className="bhajanRow">
          {this.wrappedName(location, name, <Highlighter className="spaced" searchWords={filter.split(' ')} textToHighlight={name} />)}
          <span className="Search_RightSide">
            {this.linkify(name, location)}
            {this.props.renderFavorite(name)}
          </span>
        </div>
      );
    };

    if (!window.setGAUid && localStorage.uid) {
      window.setGAUid = true;
      ReactGA.set({ userId: localStorage.uid });
    }
    const myFavorites = window.location.hash.includes('/my-favorites');

    return (
      <div className="App">
        <div className="App-header">
          <Link to={+localStorage.admin ? '/admin' : '/'}>
            <div className="title">Amma's Bhajans</div>
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
            {!myFavorites ? <Link to="/my-favorites">Only My Favorites</Link> : <Link to="/">Home</Link>}
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

export default withRouter(Search);
