import React, { Component } from "react";
import "react-virtualized/styles.css";
import { List, WindowScroller, AutoSizer } from "react-virtualized";
import Highlighter from "react-highlight-words";
import { Link } from "react-router-dom";
// import { withRouter } from 'react-router';

class Search extends Component {
  constructor(props) {
    super(props);
    this.state = { filteredBhajans: [] };
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.location.pathname !== nextProps.location.pathname) {
      this.filterBhajans({ nextProps, filter: nextProps.path.includes("/my-favorites") ? "" : null });
    }
  }

  componentWillMount() {
    setTimeout(function() {
      if (document.scrollingElement) {
        document.scrollingElement.scrollTop =
          window.scrollTop || (document.scrollingElement && document.scrollingElement.scrollTop) || 0;
      } else {
        document.body.scrollTop = window.scrollTop || 0;
      }
    }, 0);

    if (window.searchableBhajans) {
      this.filterBhajans();
    } else {
      window
        .fetch("./bhajan-index2.json")
        .then(data => data.json())
        .then(fetchedBhajans => {
          window.fetchedBhajans = fetchedBhajans;
          window.searchableBhajans = fetchedBhajans.map(o => this.makeSearchable(o.n + o.l.join("") + o.t));
        })
        .then(() => this.filterBhajans());
    }
  }

  wrappedName = (location, name, child) => {
    const match = location.match(/\d{4}supl-\d+|vol\d-\d+/gi);
    return match ? <Link to={`/pdf/${match[0]}/${name}`}>{child}</Link> : { child };
  };

  audioTag = document.querySelector("#audio");

  play = url => {
    this.audioTag.src = url.toLowerCase();
    this.audioTag.play();
  };

  linkify = (name, location) => {
    var re = /\d{4}supl-\d+|vol\d-\d+/gi;
    var results = [];
    var lastIndex = re.lastIndex;
    var result;
    location = location.replace(/[,/]/g, " ");
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
    return <span className="spaced rightAligned">{results}</span>;
  };

  // The meat and potatoes
  // TODO: to make page load faster, we can pre compute searchable text
  makeSearchable = line =>
    line
      .toLowerCase()
      .replace(/[^A-z0-9]/g, "")
      .replace(/ri?/g, "ri")
      .replace(/[kg]il/g, "kgil") // 2
      .replace(/[vw]/g, "vw")
      .replace(/ny?/g, "ny")
      .replace(/h/g, "")
      .replace(/a+/g, "a")
      .replace(/k+/g, "k")
      .replace(/t+/g, "t")
      .replace(/[iey]+/g, "iey")
      .replace(/[uo]+/g, "uo")
      .replace(/[tdl]/g, "tdl")
      .replace(/z/g, "r");

  filterBhajans = ({ filter, nextProps } = {}) => {
    // fetchedBhajans is optionally passed - after fetch request
    filter = (filter !== undefined ? filter : window.searchFilter) || "";
    window.searchFilter = filter;
    window.searchableBhajans = window.searchableBhajans || [];

    const searchableFilter = this.makeSearchable(filter);
    const filterFavorites = nextProps
      ? nextProps.path.includes("/my-favorites")
      : this.props.path.includes("/my-favorites");

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
      const {
        sm: sheetmusic,
        n: name,
        t: tags = "",
        l: location,
        cs: cdbabySampleUrls,
        cu: cdbabyBuyUrls
      } = window.fetchedBhajans[filteredBhajans[index]];
      const tag = tags ? ` (${tags})` : "";
      return (
        <div key={key} style={style} className="bhajanRow">
          <div className="capitalize">
            {this.wrappedName(
              location[0],
              `${filteredBhajans[index]}/${name}`,
              <Highlighter className="spaced" searchWords={filter.split(" ")} textToHighlight={`${name}${tag}`} />
            )}
          </div>
          <span className="Search_RightSide">
            {sheetmusic && (
              <Link
                className="button button-3d button-circle button-action button-jumbo"
                to={`/pdf/${sheetmusic[0]}/${filteredBhajans[index]}/${name}`}
              >
                <span role="img" aria-label="sheet music">
                  🎼
                </span>
              </Link>
            )}
            {cdbabyBuyUrls && (
              <a
                className="button button-3d button-circle button-action button-jumbo"
                href={cdbabyBuyUrls[0]}
                target="_blank"
              >
                <span role="img" aria-label="cd">
                  💿
                </span>
              </a>
            )}
            {cdbabySampleUrls && (
              <button
                className="button button-3d button-circle button-action button-jumbo"
                onClick={() => this.play(cdbabySampleUrls[0])}
              >
                <span role="img" aria-label="music sample">
                  🎧
                </span>
              </button>
            )}
            {this.props.renderFavorite(name)}
          </span>
        </div>
      );
    };
    if (window.ga && !window.setGAUid && localStorage.uid) {
      window.setGAUid = true;
      window.ga && window.ga("set", { userId: localStorage.uid });
    }
    const myFavorites = window.location.hash.includes("/my-favorites");

    return (
      <div className="App">
        <div className="App-header">
          <Link to={+localStorage.admin ? "/admin" : "/"} className="title">
            Amma's Bhajans
          </Link>
          <input
            type="search"
            placeholder="Search Bhajans"
            autoFocus
            className="form-control"
            name="search"
            id="search"
            value={filter || ""}
            onChange={e => e && e.target && this.filterBhajans({ filter: e.target.value })}
          />
        </div>
        <div className="rest">
          <nav>
            {!myFavorites ? (
              <Link to="/my-favorites" className="button button-glow button-rounded button-raised button-action">
                Only My Favorites
              </Link>
            ) : (
              <Link to="/" className="button button-glow button-rounded button-raised button-primary">
                Home
              </Link>
            )}
          </nav>
          <WindowScroller>
            {({ height, isScrolling, onChildScroll, scrollTop }) => {
              window.scrollTop =
                (document.scrollingElement && document.scrollingElement.scrollTop) ||
                window.pageYOffset ||
                window.scrollTop;
              return (
                <AutoSizer disableHeight>
                  {({ width }) => (
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
                    />
                  )}
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
