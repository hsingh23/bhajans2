// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import RenderPage from './RenderPage';
import { ThemeProvider } from "./ThemeContext";
import MUIThemeWrapper from "./MUIThemeProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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
vi.mock('./InvertiblePDF', () => ({
  default: ({ page, onPageComplete, onDocumentComplete }) => {
    // Simulate document loaded with 5 pages
    setTimeout(() => onDocumentComplete?.(5), 0);
    setTimeout(() => onPageComplete?.(page), 0);
    return <div data-testid="pdf-viewer">PDF Page {page}</div>;
  },
}));

vi.mock('./InvertibleEmbed', () => ({
  default: ({ src }) => <div data-testid="pdf-embed">{src}</div>,
}));

const mockBhajans = {
  0: { n: 'Test Bhajan', cu: ['http://buy.com'], cs: ['http://sample.mp3'] },
  1: { n: 'Another Bhajan', cu: null, cs: null },
};

const renderRenderPage = (props = {}, route = '/pdf/vol1-10/0/Test%20Bhajan') => {
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
          <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
            <Routes>
              <Route 
                path="/pdf/:location/:id/:name" 
                element={
                  <RenderPage 
                    bhajans={mockBhajans} 
                    renderFavorite={() => <button data-testid="favorite-btn">♥</button>}
                    {...props}
                  />
                } 
              />
            </Routes>
          </MemoryRouter>
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
      state: { headerHidden: false },
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
