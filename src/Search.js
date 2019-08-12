import React, { Component } from "react";
import "react-virtualized/styles.css";
import { List, WindowScroller, AutoSizer } from "react-virtualized";
import Highlighter from "react-highlight-words";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { orderBy, zip } from "lodash-es";
import classNames from "classnames";

class Search extends Component {
  constructor(props) {
    super(props);
    this.state = {
      filteredBhajans: [],
      playing: false,
      infoOpen: false,
      infoFilteredIndex: false,
      copyRightHidden: !!sessionStorage.copyRightHidden
    };
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.location.pathname !== nextProps.location.pathname) {
      this.filterBhajans({ nextProps, filter: nextProps.path.includes("/my-favorites") ? "" : null });
    }
  }
  componentDidMount() {
    setTimeout(() => {
      sessionStorage.copyRightHidden = 1;
      this.setState({ copyRightHidden: true });
    }, 10000);
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
          fetchedBhajans = orderBy(fetchedBhajans, ["n", "t"], ["asc", "asc"]);
          window.fetchedBhajans = fetchedBhajans;
          window.searchableBhajans = fetchedBhajans.map(o => this.makeSearchable(o.n + o.l.join("") + o.t));
        })
        .then(() => this.filterBhajans());
    }
  }

  wrappedName = (location, name, child) => {
    const match = location.match(/\d{4}supl-\d+|vol\d-\d+/gi);
    return match ? (
      <Link to={`/pdf/${match[0]}/${name}`} className="lyrics">
        {child} <FontAwesomeIcon icon="book-open" />
      </Link>
    ) : (
      <span>{child}</span>
    );
  };

  audioTag = document.querySelector("#audio");

  play = url => {
    this.audioTag.src = url;
    this.audioTag.play();
    this.setState({ playing: url });
    this.audioTag.onEnded = this.stop;
  };

  stop = () => {
    this.audioTag.pause();
    this.setState({ playing: false });
  };

  makeSearchable = line =>
    line
      .toLowerCase()
      .replace(/[^A-z0-9]/g, "")
      .replace(/h/g, "")
      .replace(/z/g, "r")
      .replace(/ri?/g, "ri")
      .replace(/ai?/g, "ai")
      .replace(/ee/g, "i")
      .replace(/oo|uu/g, "u")
      .replace(/[kg]il/g, "kgil") // 2
      .replace(/[cj]al/g, "Cal")
      .replace(/[vw]/g, "V")
      .replace(/ny?/g, "ny")
      .replace(/a+/g, "a")
      .replace(/(t|k|c){2}/g, "$1")
      .replace(/(g|p|j){2}/g, "$1")
      .replace(/[ie]*y/g, "Y")
      .replace(/[tdl]/g, "T");

  filterBhajans = ({ filter, nextProps } = {}) => {
    // fetchedBhajans is optionally passed - after fetch request
    filter = (filter !== undefined ? filter : window.searchFilter) || "";
    window.searchFilter = filter;
    const searchableFilter = this.makeSearchable(filter);
    console.log(searchableFilter);
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

  setInfo = (infoOpen, infoFilteredIndex) => this.setState({ infoOpen, infoFilteredIndex });

  render() {
    const { filteredBhajans, playing, infoOpen, infoFilteredIndex } = this.state;
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
        <div key={key} style={style}>
          <div className="bhajanRow">
            <div className="Search_LeftSide">
              {this.wrappedName(
                location[0],
                `${filteredBhajans[index]}/${name}`,
                <Highlighter className="spaced" searchWords={filter.split(" ")} textToHighlight={`${name}${tag}`} />
              )}
            </div>
            <span className="Search_RightSide">
              <button
                aria-label="search"
                className="button button-3d button-circle button-jumbo spaced"
                onClick={() => this.setInfo(window.fetchedBhajans[filteredBhajans[index]], filteredBhajans[index])}
              >
                <span role="img" aria-label="info">
                  <FontAwesomeIcon icon="info" />
                </span>
              </button>
              {sheetmusic && (
                <Link
                  className="button button-3d button-circle button-jumbo spaced"
                  to={`/pdf/${sheetmusic[0]}/${filteredBhajans[index]}/${name}`}
                >
                  <span role="img" aria-label="sheet music">
                    <FontAwesomeIcon icon="music" />
                  </span>
                </Link>
              )}
              {cdbabyBuyUrls && (
                <a
                  className="button button-3d button-circle button-jumbo spaced"
                  href={cdbabyBuyUrls[0]}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="buy song on cdbaby"
                >
                  <span role="img" aria-label="cd">
                    <FontAwesomeIcon icon="cart-arrow-down" />
                  </span>
                </a>
              )}
              {cdbabySampleUrls && (
                <button
                  aria-label="play sample"
                  className="button button-3d button-circle button-jumbo spaced"
                  onClick={() => (playing === cdbabySampleUrls[0] ? this.stop() : this.play(cdbabySampleUrls[0]))}
                >
                  <span role="img" aria-label="music sample">
                    <FontAwesomeIcon icon={playing === cdbabySampleUrls[0] ? "stop" : "play"} />
                  </span>
                </button>
              )}
              {this.props.renderFavorite(name)}
            </span>
          </div>
        </div>
      );
    };
    if (window.ga && !window.setGAUid && localStorage.uid) {
      window.setGAUid = true;
      window.ga && window.ga("set", { userId: localStorage.uid });
    }
    const myFavorites = window.location.hash.includes("/my-favorites");
    const {
      sm: sheetmusic = [],
      n: name,
      t: tags = "",
      l: location = [],
      cs: cdbabySampleUrls = [],
      cu: cdbabyBuyUrls = [],
      cn: cdbabyNames = []
    } = infoOpen || {};
    const cdbabyLinks = zip(cdbabySampleUrls, cdbabyBuyUrls, cdbabyNames);
    return (
      <div className="App">
        <div
          className={classNames("modal-window", { open: !!infoOpen })}
          onClick={e => {
            e.stopPropagation();
            this.setState({ infoOpen: false });
          }}
        >
          <div
            onClick={e => {
              e.stopPropagation();
            }}
          >
            <button
              aria-label="close dialog"
              onClick={e => {
                e.stopPropagation();
                this.setInfo();
              }}
              title="Close"
              className="modal-close"
            >
              Close
            </button>
            <h1>{name}</h1>
            {location.length > 0 && (
              <div>
                <strong>Found in Books: </strong>

                {location.map(pdf => (
                  <span className="block">
                    {this.wrappedName(
                      pdf,
                      `${infoFilteredIndex}/${name}`,
                      pdf
                        .replace("voli", "Alternate Volume ")
                        .replace("vol", "Volume ")
                        .replace("-", ", page ")
                    )}
                  </span>
                ))}
                <hr />
              </div>
            )}

            {sheetmusic.length > 0 && (
              <div>
                <strong>Sheet Music: </strong>
                {sheetmusic.map(pdf => (
                  <Link to={`/pdf/${pdf}/${infoFilteredIndex}/${name}`} className="block">
                    {pdf}
                  </Link>
                ))}
                <hr />
              </div>
            )}

            {cdbabyLinks.length > 0 && (
              <div>
                <strong>CD Baby: </strong>

                {cdbabyLinks.map(([sample, buy, name]) => (
                  <div>
                    <button
                      aria-label="toggle sample"
                      role="img"
                      onClick={() => (!!playing ? this.stop() : this.play(sample))}
                    >
                      <FontAwesomeIcon icon={playing === sample ? "stop" : "play"} />
                    </button>
                    {" Buy "}
                    <a href={buy} target="_blank" rel="noopener noreferrer">
                      {name}
                    </a>
                  </div>
                ))}
                <hr />
              </div>
            )}

            {tags.length > 0 && (
              <div>
                <strong>Tags: </strong>
                <small>{tags.join(", ")}</small>
              </div>
            )}
          </div>
        </div>
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
            role="search"
            aria-label="search"
            value={filter || ""}
            onChange={e => e && e.target && this.filterBhajans({ filter: e.target.value })}
          />
        </div>
        <div className="rest">
          <nav>
            {!myFavorites ? (
              <Link to="/my-favorites" className="button button-rounded button-raised button-action full">
                Only My Favorites
              </Link>
            ) : (
              <Link to="/" className="button full button-rounded button-raised button-primary">
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
                      rowHeight={200}
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
        <div className={classNames("copyRight", { hidden: this.state.copyRightHidden })}>
          <img style={{ paddingLeft: "80px", display: "inline-block" }} src="amma.jpg" alt="Copyright: MA Center" />
          <small style={{ position: "absolute", top: "50%" }}>© MA Centers 2019, all rights reserved.</small>
        </div>
      </div>
    );
  }
}

export default Search;
