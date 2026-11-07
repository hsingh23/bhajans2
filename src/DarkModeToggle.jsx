import React from 'react';
import Icon from './Icon';
import { useTheme } from './ThemeContext';

const getIconAndLabel = (themeMode) => {
  switch (themeMode) {
    case 'light':
      return { icon: 'moon', nextLabel: 'dark' };
    case 'dark':
      return { icon: 'monitor', nextLabel: 'system' };
    case 'system':
    default:
      return { icon: 'sun', nextLabel: 'light' };
  }
};

const DarkModeToggle = ({ className = "button button-3d button-circle" }) => {
  const { themeMode, toggleDarkMode } = useTheme();
  const { icon, nextLabel } = getIconAndLabel(themeMode);

  return (
    <button
      className={className}
      onClick={toggleDarkMode}
      aria-label={`Switch to ${nextLabel} mode`}
      title={`Switch to ${nextLabel} mode (current: ${themeMode})`}
    >
      <Icon name={icon} />
    </button>
  );
};

export default DarkModeToggle;