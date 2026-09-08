# 004 — Render PDFs in-app with pdf.js; never hand the user a file

**Date:** 2017-06 → 2025 · **Status:** active

## Context

Lyrics are copyrighted songbook PDFs. The product needs page-level deep links
(`/render/vol4/180`), pinch-zoom on phones, dark mode, and — per the project's
TODO — must not simply expose downloadable PDFs, while still being usable on
iOS Safari, which for years refused to open a PDF at a specific page.

## Decision

Render inside the app with pdf.js wrappers (`react-pdf-js`, via
`InvertiblePDF.jsx`/`InvertibleEmbed.jsx`):

- native `<embed>` was tried first, then rejected ("try" → "try 2" →
  "try 3" → "try 4" in 2017: `7706ab8`, `3148634`, `5611d77`, `1cc4fd4`);
  pdf.js won because of page anchoring and iOS behavior (`beb8847`)
- canvas scale tuned 3→4 (`500cc30`) then reduced for render speed
  (`660d5af`); pinch-zoom beat swipe gestures, so swiping was removed
  (`671301a`)
- legacy Google-Docs-viewer fallback kept for unsupported browsers
- hotkeys (left/right), pagination arrows, inverted (dark) rendering

## Consequences

- Deep links land on the exact page; downloads are not one click away; dark
  mode works by CSS inversion of the canvas.
- pdf.js upgrades broke twice and were reverted (`b8bf954`), teaching the team
  to pin `react-pdf-js` carefully; the worker script is vendored
  (`public/pdf.worker.min.js`).
- Large PDFs forced the 2025 PWA compromise: **no precache** of PDFs, runtime
  CacheFirst with LRU (100 entries / 30 days) instead (`1ac2dd2` plan,
  `256a2c6` precache work).

## Evidence

`5611d77` (react-pdf-js everywhere), `beb8847` (fallback renderer),
`660d5af` (render quality vs speed), `671301a` (remove swipe for zoom),
`b8bf954` (revert pdf upgrade), `256a2c6`/`f09845f` (cache strategy).
