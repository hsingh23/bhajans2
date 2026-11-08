// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from "./ThemeContext";
import Search, { Highlight } from './Search';

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
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  it('renders the app header with logo', () => {
    renderSearch();
    expect(screen.getByAltText(/Amma/i)).toBeInTheDocument();
  });

  it('switches between all bhajans and favorites, marking the current view', () => {
    renderSearch({ 'Krishna Krishna': 1, 'Not In Index': 1 }, '/');
    const all = screen.getByRole('link', { name: /All bhajans/ });
    const favs = screen.getByRole('link', { name: /Favorites/ });
    expect(all).toHaveAttribute('aria-current', 'page');
    expect(all).toHaveTextContent('5');
    expect(favs).toHaveAttribute('href', '/my-favorites');
    // Only favorites that are in the index are counted.
    expect(favs).toHaveTextContent('1');
  });

  it('marks favorites as current on the favorites page', () => {
    renderSearch({}, '/my-favorites');
    expect(screen.getByRole('link', { name: /Favorites/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /All bhajans/ })).toHaveAttribute('href', '/');
  });

  it('updates search filter on input change', () => {
    renderSearch();
    
    const searchInput = screen.getByRole('searchbox');
    fireEvent.change(searchInput, { target: { value: 'shiva' } });
    
    expect(searchInput).toHaveValue('shiva');
  });

  it('persists search filter to window object', () => {
    renderSearch();
    
    const searchInput = screen.getByRole('searchbox');
    fireEvent.change(searchInput, { target: { value: 'test' } });
    
    // The filter is stored in window.searchFilter for persistence
    expect(window.searchFilter).toBe('test');
  });
});

// Note: Tests for filtering and virtualized list content are better suited for E2E tests
// because react-virtualized requires actual DOM dimensions to render items

const categorizedBhajans = [
  { n: 'amme narayana', l: ['vol1-10'], lg: 'Malayalam', d: 'Devi', az: 'B004G1T0UK' },
  { n: 'devi devi devi', l: ['vol2-5'], lg: 'Sanskrit', d: 'Devi' },
  { n: 'gopala gopala', l: ['vol1-25'], lg: 'Hindi', d: 'Krishna', cn: ['gopala gopala'] },
  { n: 'kanna va', l: ['vol3-1'], lg: 'Malayalam', d: 'Krishna' },
  { n: 'om namah sivaya', l: ['vol2-15'], lg: 'Sanskrit', d: 'Shiva' },
];

const renderCategorized = () =>
  render(
    <ThemeProvider>
      <MemoryRouter>
        <Search path='/' favorites={{}} renderFavorite={() => null} bhajans={categorizedBhajans} />
      </MemoryRouter>
    </ThemeProvider>
  );

describe('Search deity and language filters', () => {
  beforeEach(() => {
    window.searchableBhajans = null;
    window.searchFilter = '';
    window.searchLanguage = '';
    window.searchDeity = '';
  });

  it('lists each deity and language with its count', () => {
    renderCategorized();
    const deity = screen.getByLabelText('Deity');
    expect([...deity.options].map((o) => o.textContent)).toEqual([
      'All deities',
      'Devi (2)',
      'Krishna (2)',
      'Shiva (1)',
    ]);
    const language = screen.getByLabelText('Language');
    expect([...language.options].map((o) => o.textContent)).toEqual([
      'All languages',
      'Malayalam (2)',
      'Sanskrit (2)',
      'Hindi (1)',
    ]);
  });

  it('narrows results by deity, then by language, and clears both', () => {
    renderCategorized();
    fireEvent.change(screen.getByLabelText('Deity'), { target: { value: 'Krishna' } });
    expect(screen.getByText('2 bhajans')).toBeInTheDocument();
    // Language counts follow the chosen deity.
    expect([...screen.getByLabelText('Language').options].map((o) => o.textContent)).toEqual([
      'All languages',
      'Hindi (1)',
      'Malayalam (1)',
    ]);

    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'Malayalam' } });
    expect(screen.getByText('1 bhajan')).toBeInTheDocument();
    expect(window.searchDeity).toBe('Krishna');
    expect(window.searchLanguage).toBe('Malayalam');

    fireEvent.click(screen.getByRole('button', { name: /clear deity and language filters/i }));
    expect(screen.getByLabelText('Deity')).toHaveValue('');
    expect(screen.getByLabelText('Language')).toHaveValue('');
    expect(screen.queryByText(/^\d+ bhajans?$/)).not.toBeInTheDocument();
  });

  it('hides the filters when the index has no categories', () => {
    renderSearch();
    expect(screen.queryByLabelText('Deity')).not.toBeInTheDocument();
  });
});

describe('Highlight', () => {
  it('marks every case-insensitive match and escapes regex characters', () => {
    const { container } = render(<Highlight text='Om (Siva) om' words={['OM', '(siva)', '']} />);
    expect([...container.querySelectorAll('mark')].map((m) => m.textContent)).toEqual(['Om', '(Siva)', 'om']);
    expect(container.textContent).toBe('Om (Siva) om');
  });
});

describe('Bhajan details modal', () => {
  // react-virtualized only renders rows when its containers have a size
  const sizes = {};
  beforeEach(() => {
    window.searchableBhajans = null;
    window.searchFilter = '';
    window.searchLanguage = '';
    window.searchDeity = '';
    for (const prop of ['offsetWidth', 'offsetHeight']) {
      sizes[prop] = Object.getOwnPropertyDescriptor(HTMLElement.prototype, prop);
      Object.defineProperty(HTMLElement.prototype, prop, { configurable: true, get: () => 1000 });
    }
  });
  afterEach(() => {
    for (const prop of ['offsetWidth', 'offsetHeight']) {
      Object.defineProperty(HTMLElement.prototype, prop, sizes[prop]);
    }
  });

  it('stays out of the accessibility tree until opened', () => {
    renderCategorized();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it("links the buy button straight to Amma's track, and only for songs that have one", () => {
    renderCategorized();
    const buy = screen.getAllByRole('link', { name: 'Buy on Amazon' });
    expect(buy).toHaveLength(1);
    expect(buy[0]).toHaveAttribute('href', 'https://www.amazon.com/dp/B004G1T0UK');

    fireEvent.click(screen.getAllByRole('button', { name: 'bhajan details' })[0]);
    expect(screen.getByRole('link', { name: /Amma's recording on Amazon/ })).toHaveAttribute(
      'href',
      'https://www.amazon.com/dp/B004G1T0UK',
    );
  });

  it('shows the song year on its card and in the details, and nothing for songs without one', () => {
    const songs = [
      { n: 'amme narayana', l: ['vol1-10'], lg: 'Malayalam', d: 'Devi', y: 1985 },
      { n: 'kanna va', l: ['vol3-1'], lg: 'Malayalam', d: 'Krishna' },
    ];
    render(
      <ThemeProvider>
        <MemoryRouter>
          <Search path='/' favorites={{}} renderFavorite={() => null} bhajans={songs} />
        </MemoryRouter>
      </ThemeProvider>
    );
    const chips = document.querySelectorAll('.category-chip.year');
    expect([...chips].map((c) => c.textContent)).toEqual(['1985']);

    fireEvent.click(screen.getAllByRole('button', { name: 'bhajan details' })[0]);
    expect(within(screen.getByRole('dialog')).getByText('Year').nextElementSibling).toHaveTextContent('1985');
    fireEvent.keyDown(document, { key: 'Escape' });

    fireEvent.click(screen.getAllByRole('button', { name: 'bhajan details' })[1]);
    expect(within(screen.getByRole('dialog')).queryByText('Year')).toBeNull();
  });

  it('searches for a year when its chip is pressed, and clears it when pressed again', () => {
    const songs = [
      { n: 'amme narayana', l: ['vol1-10'], lg: 'Malayalam', d: 'Devi', y: 1985 },
      { n: 'kanna va', l: ['vol3-1'], lg: 'Malayalam', d: 'Krishna', y: 2010 },
    ];
    render(
      <ThemeProvider>
        <MemoryRouter>
          <Search path='/' favorites={{}} renderFavorite={() => null} bhajans={songs} />
        </MemoryRouter>
      </ThemeProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Show bhajans first sung in 1985' }));
    expect(screen.getByRole('searchbox', { name: 'search' })).toHaveValue('1985');
    expect(screen.queryByText('kanna va')).toBeNull();
    const chip = screen.getByRole('button', { name: 'Show bhajans first sung in 1985' });
    expect(chip).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(chip);
    expect(screen.getByRole('searchbox', { name: 'search' })).toHaveValue('');
  });

  it('opens with focus on Close and closes on Escape', () => {
    renderCategorized();
    const opener = screen.getAllByRole('button', { name: 'bhajan details' })[0];
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('amme narayana');
    expect(screen.getByRole('button', { name: 'close details modal' })).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('lays out the title, close button, samples and facts as aligned rows', () => {
    const song = {
      n: 'amme narayana',
      l: ['vol1-10'],
      lg: 'Malayalam',
      d: 'Devi',
      cs: ['https://example.com/a.mp3', 'https://example.com/b.mp3'],
      cn: ['Amme Narayana Vintage'],
      az: 'B004G1T0UK',
    };
    render(
      <ThemeProvider>
        <MemoryRouter>
          <Search path='/' favorites={{}} renderFavorite={() => null} bhajans={[song]} />
        </MemoryRouter>
      </ThemeProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: 'bhajan details' }));
    const dialog = screen.getByRole('dialog', { name: 'amme narayana' });

    // Close sits in the title row as an icon button, not a floating text box
    const close = within(dialog).getByRole('button', { name: 'close details modal' });
    expect(close).toHaveAttribute('title', 'Close');
    expect(close).toHaveClass('button', 'button-circle');
    expect(close.closest('.modal-head')).toContainElement(within(dialog).getByRole('heading', { level: 1 }));

    expect(within(dialog).getByRole('heading', { name: 'Found in books' })).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: 'Song samples' })).toBeInTheDocument();

    // One row per sample: play control and name; the song's own Amazon track gets one Buy link
    const rows = within(dialog).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    const play = within(rows[0]).getByRole('button', { name: 'Play sample: Amme Narayana Vintage' });
    expect(play).toHaveAttribute('aria-pressed', 'false');
    expect(within(rows[0]).queryByRole('link')).toBeNull();
    expect(within(rows[1]).getByRole('button', { name: 'Play sample: Sample 2' })).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: 'Buy' })).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: /Amma's recording on Amazon/ })).toHaveAttribute(
      'href',
      'https://www.amazon.com/dp/B004G1T0UK'
    );

    expect(within(dialog).getByText('Deity').nextElementSibling).toHaveTextContent('Devi');
    expect(within(dialog).getByText('Language').nextElementSibling).toHaveTextContent('Malayalam');
  });
});
