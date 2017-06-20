import React from 'react';
import { Link } from 'react-router-dom';

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
        <embed src={`/pdfs/${book}.pdf#page=${page}`} style={{ width: '100vw', height: 'calc( 100vh - 56px )' }} />
      </div>
    </div>
  );
};

export default RenderPage;
