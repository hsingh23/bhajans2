import { Link } from "react-router-dom";
import PDF from "react-pdf-js";
import React, { Component } from "react";
import { onlyUpdateForKeys } from "recompose";
import { HotKeys } from "react-hotkeys";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { auth } from "firebase";
const THREE_MONTHS_MS = 7776000000;
const Pdf = onlyUpdateForKeys(["page"])(PDF);
const map = {
  left: "left",
  right: "right"
};
class RenderPage extends Component {
  constructor(props) {
    super(props);
    var page;
    if (!props.match.params.location.includes(".pdf")) {
      page = props.match.params.location.split("-")[1];
    } else {
      page = "1";
    }
    this.state = { page: parseInt(page, 10), initialPage: parseInt(page, 10) };

    if (
      !localStorage.expiresOn ||
      !localStorage.lastOnline ||
      +localStorage.expiresOn < +new Date() ||
      +localStorage.lastOnline + THREE_MONTHS_MS < +new Date()
    ) {
      auth()
        .signOut()
        .then(() => {
          localStorage.clear();
          if ("serviceWorker" in navigator) {
            navigator.serviceWorker.ready.then(registration => {
              registration.unregister();
            });
            navigator.serviceWorker.getRegistrations().then(function(registrations) {
              for (let registration of registrations) {
                registration.unregister();
              }
            });
          }
          props.history.push(`/login`);
        });
    }
  }
  play = url => {
    this.audioTag.src = url.toLowerCase();
    this.audioTag.play();
  };
  audioTag = document.querySelector("#audio");
  onPageComplete = page => this.setState({ page });
  onDocumentComplete = pages => this.setState({ pages });
  handlePrevious = () => this.state.page > this.state.initialPage && this.setState({ page: this.state.page - 1 });
  handleNext = () => this.state.page < this.state.pages && this.setState({ page: this.state.page + 1 });
  render() {
    const {
      bhajans = {},
      match: {
        params: { id, location }
      }
    } = this.props;
    const name = bhajans && bhajans[id] && bhajans[id].n;
    const cdbabyBuyUrls = bhajans && bhajans[id] && bhajans[id].cu;
    const cdbabySampleUrls = bhajans && bhajans[id] && bhajans[id].cs;
    var book,
      page,
      url,
      scale = 3;
    if (!location.includes(".pdf")) {
      [book, page] = location.split("-");
      url = `/pdfs/${book}.pdf`;
    } else {
      url = `https://s3.amazonaws.com/amma-bhajans-sheetmusic/${location}`;
      scale = 2;
      page = 1;
    }
    const pagination = this.state.pages ? (
      <span>
        <span className="pdf-prev-arrow arrow" />
        <span className="pdf-next-arrow arrow" />
        <span className="pdf-previous" onClick={this.handlePrevious} />
        <span className="pdf-next" onClick={this.handleNext} />
      </span>
    ) : null;

    const handlers = { left: this.handlePrevious, right: this.handleNext };

    return (
      <HotKeys keyMap={map} handlers={handlers} focused={true}>
        <div className="App">
          <div className="App-header">
            <Link to={"/"}>
              <img className="favicon" src="favicon.ico" alt="Sing " />
            </Link>
            <div style={{ flexGrow: 1, textOverflow: "ellipsis", textTransform: "capitalize" }}>{name}</div>
            <nav style={{ flex: "0 0 160px", display: "flex", justifyContent: "flex-end" }}>
              {cdbabyBuyUrls && (
                <a
                  className="button button-3d button-circle button-action"
                  href={cdbabyBuyUrls[0]}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span role="img" aria-label="cd">
                    <FontAwesomeIcon icon="cart-arrow-down" />
                  </span>
                </a>
              )}
              {cdbabySampleUrls && (
                <button
                  className="button button-3d button-circle button-action"
                  onClick={() => this.play(cdbabySampleUrls[0])}
                >
                  <span role="img" aria-label="music sample">
                    <FontAwesomeIcon icon="play" />
                  </span>
                </button>
              )}
              {this.props.renderFavorite(name, "button button-caution button-circle", "button button-circle")}
            </nav>
          </div>
          <div className="rest">
            {localStorage.presenter && Math.max(document.documentElement.clientWidth, window.innerWidth || 0) > 1200 ? (
              <embed
                src={`/pdfs/${book}.pdf#page=${page}`}
                style={{ width: "100vw", height: "calc( 100vh - 56px )" }}
              />
            ) : (
              <span>
                <Pdf
                  file={url}
                  onDocumentComplete={this.onDocumentComplete}
                  onPageComplete={this.onPageComplete}
                  page={this.state.page}
                  scale={scale}
                  style={{ maxWidth: "100vw", display: "block", margin: "0 auto" }}
                />

                {pagination}
              </span>
            )}
          </div>
        </div>
      </HotKeys>
    );
  }
}

export default RenderPage;
