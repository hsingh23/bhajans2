// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './ThemeContext';
import { MusicianModeProvider } from './MusicianMode';
import Header from './Header';
import Search from './Search';
import { applyRemotePrefs, getPrefs, setPref } from './prefs';
import songsFixture from './__fixtures__/bhajan-music.json';
import referenceFixture from './__fixtures__/music-reference.json';

const mockSetRefOnce = vi.fn(() => Promise.resolve());
const mockAuth = { currentUser: null };
vi.mock('./loadFirebase', () => ({
  loadFirebase: () => Promise.resolve({ auth: mockAuth, setRefOnce: mockSetRefOnce, removeRefOnce: vi.fn() }),
  loadFirebaseWhenIdle: () => new Promise(() => {}),
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query) => ({
    matches: false,
    media: query,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  }),
});
window.scrollTo = vi.fn();

const MUSIC_URLS = ['/bhajan-music.json', '/music-reference.json'];
const jsonResponse = (body, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 404, json: () => Promise.resolve(body) });
const serveFixtures = () =>
  vi.fn((url) => {
    if (url === '/bhajan-music.json') return jsonResponse(songsFixture);
    if (url === '/music-reference.json') return jsonResponse(referenceFixture);
    return jsonResponse([]);
  });
const musicFetches = () => global.fetch.mock.calls.map(([url]) => url).filter((url) => MUSIC_URLS.includes(url));

const bhajans = [
  { n: 'kali kali kali (gujarati)', l: ['vol7-125'], d: 'Devi', lg: 'Gujarati', sm: ['KaliKaliKaliBb.pdf', 'KaliKaliKaliC.pdf', 'KaliKaliKaliG.pdf'] },
  { n: 'arivenum akakkan (tamil)', l: ['vol7-31'] },
  { n: 'abhayam abhayam amma', l: ['vol1-6'] },
];

const renderWithMode = (ui) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MusicianModeProvider>
          <MemoryRouter>{ui}</MemoryRouter>
        </MusicianModeProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

const renderSearch = () =>
  renderWithMode(<Search path='/' favorites={{}} renderFavorite={() => null} bhajans={bhajans} />);

const rowFor = (name) => screen.getAllByText(name).map((el) => el.closest('.bhajanRow')).find(Boolean);

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mockAuth.currentUser = null;
  window.dataLayer = [];
  window.searchFilter = '';
  window.searchableBhajans = null;
  global.fetch = serveFixtures();
});

afterEach(() => {
  localStorage.clear();
});

describe('musician mode toggle', () => {
  it('is off by default and labelled for screen readers', () => {
    renderWithMode(<Header />);
    const toggle = screen.getByRole('button', { name: 'Show musician details' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(toggle).toHaveAttribute('title', 'Show musician details');
  });

  it('turns on, persists on this device and is tracked', async () => {
    const { unmount } = renderWithMode(<Header />);
    fireEvent.click(screen.getByRole('button', { name: 'Show musician details' }));

    expect(screen.getByRole('button', { name: 'Hide musician details' })).toHaveAttribute('aria-pressed', 'true');
    expect(JSON.parse(localStorage.getItem('prefs'))).toEqual({ musicianMode: true });
    expect(window.dataLayer).toContainEqual({ event: 'toggle_musician_mode', musician_mode: 'on' });

    unmount();
    renderWithMode(<Header />);
    expect(screen.getByRole('button', { name: 'Hide musician details' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Hide musician details' }));
    expect(getPrefs().musicianMode).toBe(false);
    expect(window.dataLayer).toContainEqual({ event: 'toggle_musician_mode', musician_mode: 'off' });
  });

  it("saves the choice to a signed-in reader's prefs", async () => {
    mockAuth.currentUser = { uid: 'u1' };
    renderWithMode(<Header />);
    fireEvent.click(screen.getByRole('button', { name: 'Show musician details' }));
    await waitFor(() => expect(mockSetRefOnce).toHaveBeenCalledWith('prefs/u1/musicianMode', true));
  });

  it('does not write to the account when signed out', async () => {
    renderWithMode(<Header />);
    fireEvent.click(screen.getByRole('button', { name: 'Show musician details' }));
    await Promise.resolve();
    expect(mockSetRefOnce).not.toHaveBeenCalled();
  });

  it("takes the account's choice at sign-in and ignores anything else stored there", () => {
    renderWithMode(<Header />);
    act(() => applyRemotePrefs({ musicianMode: true, 'Remote Song': 1, viewer: { headerHidden: 'yes' } }));
    expect(screen.getByRole('button', { name: 'Hide musician details' })).toBeInTheDocument();
    expect(getPrefs()).toEqual({ musicianMode: true });
  });

  it('is not shown where there is no provider', () => {
    render(
      <ThemeProvider>
        <MemoryRouter>
          <Header />
        </MemoryRouter>
      </ThemeProvider>
    );
    expect(screen.queryByRole('button', { name: /musician details/ })).toBeNull();
  });
});

describe('musician details in search', () => {
  // react-virtualized only renders rows when its containers have a size
  const sizes = {};
  beforeEach(() => {
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

  it('shows and fetches nothing while the mode is off', async () => {
    renderSearch();
    fireEvent.click(within(rowFor('kali kali kali (gujarati)')).getByRole('button', { name: 'bhajan details' }));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(screen.queryByTestId('music-chips')).toBeNull();
    expect(screen.queryByText('For musicians')).toBeNull();
    expect(musicFetches()).toEqual([]);
  });

  it('shows shruti, raga and taal chips from the data once on', async () => {
    setPref('musicianMode', true);
    renderSearch();

    const chips = await within(rowFor('kali kali kali (gujarati)')).findByTestId('music-chips');
    expect(chips).toHaveTextContent('G · 5');
    expect(chips).toHaveTextContent('Mohanam');
    expect(chips).toHaveTextContent('Keherwa 8');
    expect(within(rowFor('arivenum akakkan (tamil)')).getByTestId('music-chips')).toHaveTextContent('Maand + Sarasangi');
    expect(musicFetches().sort()).toEqual([...MUSIC_URLS].sort());
  });

  it('shows nothing for a song with no entry', async () => {
    setPref('musicianMode', true);
    renderSearch();
    await within(rowFor('kali kali kali (gujarati)')).findByTestId('music-chips');

    expect(within(rowFor('abhayam abhayam amma')).queryByTestId('music-chips')).toBeNull();
    fireEvent.click(within(rowFor('abhayam abhayam amma')).getByRole('button', { name: 'bhajan details' }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByText('For musicians')).toBeNull();
  });

  it('adds a "For musicians" section to the details dialog', async () => {
    setPref('musicianMode', true);
    renderSearch();
    await within(rowFor('kali kali kali (gujarati)')).findByTestId('music-chips');
    fireEvent.click(within(rowFor('kali kali kali (gujarati)')).getByRole('button', { name: 'bhajan details' }));

    const section = await screen.findByRole('region', { name: 'For musicians' });
    expect(section).toHaveTextContent('G (5 kattai)');
    expect(section).toHaveTextContent('Also possible: Ab (5.5)');
    expect(section).toHaveTextContent('Hindustani: Bhupali');
    expect(section).toHaveTextContent('S R2 G3 P D2 S');
    expect(section).toHaveTextContent('G A B D E G');
    expect(section).toHaveTextContent('Carnatic: Adi');
    expect(section).toHaveTextContent('dha ge na ti');
    expect(section).toHaveTextContent('Count 1-2-3-4 at ~96 BPM');
    expect(within(section).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['I G', 'IV C', 'V D', 'vi Em']);
    expect(section).toHaveTextContent('Sing in G (5 kattai).');
    expect(section).toHaveTextContent(/may be imperfect/);
    expect(within(section).queryByText('approximate')).toBeNull();
  });

  it('lists each raga with its section and marks low-confidence songs', async () => {
    setPref('musicianMode', true);
    const lowConfidence = { n: 'ajnabi rah ke (hindi)', l: ['vol6-9'] };
    renderWithMode(
      <Search path='/' favorites={{}} renderFavorite={() => null} bhajans={[bhajans[1], lowConfidence]} />
    );
    await within(rowFor('arivenum akakkan (tamil)')).findByTestId('music-chips');

    fireEvent.click(within(rowFor('arivenum akakkan (tamil)')).getByRole('button', { name: 'bhajan details' }));
    let section = await screen.findByRole('region', { name: 'For musicians' });
    expect(section).toHaveTextContent('pallavi: Maand');
    expect(section).toHaveTextContent('charanam: Sarasangi');
    expect(section).toHaveTextContent('D E F# G A Bb C# D');

    fireEvent.click(screen.getByRole('button', { name: 'close details modal' }));
    fireEvent.click(within(rowFor('ajnabi rah ke (hindi)')).getByRole('button', { name: 'bhajan details' }));
    section = await screen.findByRole('region', { name: /For musicians/ });
    expect(within(section).getByText('approximate')).toBeInTheDocument();
  });

  it('shows nothing, without errors, when the data files are missing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    global.fetch = vi.fn(() => jsonResponse(null, false));
    setPref('musicianMode', true);
    renderSearch();

    await waitFor(() => expect(musicFetches().length).toBeGreaterThan(0));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByTestId('music-chips')).toBeNull();
    expect(screen.getByText('kali kali kali (gujarati)')).toBeInTheDocument();
    warn.mockRestore();
  });

  it('opens sheet music in the key the reader last used', () => {
    setPref('viewer/sheetKeys/KaliKaliKali', 'G');
    renderSearch();
    expect(within(rowFor('kali kali kali (gujarati)')).getByRole('link', { name: 'open sheet music' })).toHaveAttribute(
      'href',
      '/pdf/KaliKaliKaliG.pdf/0/kali kali kali (gujarati)'
    );
  });
});

describe('music data fixtures', () => {
  it('keep the public copies (used in development) the same as the test copies', () => {
    const read = (file) => JSON.parse(readFileSync(join(process.cwd(), 'public', file), 'utf8'));
    expect(read('bhajan-music.json')).toEqual(songsFixture);
    expect(read('music-reference.json')).toEqual(referenceFixture);
  });

  it('only name songs that are in the bhajan index', () => {
    const index = JSON.parse(readFileSync(join(process.cwd(), 'public', 'bhajan-index2.json'), 'utf8'));
    const names = new Set(index.map((b) => b.n));
    expect(Object.keys(songsFixture).filter((name) => !names.has(name))).toEqual([]);
  });
});
