# Blocker Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Address code review blockers: ensure Firebase messaging service worker is registered with Vite, fix login redirect logic, reinstate an error boundary, trim PWA precache of large PDFs, and remove committed generated artifacts (keeping PDFs).

**Architecture:** Tweak entrypoint bootstrap to register the messaging worker before Firebase usage; adjust Login control flow to guard redirects on authenticated state and clear stale storage; wrap the root tree in a lightweight error boundary; narrow PWA asset lists to avoid precaching PDFs while keeping runtime caching; clean the repo by deleting caches/logs and non-PDF generated outputs that are now gitignored.

**Tech Stack:** React 19 + Vite, Firebase v12 modular SDK, vite-plugin-pwa, React Router 7, TanStack Query, Bun toolchain.

### Task 1: Clean generated artifacts (keep PDFs)

**Files:**
- Remove from git: `.eslintcache`, `.tsbuildinfo`, `lint_results*.txt`, `validate_log*.txt`, `test-results/.last-run.json`, `playwright-report/`, `create-index/ppts/output` non-PDFs, `bun.lock`? (keep if real lock), `create-index/ppts/output/*.xml|*.json|*.txt`

**Steps:**
1. Delete listed generated files/directories except PDFs.
2. Confirm `.gitignore` covers them (already updated).
3. `git status` to verify removals.

### Task 2: Register Firebase messaging service worker under Vite

**Files:**
- Modify: `src/index.jsx`

**Steps:**
1. Add a bootstrapping function to register `/firebase-messaging-sw.js` (with error logging) before enabling mocks and app render; guard to only run in browsers with SW support.
2. Ensure it doesn’t conflict with Vite PWA worker (separate registration, no precache).

### Task 3: Fix Login redirect gating stale localStorage

**Files:**
- Modify: `src/Login.jsx`

**Steps:**
1. On mount, clear stale localStorage auth if `auth.currentUser` is absent.
2. Only redirect to `/pay` when an authenticated user exists and has expired subscription; otherwise allow login form to show.
3. Keep existing redirectOnLogin path for authenticated users.

### Task 4: Reinstate error boundary around root render

**Files:**
- Modify: `src/index.jsx`
- Add: `src/ErrorBoundary.jsx` (simple class component)

**Steps:**
1. Implement a minimal error boundary that logs errors to `console.error` and renders a fallback message.
2. Wrap the rendered app tree with the error boundary.

### Task 5: Avoid precaching large PDFs in PWA

**Files:**
- Modify: `vite.config.js`

**Steps:**
1. Remove PDF entries from `includeAssets`.
2. Keep runtime caching for `/pdfs/*.pdf` but ensure no precache of bulk PDFs.

### Task 6: A11y polish for icon-only controls

**Files:**
- Modify: `src/RenderPage.jsx`, `src/Search.jsx`

**Steps:**
1. Add missing `aria-label`/`title` to icon-only navigation and sheet-music/amazon controls.
2. Ensure back navigation control is keyboard/focus accessible (button).
3. Verify favorites buttons keep labels.
