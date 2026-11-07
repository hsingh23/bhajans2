// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import RenderPage from './RenderPage';
import { ThemeProvider } from "./ThemeContext";
import MUIThemeWrapper from "./MUIThemeProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MusicianModeProvider } from "./MusicianMode";
import { setPref, getPrefs } from "./prefs";
import songsFixture from "./__fixtures__/bhajan-music.json";
import referenceFixture from "./__fixtures__/music-reference.json";

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

// Mock audio element
let mockAudio;
beforeEach(() => {
  mockAudio = {
    src: '',
    play: vi.fn(() => Promise.resolve()),
    pause: vi.fn(),
    paused: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  document.querySelector = vi.fn((selector) => {
    if (selector === '#audio') return mockAudio;
    return null;
  });
});

// Mock navigator and localStorage
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock InvertiblePDF to avoid PDF.js issues
vi.mock('./InvertiblePDF', async () => {
  const { useEffect, useRef } = await import('react');
  const MockPdf = ({ page, onDocumentComplete }) => {
    // Like react-pdf-js: report 0 pages before the document loads, then 5.
    // The document takes longer than the loading animation (mocked below).
    setTimeout(() => onDocumentComplete?.(0), 0);
    setTimeout(() => onDocumentComplete?.(5), 10);
    const canvasRef = useRef(null);
    // Like react-pdf-js: size the canvas once the page has been fetched.
    useEffect(() => {
      const timer = setTimeout(() => {
        if (canvasRef.current) canvasRef.current.height = 1000;
      }, 10);
      return () => clearTimeout(timer);
    }, [page]);
    return (
      <div data-testid="pdf-viewer" className="invertible-pdf-container">
        <canvas ref={canvasRef} />PDF Page {page}
      </div>
    );
  };
  return { default: MockPdf };
});

// The real loader is a Lottie animation drawn on a canvas of its own, which
// react sizes before the PDF page arrives; the viewer must not mistake it for the page.
vi.mock('./Loader', async () => {
  const { useEffect, useRef } = await import('react');
  const MockLoader = () => {
    const canvasRef = useRef(null);
    // Like the animation library: the canvas gets its size once the animation has loaded.
    useEffect(() => {
      const timer = setTimeout(() => {
        if (canvasRef.current) canvasRef.current.height = 300;
      }, 0);
      return () => clearTimeout(timer);
    }, []);
    return <canvas ref={canvasRef} data-testid='loader-canvas' />;
  };
  return { default: MockLoader };
});

vi.mock('./InvertibleEmbed', () => ({
  default: ({ src }) => <div data-testid="pdf-embed">{src}</div>,
}));

const mockBhajans = {
  0: { n: 'Test Bhajan', cu: ['http://buy.com'], cs: ['http://sample.mp3'] },
  1: { n: 'Another Bhajan', cu: null, cs: null },
};

const renderRenderPage = (props = {}, route = '/pdf/vol1-10/0/Test%20Bhajan', element) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  // Set valid localStorage values
  localStorage.setItem('lastOnline', String(Date.now()));
  localStorage.setItem('expiresOn', String(Date.now() + 86400000));
  
  const entries = [].concat(route);

  return render(
    <ThemeProvider>
      <MUIThemeWrapper>
        <QueryClientProvider client={queryClient}>
          <MusicianModeProvider>
          <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
            <Routes>
              <Route 
                path="/pdf/:location/:id/:name" 
                element={
                  element ?? (
                    <RenderPage
                      bhajans={mockBhajans}
                      renderFavorite={() => <button data-testid="favorite-btn">♥</button>}
                      {...props}
                    />
                  )
                }
              />
            </Routes>
          </MemoryRouter>
          </MusicianModeProvider>
        </QueryClientProvider>
      </MUIThemeWrapper>
    </ThemeProvider>
  );
};

describe('RenderPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('lastOnline', String(Date.now()));
    localStorage.setItem('expiresOn', String(Date.now() + 86400000));
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('renders PDF viewer with correct page', async () => {
    renderRenderPage();
    
    await waitFor(() => {
      expect(screen.getByTestId('pdf-viewer')).toBeInTheDocument();
    });
  });

  it('displays bhajan name in header', async () => {
    renderRenderPage();
    
    await waitFor(() => {
      expect(screen.getByText('Test Bhajan')).toBeInTheDocument();
    });
  });

  it('shows back button with proper accessibility', async () => {
    renderRenderPage();
    
    await waitFor(() => {
      const backButton = screen.getByRole('button', { name: /go back/i });
      expect(backButton).toBeInTheDocument();
      expect(backButton).toHaveClass('back-button');
    });
  });
});

describe('RenderPage Audio Controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('lastOnline', String(Date.now()));
    localStorage.setItem('expiresOn', String(Date.now() + 86400000));
    mockAudio.paused = true;
  });

  it('plays sample audio when play button is clicked', async () => {
    renderRenderPage();
    
    await waitFor(() => {
      expect(screen.getByTestId('pdf-viewer')).toBeInTheDocument();
    });
    
    const playButton = screen.getByRole('button', { name: /play sample/i });
    fireEvent.click(playButton);
    
    expect(mockAudio.play).toHaveBeenCalled();
    expect(mockAudio.src).toBe('http://sample.mp3');
  });

  it('stops audio when stop button is clicked', async () => {
    mockAudio.paused = false;
    
    renderRenderPage();
    
    await waitFor(() => {
      expect(screen.getByTestId('pdf-viewer')).toBeInTheDocument();
    });
    
    // First, play the audio
    const playButton = screen.getByRole('button', { name: /play sample/i });
    fireEvent.click(playButton);
    
    // Then click again to stop
    fireEvent.click(playButton);
    
    expect(mockAudio.pause).toHaveBeenCalled();
  });

  it('should clean up audio event listener on unmount', async () => {
    // This test validates that audio cleanup happens on unmount
    const { unmount } = renderRenderPage();
    
    await waitFor(() => {
      expect(screen.getByTestId('pdf-viewer')).toBeInTheDocument();
    });
    
    // Start playing
    const playButton = screen.getByRole('button', { name: /play sample/i });
    fireEvent.click(playButton);
    
    // Unmount (navigate away)
    unmount();
    
    // The audio element's event listener should be cleaned up
    expect(mockAudio.removeEventListener).toHaveBeenCalled();
  });
});

describe('RenderPage hideable header', () => {
  const PHONE_LANDSCAPE = [844, 390];
  const PHONE_PORTRAIT = [390, 844];
  const LAPTOP = [1024, 768];
  const originalSize = [window.innerWidth, window.innerHeight];

  const setViewport = ([width, height]) => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
    Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height });
  };
  const advance = (ms) => act(() => vi.advanceTimersByTime(ms));
  const isHidden = (container) => container.querySelector('.App').classList.contains('header-hidden');
  const floatingBack = (container) => container.querySelector('.viewer-back');

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    setViewport(originalSize);
    localStorage.clear();
  });

  it.each([
    ['landscape', PHONE_LANDSCAPE],
    ['portrait', PHONE_PORTRAIT],
  ])('hides the header 3 seconds after opening on a phone in %s', (_, size) => {
    setViewport(size);
    const { container } = renderRenderPage();

    advance(2999);
    expect(isHidden(container)).toBe(false);
    expect(floatingBack(container)).toBeNull();

    advance(1);
    expect(isHidden(container)).toBe(true);
    expect(floatingBack(container)).not.toBeNull();
  });

  it('keeps the header on larger screens', () => {
    setViewport(LAPTOP);
    const { container } = renderRenderPage();

    advance(10000);
    expect(isHidden(container)).toBe(false);
  });

  it('hides automatically when a window shrinks to a phone-sized height', () => {
    setViewport(LAPTOP);
    const { container } = renderRenderPage();

    setViewport(PHONE_LANDSCAPE);
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    advance(3000);

    expect(isHidden(container)).toBe(true);
  });

  it('toggles the header from the pull tab on any screen', () => {
    setViewport(LAPTOP);
    const { container } = renderRenderPage();

    fireEvent.click(screen.getByRole('button', { name: /hide top bar/i }));
    expect(isHidden(container)).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: /show top bar/i }));
    expect(isHidden(container)).toBe(false);
  });

  it('does not re-hide a header the user brought back', () => {
    setViewport(PHONE_LANDSCAPE);
    const { container } = renderRenderPage();

    advance(3000);
    fireEvent.click(screen.getByRole('button', { name: /show top bar/i }));
    advance(10000);

    expect(isHidden(container)).toBe(false);
  });

  it('does not auto-hide over a choice made during the first 3 seconds', () => {
    setViewport(PHONE_LANDSCAPE);
    const { container } = renderRenderPage();

    advance(1000);
    fireEvent.click(screen.getByRole('button', { name: /hide top bar/i }));
    fireEvent.click(screen.getByRole('button', { name: /show top bar/i }));
    advance(10000);

    expect(isHidden(container)).toBe(false);
  });

  it('returns to the previous page from the floating back button', () => {
    setViewport(PHONE_LANDSCAPE);
    const { container } = renderRenderPage({}, ['/', '/pdf/vol1-10/0/Test%20Bhajan']);

    advance(3000);
    fireEvent.click(floatingBack(container));

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('goes to search from a page whose URL was rewritten in place', () => {
    setViewport(PHONE_LANDSCAPE);
    const { container } = renderRenderPage({}, [{ pathname: '/pdf/vol1-10/0/Test%20Bhajan', search: '?page=11', state: { entryPoint: true }, key: 'rewritten' }]);

    advance(3000);
    fireEvent.click(floatingBack(container));

    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('goes to search when the viewer was the first page opened', () => {
    setViewport(PHONE_LANDSCAPE);
    const { container } = renderRenderPage();

    advance(3000);
    fireEvent.click(floatingBack(container));

    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('still turns pages by tapping while the header is hidden', () => {
    setViewport(PHONE_LANDSCAPE);
    const { container } = renderRenderPage({}, '/pdf/vol1-1/0/Test%20Bhajan');

    advance(3000);
    expect(isHidden(container)).toBe(true);

    fireEvent.click(container.querySelector('.pdf-next'));
    advance(0);

    expect(screen.getByTestId('pdf-viewer')).toHaveTextContent('PDF Page 2');
  });
});

// Note: Navigation tests with pagination controls and subscription redirect tests 
// are more reliable in E2E tests due to timing issues with fake timers and 
// document.querySelector in jsdom. See e2e/app.spec.js for comprehensive tests.

describe('RenderPage key picker', () => {
  const sheetBhajans = {
    3: {
      n: 'Fragrance',
      sm: ['FragranceC.pdf', 'IrulTingiC.pdf', 'FragranceDb.pdf', 'FragranceBb.pdf', 'IrulTingiD.pdf'],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('shows the current key and lists only the same song in other keys', () => {
    renderRenderPage({ bhajans: sheetBhajans }, '/pdf/FragranceDb.pdf/3/Fragrance');

    fireEvent.click(screen.getByRole('button', { name: 'Change key, now Db' }));

    const keys = screen.getAllByRole('menuitemradio');
    expect(keys.map((k) => k.textContent)).toEqual(['C', 'Db', 'Bb']);
    expect(screen.getByRole('menuitemradio', { name: 'Db' })).toHaveAttribute('aria-checked', 'true');
  });

  it('replaces the page with the chosen key so back still returns to search', () => {
    renderRenderPage({ bhajans: sheetBhajans }, '/pdf/FragranceDb.pdf/3/Fragrance');

    fireEvent.click(screen.getByRole('button', { name: 'Change key, now Db' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Bb' }));

    expect(mockNavigate).toHaveBeenCalledWith('/pdf/FragranceBb.pdf/3/Fragrance', {
      replace: true,
      // Opened directly, so the next page must still send back to search.
      state: { headerHidden: false, entryPoint: true },
    });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes the key list with Escape', () => {
    renderRenderPage({ bhajans: sheetBhajans }, '/pdf/FragranceDb.pdf/3/Fragrance');

    fireEvent.click(screen.getByRole('button', { name: 'Change key, now Db' }));
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('has no key picker for book pages or a single key', () => {
    renderRenderPage({ bhajans: { 3: { n: 'Solo', sm: ['SoloC.pdf'] } } }, '/pdf/SoloC.pdf/3/Solo');
    expect(screen.queryByRole('button', { name: /Change key/ })).toBeNull();
  });
});

describe('page number in the address', () => {
  const LocationProbe = () => <output data-testid='location'>{useLocation().search}</output>;
  const renderAt = (route) =>
    render(
      <ThemeProvider>
        <MUIThemeWrapper>
          <QueryClientProvider client={new QueryClient()}>
            <MemoryRouter initialEntries={[route]}>
              <Routes>
                <Route
                  path='/pdf/:location/:id/:name'
                  element={
                    <>
                      <RenderPage bhajans={mockBhajans} renderFavorite={() => null} />
                      <LocationProbe />
                    </>
                  }
                />
              </Routes>
            </MemoryRouter>
          </QueryClientProvider>
        </MUIThemeWrapper>
      </ThemeProvider>
    );

  beforeEach(() => {
    localStorage.setItem('lastOnline', String(Date.now()));
    localStorage.setItem('expiresOn', String(Date.now() + 86400000));
  });

  it('records the starting page so a reload can find it', async () => {
    renderAt('/pdf/vol1-3/0/Test%20Bhajan');
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('?page=3'));
  });

  it('reopens the page from the address after a reload', async () => {
    renderAt('/pdf/vol1-3/0/Test%20Bhajan?page=4');
    await waitFor(() => expect(screen.getByTestId('pdf-viewer')).toHaveTextContent('PDF Page 4'));
  });

  it('updates the address as pages turn', async () => {
    renderAt('/pdf/vol1-3/0/Test%20Bhajan');
    // Wait until the mocked 5-page document has loaded, so "next" is allowed.
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('?page=3'));
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('?page=4'));
  });

  it('ignores a page before the song starts or past the end', async () => {
    renderAt('/pdf/vol1-3/0/Test%20Bhajan?page=1');
    await waitFor(() => expect(screen.getByTestId('pdf-viewer')).toHaveTextContent('PDF Page 3'));
  });

  it('falls back to the last page when the address points past the end', async () => {
    renderAt('/pdf/vol1-3/0/Test%20Bhajan?page=99');
    // The mocked PDF has 5 pages.
    await waitFor(() => expect(screen.getByTestId('pdf-viewer')).toHaveTextContent('PDF Page 5'));
  });
});

describe('opening at the line where the song starts', () => {
  // The rendered page: 1000px tall, starting 100px below the top of the window.
  const canvasRect = { top: 100, height: 1000 };
  const original = HTMLCanvasElement.prototype.getBoundingClientRect;
  // bhajans[0] starts 65% of the way down page 3 of volume 1.
  const bhajans = { 0: { n: 'Test Bhajan', lo: { 'vol1-3': 0.65 } } };
  const route = '/pdf/vol1-3/0/Test%20Bhajan';

  beforeEach(() => {
    window.scrollTo = vi.fn();
    // A canvas has no height on the page until the viewer has sized it.
    HTMLCanvasElement.prototype.getBoundingClientRect = function () {
      return this.height === 1000 ? canvasRect : { top: canvasRect.top, height: 0 };
    };
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getBoundingClientRect = original;
  });

  it('scrolls the song title to just below the header', async () => {
    renderRenderPage({ bhajans }, route);
    // 100 (page top) + 650 (65% of 1000) - 64 (header)
    await waitFor(() => expect(window.scrollTo).toHaveBeenCalledWith(0, 686));
  });

  it('waits for the index to arrive before scrolling', async () => {
    // Like App: the viewer mounts with an empty index and gets the real one later.
    const LateIndex = () => {
      const [loaded, setLoaded] = useState({});
      useEffect(() => {
        const timer = setTimeout(() => setLoaded(bhajans), 50);
        return () => clearTimeout(timer);
      }, []);
      return <RenderPage bhajans={loaded} renderFavorite={() => null} />;
    };
    renderRenderPage({}, route, <LateIndex />);
    await waitFor(() => expect(screen.getByTestId('pdf-viewer')).toHaveTextContent('PDF Page 3'));
    expect(window.scrollTo).not.toHaveBeenCalled();
    await waitFor(() => expect(window.scrollTo).toHaveBeenCalledWith(0, 686));
  });

  it('waits for the page itself, not the loading animation drawn beside it', async () => {
    // The mocked Loader sizes its own canvas before the page's canvas is sized.
    renderRenderPage({ bhajans }, route);
    await waitFor(() => expect(window.scrollTo).toHaveBeenCalledWith(0, 686));
    // Never measured while the page still had no height.
    expect(window.scrollTo).not.toHaveBeenCalledWith(0, 36);
  });

  it('starts at the top when the index has no start position', async () => {
    renderRenderPage({ bhajans: { 0: { n: 'Test Bhajan' } } }, route);
    await waitFor(() => expect(window.scrollTo).toHaveBeenCalledWith(0, 36));
  });

  it('starts at the top when reopened on a later page', async () => {
    renderRenderPage({ bhajans }, `${route}?page=4`);
    await waitFor(() => expect(window.scrollTo).toHaveBeenCalledWith(0, 36));
    expect(window.scrollTo).not.toHaveBeenCalledWith(0, 686);
  });

  it('starts each turned page at the top', async () => {
    renderRenderPage({ bhajans }, route);
    await waitFor(() => expect(window.scrollTo).toHaveBeenCalledWith(0, 686));
    // Wait until the mocked 5-page document has loaded, so "next" is allowed.
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => expect(screen.getByTestId('pdf-viewer')).toHaveTextContent('PDF Page 4'));
    await waitFor(() => expect(window.scrollTo).toHaveBeenLastCalledWith(0, 36));
  });

  it('measures from the top of the window once the header is hidden', async () => {
    renderRenderPage({ bhajans }, [{ pathname: route, state: { headerHidden: true } }]);
    await waitFor(() => expect(window.scrollTo).toHaveBeenCalledWith(0, 750));
  });
});

describe('quick key change', () => {
  // C, Db, Eb and Bb only: stepping skips the missing keys.
  const gappy = { 3: { n: 'Fragrance', sm: ['FragranceBb.pdf', 'FragranceC.pdf', 'FragranceEb.pdf', 'FragranceDb.pdf'] } };
  const openAt = (file) => renderRenderPage({ bhajans: gappy }, `/pdf/${file}/3/Fragrance`);
  const opened = (file) => [`/pdf/${file}/3/Fragrance`, { replace: true, state: { headerHidden: false, entryPoint: true } }];

  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it('steps to the next available key down and up', () => {
    openAt('FragranceEb.pdf');
    fireEvent.click(screen.getByRole('button', { name: 'Lower key' }));
    expect(mockNavigate).toHaveBeenLastCalledWith(...opened('FragranceDb.pdf'));
    fireEvent.click(screen.getByRole('button', { name: 'Higher key' }));
    expect(mockNavigate).toHaveBeenLastCalledWith(...opened('FragranceBb.pdf'));
  });

  it('stops at the lowest and highest keys', () => {
    const { unmount } = openAt('FragranceC.pdf');
    expect(screen.getByRole('button', { name: 'Lower key' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Higher key' })).toBeEnabled();
    unmount();

    openAt('FragranceBb.pdf');
    expect(screen.getByRole('button', { name: 'Higher key' })).toBeDisabled();
    fireEvent.keyDown(window, { key: '=' });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('steps with - and = or + on a keyboard, but not while typing or zooming', () => {
    openAt('FragranceDb.pdf');
    fireEvent.keyDown(window, { key: '-' });
    expect(mockNavigate).toHaveBeenLastCalledWith(...opened('FragranceC.pdf'));
    fireEvent.keyDown(window, { key: '+' });
    expect(mockNavigate).toHaveBeenLastCalledWith(...opened('FragranceEb.pdf'));
    mockNavigate.mockClear();

    fireEvent.keyDown(window, { key: '=', ctrlKey: true });
    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: '-' });
    input.remove();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('remembers the key being read for the next time the song opens', () => {
    openAt('FragranceEb.pdf');
    expect(getPrefs().viewer.sheetKeys).toEqual({ Fragrance: 'Eb' });
  });

  it('marks the key of the recording when musician mode is on', async () => {
    global.fetch = vi.fn((url) =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(url === '/bhajan-music.json' ? songsFixture : referenceFixture),
      })
    );
    setPref('musicianMode', true);
    const kali = { 5: { n: 'kali kali kali (gujarati)', sm: ['KaliKaliKaliBb.pdf', 'KaliKaliKaliC.pdf', 'KaliKaliKaliG.pdf'] } };
    renderRenderPage({ bhajans: kali }, '/pdf/KaliKaliKaliBb.pdf/5/kali%20kali%20kali');

    fireEvent.click(await screen.findByRole('button', { name: 'For musicians: key, raga and taal' }));
    expect(await screen.findByRole('region', { name: 'For musicians' })).toHaveTextContent('G A B D E');
    fireEvent.click(screen.getByRole('button', { name: 'close musician details' }));

    fireEvent.click(screen.getByRole('button', { name: 'Change key, now Bb' }));
    expect(screen.getByRole('menuitemradio', { name: 'G · recording' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'C' })).toBeInTheDocument();
  });

  it('marks the PDF named for the arranger\'s key when Sa is not the key root', async () => {
    // Hindolam on F# is written as B minor (its fifth is Sa), so the recording's PDF is Bm, not F#m.
    const songs = { 'atulya tayute': { sh: { pc: 6, k: '4.5', c: 0.96, src: 'box', pdf_pc: 11 }, r: [{ id: 'mohanam', sec: 'all', c: 0.9 }], c: 0.9 } };
    global.fetch = vi.fn((url) =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(url === '/bhajan-music.json' ? songs : referenceFixture) })
    );
    setPref('musicianMode', true);
    const song = { 7: { n: 'atulya tayute', sm: ['AtulyaTayuteBm.pdf', 'AtulyaTayuteCm.pdf', 'AtulyaTayuteFsharpm.pdf'] } };
    renderRenderPage({ bhajans: song }, '/pdf/AtulyaTayuteCm.pdf/7/atulya%20tayute');

    await screen.findByRole('button', { name: 'For musicians: key, raga and taal' });
    fireEvent.click(screen.getByRole('button', { name: 'Change key, now Cm' }));
    expect(await screen.findByRole('menuitemradio', { name: 'Bm · recording' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'F#m' })).toBeInTheDocument();
  });

  it('shows no musician button or recording mark while the mode is off', () => {
    const kali = { 5: { n: 'kali kali kali (gujarati)', sm: ['KaliKaliKaliBb.pdf', 'KaliKaliKaliG.pdf'] } };
    renderRenderPage({ bhajans: kali }, '/pdf/KaliKaliKaliBb.pdf/5/kali%20kali%20kali');
    expect(screen.queryByRole('button', { name: /For musicians/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Change key, now Bb' }));
    expect(screen.getByRole('menuitemradio', { name: 'G' })).toBeInTheDocument();
  });
});

describe('remembered top bar', () => {
  const setViewport = ([width, height]) => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
    Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height });
  };
  const originalSize = [window.innerWidth, window.innerHeight];
  const isHidden = (container) => container.querySelector('.App').classList.contains('header-hidden');

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    setViewport(originalSize);
    localStorage.clear();
  });

  it('stays hidden when the reader opens a different song', () => {
    setViewport([1024, 768]);
    const first = renderRenderPage();
    fireEvent.click(screen.getByRole('button', { name: /hide top bar/i }));
    expect(getPrefs().viewer.headerHidden).toBe(true);
    first.unmount();

    const { container } = renderRenderPage({}, '/pdf/vol2-5/1/Another%20Bhajan');
    expect(isHidden(container)).toBe(true);
  });

  it('keeps the bar on a phone when the reader chose to show it', () => {
    setPref('viewer/headerHidden', false);
    setViewport([390, 844]);
    const { container } = renderRenderPage();
    act(() => vi.advanceTimersByTime(10000));
    expect(isHidden(container)).toBe(false);
  });

  it('does not save the automatic phone hide as a choice', () => {
    setViewport([390, 844]);
    const { container } = renderRenderPage();
    act(() => vi.advanceTimersByTime(3000));
    expect(isHidden(container)).toBe(true);
    expect(getPrefs().viewer?.headerHidden).toBeUndefined();
  });
});
