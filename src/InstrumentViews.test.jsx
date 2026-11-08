// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScaleTab } from './InstrumentViews';

describe('ScaleTab', () => {
  it('wraps a long line into even staves so it fits a phone (Desh down, 15 notes)', () => {
    const deshDown = ['S', 'n2', 'D2', 'P', 'D2', 'M1', 'G3', 'R2', 'P', 'M1', 'G3', 'R2', 'G3', 'N3', 'S'];
    render(<ScaleTab instrument='guitar' saPc={10} swaras={deshDown} descending label='Down' />);
    const tab = screen.getByRole('img', { name: /^Guitar tab, down/ });
    const staves = tab.textContent.split('\n\n');
    expect(staves).toHaveLength(2);
    expect(staves.map((s) => (s.match(/-\d+/g) || []).length)).toEqual([8, 7]);
    expect(Math.max(...tab.textContent.split('\n').map((l) => l.length))).toBeLessThanOrEqual(30);
  });

  it('keeps a short line on one stave', () => {
    render(<ScaleTab instrument='guitar' saPc={7} swaras={['S', 'R2', 'G3', 'P', 'D2', 'S']} />);
    expect(screen.getByRole('img', { name: /^Guitar tab/ }).textContent.split('\n\n')).toHaveLength(1);
  });
});
