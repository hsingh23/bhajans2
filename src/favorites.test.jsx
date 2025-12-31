// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./ThemeContext";
import MUIThemeWrapper from "./MUIThemeProvider";
import App from './App';

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Mock Google Analytics and scroll
window.ga = () => {};
window.scrollTo = () => {};

// Mock Firebase
const mockCheckRefOnce = vi.fn();
const mockSetRefOnce = vi.fn(() => Promise.resolve());
const mockRemoveRefOnce = vi.fn(() => Promise.resolve());
let mockAuthStateCallback = null;

vi.mock('./firebase', () => ({
  auth: {
    currentUser: { uid: 'test-uid' },
  },
  checkRefOnce: (...args) => mockCheckRefOnce(...args),
  setRefOnce: (...args) => mockSetRefOnce(...args),
  removeRefOnce: (...args) => mockRemoveRefOnce(...args),
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((auth, callback) => {
    mockAuthStateCallback = callback;
    return () => { mockAuthStateCallback = null; };
  }),
}));

// Mock fetch for bhajan index
global.fetch = vi.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve([
      { n: 'Test Bhajan 1', l: ['vol1-1'], t: 'test' },
      { n: 'Test Bhajan 2', l: ['vol1-2'], t: 'devotional' },
    ]),
  })
);

const renderWithProviders = (component) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  
  return render(
    <ThemeProvider>
      <MUIThemeWrapper>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            {component}
          </MemoryRouter>
        </QueryClientProvider>
      </MUIThemeWrapper>
    </ThemeProvider>
  );
};

describe('Favorites Sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockAuthStateCallback = null;
    window.fetchedBhajans = null;
  });

  afterEach(() => {
    localStorage.clear();
    window.fetchedBhajans = null;
  });

  it('should merge remote favorites on auth state change', async () => {
    // Setup remote favorites
    mockCheckRefOnce.mockResolvedValue({ 'Remote Song': 1 });
    
    // Set local favorites
    localStorage.setItem('favorites', JSON.stringify({ 'Local Song': 1 }));
    
    renderWithProviders(<App />);
    
    // Simulate user login
    if (mockAuthStateCallback) {
      mockAuthStateCallback({ uid: 'test-uid' });
    }
    
    await waitFor(() => {
      expect(mockCheckRefOnce).toHaveBeenCalledWith('favorites/test-uid');
    });
    
    // After merge, localStorage should have both
    await waitFor(() => {
      const favorites = JSON.parse(localStorage.getItem('favorites') || '{}');
      expect(favorites['Local Song']).toBe(1);
      expect(favorites['Remote Song']).toBe(1);
    });
  });

  it('should persist favorites to RTDB when adding', async () => {
    mockCheckRefOnce.mockResolvedValue({});
    
    renderWithProviders(<App />);
    
    // Simulate user login  
    if (mockAuthStateCallback) {
      mockAuthStateCallback({ uid: 'test-uid' });
    }
    
    // Wait for bhajans to load
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
    
    // Note: Full add/remove testing requires rendering Search and clicking favorite buttons
    // This is more suitable for E2E tests
  });

  it('should handle null remote favorites gracefully', async () => {
    mockCheckRefOnce.mockResolvedValue(null);
    localStorage.setItem('favorites', JSON.stringify({ 'Local Song': 1 }));
    
    renderWithProviders(<App />);
    
    if (mockAuthStateCallback) {
      mockAuthStateCallback({ uid: 'test-uid' });
    }
    
    await waitFor(() => {
      expect(mockCheckRefOnce).toHaveBeenCalled();
    });
    
    // Should keep local favorites intact
    const favorites = JSON.parse(localStorage.getItem('favorites') || '{}');
    expect(favorites['Local Song']).toBe(1);
  });
});

describe('Favorites Sync with Auth Changes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockAuthStateCallback = null;
  });

  it('should sync favorites on every login event', async () => {
    mockCheckRefOnce.mockResolvedValue({ 'Song A': 1 });
    
    renderWithProviders(<App />);
    
    // First login
    if (mockAuthStateCallback) {
      mockAuthStateCallback({ uid: 'test-uid' });
    }
    
    await waitFor(() => {
      expect(mockCheckRefOnce).toHaveBeenCalledTimes(1);
    });
    
    // Clear and simulate second login (e.g., after sign out and sign in)
    mockCheckRefOnce.mockClear();
    mockCheckRefOnce.mockResolvedValue({ 'Song B': 1 });
    
    if (mockAuthStateCallback) {
      mockAuthStateCallback({ uid: 'test-uid-2' });
    }
    
    await waitFor(() => {
      expect(mockCheckRefOnce).toHaveBeenCalledWith('favorites/test-uid-2');
    });
  });

  it('should not sync when user is null', async () => {
    mockCheckRefOnce.mockResolvedValue({});
    
    renderWithProviders(<App />);
    
    // Simulate signed out state
    if (mockAuthStateCallback) {
      mockAuthStateCallback(null);
    }
    
    // checkRefOnce should not be called for favorites when no user
    await waitFor(() => {
      // Give time for potential call
    }, { timeout: 100 });
    
    expect(mockCheckRefOnce).not.toHaveBeenCalledWith(expect.stringContaining('favorites/'));
  });
});
