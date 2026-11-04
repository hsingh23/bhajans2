import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import Footer from './Footer';

const NOTICE = /all rights reserved/i;

describe('Footer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('shows the copyright notice until 3 seconds have passed', () => {
    render(<Footer />);
    expect(screen.getByText(NOTICE)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(screen.getByText(NOTICE)).toBeInTheDocument();
  });

  test('removes the copyright notice after 3 seconds', () => {
    const { container } = render(<Footer />);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
    expect(container.querySelector('.copyRight')).toBeNull();
  });

  test('clears the timer on unmount', () => {
    const { unmount } = render(<Footer />);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
