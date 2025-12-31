// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from "./ThemeContext";
import Search from './Search';

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

// Mock scrollTo
window.scrollTo = vi.fn();

// Sample bhajan data
const mockBhajans = [
  { n: 'Amme Narayana', l: ['vol1-10'], t: 'devotional', cs: null },
  { n: 'Devi Devi Devi', l: ['vol2-5'], t: 'goddess', cs: ['http://sample.com/devi.mp3'] },
  { n: 'Hari Om Namah Shivaya', l: ['vol1-25'], t: 'shiva', cs: null },
  { n: 'Krishna Krishna', l: ['vol3-1'], t: 'krishna', cs: null },
  { n: 'Om Namah Shivaya', l: ['vol2-15'], t: 'shiva', cs: null },
];

const mockSearchableBhajans = mockBhajans.map(b => 
  (b.n + b.l.join('') + b.t).toLowerCase().replace(/[^a-z0-9]/g, '')
);

// Mock fetch
global.fetch = vi.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve(mockBhajans),
  })
);

const renderSearch = (favorites = {}, path = '/') => {
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <Search 
          path={path}
          favorites={favorites}
          renderFavorite={(name) => <button data-testid={`fav-${name}`}>♥</button>}
          bhajans={mockBhajans}
        />
      </MemoryRouter>
    </ThemeProvider>
  );
};

describe('Search Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    window.fetchedBhajans = mockBhajans;
    window.searchableBhajans = mockSearchableBhajans;
    window.searchFilter = '';
  });

  afterEach(() => {
    window.fetchedBhajans = null;
    window.searchableBhajans = null;
    window.searchFilter = '';
  });

  it('renders search input', () => {
    renderSearch();
    expect(screen.getByRole('search')).toBeInTheDocument();
  });

  it('renders the app header with logo', () => {
    renderSearch();
    expect(screen.getByAltText(/Amma/i)).toBeInTheDocument();
  });

  it('shows filter to favorites button on main page', () => {
    renderSearch({}, '/');
    expect(screen.getByText(/Filter to my Favorites/i)).toBeInTheDocument();
  });

  it('shows all bhajans button when on favorites page', () => {
    renderSearch({}, '/my-favorites');
    expect(screen.getByText(/Show All Bhajans/i)).toBeInTheDocument();
  });

  it('updates search filter on input change', () => {
    renderSearch();
    
    const searchInput = screen.getByRole('search');
    fireEvent.change(searchInput, { target: { value: 'shiva' } });
    
    expect(searchInput).toHaveValue('shiva');
  });

  it('persists search filter to window object', () => {
    renderSearch();
    
    const searchInput = screen.getByRole('search');
    fireEvent.change(searchInput, { target: { value: 'test' } });
    
    // The filter is stored in window.searchFilter for persistence
    expect(window.searchFilter).toBe('test');
  });
});

// Note: Tests for filtering and virtualized list content are better suited for E2E tests
// because react-virtualized requires actual DOM dimensions to render items
