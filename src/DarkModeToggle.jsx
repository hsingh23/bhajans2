import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSun, faMoon } from '@fortawesome/free-solid-svg-icons';
import { useTheme } from './ThemeContext';
import { library } from '@fortawesome/fontawesome-svg-core';

library.add(faSun, faMoon);

const DarkModeToggle = ({ className = "button button-3d button-circle" }) => {
  const { isDarkMode, toggleDarkMode } = useTheme();

  return (
    <button
      className={className}
      onClick={toggleDarkMode}
      aria-label={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
    >
      <FontAwesomeIcon 
        icon={isDarkMode ? 'sun' : 'moon'} 
        color={isDarkMode ? '#ffd700' : '#4a5568'}
      />
    </button>
  );
};

export default DarkModeToggle;