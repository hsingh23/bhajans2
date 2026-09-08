# One-Shot Recreation Prompt — Sing With Amma (bhajans2)

Use this prompt to recreate the app from scratch with an AI coding agent. It
encodes every product, UX, data, and architecture decision needed to rebuild
an equivalent system. (Written 2026-09-08; references:
[README.md](README.md), [AGENTS.md](AGENTS.md),
[architectural-diary/](architectural-diary/), [CHANGELOG.md](CHANGELOG.md).)

---

## The prompt

Build **"Sing With Amma — Bhajan Search Engine"**, a mobile-first Progressive
Web App that lets singers of Hindu devotional songs (bhajans) instantly find
which songbook volume/supplement and page a bhajan appears in, read its lyrics
as an in-app PDF, play an audio sample when available, keep favorites, and
maintain a cheap charity-membership account. Deploy target: Firebase Hosting
at `https://sing.withamma.com/`. Net proceeds of memberships go to the
Embracing the World nonprofit.

### Tech stack (exact)

- **Bun** for package management/scripts; **React 19** + **Vite 7** with
  `babel-plugin-react-compiler`; **Material UI 7** + FontAwesome for icons +
  vanilla mobile-first CSS (no Tailwind); **React Router 7**;
  **@tanstack/react-query v5**; `react-virtualized` for the list;
  `react-pdf-js` (pdf.js) for lyrics; `react-highlight-words`;
  `react-debounce-input`; `@lottiefiles/dotlottie-react` for loaders;
  `@typeform/embed-react` for feedback; Google Tag Manager for analytics.
- **Firebase 12 modular SDK**: Auth (email/password + magic link + password
  reset), Realtime Database, Cloud Functions (Node.js, Yarn-managed,
  region `us-central1`), Cloud Messaging (FCM).
- **PWA**: `vite-plugin-pwa` (Workbox, `registerType: autoUpdate`, filename
  `service-worker2.js`, manifest name "Amma's Bhajans", short_name "Bhajans",
  theme color `#ffa500`).
- **Tests**: Vitest + Testing Library + MSW mocks (unit), Playwright (E2E),
  `bun run validate` = `tsc --noEmit` + ESLint 9 (React Compiler plugin) +
  tests. Husky + commitlint (Conventional Commits) + post-commit auto version
  bump (`scripts/bump-version.cjs`, honors `SKIP_BUMP_HOOK=1`).

### Domain model

- Songbook sources: volumes `vol1`–`vol7`, yearly supplements
  `2011supl`…`2020supl3`, `2025` presentation songbook. Lyrics PDFs live at
  `/pdfs/<volume>.pdf`.
- **Bhajan index** `public/bhajan-index2.json`: committed build artifact, array
  sorted by name: `{ "n": "<name>", "t": "<tags>", "l": ["vol4-180",
  "2020supl2-5", "cdbaby:<slug>", "sheet:<file.pdf>"] }`. Generated offline by
  `create-index/` scripts from text indexes and (2025) PPTX decks; includes a
  Python (uv) PPTX→digest-PDF songbook generator under `create-index/ppts/`.
- **Realtime Database paths**: `favorites/<uid>` (per-user hearts),
  `paid/<uid>` `{paidOn, expiresOn, orderID, payer, gross_total_amount}`,
  `confirmPayment|confirmedPayment` + `confirmBeta|confirmedBeta` (manual admin
  approval queues), `admin/<uid>` = `'1'` (admin flag),
  `messages/<uid>/tokens` (FCM tokens), `satsang/<uid>` (presenter role).
  Security rules mirror these: users read/write only their own favorites,
  admin-only writes for paid/confirmed nodes (`database.rules.json`).

### Search (the core feature)

- Client-side only. Fetch the index once at boot, sort by `n`, memoize a
  **searchable projection**: `makeSearchable(name + locations.join('') + tags)`
  — lowercase, strip non-alphanumerics, then fold transliteration variants:
  `va`→`v`, drop `h`, `z`→`r`, collapse vowel lengths (`a+`→`a`, `ee`→`i`,
  `oo|uu`→`u`), merge `[vw]`→`V`, `[tdl]`→`T`, fold doubled consonants, handle
  `ny` and `[ie]*y`→`Y`. The raw query is passed through the same function, so
  matching is plain `includes()`. Strip spaces from queries.
- Results in a virtualized list (`react-virtualized` WindowScroller+AutoSizer);
  query words highlighted (`react-highlight-words`); scroll position restored
  on return; `window.fetchedBhajans`/`window.searchableBhajans` survive route
  changes.
- Each row: name, tags, first **songbook-pattern** location (regex wins over
  store links), favorite heart, play/stop sample button, info icon.
- Info modal (per bhajan): every book location (each deep-links), sheet-music
  links, sample/buy links, tags.
- Typeform "Bhajan Problem" feedback button floats on the search page.

### Routes / pages

- `/` search list; `/my-favorites` same list filtered to hearts;
  `/pdf/:location/:id/:name` lyrics viewer (auth required; e.g.
  `/pdf/vol4/180/govinda` opens page 180 of vol4);
- `/login` (FirebaseUI-less custom card: email/password sign-in, magic link
  via `sendSignInLinkToEmail` with `emailLink` redirect handling and
  `next=` param preservation, "Forgot Password?" using `sendPasswordResetEmail`
  with toast feedback, guarded redirects that clear stale localStorage);
  `/logout`; `/beta` (beta opt-in waiting page); `/pay` (plans + how-to video +
  support mailto pre-filled with user's uid); `/profile`;
  `/admin` (RequireAdmin: React-Query user lookup via `getUserByEmail`
  callable, grant paid/beta, activation email templates);
  `/faq`, `/privacy`, `/terms` (static content pages);
  `*` → redirect home.
- Auth gating: unauthenticated/expired users are redirected to `/login`
  preserving `next=`; paid status via `syncUserData` reading `paid/<uid>.expiresOn`.

### Lyrics viewer (RenderPage)

- pdf.js render inside the app (never expose a downloadable file); initial page
  parsed from the route location (`vol4-180` → page 180); left/right arrow
  hotkeys + on-screen pagination arrows; page count; pinch-zoom friendly
  (no swipe-to-navigate); inverted/dark rendering via CSS filters
  (`InvertiblePDF`/`InvertibleEmbed`); header with back navigation that
  preserves favorites/history; audio sample control; toast messages (MUI
  Snackbar/Alert) for session re-verification; Google-Docs-viewer fallback for
  unsupported browsers.

### Favorites

- Heart toggles update React state → mirrored to `localStorage["favorites"]`
  instantly; on every `onAuthStateChanged` login, fetch `favorites/<uid>` once
  and `Object.assign` merge over local (documented limitation: deletions don't
  propagate without tombstones — accepted).

### Payments (deliberately manual)

- External shop (PayPal/Amma Shop) with the user's account email autofilled;
  webhook/manual entry writes `paid/<uid>`; an RTDB `onWrite` trigger on
  `/paid/{uid}` sends FCM push to all admins ("<name> signed up! paid $X");
  an admin confirms in the Admin UI (`confirmPayment`→`confirmedPayment`).
  Plans: 1yr $9.99, 5yr $39.99, 10yr $49.99 (best). Pay page states a
  two-business-day manual delay and a no-refunds policy; all net proceeds to
  charity. Do NOT automate the approval step.

### Cloud Functions (names matter)

`getUserByEmail` (https.onCall, admin/user lookup), `amritabooks`
(https.onRequest webhook, PayPal/Woo legacy), `manuallyAddUser`
(https.onRequest), `paid` (database trigger → admin push). Mail via Mailjet
(`functions/src/mail.js`: welcome/reset templates). Secrets only in Firebase
functions config keys `config.amritabooks_secret`,
`config.amritabooks_secret_debug`, `config.mailjet_auth_header`. Firebase web
config is public/client-side in `src/firebase.js` (safe; rules protect data).

### PWA / offline

- Workbox precache of the app shell (no PDFs); runtime **CacheFirst** for
  `/pdfs/*.pdf` (LRU 100 entries / 30 days); StaleWhileRevalidate for
  analytics; `navigateFallback /index.html` with denylist `/api/`, `/__/auth/`,
  `reset.html`; `skipWaiting` + `clientsClaim` + `cleanupOutdatedCaches`;
  update toast prompting reload.
- `public/reset.html`: standalone page that unregisters all service workers
  (recovery from a bricked SW), never cached, outside the fallback denylist
  never.
- Separate `public/firebase-messaging-sw.js` for FCM, registered at bootstrap,
  served `no-cache` (like all worker files via `firebase.json` headers + HSTS).

### Theme / UI language

- Light/dark/system three-state mode (`ThemeContext`, cycles
  light→dark→system, follows `matchMedia` for system, MUI palette flips:
  background `#ffffff`/`#1a1a1a`, paper `#2d2d2d`; primary `#ff6b35`).
- CSS custom properties: primary `#e65100`/dark `#ffb74d`, secondary green
  `#2e7d32`, danger `#c62828`; radii 8/12/9999px; layered shadows; fonts
  Lato (UI), Lora + Playfair Display italic (display); `button-3d`,
  `button-circle` affordances; orange theme color `#ffa500` in the manifest;
  Lottie loaders ("Sandy Loading", "Siri Style Loading").
- Compact circular back button on the viewer; admin gets a discreet `/admin`
  link in the header title; Gmail-compose admin email helper only on desktop
  widths.

### Acceptance criteria

1. `bun install && bun dev` serves on port 3000; `bun run build` emits
   `dist/` + `dist/service-worker2.js`; `bun run validate` passes.
2. Typing `govind`, `bhajan`, or a tag filters the list within one frame on a
   phone; highlighting matches; scrolling 7k rows stays smooth.
3. Clicking a `vol4-180` location opens the viewer on exactly page 180 of the
   vol4 PDF; arrows paginate; back returns to the same scroll position.
4. Heart a song offline → reload → still favorited; sign in on another device →
   favorites merge in.
5. Signed-out user hitting `/pdf/...` lands on `/login` and returns to the
   exact page after authenticating (magic link included).
6. Unpaid member sees the Pay page messaging; a simulated `paid/<uid>` write
   triggers an admin push notification; admin confirmation unlocks the app
   until `expiresOn`.
7. Lighthouse PWA installable; airplane-mode reload serves the shell and
   previously viewed PDFs; `reset.html` unregisters a stuck worker.
8. New commit messages follow Conventional Commits; the post-commit hook bumps
   the version unless `SKIP_BUMP_HOOK=1`.
9. No secrets in the repo; Firebase rules deny non-admin writes to
   `paid`/`confirmed*` nodes.
