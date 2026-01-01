import React from 'react';
import { version } from '../package.json';

const Footer = () => {


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
