import { Link } from 'react-router-dom';
// import ReactPDF from 'react-pdf';
import PDF from 'react-pdf-js';
import React, { PureComponent } from 'react';

const canRenderPdfNatively = function() {
  function hasAcrobatInstalled() {
    function getActiveXObject(name) {
      try {
        return new ActiveXObject(name); // eslint-disable-line
      } catch (e) {}
    }

    return getActiveXObject('AcroPDF.PDF') || getActiveXObject('PDF.PdfCtrl');
  }

  function isIos() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  }

  return navigator.mimeTypes['application/pdf'] || hasAcrobatInstalled() || isIos();
};

class RenderPage extends PureComponent {
  constructor(props) {
    super(props);
    const page = this.props.match.params.location.split('-')[1];
    this.state = { page: parseInt(page, 10) };
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
          <div className="title">Amma's Bhajans</div>
          <nav>
            {this.props.match.params.name} {' '}
            <Link to={'/'}>Back </Link>
          </nav>
        </div>
        <div className="rest">
          {canRenderPdfNatively()
            ? <embed src={`/pdfs/${book}.pdf#page=${page}`} style={{ width: '100vw', height: 'calc( 100vh - 56px )' }} />
            : <span>
                <PDF
                  file={`/pdfs/${book}.pdf`}
                  onDocumentComplete={this.onDocumentComplete}
                  onPageComplete={this.onPageComplete}
                  page={this.state.page}
                  style={{ height: 'calc( 100vh - 56px )', display: 'block', margin: '0 auto' }}
                />
                {pagination}
              </span>}
        </div>
      </div>
    );
  }
}

export default RenderPage;
