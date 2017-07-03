import React, { Component } from 'react';
import 'react-virtualized/styles.css';
import { List, WindowScroller, AutoSizer } from 'react-virtualized';
import Highlighter from 'react-highlight-words';
import { Link } from 'react-router-dom';
import ReactGA from 'react-ga';
class App extends Component {
  constructor(props, context) {
    super(props, context);
    this.state = { filteredBhajans: [] };
  }

  componentWillMount() {
    if (localStorage.uid) ReactGA.set({ userId: localStorage.uid });
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

  linkify = (name, location) => {
    var re = /\d{4}supl-\d+|vol\d-\d+/gi;
    var results = [];
    var lastIndex = re.lastIndex;
    var result;
    location = location.replace(/[,/]/g, ' ');
    // eslint-disable-next-line
    while ((result = re.exec(location)) !== null) {
      if (result.index > lastIndex) {
        results.push(location.slice(lastIndex, result.index));
      }
      results.push(<Link key={`/pdf/${result[0]}/${name}`} to={`/pdf/${result[0]}/${name}`}>{result[0]}</Link>);
      lastIndex = re.lastIndex;
    }
    return <span className="spaced rightAligned">{results}</span>;
  };

  // The meat and potatoes
  makeSearchable = line =>
    line
      .toLowerCase()
      .replace(' ', '')
      .replace('krs', 'kris')
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
    const filteredBhajans = window.searchableBhajans.reduce((memo, bhajan, i) => {
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
          <Highlighter className="spaced" searchWords={filter.split(' ')} textToHighlight={name} />
          {this.linkify(name, location)}
        </div>
      );
    };

    return (
      <div className="App">
        <div className="App-header">
          <Link to={+localStorage.admin ? '/admin' : '/'}><div className="title">Amma's Bhajans</div></Link>
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
          <WindowScroller>
            {({ height, isScrolling, onChildScroll, scrollTop }) =>
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
              </AutoSizer>}
          </WindowScroller>
        </div>
      </div>
    );
  }
}

export default App;
