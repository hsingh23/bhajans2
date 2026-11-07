// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from './ThemeContext';
import MUIThemeWrapper from './MUIThemeProvider';
import Pay from './Pay';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query) => ({
    matches: false,
    media: query,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

const renderPay = () =>
  render(
    <ThemeProvider>
      <MUIThemeWrapper>
        <MemoryRouter>
          <Pay />
        </MemoryRouter>
      </MUIThemeWrapper>
    </ThemeProvider>,
  );

describe('Pay membership message', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.email = 'member@example.com';
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('tells an expired member when it ended and how to switch accounts', () => {
    localStorage.expiresOn = String(Date.UTC(2020, 7, 30));
    renderPay();

    const message = screen.getByText(/member@example\.com/, { selector: 'p' });
    expect(message).toHaveTextContent(/expired on .*2020/);
    expect(message).toHaveTextContent(/different email address/);
    expect(message).not.toHaveTextContent(/not yet paid/);
  });

  it('points someone without a payment to the address they paid with', () => {
    renderPay();

    const message = screen.getByText(/member@example\.com/, { selector: 'p' });
    expect(message).toHaveTextContent(/not yet paid/);
    expect(message).toHaveTextContent(/different email address/);
  });

  it('keeps showing the end date for an active member', () => {
    localStorage.expiresOn = String(Date.now() + 86400000);
    renderPay();

    const message = screen.getByText(/member@example\.com/, { selector: 'p' });
    expect(message).toHaveTextContent(/expires on/);
    expect(message).not.toHaveTextContent(/different email address/);
  });
});

describe('Pay when signed out', () => {
  beforeEach(() => localStorage.clear());

  it('asks to sign in instead of offering payment links without an email', () => {
    renderPay();

    expect(screen.queryByText(/you are signed in/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login?next=%2Fpay');
    expect(screen.queryByRole('link', { name: /1 Years/ })).not.toBeInTheDocument();
  });
});
