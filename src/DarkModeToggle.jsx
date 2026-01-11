import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSun, faMoon, faDesktop } from '@fortawesome/free-solid-svg-icons';
import { useTheme } from './ThemeContext';
import { library } from '@fortawesome/fontawesome-svg-core';

library.add(faSun, faMoon, faDesktop);

const getIconAndLabel = (themeMode) => {
  switch (themeMode) {
    case 'light':
      return { icon: faMoon, color: '#4a5568', nextLabel: 'dark' };
    case 'dark':
      return { icon: faDesktop, color: '#ffd700', nextLabel: 'system' };
    case 'system':
    default:
      return { icon: faSun, color: '#66b2b2', nextLabel: 'light' };
  }
};

const DarkModeToggle = ({ className = "button button-3d button-circle" }) => {
  const { themeMode, toggleDarkMode } = useTheme();
  const { icon, color, nextLabel } = getIconAndLabel(themeMode);

  return (
    <button
      className={className}
      onClick={toggleDarkMode}
      aria-label={`Switch to ${nextLabel} mode`}
      title={`Switch to ${nextLabel} mode (current: ${themeMode})`}
    >
      <FontAwesomeIcon 
        icon={icon} 
        color={color}
      />
    </button>
  );
};

export default DarkModeToggle;