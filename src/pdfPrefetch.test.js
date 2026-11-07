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
    delete window.ga;
    vi.useRealTimers();
  });

  it('resolves when analytics.js runs its ready callback', async () => {
    let ready;
    window.ga = vi.fn((cb) => (ready = cb));
    const promise = whenAnalyticsReady(60000);
    ready();
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
  let cached;
  beforeEach(() => {
    cached = new Set(['/pdfs/vol1.pdf']);
    globalThis.caches = {
      open: vi.fn(async () => ({ match: async (url) => cached.has(url) })),
    };
    Object.defineProperty(navigator, 'connection', { configurable: true, value: undefined });
  });
  afterEach(() => {
    delete globalThis.caches;
  });

  const okFetch = () =>
    vi.fn(async (url) => {
      cached.add(url);
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(0) };
    });

  it('fetches only the PDFs not cached yet, one at a time, at low priority', async () => {
    const fetchImpl = okFetch();
    const fetched = await prefetchLyricsPdfs(['/pdfs/vol1.pdf', '/pdfs/vol2.pdf', '/pdfs/vol3.pdf'], { fetchImpl });
    expect(fetched).toEqual(['/pdfs/vol2.pdf', '/pdfs/vol3.pdf']);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ priority: 'low' });
    expect(caches.open).toHaveBeenCalledWith(PDF_CACHE);
  });

  it('keeps going after a failed download', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) });
    const fetched = await prefetchLyricsPdfs(['/pdfs/vol2.pdf', '/pdfs/vol3.pdf'], { fetchImpl });
    expect(fetched).toEqual(['/pdfs/vol3.pdf']);
  });

  it('skips everything when the visitor asked to save data', async () => {
    Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: true } });
    const fetchImpl = okFetch();
    expect(await prefetchLyricsPdfs(['/pdfs/vol2.pdf'], { fetchImpl })).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
