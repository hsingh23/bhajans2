// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { whenUserInteracts, whenAnalyticsReady, prefetchLyricsPdfs, PDF_CACHE } from './pdfPrefetch';

describe('whenUserInteracts', () => {
  it('waits for the first interaction', async () => {
    let done = false;
    const promise = whenUserInteracts().then(() => (done = true));
    await Promise.resolve();
    expect(done).toBe(false);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await promise;
    expect(done).toBe(true);
  });
});

describe('whenAnalyticsReady', () => {
  afterEach(() => {
    delete window.dataLayer;
    vi.useRealTimers();
  });

  it('resolves when Tag Manager runs the queued eventCallback', async () => {
    const promise = whenAnalyticsReady(60000);
    const queued = window.dataLayer.find((entry) => entry.event === 'analytics_ready_check');
    expect(queued.eventCallback).toEqual(expect.any(Function));
    queued.eventCallback('GTM-KF3RQXP');
    await expect(promise).resolves.toBeUndefined();
  });

  it('gives up waiting when analytics never loads', async () => {
    vi.useFakeTimers();
    const promise = whenAnalyticsReady(1000);
    vi.advanceTimersByTime(1000);
    await expect(promise).resolves.toBeUndefined();
  });
});

describe('prefetchLyricsPdfs', () => {
  let stored;
  beforeEach(() => {
    localStorage.clear();
    stored = new Map([['/pdfs/vol1.pdf', 'old copy']]);
    globalThis.caches = {
      open: vi.fn(async () => ({
        match: async (url) => stored.get(url),
        put: async (url, response) => stored.set(url, response.body),
      })),
    };
    Object.defineProperty(navigator, 'connection', { configurable: true, value: undefined });
  });
  afterEach(() => {
    delete globalThis.caches;
  });

  const okFetch = () => vi.fn(async (source) => ({ ok: true, body: `fresh ${source}` }));

  it('downloads missing books once, at low priority, under their plain URL', async () => {
    const fetchImpl = okFetch();
    const entries = [{ url: '/pdfs/vol2.pdf', rev: 'aaa' }, { url: '/pdfs/vol3.pdf', rev: 'bbb' }];
    expect(await prefetchLyricsPdfs(entries, { fetchImpl })).toEqual(['/pdfs/vol2.pdf', '/pdfs/vol3.pdf']);
    expect(fetchImpl.mock.calls[0]).toEqual(['/pdfs/vol2.pdf?rev=aaa', { priority: 'low', credentials: 'same-origin' }]);
    expect(stored.get('/pdfs/vol2.pdf')).toBe('fresh /pdfs/vol2.pdf?rev=aaa');
    expect(caches.open).toHaveBeenCalledWith(PDF_CACHE);
    // Second visit: nothing to do.
    expect(await prefetchLyricsPdfs(entries, { fetchImpl })).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('keeps books cached before revisions were recorded, without downloading again', async () => {
    const fetchImpl = okFetch();
    expect(await prefetchLyricsPdfs([{ url: '/pdfs/vol1.pdf', rev: 'r1' }], { fetchImpl })).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(stored.get('/pdfs/vol1.pdf')).toBe('old copy');
  });

  it('replaces a book whose content changed', async () => {
    const fetchImpl = okFetch();
    await prefetchLyricsPdfs([{ url: '/pdfs/vol1.pdf', rev: 'r1' }], { fetchImpl });
    expect(await prefetchLyricsPdfs([{ url: '/pdfs/vol1.pdf', rev: 'r2' }], { fetchImpl })).toEqual(['/pdfs/vol1.pdf']);
    expect(stored.get('/pdfs/vol1.pdf')).toBe('fresh /pdfs/vol1.pdf?rev=r2');
  });

  it('keeps the old copy when a refresh fails', async () => {
    await prefetchLyricsPdfs([{ url: '/pdfs/vol1.pdf', rev: 'r1' }], { fetchImpl: okFetch() });
    const failing = vi.fn().mockRejectedValue(new Error('offline'));
    expect(await prefetchLyricsPdfs([{ url: '/pdfs/vol1.pdf', rev: 'r2' }], { fetchImpl: failing })).toEqual([]);
    expect(stored.get('/pdfs/vol1.pdf')).toBe('old copy');
    // It tries again next time.
    expect(await prefetchLyricsPdfs([{ url: '/pdfs/vol1.pdf', rev: 'r2' }], { fetchImpl: okFetch() })).toEqual(['/pdfs/vol1.pdf']);
  });

  it('skips everything when the visitor asked to save data', async () => {
    Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: true } });
    const fetchImpl = okFetch();
    expect(await prefetchLyricsPdfs([{ url: '/pdfs/vol2.pdf', rev: 'a' }], { fetchImpl })).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
