import React from 'react';
import Icon from './Icon';
import { useTheme } from './ThemeContext';

const getIconAndLabel = (themeMode) => {
  switch (themeMode) {
    case 'light':
      return { icon: 'moon', color: '#4a5568', nextLabel: 'dark' };
    case 'dark':
      return { icon: 'monitor', color: '#ffd700', nextLabel: 'system' };
    case 'system':
    default:
      return { icon: 'sun', color: '#66b2b2', nextLabel: 'light' };
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
      <Icon name={icon} color={color} />
    </button>
  );
};

export default DarkModeToggle;