import { Link } from 'react-router-dom';
import PDF from 'react-pdf-js';
import React, { PureComponent } from 'react';

const canRenderPdfNatively = function() {
  // TODO: perhaps do this with screen size
  function hasAcrobatInstalled() {
    function getActiveXObject(name) {
      try {
        return new ActiveXObject(name); // eslint-disable-line
      } catch (e) {}
    }
    return getActiveXObject('AcroPDF.PDF') || getActiveXObject('PDF.PdfCtrl');
  }

  return navigator.mimeTypes['application/pdf'] || hasAcrobatInstalled();
};

class RenderPage extends PureComponent {
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

  onPageComplete = page => this.setState({ page });
  onDocumentComplete = pages => this.setState({ pages });
  handlePrevious = () => this.state.page > 1 && this.setState({ page: this.state.page - 1 });
  handleNext = () => this.state.page < this.state.pages && this.setState({ page: this.state.page + 1 });

  render() {
    const [book, page] = this.props.match.params.location.split('-');
    const pagination = this.state.pages
      ? <span>
          <span className="pdf-previous" onClick={this.handlePrevious} />
          <span className="pdf-next" onClick={this.handleNext} />
          <span className="pdf-prev-arrow arrow" />
          <span className="pdf-next-arrow arrow" />
        </span>
      : null;

    return (
      <div className="App">
        <div className="App-header">
          <img src="favicon.ico" alt="Sing " />
          <div className="title">Amma's Bhajans</div>
          <div style={{ flexGrow: 1 }}>
            {this.props.match.params.name}
          </div>
          <nav style={{ float: 'right', display: 'block' }}>
            <Link to={'/'} className="button button-rounded button-">
              Back
            </Link>
            {this.props.renderFavorite(this.props.match.params.name, 'button button-action button-circle', 'button button-circle')}
          </nav>
        </div>
        <div className="rest">
          {true && canRenderPdfNatively()
            ? <embed src={`/pdfs/${book}.pdf#page=${page}`} style={{ width: '100vw', height: 'calc( 100vh - 56px )' }} />
            : <span>
                <PDF
                  file={`/pdfs/${book}.pdf`}
                  onDocumentComplete={this.onDocumentComplete}
                  onPageComplete={this.onPageComplete}
                  page={this.state.page}
                  scale={3}
                  style={{ width: '100vw', display: 'block', margin: '0 auto' }}
                />
                {pagination}
              </span>}
        </div>
      </div>
    );
  }
}

export default RenderPage;
