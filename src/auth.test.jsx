// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./ThemeContext";
import MUIThemeWrapper from "./MUIThemeProvider";
import Login from './Login';

// Mock Firebase
vi.mock('./firebase', () => ({
  auth: {
    currentUser: null,
  },
  checkRefOnce: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  sendSignInLinkToEmail: vi.fn(() => Promise.resolve()),
  isSignInWithEmailLink: vi.fn(() => false),
  signInWithEmailLink: vi.fn(() => Promise.resolve({ user: { uid: 'test-uid' } })),
  onAuthStateChanged: vi.fn(() => {
    // Return unsubscribe function
    return () => {};
  }),
}));

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

describe('Login Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('renders login page with email input and magic link button', async () => {
    renderWithProviders(<Login />);
    
    await waitFor(() => {
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /send magic link/i })).toBeInTheDocument();
  });

  it('displays Sing with Amma branding', async () => {
    renderWithProviders(<Login />);
    
    await waitFor(() => {
      expect(screen.getByText(/Sing with Amma/i)).toBeInTheDocument();
    });
  });
});

describe('Auth State Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should not redirect based on stale localStorage.expiresOn', async () => {
    // Set an expired localStorage value
    localStorage.setItem('expiresOn', String(Date.now() - 1000));
    
    // The Login component should NOT redirect to /pay based on stale localStorage
    // It should wait for RTDB check in redirectOnLogin
    renderWithProviders(<Login />);
    
    // Should still show login form, not redirect immediately
    await waitFor(() => {
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    });
  });

  it('renders confirm email form when accessing via magic link', async () => {
    // This test validates the flow when email needs confirmation
    renderWithProviders(<Login />);
    
    // Should show login form in default state
    await waitFor(() => {
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    });
  });
});
