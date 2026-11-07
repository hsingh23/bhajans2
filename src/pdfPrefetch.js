// @ts-nocheck
// Downloads the lyrics book PDFs into the service worker's cache for offline
// use, but only once the visitor has interacted with the page, the app's own
// start-up traffic has settled and Google Analytics has loaded, so the ~15 MB
// never competes with the first screen.

export const PDF_CACHE = "pdfs-cache";
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
 * Resolves when analytics.js has loaded (ga() runs a callback at that point),
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
    const poll = () => {
      if (settled) return;
      if (typeof window.ga === "function") window.ga(done);
      else setTimeout(poll, 500);
    };
    poll();
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
 * Fetches each PDF that isn't cached yet, one at a time and at low priority.
 * The service worker's CacheFirst route for /pdfs/ stores each response.
 * Returns the URLs it fetched.
 */
export const prefetchLyricsPdfs = async (urls, { fetchImpl = fetch } = {}) => {
  if (!("caches" in window) || onSlowOrMeteredConnection()) return [];
  const cache = await caches.open(PDF_CACHE);
  const fetched = [];
  for (const url of urls) {
    if (await cache.match(url)) continue;
    try {
      // @ts-ignore: fetch priority hints are not in every DOM typing yet
      const response = await fetchImpl(url, { priority: "low", credentials: "same-origin" });
      if (response?.ok) {
        // Read the body so the service worker finishes writing it to the cache.
        await response.arrayBuffer();
        fetched.push(url);
      }
    } catch {
      // Offline or interrupted: the next visit tries again.
    }
    await whenIdle();
  }
  return fetched;
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
