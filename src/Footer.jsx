import React, { useEffect, useState } from 'react';
import { version } from '../package.json';

const VISIBLE_MS = 3000;

const Footer = () => {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setHidden(true), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, []);

  if (hidden) return null;

  return (
    <div className="copyRight">
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
