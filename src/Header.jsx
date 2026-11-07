import React from 'react';
import { Link } from 'react-router-dom';
import DarkModeToggle from './DarkModeToggle';
import { useGoBack } from './useGoBack';

const Header = ({ children = null, back = false, title = "", rightContent = null }) => {
  const handleBack = useGoBack();

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
        
        {children && <div style={{ marginLeft: '10px', flex: 1, minWidth: 0, display: 'flex' }}>{children}</div>}
      </div>

      <nav className="header-right">
        {rightContent}
        <DarkModeToggle className="button button-circle header-darkmode" />
      </nav>
    </div>
  );
};

export default Header;
