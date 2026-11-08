// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PianoKeys, { pianoLayout } from './PianoKeys';

describe('PianoKeys', () => {
  it('spans Sa to the Sa above, padded to whole white keys', () => {
    // Sa on Bb: starts at the A below and ends at the B above Bb'
    const { whites, blacks } = pianoLayout(10, [0, 2, 3, 5, 7, 8, 10]);
    expect(whites[0].abs).toBe(9);
    expect(whites.at(-1).abs).toBe(23);
    const lit = [...whites, ...blacks].filter((k) => k.on).map((k) => k.abs).sort((a, b) => a - b);
    expect(lit).toEqual([10, 12, 13, 15, 17, 18, 20, 22]);
    expect([...whites, ...blacks].filter((k) => k.sa).map((k) => k.abs).sort((a, b) => a - b)).toEqual([10, 22]);
  });

  it('starts on Sa when Sa is a white key', () => {
    const { whites } = pianoLayout(0, [0, 4, 7]);
    expect(whites.map((k) => k.abs)).toEqual([0, 2, 4, 5, 7, 9, 11, 12]);
  });

  it('names the notes for screen readers and lights the used keys', () => {
    render(<PianoKeys saPc={7} semitones={[0, 2, 4, 7, 9]} label='Up' notes={['G', 'A', 'B', 'D', 'E', 'G']} />);
    const piano = screen.getByRole('img', { name: 'Piano keys — Up: G A B D E G' });
    expect(piano.querySelectorAll('.pk-on')).toHaveLength(6);
    expect(screen.getByText('Up')).toBeInTheDocument();
  });

  it('draws nothing without a key or notes', () => {
    const { container } = render(<PianoKeys saPc={undefined} semitones={[0, 2]} />);
    expect(container).toBeEmptyDOMElement();
    const empty = render(<PianoKeys saPc={3} semitones={[]} />);
    expect(empty.container).toBeEmptyDOMElement();
  });
});
