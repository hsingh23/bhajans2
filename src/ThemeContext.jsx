// @ts-nocheck
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  // themeMode: 'light' | 'dark' | 'system'
  const [themeMode, setThemeMode] = useState(() => {
    const saved = localStorage.getItem('themeMode');
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved;
    }
    // Migration: convert old boolean darkMode to new themeMode
    const oldDarkMode = localStorage.getItem('darkMode');
    if (oldDarkMode === 'true') return 'dark';
    if (oldDarkMode === 'false') return 'light';
    return 'system';
  });

  const [systemPrefersDark, setSystemPrefersDark] = useState(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  // Listen for system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => setSystemPrefersDark(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Compute effective dark mode
  const isDarkMode = useMemo(() => {
    if (themeMode === 'system') return systemPrefersDark;
    return themeMode === 'dark';
  }, [themeMode, systemPrefersDark]);

  // Apply theme to DOM
  useEffect(() => {
    localStorage.setItem('themeMode', themeMode);
    // Clean up old storage key
    localStorage.removeItem('darkMode');
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }, [themeMode, isDarkMode]);

  // Cycle through: light -> dark -> system -> light
  const toggleDarkMode = () => {
    setThemeMode((prev) => {
      if (prev === 'light') return 'dark';
      if (prev === 'dark') return 'system';
      return 'light';
    });
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, themeMode, toggleDarkMode, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
};