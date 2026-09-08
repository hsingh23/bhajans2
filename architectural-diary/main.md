# Architectural Diary — master branch

A chronological index of the significant design decisions behind
**Sing With Amma — Bhajan Search Engine**, reconstructed from the full commit
history of `master` (228 commits, 2017–2026). Each entry links to a detail file
under `decisions/`.

> Hashes cited are post-2026-09-08 (see
> [011-messages-only-history-rewrite](decisions/011-messages-only-history-rewrite.md)).
> The changelog in [CHANGELOG.md](../CHANGELOG.md) lists every commit.

| # | Era | Decision | Detail |
| --- | --- | --- | --- |
| 001 | 2017-06 | Hash-based SPA routing for static hosting | [001-hash-router-static-hosting](decisions/001-hash-router-static-hosting.md) |
| 002 | 2017-07 | Precomputed, committed bhajan index searched client-side | [002-precomputed-bhajan-index](decisions/002-precomputed-bhajan-index.md) |
| 003 | 2017-06/07 | Transliteration-tolerant fuzzy search in the browser | [003-transliteration-tolerant-search](decisions/003-transliteration-tolerant-search.md) |
| 004 | 2017-08 | Render PDFs in-app with pdf.js; never hand the user a file | [004-in-app-pdf-rendering](decisions/004-in-app-pdf-rendering.md) |
| 005 | 2017-07 → 2023 | Manual, admin-approved membership payments | [005-manual-payment-flow](decisions/005-manual-payment-flow.md) |
| 006 | 2017 → 2026 | Service worker strategy: sw-precache → Workbox + recovery page | [006-service-worker-evolution](decisions/006-service-worker-evolution.md) |
| 007 | 2017-07 | Firebase goOnline/goOffline bandwidth shims (and their retreat) | [007-firebase-online-offline-shims](decisions/007-firebase-online-offline-shims.md) |
| 008 | 2017-07 | Favorites: localStorage-first with last-login RTDB merge | [008-favorites-merge-strategy](decisions/008-favorites-merge-strategy.md) |
| 009 | 2025-12 | Big-bang migration: CRA → Vite 7 / React 19 / Playwright | [009-cra-to-vite-react-19-migration](decisions/009-cra-to-vite-react-19-migration.md) |
| 010 | 2025-12 | PPTX presentation pipeline becomes the 2025 songbook source | [010-pptx-songbook-pipeline](decisions/010-pptx-songbook-pipeline.md) |
| 011 | 2026-09 | Messages-only history rewrite for documentation | [011-messages-only-history-rewrite](decisions/011-messages-only-history-rewrite.md) |

## Reading the history in broad strokes

1. **2017 (birth):** a Create React App SPA with Firebase Auth/RTDB, a
   Python-generated bhajan index, pdf.js lyrics rendering, PayPal payments,
   favorites, push notifications, and an offline-first service worker — most of
   the product shape existed within the first three months.
2. **2018–2023 (stewardship):** yearly songbook supplements, dependency
   upgrades (Snyk/Dependabot era), payment-provider churn (PayPal → Amazon →
   CD Baby → Amma Shop), Apple Pay, presenter view, and a long tail of
   service-worker and iOS hardening.
3. **2025–2026 (modernization):** Firebase v9 modular SDK + Workbox rewrite,
   then the CRA → Vite 7 / React 19 big-bang with a real test harness
   (Vitest/MSW/Playwright), dark mode, password reset, the 2025 PPTX songbook
   pipeline, and CodeGraph-assisted development.
