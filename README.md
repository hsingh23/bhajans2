# Sing With Amma — Bhajan Search Engine

Live site: **https://sing.withamma.com/**

A Progressive Web App (PWA) for searching and viewing bhajans (Hindu devotional
songs). It lets singers instantly find which book and page a bhajan appears in,
read the lyrics as a PDF (with audio samples where available), keep a list of
favorites, and manage an inexpensive yearly membership that supports the
[Embracing the World](http://www.embracingtheworld.org/) nonprofit.

The app indexes the *Bhajanamritam* / *Bhajanavali* songbook volumes and yearly
supplements published by the Mata Amritanandamayi Math, plus 2025 presentation
songbooks, and makes all of them searchable with transliteration-tolerant
matching — so differently-spelled transliterations of the same song find each
other.

## Features

- **Fuzzy bhajan search** — Sanskrit/transliteration-tolerant matching
  (`va`→`v`, aspirated-`h` dropping, vowel folding, etc.) over names, tags, and
  book locations, with highlighted results in a virtualized list.
- **PDF lyrics viewer** — pdf.js-based rendering with page navigation from a
  search hit deep link, keyboard arrows, dark-mode/inverted rendering, and
  offline caching of visited PDFs.
- **Audio samples & buy links** — CD Baby / self-hosted samples playable inline,
  plus Amazon/Amma Shop purchase links.
- **Favorites** — heart a bhajan anywhere; stored locally and synced to your
  account; a "my-favorites" view filters the search list.
- **Accounts & membership** — Firebase email/password and magic-link sign-in,
  password reset, manual PayPal/Amma Shop payment flow with admin approval and
  expiration tracking. Proceeds go to charity; admins get push notifications
  when someone pays.
- **Offline PWA** — installable, Workbox precache + runtime caching, service
  worker update prompts, and a `reset.html` recovery page for stuck workers.
- **Admin console** — look up users, grant paid/beta access, and send
  activation/welcome emails.
- **Dark mode** — light / dark / follow-system theme toggle.
- **Index toolchain** — `create-index/` scripts that turn yearly text indexes
  and PPTX presentations into the searchable `bhajan-index2.json`, and a Python
  generator that produces a printable PDF songbook.

## Tech Stack

| Layer | Technology |
| --- | --- |
| UI | React 19, Material UI 7, FontAwesome, vanilla CSS (mobile-first) |
| Build | Vite 7 + `vite-plugin-pwa` (Workbox), React Compiler |
| Routing | React Router 7 with an SPA fallback rewrite on Firebase Hosting |
| State/data | React Query (TanStack v5), localStorage caching |
| Backend | Firebase 12: Auth, Realtime Database, Cloud Functions (Node.js), Cloud Messaging |
| PDF | `react-pdf-js` (pdf.js), `react-highlight-words`, `react-virtualized` |
| Testing | Vitest + Testing Library + MSW (unit), Playwright (E2E) |
| Tooling | Bun (root), Yarn (`functions/`), Husky, commitlint, ESLint 9, Prettier, TypeScript checking |
| Analytics | Google Analytics / Google Tag Manager |
| Error reporting | Bugsnag (legacy script) |

## Quickstart

```bash
bun install          # root app dependencies (uses Bun)
bun dev              # Vite dev server on http://localhost:3000

bun run build        # production build (dist/) with PWA service worker
bun run preview      # serve the production build locally

bun run test         # Vitest unit tests with coverage
bun run test:e2e     # Playwright end-to-end tests
bun run lint         # ESLint
bun run validate     # tsc --noEmit + lint + tests — run before finishing any task
```

Cloud Functions use Node.js 24 and Yarn in `functions/` and `admin-functions/`:

```bash
yarn --cwd functions install && yarn --cwd functions build
yarn --cwd admin-functions install
bun run test:functions
bun run deploy:functions
```

See [deployment and production-source audit](docs/DEPLOYMENT.md) for authentication, secrets, and deployment scope.

## Project Structure

```
src/                 React app
  App.jsx            routes, favorites state, index loading
  Search.jsx         virtualized, fuzzy search list + info modal
  RenderPage.jsx     pdf.js lyrics viewer (pagination, hotkeys, toasts)
  Login.jsx          email/password + magic-link + password reset
  Pay.jsx            membership/plans page
  Admin.jsx          admin-only email/UID lookup and membership expiration editing
  firebase.js        Firebase init, auth/db/functions helpers
  ThemeContext.jsx   light/dark/system theme mode
functions/           Firebase Cloud Functions (Yarn)
  src/index.js       Shopify/Woo webhooks, paidNotification, manuallyAddUser
  src/mail.js        responsive Mailjet membership email templates
admin-functions/     protected lookup and membership-access callable functions
public/              static assets, PDFs (public/pdfs), manifests, reset.html
create-index/        index-generation pipeline (text -> bhajan-index2.json)
  ppts/              Python PPTX -> PDF songbook generator
scripts/             bump-version.cjs (post-commit version automation), generate-sw.js
e2e/                 Playwright specs
docs/plans/          implementation plan documents
```

## Data Model (Firebase Realtime Database)

- `favorites/<uid>` — user's hearted bhajans (name -> truthy)
- `paid/<uid>` — `{ paidOn, expiresOn, orderID, payer, ... }` written when
  membership is confirmed; the `paidNotification` DB trigger pushes a notification to admins
- `confirmPayment|confirmedPayment`, `confirmBeta|confirmedBeta` — manual
  admin-approval queues
- `admin/<uid>` — flag granting admin rights (see `database.rules.json`)
- `messages/<uid>/tokens` — FCM device tokens for push notifications
- `satsang/<uid>` — presenter-view role data

## Environment & Configuration

- The Firebase **web app config is public and committed** in `src/firebase.js`
  (standard Firebase practice; security comes from Auth + database rules).
- Cloud Functions use Secret Manager: `SHOPIFY_SECRET`, `AMRITABOOKS_SECRET`,
  and `MAILJET_AUTH_HEADER`. Local environment files are ignored by Git and deployment.
- `scripts/bump-version.cjs` honors `SKIP_BUMP_HOOK=1` to skip the automatic
  version bump.
- Vite's built-in `import.meta.env.DEV/PROD` flags gate analytics and service
  worker registration.

## Deployment

Production at `sing.withamma.com` deploys through Netlify from GitHub `master`.
`netlify.toml` uses Node.js 24, `bun run build`, and the `dist/` directory.
Firebase Functions deploy separately with `bun run deploy:functions`.
See [deployment documentation](docs/DEPLOYMENT.md) and the
[email before/after review](docs/email-review/README.md).

## Contributing / Agents

See [AGENTS.md](AGENTS.md) for agent instructions and conventions,
[CHANGELOG.md](CHANGELOG.md) for the full commit-by-commit history, and
[architectural-diary/](architectural-diary/) for the reasoning behind major
decisions.
