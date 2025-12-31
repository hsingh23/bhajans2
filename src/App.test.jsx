// @ts-nocheck
import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./ThemeContext";
import MUIThemeWrapper from "./MUIThemeProvider";
import App from './App';

const queryClient = new QueryClient();

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {}, // Deprecated
    removeListener: () => {}, // Deprecated
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Mock Google Analytics
window.ga = () => {};
window.scrollTo = () => {};

// Mock Firebase
vi.mock('./firebase', () => ({
  auth: {
    currentUser: { uid: 'test-uid' },
  },
  db: {},
  setRefOnce: vi.fn(() => Promise.resolve()),
  removeRefOnce: vi.fn(() => Promise.resolve()),
  checkRefOnce: vi.fn(() => Promise.resolve({})),
  getUserByEmail: vi.fn(),
}));

// Mock firebase/auth - return unsubscribe function
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(() => () => {}), // Return unsubscribe function
}));

// Mock fetch
global.fetch = vi.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve([]),
  })
);

// @ts-ignore
it('renders without crashing', () => {
  render(
    <ThemeProvider>
      <MUIThemeWrapper>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <App />
          </MemoryRouter>
        </QueryClientProvider>
      </MUIThemeWrapper>
    </ThemeProvider>
  );
});
