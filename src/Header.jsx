import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DarkModeToggle from './DarkModeToggle';

const Header = ({ children = null, back = false, title = "", rightContent = null }) => {
  const navigate = useNavigate();
  
  const handleBack = () => {
    if (window.history.length <= 1) {
      window.location.href = window.location.origin + "/#/";
    } else {
      navigate(-1);
    }
  };

  return (
    <div className='App-header'>
      <div className="header-center">
        {back ? (
          <button
            type="button"
            aria-label="Go back"
            className="back-button"
            onClick={handleBack}>
            <img className='header-logo' src='/amma.jpg' alt='Back' />
          </button>
        ) : (
          <Link to={+localStorage.admin ? '/admin' : '/'} className='title'>
            <img src="/amma.jpg" alt="Amma" className="header-logo" />
          </Link>
        )}
        
        {title && <div className="header-title" style={{ marginLeft: children ? '10px' : '0' }}>{title}</div>}
        
        {children && <div style={{ marginLeft: '10px', flex: 1, display: 'flex' }}>{children}</div>}
      </div>

      <nav className="header-right">
        {rightContent}
        <DarkModeToggle className="button button-3d button-circle" />
      </nav>
    </div>
  );
};

export default Header;
