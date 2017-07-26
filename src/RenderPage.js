import { Link } from 'react-router-dom';
import PDF from 'react-pdf-js';
import React, { Component } from 'react';
import { onlyUpdateForKeys } from 'recompose';

// const canRenderPdfNatively = function() {
//   // TODO: perhaps do this with screen size
//   function hasAcrobatInstalled() {
//     function getActiveXObject(name) {
//       try {
//         return new ActiveXObject(name); // eslint-disable-line
//       } catch (e) {}
//     }
//     return getActiveXObject('AcroPDF.PDF') || getActiveXObject('PDF.PdfCtrl');
//   }

//   return navigator.mimeTypes['application/pdf'] || hasAcrobatInstalled();
// };

const Pdf = onlyUpdateForKeys(['page'])(PDF);
class RenderPage extends Component {
  constructor(props) {
    super(props);
    const page = props.match.params.location.split('-')[1];
    this.state = { page: parseInt(page, 10) };
    if (!+localStorage.beta) {
      //  beta -> render (this case should not happen)
      // if (auth.currentUser) props.history.push(`/beta?next=${encodeURIComponent(props.location.pathname)}`);
      // render -> login -> beta -> render
      props.history.push(`/login?next=${encodeURIComponent(props.location.pathname)}`);
      // TODO: if expired -> redirect to beta
    }
    // if (!+localStorage.paid) {
    //   if (!auth.currentUser) props.history.push(`/pay?next=${encodeURIComponent(props.location.pathname)}`);
    //   props.history.push(`/login?next=${encodeURIComponent(props.location.pathname)}`);
    // }
  }
  play = url => {
    this.audioTag.src = url.toLowerCase();
    this.audioTag.play();
  };
  audioTag = document.querySelector('#audio');
  onPageComplete = page => this.setState({ page });
  onDocumentComplete = pages => this.setState({ pages });
  handlePrevious = () => this.state.page > 1 && this.setState({ page: this.state.page - 1 });
  handleNext = () => this.state.page < this.state.pages && this.setState({ page: this.state.page + 1 });
  render() {
    const name = this.props.bhajans && this.props.bhajans[this.props.match.params.id] && this.props.bhajans[this.props.match.params.id].n;
    const cdbabyBuyUrls = this.props.bhajans && this.props.bhajans[this.props.match.params.id] && this.props.bhajans[this.props.match.params.id].cu;
    const cdbabySampleUrls = this.props.bhajans && this.props.bhajans[this.props.match.params.id] && this.props.bhajans[this.props.match.params.id].cs;
    const [book, page] = this.props.match.params.location.split('-');
    const pagination = this.state.pages
      ? <span>
          <span className="pdf-prev-arrow arrow" />
          <span className="pdf-next-arrow arrow" />
          <span className="pdf-previous" onClick={this.handlePrevious} />
          <span className="pdf-next" onClick={this.handleNext} />
        </span>
      : null;

    return (
      <div className="App">
        <div className="App-header">
          <Link to={'/'}>
            <img className="favicon" src="favicon.ico" alt="Sing " />
          </Link>
          <div style={{ flexGrow: 1, textOverflow: 'ellipsis', textTransform: 'capitalize' }}>
            {name}
          </div>
          <nav style={{ flex: '0 0 160px' }}>
            {cdbabyBuyUrls &&
              <a className="button button-3d button-circle button-action" href={cdbabyBuyUrls[0]} target="_blank">
                📀
              </a>}
            {cdbabySampleUrls &&
              <button className="button button-3d button-circle button-action" onClick={() => this.play(cdbabySampleUrls[0])}>
                🎧
              </button>}
            {this.props.renderFavorite(name, 'button button-caution button-circle', 'button button-circle')}
            <Link to={'/'} className="button button-circle">
              🏠
            </Link>
          </nav>
        </div>
        <div className="rest">
          {false
            ? <embed src={`/pdfs/${book}.pdf#page=${page}`} style={{ width: '100vw', height: 'calc( 100vh - 56px )' }} />
            : <span>
                <Pdf
                  file={`/pdfs/${book}.pdf`}
                  onDocumentComplete={this.onDocumentComplete}
                  onPageComplete={this.onPageComplete}
                  page={this.state.page}
                  scale={3}
                  style={{ maxWidth: '1220px', width: '100vw', display: 'block', margin: '0 auto' }}
                />
                {pagination}
              </span>}
        </div>
      </div>
    );
  }
}

export default RenderPage;
