// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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
  
  return render(
    <ThemeProvider>
      <MUIThemeWrapper>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[route]}>
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

// Note: Navigation tests with pagination controls and subscription redirect tests 
// are more reliable in E2E tests due to timing issues with fake timers and 
// document.querySelector in jsdom. See e2e/app.spec.js for comprehensive tests.
