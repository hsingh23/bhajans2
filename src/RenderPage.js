import React from 'react';
import { Link } from 'react-router-dom';
import ReactPDF from 'react-pdf'
import PDF from 'react-pdf-js'

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

const RenderPage = props => {
  const [book, page] = props.match.params.location.split('-');
  return (
    <div className="App">
      <div className="App-header">
        <div className="title">Amma's Bhajans</div>
        <nav>
          {props.match.params.name} {' '}
          <Link to={'/'}>Back </Link>
        </nav>
      </div>
      <div className="rest">
       { false  ? <embed src={`/pdfs/${book}.pdf#page=${page}`} style={{ width: '100vw', height: 'calc( 100vh - 56px )' }} /> : <PDF file={`/pdfs/${book}.pdf#page=${page}`}  page={page} pageIndex={page} style={{ width: '100vw', height: 'calc( 100vh - 56px )' }} /> }
      </div>
    </div>
  );
};

export default RenderPage;
