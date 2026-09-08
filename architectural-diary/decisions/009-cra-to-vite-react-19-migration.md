# 009 — Big-bang migration: CRA → Vite 7 / React 19 / Playwright

**Date:** 2025-12-31 · **Status:** active

## Context

By 2025 the app was on Create React App (deprecated), React 17, MUI v4,
Firebase v8 namespaced SDK, Cypress for E2E, and had accumulated committed
generated artifacts. A code review produced a blocker list formalized as
`docs/plans/2025-12-31-blocker-fixes.md`. An intermediate step earlier in 2025
had already modernized Firebase to the v9 modular API and Workbox
(`69cc968`, `f578afa` docs).

## Decision

Land the whole platform migration **in one commit** (`29c96b4`, 111 files)
rather than a long incremental branch:

- Vite 7 + `vite-plugin-pwa` replaces CRA/react-scripts; build outputs `dist/`
- React 19 + React Compiler (`babel-plugin-react-compiler`), MUI v7,
  React Router 7, Firebase 12, TanStack Query v5
- Cypress dropped for Playwright; Vitest + Testing Library + MSW unit suite
  added (`918d296` was the old Cypress suite)
- Toolchain: Husky + commitlint + ESLint 9 + Prettier + `tsc --noEmit` gate
  (`bun run validate`), auto version bump post-commit hook
- Same commit lands the blocker fixes: ErrorBoundary at root, login-redirect
  gating against stale localStorage, PDFs out of precache, generated artifacts
  purged (PDFs kept)

## Consequences

- The commit is deliberately described by its plan doc; subsequent commits
  (`f09845f`, `d065030`, `3363b65`) were the debugging tail (SW refresh
  loops, session re-verification).
- `src/*.js` → `src/*.jsx` rename broke git blame continuity for every file.
- The validation gate ("not done until `bun run validate` passes") entered the
  agent docs (CLAUDE.md/AGENTS.md) from this migration.
- Route-compatible shims (`withRouterCompat` in `util.jsx`) kept class-era
  components working under Router v6/v7 without a full rewrite — a deliberate
  stepping stone (`9ca7136` had done the same for the v5→v6 jump).

## Evidence

`69cc968` (Firebase v9 + Workbox), `f578afa` (CLAUDE.md architecture docs),
`29c96b4` (the big-bang), `f09845f`/`3363b65` (stabilization),
`014de36` (version-bump hook).
