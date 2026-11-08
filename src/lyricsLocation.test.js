import { describe, expect, it } from 'vitest';
import { isLyricsLocation, locationLabel } from './lyricsLocation';

describe('lyrics locations', () => {
  it('accepts the books that have a lyrics PDF', () => {
    for (const loc of ['vol3-12', '2025-53', '2020supl2-7', '2021supl5-1', 'extra-1', 'extra-642']) {
      expect(isLyricsLocation(loc)).toBe(true);
    }
  });

  it('rejects books without a PDF and malformed locations', () => {
    for (const loc of ['voli2-4', 'vol3old-5', 'ii1-3', '', 'extra', 'extra-', 'vol3-12x', undefined]) {
      expect(isLyricsLocation(loc)).toBe(false);
    }
  });

  it('names the book and page for people', () => {
    expect(locationLabel('vol3-12')).toBe('Volume 3, page 12');
    expect(locationLabel('voli2-4')).toBe('Alternate Volume 2, page 4');
    expect(locationLabel('2020supl2-7')).toBe('2020supl2, page 7');
    expect(locationLabel('extra-5')).toBe('Additional songs, page 5');
  });
});
