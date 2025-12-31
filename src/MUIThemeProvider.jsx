import React from 'react';
import { ThemeProvider as MUIThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { useTheme } from './ThemeContext';

const MUIThemeWrapper = ({ children }) => {
  const { isDarkMode } = useTheme();

  const theme = createTheme({
    palette: {
      mode: isDarkMode ? 'dark' : 'light',
      primary: {
        main: '#ff6b35',
      },
      secondary: {
        main: isDarkMode ? '#66b2b2' : '#156161',
      },
      background: {
        default: isDarkMode ? '#1a1a1a' : '#ffffff',
        paper: isDarkMode ? '#2d2d2d' : '#ffffff',
      },
      text: {
        primary: isDarkMode ? '#e0e0e0' : 'rgba(0, 0, 0, 0.84)',
        secondary: isDarkMode ? '#b0b0b0' : 'rgba(0, 0, 0, 0.54)',
      },
    },
    typography: {
      fontFamily: '"Lato", "Helvetica Neue", Helvetica, Arial, sans-serif',
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
          },
          contained: {
            backgroundColor: isDarkMode ? '#333' : '#eee',
            color: isDarkMode ? '#ccc' : '#666',
            '&:hover': {
              backgroundColor: isDarkMode ? '#404040' : '#f6f6f6',
            },
          },
        },
      },
      MuiCircularProgress: {
        styleOverrides: {
          colorPrimary: {
            color: '#ff6b35',
          },
        },
      },
    },
  });

  return (
    <MUIThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </MUIThemeProvider>
  );
};

export default MUIThemeWrapper;