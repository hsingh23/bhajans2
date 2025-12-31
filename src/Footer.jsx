import React, { useState, useEffect } from 'react';
import classNames from 'classnames';
import { version } from '../package.json';

const Footer = () => {
  const [hidden, setHidden] = useState(!!sessionStorage.footerHidden);

  useEffect(() => {
    if (hidden) return;

    const timer = setTimeout(() => {
      sessionStorage.footerHidden = '1';
      setHidden(true);
    }, 10000);

    return () => clearTimeout(timer);
  }, [hidden]);

  return (
    <div className={classNames('copyRight', { hidden })}>
      <div className="footer-content">
        <img src="/amma.jpg" alt="MA Center" className="footer-logo" />
        <div className="footer-text">
          <small className="copyright-notice">
            © MA Centers 2023 & © Amrita Books 2023, all rights reserved.
          </small>
          <small className="version-info">v{version}</small>
        </div>
      </div>
    </div>
  );
};

export default Footer;
