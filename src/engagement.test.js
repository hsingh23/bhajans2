// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { rememberOpened, recentBhajans, viewerPath, bhajanOfTheDay } from './engagement';

const bhajans = [
  { n: 'amme narayana', l: ['vol1-10'], d: 'Devi', lg: 'Malayalam' },
  { n: 'gopala gopala', l: ['vol2-5'], d: 'Krishna', lg: 'Hindi' },
  { n: 'kanna va', l: ['vol3-1'], d: 'Krishna', lg: 'Malayalam' },
  { n: 'nanda lala', l: ['vol3-9'], d: 'Krishna', lg: 'Malayalam' },
  { n: 'sheet only', l: ['voli2-4'], d: 'Krishna', lg: 'Malayalam' },
];

describe('recently opened', () => {
  beforeEach(() => localStorage.clear());

  it('keeps the latest first, one entry per bhajan, with its page', () => {
    rememberOpened({ name: 'kanna va', location: 'vol3-1', page: 1, now: 1 });
    rememberOpened({ name: 'gopala gopala', location: 'vol2-5', page: 5, now: 2 });
    rememberOpened({ name: 'kanna va', location: 'vol3-1', page: 3, now: 3 });
    expect(recentBhajans().map((r) => [r.name, r.page])).toEqual([['kanna va', 3], ['gopala gopala', 5]]);
  });

  it('builds a viewer link from the name, so it survives index changes', () => {
    expect(viewerPath(bhajans, { name: 'kanna va', location: 'vol3-1', page: 3 })).toBe('/pdf/vol3-1/2/kanna%20va?page=3');
    expect(viewerPath(bhajans, { name: 'gone', location: 'vol1-1' })).toBeNull();
  });

  it('survives corrupt storage', () => {
    localStorage.setItem('recentBhajans', '{oops');
    expect(recentBhajans()).toEqual([]);
  });
});

describe('bhajanOfTheDay', () => {
  const day = (n) => Date.UTC(2026, 10, n, 12);

  it('is stable for a day and only picks bhajans with lyrics', () => {
    const a = bhajanOfTheDay(bhajans, { recent: [], now: day(7) });
    const b = bhajanOfTheDay(bhajans, { recent: [], now: day(7) + 3600000 });
    expect(a.bhajan.n).toBe(b.bhajan.n);
    expect(a.bhajan.n).not.toBe('sheet only');
    expect(a.reason).toBeNull();
  });

  it("prefers the visitor's deity and language and skips what they just read", () => {
    const recent = [{ name: 'kanna va', location: 'vol3-1' }];
    const pick = bhajanOfTheDay(bhajans, { recent, favorites: { 'nanda lala': 1 }, now: day(8) });
    expect(pick.bhajan.n).toBe('nanda lala');
    expect(pick.reason).toBe('Krishna · Malayalam');
  });
});
