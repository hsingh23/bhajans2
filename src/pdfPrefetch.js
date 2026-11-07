// @ts-nocheck
import { onAnalyticsReady } from "./analytics";

// Downloads the lyrics book PDFs into the service worker's cache for offline
// use, but only once the visitor has interacted with the page, the app's own
// start-up traffic has settled and Google Analytics has loaded, so the ~15 MB
// never competes with the first screen.

export const PDF_CACHE = "pdfs-cache";
// Each cached book carries its content fingerprint in this header, so the
// record lives with the file itself (localStorage is cleared on sign-out).
export const REV_HEADER = "x-content-rev";

/** First 12 hex characters of the SHA-256 of a body, as vite.config.js computes revs. */
export const contentRev = async (buffer) => {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 12);
};

/** A copy of `body` to store, labelled with its rev. */
const labelled = (body, source, rev) => {
  const headers = new Headers(source.headers);
  headers.set(REV_HEADER, rev);
  return new Response(body, { status: 200, statusText: source.statusText || "OK", headers });
};
const QUIET_MS = 2000;
const ANALYTICS_TIMEOUT_MS = 20000;
const CONTROLLER_TIMEOUT_MS = 10000;
const INTERACTION_EVENTS = ["pointerdown", "keydown", "touchstart", "wheel"];

/** Resolves on the first tap, click, key press or scroll-wheel turn. */
export const whenUserInteracts = (target = window) =>
  new Promise((resolve) => {
    const done = () => {
      INTERACTION_EVENTS.forEach((type) => target.removeEventListener(type, done, true));
      resolve();
    };
    INTERACTION_EVENTS.forEach((type) =>
      target.addEventListener(type, done, { capture: true, passive: true })
    );
  });

/** Resolves once the page has loaded and no request has finished for `quietMs`. */
export const whenNetworkQuiet = (quietMs = QUIET_MS) =>
  new Promise((resolve) => {
    const start = () => {
      let timer;
      let observer;
      const finish = () => {
        observer?.disconnect();
        resolve();
      };
      const restart = () => {
        clearTimeout(timer);
        timer = setTimeout(finish, quietMs);
      };
      if (typeof PerformanceObserver === "function") {
        try {
          observer = new PerformanceObserver(restart);
          observer.observe({ type: "resource" });
        } catch {
          observer = undefined;
        }
      }
      restart();
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
  });

/**
 * Resolves when Google Tag Manager has loaded and fired its tags,
 * or after `timeoutMs` so a blocked or missing analytics script can't stall
 * offline caching forever.
 */
export const whenAnalyticsReady = (timeoutMs = ANALYTICS_TIMEOUT_MS) =>
  new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve();
    };
    const timeout = setTimeout(done, timeoutMs);
    // Queued in the dataLayer; Tag Manager runs the callback once it has loaded.
    onAnalyticsReady(done);
  });

const whenIdle = () =>
  new Promise((resolve) =>
    typeof window.requestIdleCallback === "function"
      ? window.requestIdleCallback(() => resolve(), { timeout: 5000 })
      : setTimeout(resolve, 200)
  );

/** Resolves true once a service worker controls this page (it does the caching). */
const whenControlled = (timeoutMs = CONTROLLER_TIMEOUT_MS) =>
  new Promise((resolve) => {
    const sw = navigator.serviceWorker;
    if (!sw) return resolve(false);
    if (sw.controller) return resolve(true);
    const timer = setTimeout(() => resolve(Boolean(sw.controller)), timeoutMs);
    sw.addEventListener(
      "controllerchange",
      () => {
        clearTimeout(timer);
        resolve(true);
      },
      { once: true }
    );
  });

const onSlowOrMeteredConnection = () => {
  const connection = navigator.connection;
  return Boolean(connection?.saveData) || /(^|-)2g$/.test(connection?.effectiveType || "");
};

/**
 * Makes sure every lyrics book is in the offline cache at its current
 * revision. Entries are { url, rev } (a plain URL string means "any rev").
 * - Cached copy labelled with the same rev: kept.
 * - Cached copy without a label (cached before revs existed, or opened in
 *   the viewer first): hashed locally; labelled and kept if it matches.
 * - Missing, or a different rev: downloaded at low priority as
 *   `url?rev=…` (which skips the service worker's cached copy) and stored
 *   under `url`, replacing the old copy only once the new one has arrived.
 * Returns the URLs it downloaded.
 */
export const prefetchLyricsPdfs = async (entries, { fetchImpl = fetch } = {}) => {
  if (!("caches" in window) || onSlowOrMeteredConnection()) return [];
  const cache = await caches.open(PDF_CACHE);
  const fetched = [];
  for (const entry of entries) {
    const { url, rev } = typeof entry === "string" ? { url: entry, rev: undefined } : entry;
    const cached = await cache.match(url);
    if (cached && !rev) continue;
    if (cached) {
      const label = cached.headers.get(REV_HEADER);
      if (label === rev) continue;
      if (!label) {
        const body = await cached.arrayBuffer();
        if ((await contentRev(body)) === rev) {
          await cache.put(url, labelled(body, cached, rev));
          continue;
        }
      }
    }
    try {
      const source = rev ? `${url}?rev=${rev}` : url;
      // @ts-ignore: fetch priority hints are not in every DOM typing yet
      const response = await fetchImpl(source, { priority: "low", credentials: "same-origin" });
      if (response?.ok) {
        const body = await response.arrayBuffer();
        await cache.put(url, rev ? labelled(body, response, rev) : new Response(body, { headers: response.headers }));
        fetched.push(url);
      }
    } catch {
      // Offline or interrupted: the old copy (if any) stays; the next visit tries again.
    }
    await whenIdle();
  }
  await keepStorageForInstalledApp();
  return fetched;
};

/**
 * Asks the browser not to evict this site's storage under disk pressure, for
 * people who installed the app (they rely on it offline). Chrome decides
 * silently; Firefox may ask the person.
 */
const keepStorageForInstalledApp = async () => {
  try {
    const installed = window.matchMedia?.("(display-mode: standalone)")?.matches || navigator.standalone;
    if (installed && navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch {
    // Persistence is best effort.
  }
};

/** Waits for the right moment, then caches the lyrics PDFs. Production only. */
export const schedulePdfPrefetch = async ({
  urls = typeof __LYRICS_PDFS__ !== "undefined" ? __LYRICS_PDFS__ : [],
} = {}) => {
  if (!urls.length || !("serviceWorker" in navigator)) return [];
  await whenUserInteracts();
  await Promise.all([whenNetworkQuiet(), whenAnalyticsReady()]);
  // Analytics just made requests of its own; let those settle too.
  await whenNetworkQuiet();
  await whenIdle();
  if (!(await whenControlled())) return [];
  return prefetchLyricsPdfs(urls);
};
