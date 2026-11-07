// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { whenUserInteracts, whenAnalyticsReady, prefetchLyricsPdfs, PDF_CACHE, REV_HEADER, contentRev } from './pdfPrefetch';

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
  const bytes = (text) => new TextEncoder().encode(text).buffer;
  let stored;
  const cachedText = async (url) => new TextDecoder().decode(await stored.get(url).clone().arrayBuffer());
  const label = (url) => stored.get(url)?.headers.get(REV_HEADER);

  beforeEach(() => {
    localStorage.clear();
    stored = new Map();
    globalThis.caches = {
      open: vi.fn(async () => ({
        match: async (url) => stored.get(url)?.clone(),
        put: async (url, response) => stored.set(url, response),
      })),
    };
    Object.defineProperty(navigator, 'connection', { configurable: true, value: undefined });
  });
  afterEach(() => {
    delete globalThis.caches;
  });

  // The server's copy of each book, by URL without the ?rev query.
  const serve = (books) =>
    vi.fn(async (source) => new Response(books[source.split('?')[0]], { status: 200, headers: { 'content-type': 'application/pdf' } }));

  it('downloads missing books once, at low priority, labelled with their rev', async () => {
    const v2 = await contentRev(bytes('book two'));
    const fetchImpl = serve({ '/pdfs/vol2.pdf': 'book two' });
    expect(await prefetchLyricsPdfs([{ url: '/pdfs/vol2.pdf', rev: v2 }], { fetchImpl })).toEqual(['/pdfs/vol2.pdf']);
    expect(fetchImpl.mock.calls[0]).toEqual([`/pdfs/vol2.pdf?rev=${v2}`, { priority: 'low', credentials: 'same-origin' }]);
    expect(await cachedText('/pdfs/vol2.pdf')).toBe('book two');
    expect(label('/pdfs/vol2.pdf')).toBe(v2);
    expect(stored.get('/pdfs/vol2.pdf').headers.get('content-type')).toBe('application/pdf');
    expect(caches.open).toHaveBeenCalledWith(PDF_CACHE);
    // Second visit: nothing to do.
    expect(await prefetchLyricsPdfs([{ url: '/pdfs/vol2.pdf', rev: v2 }], { fetchImpl })).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('checks an unlabelled cached copy by hashing it, and keeps it when it matches', async () => {
    stored.set('/pdfs/vol1.pdf', new Response('book one'));
    const fetchImpl = serve({});
    const rev = await contentRev(bytes('book one'));
    expect(await prefetchLyricsPdfs([{ url: '/pdfs/vol1.pdf', rev }], { fetchImpl })).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(label('/pdfs/vol1.pdf')).toBe(rev);
  });

  it('replaces an unlabelled copy that is out of date, even after sign-out cleared storage', async () => {
    // Cached by the viewer, then the user signed out (localStorage cleared) and the book changed.
    stored.set('/pdfs/vol1.pdf', new Response('old edition'));
    localStorage.clear();
    const rev = await contentRev(bytes('new edition'));
    const fetchImpl = serve({ '/pdfs/vol1.pdf': 'new edition' });
    expect(await prefetchLyricsPdfs([{ url: '/pdfs/vol1.pdf', rev }], { fetchImpl })).toEqual(['/pdfs/vol1.pdf']);
    expect(await cachedText('/pdfs/vol1.pdf')).toBe('new edition');
  });

  it('replaces a labelled book whose content changed', async () => {
    const r1 = await contentRev(bytes('first'));
    await prefetchLyricsPdfs([{ url: '/pdfs/vol1.pdf', rev: r1 }], { fetchImpl: serve({ '/pdfs/vol1.pdf': 'first' }) });
    const r2 = await contentRev(bytes('second'));
    const fetchImpl = serve({ '/pdfs/vol1.pdf': 'second' });
    expect(await prefetchLyricsPdfs([{ url: '/pdfs/vol1.pdf', rev: r2 }], { fetchImpl })).toEqual(['/pdfs/vol1.pdf']);
    expect(await cachedText('/pdfs/vol1.pdf')).toBe('second');
    expect(label('/pdfs/vol1.pdf')).toBe(r2);
  });

  it('keeps the old copy when a refresh fails, and tries again next time', async () => {
    const r1 = await contentRev(bytes('first'));
    await prefetchLyricsPdfs([{ url: '/pdfs/vol1.pdf', rev: r1 }], { fetchImpl: serve({ '/pdfs/vol1.pdf': 'first' }) });
    const r2 = await contentRev(bytes('second'));
    const failing = vi.fn().mockRejectedValue(new Error('offline'));
    expect(await prefetchLyricsPdfs([{ url: '/pdfs/vol1.pdf', rev: r2 }], { fetchImpl: failing })).toEqual([]);
    expect(await cachedText('/pdfs/vol1.pdf')).toBe('first');
    expect(await prefetchLyricsPdfs([{ url: '/pdfs/vol1.pdf', rev: r2 }], { fetchImpl: serve({ '/pdfs/vol1.pdf': 'second' }) })).toEqual(['/pdfs/vol1.pdf']);
  });

  it('matches the build: rev is the first 12 hex characters of SHA-256', async () => {
    expect(await contentRev(bytes('abc'))).toBe('ba7816bf8f01');
  });

  it('skips everything when the visitor asked to save data', async () => {
    Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: true } });
    const fetchImpl = serve({ '/pdfs/vol2.pdf': 'x' });
    expect(await prefetchLyricsPdfs([{ url: '/pdfs/vol2.pdf', rev: 'a' }], { fetchImpl })).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
