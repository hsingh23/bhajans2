import React, { Component } from 'react';
import 'react-virtualized/styles.css';
import { List, WindowScroller, AutoSizer } from 'react-virtualized';
import Highlighter from 'react-highlight-words';
import { Link } from 'react-router-dom';

class App extends Component {
  constructor(props, context) {
    super(props, context);
    this.state = { filteredBhajans: [] };
  }

  componentWillMount() {
    if (window.bhajans) {
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
    while ((result = re.exec(location)) !== null) {
      if (result.index > lastIndex) {
        results.push(location.slice(lastIndex, result.index));
      }
      results.push(<Link to={`/pdf/${result[0]}/${name}`}>{result[0]}</Link>);
      lastIndex = re.lastIndex;
    }
    return <span className="spaced">{results}</span>;
  };

  // The meat and potatoes
  makeSearchable = line =>
    line
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
          <Highlighter searchWords={filter.split(' ')} textToHighlight={name} />
          {this.linkify(name, location)}
        </div>
      );
    };

    return (
      <div className="App">
        <div className="App-header">
          <div className="title">Amma's Bhajans</div>
          <input
            type="search"
            placeholder="Search Bhajans"
            autoFocus
            class="form-control"
            name="search"
            id="search"
            value={filter}
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
                    rowHeight={80}
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
