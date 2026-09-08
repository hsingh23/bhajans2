# 001 — Hash-based SPA routing for static hosting

**Date:** 2017-06-23 · **Status:** superseded (React Router 7 path routing + Firebase Hosting SPA fallback)

## Context

The app began as a Create React App project intended for cheap static hosting
(Netlify-era). BrowserRouter deep links (`/bhajan/vol4/180`) break on static
file servers without rewrite rules, and the team wanted zero server-side moving
parts beyond static files.

## Decision

Switch from `BrowserRouter` to `HashRouter` (`dd16e90`), and move all
cross-route state (bhajan list, current filter) onto the `window` object so
navigation did not lose search context — an early "poor man's store" that
avoided Redux entirely (Redux was pruned from dependencies in the same commit).

## Consequences

- Deep links worked anywhere (`#/bhajan/vol4/180`), at the cost of ugly URLs
  and `next=` hash-param hand-rolling for login redirects (see `getNext()` in
  `src/util.jsx`, which still parses a hash fallback).
- The `window.fetchedBhajans` / `window.searchableBhajans` caches survive today
  in `src/Search.jsx` as a performance memo across mounts.
- After moving to Firebase Hosting, `firebase.json` gained an SPA fallback
  rewrite (`** → /index.html`); React Router 7 now uses path-based routes, and
  `reset.html` is denylisted from the SW navigate fallback.

## Evidence

`dd16e90` (HashRouter + window store), `3c3e25c` (disable goOffline),
`57708a3` (beta access model), `47f6f73` (modern routes era).
