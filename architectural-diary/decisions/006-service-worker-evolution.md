# 006 — Service worker strategy: sw-precache → Workbox + recovery page

**Date:** 2017 → 2026 · **Status:** active

## Context

The app must be offline-first (singers at retreats with bad connectivity), but
a broken service worker once bricked the site for returning users — the single
most-recurring bug class in the 2017–2018 history.

## Decision trail

1. **2017:** hand-rolled + `sw-precache` caching of app shell and (later,
   reluctantly) PDFs; `sw-precache-config.js` globs tuned repeatedly
   (`12df6d6` raised the 4 MB budget, `6aa3dff` reordered globs).
2. **Update UX:** alert users when new content caches, auto-reload after 8s
   (`510b5e2`, `7bfc0be`), and rename the worker file to force refreshes when
   needed (`5edfcb1`).
3. **Recovery:** ship `public/reset.html`, excluded from the SW navigate
   fallback (`61f084b`, `4ee7a22`), whose only job is unregistering stuck
   workers; `RenderPage` also carries an unregister fallback.
4. **FCM worker kept separate** (`firebase-messaging-sw.js`), registered by
   `src/index.jsx` bootstrap and never precached (`0a7d0a2` renamed it away
   from the precache glob).
5. **2025 modernization:** `vite-plugin-pwa` (Workbox) generates
   `service-worker2.js` with `skipWaiting`/`clientsClaim`,
   `cleanupOutdatedCaches`, PDFs excluded from precache but runtime-CacheFirst
   (`f09845f`, `1ac2dd2`). Firebase Hosting serves all three worker files with
   `no-cache, no-store, must-revalidate`.

## Consequences

- The "stuck worker" incident class disappeared after `reset.html`.
- Two SW registrations coexist (Workbox app shell + FCM) and must not fight
  over scope; `firebase.json` headers keep them fresh.
- PDF caching moved from precache (bloats install) to runtime LRU — installs
  stay small for first-time users.

## Evidence

`510b5e2`, `5edfcb1`, `61f084b`, `4ee7a22`, `0a7d0a2`, `f09845f`,
`256a2c6`, `1ac2dd2` (blocker plan: "trim PWA precache of large PDFs").
