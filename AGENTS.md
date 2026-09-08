# Agent Instructions

## Superpowers System

<EXTREMELY_IMPORTANT>
You have superpowers. Superpowers teach you new skills and capabilities. RIGHT NOW run: `~/.codex/superpowers/.codex/superpowers-codex bootstrap` and follow the instructions it returns.
</EXTREMELY_IMPORTANT>

<!-- CODEGRAPH_START -->
## CodeGraph

This project has a CodeGraph MCP server (`codegraph_*` tools) configured. CodeGraph is a tree-sitter-parsed knowledge graph of every symbol, edge, and file. Reads are sub-millisecond and return structural information grep cannot.

### When to prefer codegraph over native search

Use codegraph for structural questions: what calls what, what would break, where a symbol is defined, and symbol signatures. Use native grep/read only for literal text queries such as string contents, comments, log messages, or after a specific file is already open.

| Question | Tool |
|---|---|
| "Where is X defined?" / "Find symbol named X" | `codegraph_search` |
| "What calls function Y?" | `codegraph_callers` |
| "What does Y call?" | `codegraph_callees` |
| "What would break if I changed Z?" | `codegraph_impact` |
| "Show me Y's signature / source / docstring" | `codegraph_node` |
| "Give me focused context for a task/area" | `codegraph_context` |
| "See several related symbols' source at once" | `codegraph_explore` |
| "What files exist under path/" | `codegraph_files` |
| "Is the index healthy?" | `codegraph_status` |

### Rules of thumb

- Answer directly. For architecture, trace, or "how does X work" questions, use `codegraph_context` first, then one `codegraph_explore` for the source of surfaced symbols.
- Trust codegraph results. They come from a full AST parse.
- Do not grep first when looking up a symbol by name. Use `codegraph_search`.
- Do not chain `codegraph_search` + `codegraph_node` when you only want context. Use `codegraph_context`.
- Do not loop `codegraph_node` over many symbols. Use one capped `codegraph_explore`.
- Index lag: the file watcher debounces about 500ms behind writes. Avoid querying immediately after editing a file in the same turn.

### If `.codegraph/` doesn't exist

The MCP server returns "not initialized." Run `codegraph init -i` in the repo root to build the index.
<!-- CODEGRAPH_END -->

## Project

**Sing With Amma — Bhajan Search Engine** (`https://sing.withamma.com/`). A
Firebase-backed React PWA for searching bhajan songbooks, viewing PDF lyrics,
playing samples, syncing favorites, and managing charity-membership payments.
Full history: [CHANGELOG.md](CHANGELOG.md). Design rationale:
[architectural-diary/](architectural-diary/).

## Tech Stack

- **Runtime**: Bun for the root app (all package management and script
  execution); **Yarn** inside `functions/`
- **Framework**: React 19 + Vite 7, React Compiler, Material UI 7, React Router 7
- **Backend**: Firebase 12 — Auth (password + magic link), Realtime Database,
  Cloud Functions (Node.js), Cloud Messaging
- **PWA**: `vite-plugin-pwa` / Workbox (`service-worker2.js`), plus legacy
  `public/firebase-messaging-sw.js` and `public/reset.html` recovery page
- **Testing**: Vitest + Testing Library + MSW (unit), Playwright (E2E)
- **Styling**: Vanilla CSS (mobile-first), MUIThemeProvider, ThemeContext

## Commands

```bash
bun dev               # Vite dev server on port 3000
bun run build         # production build to dist/
bun run test          # Vitest unit tests with coverage
bun run test:e2e      # Playwright E2E
bun run lint          # ESLint (cached)
bun run validate      # tsc --noEmit + lint + test

# functions/ (uses Yarn, NOT Bun)
cd functions && yarn install && yarn build
```

IMPORTANT: you are not done with any task until `bun run validate` passes.

## Architecture Map

```
index.html ── GTM/gtag bootstrap, error handlers
src/index.jsx ── root render, ErrorBoundary, React Query, SW registration, mocks (MSW)
src/App.jsx ── routes (/, /login, /logout, /pay, /profile, /admin, /render/:id/:location,
              /render/pdf/:id, /my-favorites, /faq, /privacy, /terms, /beta)
              favorites state (localStorage + RTDB merge), loads /bhajan-index2.json
src/Search.jsx ── makeSearchable() transliteration folding; virtualized list;
              info modal (locations, sheet music, samples, tags); Typeform feedback
src/RenderPage.jsx ── pdf.js viewer; deep-link page numbers; hotkeys (left/right);
              audio control; session re-verification toasts
src/InvertiblePDF.jsx / InvertibleEmbed.jsx ── dark-mode-capable PDF renderers
src/Login.jsx ── email/password + magic link (sendSignInLinkToEmail) + password reset
src/Pay.jsx ── plans display, PayPal/Amma Shop links, support mailto
src/Admin.jsx ── React Query lookup via getUserByEmail callable; grant paid/beta;
              activation email templates
src/firebase.js ── modular SDK init; checkRefOnce/setRefOnce/removeRefOnce;
              goOnline/goOffline shims; syncUserData (paid status, admin flag)
functions/src/index.js ── getUserByEmail (callable), amritabooks (PayPal/Woo webhook),
              manuallyAddUser, paid (RTDB trigger -> admin FCM push)
functions/src/mail.js ── Mailjet templates
create-index/ ── offline pipeline: yearly .txt indexes + cdbaby/metadata ->
              public/bhajan-index2.json  ({n: name, t: tags, l: locations[]})
create-index/ppts/ ── Python (uv) PPTX -> digest-format PDF songbook generator
scripts/bump-version.cjs ── Husky post-commit version bump (SKIP_BUMP_HOOK=1 to skip)
```

### Bhajan index format

`public/bhajan-index2.json` is an array sorted by `n` (name):
`{ "n": "<name>", "t": "<tags>", "l": ["vol4-180", "2020supl2-5", "cdbaby:...", "sheet:..."] }`.
Location strings are parsed into render links (`/render/vol4/180`) or external
store/sheet links. Regenerating the index requires the `create-index/` scripts
and the source text files — treat the JSON as a build artifact that happens to
be committed.

## Conventions

- **Commits**: Conventional Commits (`feat:`, `fix:`, `chore:`, ...) enforced by
  commitlint + Husky. A post-commit hook auto-bumps `package.json` version, so
  diffs after every commit show a version bump — that is expected.
- **Formatting**: Prettier; ESLint v9 with the React Compiler plugin (beware:
  mutating state during render is flagged; the codebase sometimes uses
  `setTimeout` to defer).
- **`// @ts-nocheck`** appears in some legacy files; `bun run validate` still
  type-checks the rest via `tsconfig.json`.
- **Two service workers**: `service-worker2.js` (Workbox/vite-plugin-pwa) and
  `public/firebase-messaging-sw.js` (FCM). Both must stay no-cache in
  `firebase.json` headers.
- Payment flow is **manual**: user pays externally → `paid/` node written →
  admins approve via Admin UI. Do not "fix" this into an automated flow without
  discussion (see architectural-diary decision on payments).

## Gotchas

- `functions/` has its own `package.json`/`yarn.lock` — never run Bun there.
- Firebase web config in `src/firebase.js` is intentionally public; secrets live
  only in Firebase functions config (`config.amritabooks_secret`,
  `config.mailjet_auth_header`, `config.amritabooks_secret_debug`).
- `public/reset.html` exists to unregister stuck service workers; keep it out of
  the SW navigate-fallback denylist.
- The repository contains large PDFs (`public/pdfs`, root `*.pdf`) — history is
  heavy; avoid `git gc` surprises and don't add more binaries casually.
- E2E tests need the dev server or build; check `playwright.config.js` before
  running them blind.
- MSW mocks are enabled in dev/test via `src/mocks` and `src/index.jsx`.

## Verifying Changes

1. `bun run validate` (mandatory gate).
2. If you touched Cloud Functions: `cd functions && yarn build`.
3. If you touched the PWA config: `bun run build` and confirm
   `dist/service-worker2.js` exists.
4. If you touched the index pipeline: regenerate and spot-check
   `public/bhajan-index2.json` entries against source text files.

## Pointers

- [CHANGELOG.md](CHANGELOG.md) — every commit on master, newest first.
- [architectural-diary/main.md](architectural-diary/main.md) — indexed design
  decisions with detail files.
- [prompt.md](prompt.md) — one-shot prompt that recreates this app from scratch.
- [CLAUDE.md](CLAUDE.md) / [GEMINI.md](GEMINI.md) — sibling agent docs.
