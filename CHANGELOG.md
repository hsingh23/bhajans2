# Changelog

All notable changes to **Sing With Amma — Bhajan Search Engine** (`bhajans2`),
newest first, covering every commit on `master` from the initial import (2017-06-19)
through the present.

> **Note on history:** on 2026-09-08 the commit messages on `master` were rewritten
> (messages only — authors, dates, and every tree/blob are byte-for-byte unchanged)
> to replace placeholder messages such as `chore: life`, `try 3`, `again`, `!fixup`,
> and one accidental AI-chat paste with accurate Conventional Commit messages.
> 188 of 228 messages were improved; commit hashes before that date are stale.
> A pre-rewrite backup exists locally at `backup/pre-docs-20260908`.

## 2026-09-19

- **feat: add protected sales and engagement analytics**
  - Adds the admin sales dashboard with separate recorded receipts and Shopify merchandise estimates, currency/year filters, subscription mix, renewal queues, and current favorites comparisons.
  - Adds authenticated admin aggregation, an idempotent payment evidence archive, and daily access/favorites snapshots for prospective retention measurement.
  - Preserves payment behavior, reports missing historical coverage explicitly, and pins all new functions to the Firebase runtime identity on Node 24.

## 2026-05-27

- **chore: set up codegraph for codex** (`bbf1c9a`)
  - Adds .codegraph/config.json (tree-sitter include/exclude patterns across ~30 languages, docstring extraction, call-site tracking) and .codegraph/.gitignore for local DB/cache files.
  - Prepends a CODEGRAPH section to AGENTS.md instructing agents to prefer codegraph_search/callers/callees/impact/context tools over grep for structural queries.
  - Also simplifies shouldShow2025() to a plain true in App.jsx and adds Proxy-based localStorage/sessionStorage mocks plus storage mock installation to src/setupTests.js.

## 2026-01-11

- **feat: enable 2025 songbook by default and add system theme mode** (`47f6f73`)
  - Two user-facing changes.
  - App.jsx hardcodes shouldShow2025() to true so all users see 2025 entries without the localStorage flag (the ?2025= param override remains).
  - ThemeContext.jsx rewrites dark mode into a three-state themeMode ('light' | 'dark' | 'system') with matchMedia tracking of the OS preference, migration from the old boolean darkMode key, and a light -> dark -> system toggle cycle; DarkModeToggle.jsx renders...

## 2026-01-10

- **fix: prefer songbook locations over store links in search** (`f91cfd7`)
  - Fixes location handling for bhajans with non-songbook links: mergelinks.js filters index entries with value.l.some(loc => loc && loc.match(...)) instead of only checking l[0], and Search.jsx displays the first location matching the songbook pattern (YYYYsup...
  - Regenerates manyMatches.json (13 added, 46 removed) and removes the fully-resolved noMatch.json.
  - Includes the automatic version bump to 1.1.2.

- **fix: restore missing bhajans and re-verify sessions online** (`aa0cd98`)
  - Mixes index repair with auth hardening. create-index: regenerates bhajan-index.txt/json (public copies updated), moves 2011-2017 supplement files into a legacy/ subfolder, prunes manyMatches.json, and adds an "iyarkai amma" noMatch.json entry — restoring bh...
  - App.jsx defers setShow2025 via setTimeout to avoid a cascading-render lint error.
  - Login.jsx adds optimistic navigation when an unexpired session is cached (background syncUserData instead of blocking fetch) and cleans the admin flag.

## 2026-01-05

- **feat: Add password reset functionality to the login page** (`05c6c23`)
  - Login.jsx imports sendPasswordResetEmail and adds handleResetPassword, which validates an email is entered, sends a Firebase reset email with continue URL https://sing.withamma.com, and surfaces success/error toasts (stripping the "Firebase:" prefix).
  - Renders a "Forgot Password?" button below the Sign In button in the password sign-in card.
  - Includes the automatic version bump to 1.1.0.

## 2026-01-01

- **fix: exclude reset.html from service worker navigation fallback** (`4ee7a22`)
  - Adds /reset\.html$/ to the navigateFallbackDenylist in the vite-plugin-pwa workbox config in vite.config.js, so requests for the static reset.html page are served directly instead of being rewritten to /index.html by the service worker.
  - Includes the automatic version bump to 1.0.4.

- **fix: remove session storage logic from footer** (`09c12b4`)
  - Strips the useState/useEffect timer from Footer.jsx that hid the copyright footer 10 seconds after first render (persisted via sessionStorage.footerHidden); the footer now always renders with a plain 'copyRight' class.
  - Unused react and classnames imports removed.
  - Includes the automatic package.json version bump to 1.0.3.

- **feat: auto-bump package version via post-commit hook** (`014de36`)
  - Introduces scripts/bump-version.cjs and a .husky/post-commit hook (with SKIP_BUMP_HOOK=1 loop guard) that parses the last commit message and runs npm version patch/minor/major accordingly (feat -> minor, BREAKING CHANGE -> major, else patch), syncs bun.lock...
  - Removes the .husky/commit-msg commitlint hook (likely because it rejected these scratch commits). package.json bumps 1.0.1 -> 1.0.2 via the new hook itself.

- **chore: verify auto version bump (1.0.0 -> 1.0.1)** (`db689cc`)
  - Second scratch commit in the auto-version-bump setup sequence: the only functional content is package.json version 1.0.0 -> 1.0.1 (the bump itself) and a "change" line added to test_bump.txt.
  - No source code changes.

- **chore: run pre-commit tests via bun run test** (`159f254`)
  - Scratch commit while wiring up auto version bumping: changes .husky/pre-commit from `bun test` to `bun run test` (so the vitest script in package.json runs instead of bun's built-in test runner) and adds an empty test_bump.txt placeholder to have a file to ...

- **fix: harden service worker cache and offline assets** (`256a2c6`)
  - Adds no-cache HTTP headers for service-worker2.js, sw.js, service-worker.js, and firebase-messaging-sw.js via both firebase.json and a new public/_headers file; creates self-unregistering kill-switch workers at public/sw.js, public/service-worker.js, and pu...
  - Vite workbox config gains cleanupOutdatedCaches, clientsClaim, skipWaiting, navigateFallback with an api/auth denylist, and adds wasm/lottie to precache patterns; a vendored public/pdf.worker.min.js plus workerSrc="/pdf.worker.min.js" in InvertiblePDF.jsx m...

- **feat: toggle 2025 results and precache assets** (`bd92294`)
  - App.jsx adds a show2025 feature: a ?2025=1|0 URL param persists a localStorage flag and drives a useMemo that either shows all bhajans or filters out 2025-* locations (dropping bhajans that only exist in 2025). vite.config.js expands the workbox globPattern...

- **fix: adjust offline subscription checks** (`3f93c81`)
  - RenderPage.jsx now computes a single effective offlineValidUntil (preferring stored offlineValidUntil, falling back to min(expiresOn, lastOnline + 3 months), then expiresOn alone) and, when expired, distinguishes a lapsed subscription (error toast, redirect...

## 2025-12-31

- **fix: refine header icon spacing and magic link history** (`b6d3b3c`)
  - Two UI fixes: (1) Header dark-mode toggle no longer wraps or misaligns — App.css adds flex-shrink: 0 to .header-right, display: block for .header-darkmode svg, and line-height: 1, applied via a new header-darkmode class on DarkModeToggle in Header.jsx.
  - (2) Login.jsx sets a sessionStorage magicLinkSignIn flag when arriving on an email sign-in link and uses window.location.replace() instead of navigate() for post-login redirects, keeping magic-link sign-ins from polluting browser history.

- **fix: refresh service worker updates** (`f195598`)
  - Moves the PWA registration in src/index.jsx into an async registerServiceWorkers() step that, in production, first unregisters every existing service worker whose script URL is not service-worker2.js (the new filename set in vite.config.js) before registeri...
  - The registration now runs inside bootstrap() before mocks and render.

- **fix: trigger service worker refresh** (`dc7e2db`)
  - Rewires the vite-plugin-pwa registration in src/index.jsx so onNeedRefresh calls updateSW(true) to auto-reload when new content is available instead of only logging.
  - Exposes window.requestServiceWorkerUpdate (prod-only) and triggers update checks on visibilitychange-to-visible and window online events so deployed users pick up new builds quickly.

- **feat: migrate to Vite, React 19, and modern toolchain** (`29c96b4`)
  - Sweeping 111-file commit that migrates the app off Create React App to Vite 7 with vite-plugin-pwa, upgrades React 17 to 19 (with babel-plugin-react-compiler), renames all src modules from .js to .jsx, and bumps MUI v4 to v7, Firebase 10 to 12, and React Ro...
  - Replaces Cypress with Playwright, adds Vitest + Testing Library + MSW unit tests (auth, favorites, Search, RenderPage, App sanity), and introduces Husky, commitlint, ESLint 9, Prettier, and tsconfig.
  - Also implements the docs/plans/2025-12-31-blocker-fixes.md items: ErrorBoundary around the root render, login redirect gating against stale localStorage, trimmed PWA precache with runtime PDF caching, plus new Privacy/Terms pages, lottie loaders, the 2025 P...

- **feat: add searchable titles and robust language detection to songbook** (`c904d0b`)
  - Enhances create-index/ppts/songbook_generator.py: emits an invisible 1pt transparent-ASCII title on each song so Ctrl+F finds diacritic forms (e.g.
  - "prema-sagarame" matches "prēma-sāgaramē"), replaces the small KNOWN_LANGUAGES list with a ~60-language LANGUAGE_MAP of variations/abbreviations plus reverse lookup and filename-based language regex patterns, and tracks language_sources in the processing re...
  - PPTX text extraction now preserves soft line breaks (vertical tabs → newlines).

- **feat: add 2025 bhajan songbook pipeline and dark mode UI** (`8b32857`)
  - Giant mixed commit (424 files, +50,492): adds ~370 PowerPoint files for 2025 bhajan presentations under create-index/ppts/2025/, the Python songbook toolchain (songbook_generator.py 1,463 lines, download_fonts.py, NotoSerif fonts, pyproject.toml, uv.lock) a...
  - On the frontend it introduces a dark mode feature — ThemeContext with localStorage + prefers-color-scheme, DarkModeToggle added to Admin/Pay/Search/RenderPage headers, MUIThemeProvider, CSS custom properties in App.css, and InvertiblePDF/InvertibleEmbed wra...
  - Also deletes the stray commit-msg.txt and tweaks .vscode/settings.json.

## 2025-08-07

- **chore: add stray commit message notes file (accidental)** (`757d2b4`)
  - Adds commit-msg.txt containing a pasted AI assistant response congratulating on the previous (de57a48f) commit — an accidental working-tree artifact, not real content.
  - The commit message itself is that same pasted AI text rather than a description of the change.
  - The file is deleted again four months later in e90a88c9.

- **feat: modernize to Firebase v9 modular SDK and Workbox service worker** (`69cc968`)
  - Phase 2/3 of the modernization plan: rewrites src/firebase.js onto Firebase v9+ modular APIs (initializeApp, getAuth, getDatabase with ref/get/set/remove, getFunctions/httpsCallable, getMessaging guarded by isSupported + production + service-worker readines...
  - Replaces sw-precache with workbox-build via a new scripts/generate-sw.js (precache plus cache-first /pdfs/*.pdf and stale-while-revalidate runtime caches) wired into the build script.
  - Login.js switches to firebaseui.auth.EmailAuthProvider, the messaging SW moves to 10.14.1 compat scripts with onBackgroundMessage, and firebase/firebaseui/workbox deps are bumped; plan.md/CLAUDE.md record phase completion.

- **feat: migrate to React Router v6 with compatibility layer** (`8a1f991`)
  - Phase 1 of the router modernization: upgrades react-router-dom to v6, replacing Router/Switch/Redirect with HashRouter/Routes/Route/Navigate in src/index.js and src/App.js.
  - Adds a withRouterCompat HOC in src/util.js that re-provides v5-style match/history/location props to class components, plus RequireAuth/RequireAdmin wrappers (RTDB admin check) and a hashchange-based GA pageview tracker replacing history.listen.
  - Admin.js moves to useNavigate; Beta/Logout/Login get wrapped; analytics doOnce is gated to production.

- **docs: enhance CLAUDE.md with detailed component architecture** (`251cf4d`)
  - Extends CLAUDE.md with a Mermaid component/data-flow diagram and "deep dive" sections covering functions/src/index.js (getUserByEmail, amritabooks webhook, paid trigger), RenderPage.js subscription gating, Admin.js auth/data flow, and the Search.js normaliz...
  - Also fixes the lodash wrap import in src/firebase.js (from "lodash/wrap" default import to named { wrap } from "lodash") and adds the history and lodash runtime dependencies to package.json + pnpm-lock.

- **docs: add comprehensive CLAUDE.md for development guidance** (`f578afa`)
  - Adds a 180-line CLAUDE.md documenting dev/build/deploy commands, the React + Firebase architecture, search algorithm, favorites model, FCM, service-worker pipeline, database rules, and project layout.
  - Also adds .vscode/tasks.json (Deploy Firebase Functions task), pnpm-workspace.yaml with onlyBuiltDependencies, a packageManager: pnpm@10.11.1 field in package.json, and the first pnpm-lock.yaml (18,579 lines).

## 2023-02-25

- **chore: update copyright notice and reformat Search.js** (`2e05e2f`)
  - Updates the footer in src/Search.js from "© MA Centers 2019, all rights reserved." to "© MA Centers 2023 & © Amrita Books 2023, all rights reserved." The other ~100 changed lines are a mechanical prettier reformat of the same file switching double quotes to...

## 2023-01-24

- **fix: add node-fetch for Mailjet calls in functions** (`a84782e`)
  - Adds node-fetch ^3.3.0 to functions/package.json and requires it at the top of functions/src/index.js and mail.js. mail.js calls the bare global fetch(), which does not exist on the Node 16 Functions runtime, so without this dependency the newUserResetPassw...

## 2023-01-17

- **feat: add Amrita Books WooCommerce webhook and welcome email** (`e553b2f`)
  - Replaces the stubbed shopify_paid endpoint with an `amritabooks` HTTPS function that verifies a WooCommerce webhook via HMAC-SHA256 (x-wc-webhook-signature), maps the SingWithAmma-1year SKU to a 1-year subscription, auto-creates the Firebase auth user with ...
  - Adds functions/src/mail.js (492 lines) with a styled AMP HTML Mailjet template for the new-user welcome/password-reset email, plus email images in public/email-images/.
  - Comments out the old PayPal `process` handler and drops paypal-rest-sdk from functions/package.json (firebase 9.15.0 added, firebase-functions loosened to 3.x).

## 2023-01-08

- **refactor: drop unused isAdmin state from Admin** (`404af58`)
  - Deletes the isAdmin/setIsAdmin useState pair from Admin.js; the fetchData effect now only redirects to /login when the admin/{uid} node is absent and no longer sets state inside the snapshot callback.
  - Access control behavior is unchanged because rendering is no longer conditioned on isAdmin (that gate was removed in the prior commit).

## 2023-01-07

- **fix: guard Admin email state against null in useQuery** (`284f5bf`)
  - Initializes the Admin email state to "" instead of null and guards the useQuery `enabled` flag with !!email so `email.length` no longer evaluates on null (which produced a warning/error on render).
  - Removes the `!isAdmin ? <CircularProgress/> : ...` wrapper so the admin page always renders after the redirect check, and adds an eslint-disable comment for the effect dependency.

- **chore: remove debug console.logs and unused vars** (`9816e13`)
  - Removes the console.log(playing, cdbabySampleUrls[0]) from RenderPage and console.log(url) from Search.js play(), both added minutes earlier in the play-button fix.
  - Drops the now-unused useCallback import and isError/error destructuring from Admin.js's useQuery result.
  - No behavior change.

- **style: apply 3D styling to favorite button on bhajan page** (`bcd91e6`)
  - Changes the favorite heart button classNames passed from RenderPage's renderFavorite call so both active and inactive states include the "button-3d" class ("button button-3d button-caution button-circle" / "button button-3d button-circle"), matching the pla...
  - Two-line CSS-class-only change with no logic touched.

- **fix: toggle play/stop state on bhajan page sample audio** (`219ca10`)
  - Adds a `playing` state to RenderPage that is initialized from the global #audio element so navigating to a bhajan page mid-playback keeps the correct button icon.
  - The sample-audio button now toggles between play() and stop() (icon switches between play and stop), gets an aria-label, and an onEnded handler resets state when audio finishes.
  - Also adds a stray console.log in Search.js play().

- **feat: use React Query for admin user lookup** (`4c46622`)
  - Introduces @tanstack/react-query and wraps the app in QueryClientProvider with devtools in src/index.js.
  - Rewrites the Admin.js email lookup from a manual useCallback/useEffect fetch to a useQuery keyed on ["email", email] with enabled gating, a fetching spinner, 400ms debounce, and flexible input layout; also fixes user.name → user.displayName.
  - Plans.js gets a "$" added to the 10-year label, and App.js/index.js receive prettier-style reformatting (arrow parens, trailing commas, quote style).

## 2023-01-06

- **fix: correct 5-year plan price label to $40 in Pay.js** (`486a376`)
  - Changes the 5-year subscription button label in src/Pay.js from "5 Years - $50" to "5 Years - $40", matching the $39.99 fiveIndividual40 plan in Plans.js.
  - Updates functions/.babelrc preset-env target from node 10 to node 16 (and adds a trailing newline).
  - The Ammashop checkout URL itself is unchanged.

- **chore: clean up Pay.js dead imports and responsive admin input** (`dfcca29`)
  - Removes ~11 lines of dead imports (PayPalButton remnants, MUI table components, notie, useHistory, useEffect/useState) from src/Pay.js, leaving the simple plan-button page.
  - Changes the Admin.js DebounceInput min-width from a fixed 800px to "min(95%, 800px)" so it fits narrow screens.
  - Bumps the engines requirement in package.json from node >=12 to >=16.

- **chore: add searchable volume 1 text with diacritic cleanup script** (`4e867fa`)
  - Adds create-index/cdbaby/json-bhajans/clean-volume.js, a Node script that transliterates diacritic-heavy Bhajanamritam Vol.
  - 1 text (e.g.
  - "ammà" → "amma", "kaniyèåamè" → "kaniyename") via a large character-translation map, converts bold-marked titles into "## Heading" markdown, strips page-footer boilerplate, and normalizes smart quotes.

- **fix: stop redirecting Pay page to login and simplify payment links** (`a8619d9`)
  - Deletes Pay.js's componentDidMount checkUser logic, which bounced users to /login (the misbehaving "payment redirect") and warned already-paid users; imports whenUser/useEffect (unused) in its place.
  - Replaces the pricing Table with three direct Amma Shop cart buttons (1yr $10, 5yr, 10yr), reorders copy (Payments h1, YouTube embed up front, stronger no-refund/use-your-account-email warnings, two-business-day note), and removes a large block of commented-...
  - Adjusts .pay padding and h2 margins in App.css.

## 2023-01-04

- **fix: fall back to home when history is empty on PDF back button** (`d7641ad`)
  - In src/RenderPage.js, the header's onClick now checks history.length === 1 and sets window.location.href to origin + "/#/" in that case, otherwise calling history.goBack() as before.

- **feat: clarify search page link and button labels** (`84efe25`)
  - Renames four user-facing labels in src/Search.js's info modal and footer nav: "CD Baby:" becomes "Song samples:", the " Buy " link text becomes " Buy on Amazon (if available) ", "Only My Favorites" becomes "Filter to my Favorites", and "Home" becomes "Show ...

## 2023-01-03

- **feat: add activation email templates to Admin page** (`312d89d`)
  - Reworks src/Admin.js (mostly reformatting plus real changes): adds two pre-filled mailto: links — "Account Activated Email" for a found user and "Create Account Email" when an email has no account yet — with URL-encoded welcome/activation bodies signed by H...
  - Guards getUser behind an email.includes("@") check, widens the DebounceInput (minWidth 800px), and cuts debounce timeout from 700ms to 100ms.

- **feat: serve song samples from self-hosted bucket and rebuild index** (`7365084`)
  - Replaces the 100+ per-CD cd-*.json files with a consolidated create-index/cdbaby/samples.json (~11.6k lines, entries keyed by song with a path field), and rewrites mergelinks.js addSong to source sample URLs from https://bhajan-samples.withamma.com + song.p...
  - Regenerates cdbaby.json, noMatch.json, manyMatches.json, and bhajan-index2.json with pretty-printing.
  - Also swaps the seven 2021 supplement PDFs for recompressed versions (~30-40% smaller).

- **feat: add shopify_paid webhook stub and upgrade functions to Node 16** (`ce84341`)
  - In functions/, upgrades the runtime from nodejs14 to nodejs16, bumps babel/firebase-tools/firebase-functions-test devDeps, and reformats index.js.
  - Adds a new exported shopify_paid HTTPS function (currently a logged stub with a large commented-out implementation modeled on manuallyAddUser for granting paid subscriptions from Shopify webhooks) alongside the existing getUserByEmail/manuallyAddUser/proces...
  - Also adds create-index/cdbaby/boxsamples.js (a transliteration/cleanup utility for cd-sample-names.txt with its raw and cleaned outputs) and refactors mergelinks.js (docs, let/const, comments) toward the sample-matching rework.

## 2022-11-30

- **test: add Cypress e2e tests for login, signup, and password reset** (`8b6fbba`)
  - Scaffolds Cypress (config, support files, fixtures, eslint cypress/recommended plugin, deps in package.json/yarn.lock) and adds cypress/e2e/firebase.cy.js covering: failed login, account creation + login + redirect to /pay, password reset via a temp-mail AP...
  - Persists the generated test account email in email.json.
  - Also touches src/firebase.js (comments out the notie alert import, formatting, getUserByEmail formatting) and src/Search.js (one line).

- **chore: update node version** (`fdfd44f`)
  - Updates .node-version from 14 to 18 and .ruby-version from 2.7.1 to 2.7.2, aligning the toolchain pins (likely for a Heroku-style deploy that reads these files) with the environment the app was being developed against.

- **feat: add Typeform "Bhajan Problem" feedback button to search page** (`2e461d7`)
  - Adds a @typeform/embed-react PopupButton ("Bhajan Problem", form EVBTgcG5) to the search page in src/Search.js for reporting song issues.
  - Updates package.json to add the typeform dependency, bump @fortawesome/fontawesome-svg-core to 6.2.1, and append --openssl-legacy-provider to the start/build/test react-scripts invocations so the old CRA toolchain runs on newer Node. yarn.lock updated accor...

## 2022-08-29

- **chore: add pdfs** (`92ca143`)
  - Adds the seven 2021 supplement PDFs (2021supl1 through 2021supl7, ~460-650KB each) to public/pdfs, completing the 2021 songs added to the index earlier, and bumps the regenerated cdbaby.json, manyMatches.json, noMatch.json, and bhajan-index2.json match repo...

## 2022-08-24

- **fix: remove broken notie alerts from service worker updates** (`c1d1c54`)
  - In src/registerServiceWorker.js, removes the notie import and comments out both alert() calls for "New content is available" and "Content is cached for offline use", leaving console.log plus the 8-second auto-reload.
  - Some incidental Prettier-style quote changes are included.

## 2022-08-22

- **fix: drop ai? collapsing from cdbaby searchable-name normalization** (`3d40daa`)
  - One-line change in create-index/cdbaby/mergelinks.js commenting out .replace(/ai?/g, "ai") in makeSearchable, mirroring the same change made to src/Search.js in the prior commit.
  - Despite the "noop" message, this functionally changes how searchable keys are generated for cdbaby matching.

- **fix: navigate back in history from PDF header to keep favorites** (`79eaa09`)
  - In src/RenderPage.js, replaces the header logo's react-router <Link to="/"> with a div wired to history.goBack(), so tapping the header from a PDF page returns to the previous route instead of resetting to home.
  - The remainder of the 126-line diff is Prettier reformatting (quotes, arrow parens, ternary JSX).

- **fix: adjust name normalization for optional text in cdbaby matching** (`de1edc9`)
  - Tweaks the fuzzy-matching pipeline to cope with optional parenthetical/variant text in song names: create-index/cdbaby/mergelinks.js changes /va / to /va/ so the bhava≈bhav substitution applies everywhere, and src/Search.js comments out the .replace(/ai?/g,...
  - Regenerates cdbaby.json, bhajan-index2.json, manyMatches.json, and noMatch.json from the updated matcher.

- **chore: add 2021 songs** (`6508b83`)
  - Adds create-index/2021Supplement.txt (265 lines) plus its transliterated .changed.txt variant, registers 2021Supplement.txt in both supplement lists of create-index.py, and regenerates bhajan-index.json/txt, manyMatches.json, and the public bhajan-index.jso...

## 2022-08-15

- **fix: increase service worker update alert duration to 3s** (`de18f84`)
  - Two-line change in src/registerServiceWorker.js bumping the notie alert time option from 1 to 3 for both the "New content is available" and "Content is cached for offline use" messages, so the notification stays visible longer.

- **fix: auto-dismiss service worker update alerts and reload after 8s** (`befb5e4`)
  - Reworks the notie alerts in src/registerServiceWorker.js for the "New content is available" and "Content is cached for offline use" states to pass time: 1 and stay: false so they auto-dismiss, and keeps the forced window.location.reload after 8 seconds when...
  - The rest of the diff is Prettier formatting (quotes, arrow parens).

- **fix: match numbered supplement locations in PDF link regex** (`5fb3d9b`)
  - Updates the location-parsing regex from /\d{4}supl-\d+/ to /\d{4}supl\d?-\d+/ in both src/Search.js (wrappedName) and create-index/cdbaby/mergelinks.js, so locations like "2020supl2-3" from the newly added supplements are recognized as real books and linked...
  - The bulk of the 243-line Search.js diff is Prettier reformatting (single to double quotes, arrow parens, JSX parentheses); regenerated noMatch.json and bhajan-index2.json are also included.

- **feat: add 2020supl2 and 2020supl3** (`b35dd1e`)
  - Adds the 2020supl2.pdf and 2020supl3.pdf books (repo root and public/pdfs), their raw and transliterated index text files under create-index/, and registers both supplements in create-index.py so they are merged into the master bhajan index.
  - Extends translation.csv with new diacritic mappings (e→ø, o→ó/ö, u→ŭ) and switches the python index builder from subprocess.call to Popen.
  - Regenerates bhajan-index.json/txt and the public bhajan-index.json consumed by the app.

## 2021-07-11

- **fix: strip mailto: prefix from Admin email input** (`39b3c2b`)
  - Makes the Admin email input strip a leading "mailto:" from pasted values (extending the earlier trim), and deletes ~127 lines of commented-out legacy class-component code left over from the 019ee59 rewrite.

## 2021-06-21

- **fix: handle unpaid users and nested clicks in Admin** (`70054c3`)
  - Guards getUserByEmail in functions/src/index.js with `|| {}` so users with no /paid record don't crash the destructuring, fixes the PLANS.find parenthesization in src/Admin.js so clicking a button's child element still resolves the plan, trims the email inp...

## 2021-06-20

- **fix: correct isvara lila yitellam index entry** (`ffd4108`)
  - Corrects the "Ìsvara lila yitellam" mojibake entry, collapses its duplicate vol3old-60/voli3-75 locations to vol3-76, and adds the alternate title "ishwara lele yitellam" in the index sources.
  - Adds the 2020.txt/2020.changed.txt title lists (diacritic and transliterated variants) and regenerates bhajan-index.json/bhajan-index2.json.

- **feat: add email-based admin lookup; upgrade to Firebase 8** (`54a0333`)
  - Upgrades firebase 7.14→8.6.8 (plus react-select 4, classnames, core-js, etc.) and adds react-debounce-input.
  - Adds two Cloud Functions: callable getUserByEmail (admin-gated user/payment lookup) and manuallyAddUser (writes paid/transactions records).
  - Rewrites src/Admin.js from a class component to hooks with debounced email search and one-click plan-grant buttons, exposes the callable via src/firebase.js, adds src/analyticsTracker.js (ReactGA pageview HOC), and drops the staging alias from functions/.fi...

- **chore: add react-app-rewired overrides and ignore artifacts** (`f7f2fe5`)
  - Adds config-overrides.js using customize-cra's override(useBabelRc()) so react-app-rewired picks up a .babelrc, appends public/webviewer/ and stats/ to .gitignore, and adds a green VS Code workbench color theme in .vscode/settings.json.

## 2021-04-23

- **fix: fall back to raw displayName when it is not JSON** (`89ac0db`)
  - Replaces `displayName ?
  - JSON.parse(displayName) : displayName` with `displayName || ""` for cleanedDisplayName in src/Pay.js.
  - The JSON.parse introduced in af09d03 threw when displayName was stored as a plain (non-JSON) string, breaking the Pay page render.

## 2021-04-20

- **Delete package-lock.json** (`da7a03a`)
  - Removes the 21,484-line package-lock.json that was accidentally committed in af09d03, returning the repo to a yarn-only workflow (yarn.lock remains the single lockfile).

- **feat: improve Pay page greeting and home navigation** (`5d4226f`)
  - In src/Pay.js, JSON-parses the displayName from localStorage for the greeting (falling back to a plain "Hello"), uses it in the support-email template, turns the header title into a Link to "/", and adds a "Home (Bhajan List)" link next to Logout.
  - The commit also accidentally adds a 21,484-line package-lock.json generated by an npm install (removed again in ba2d827).

## 2021-03-20

- **feat: pass account email to Amma Shop checkout links** (`cc5179a`)
  - Appends ?email=<signed-in email> to the three Amma Shop cart URLs in src/Pay.js and rewords the helper text to say the email should be autofilled and changing it complicates fulfillment.

- **chore: comment out unused PayPal client config in Pay.js** (`2d58f40`)
  - Comments out the PayPal mode/clientId constants and removes the now-unused selectedPlan destructure in src/Pay.js, cleaning up dead code from the PayPal removal in b248292.
  - No behavior change (the values were already unused).

- **feat: replace PayPal checkout with Amma Shop links on Pay page** (`78871a9`)
  - Rewrites src/Pay.js to drop the in-app PayPalButton/react-select checkout in favor of a Material-UI pricing table linking to theammashop.com cart URLs (The Decade 10yr/$50, 1/2 Decade 5yr/$40, One Year 1yr/$10), embeds a YouTube promo video, and adds warnin...
  - Adds the @material-ui/core dependency; the old PayPal code is left commented out rather than deleted.

- **chore: pin Node 14 and Ruby 2.7.1 with version files** (`74a4d96`)
  - Adds .node-version containing "14" and .ruby-version containing "2.7.1" so version managers (nodenv/rbenv/asdf) select the intended toolchain.

- **build: declare Node >=12.0.0 engine in root package.json** (`3148634`)
  - Adds an engines block ("node": ">=12.0.0") to the root package.json.
  - Three-line change, nothing else.

- **build: widen functions engines.node to ^10.12.0 || >=12.0.0** (`0e83a8e`)
  - Changes engines.node in functions/package.json from ">=12" to "^10.12.0 || >=12.0.0".
  - One-line metadata change.

- **build: set Firebase Functions runtime to nodejs14** (`772095e`)
  - Adds "runtime": "nodejs14" to functions/firebase.json so Cloud Functions deploy on the Node 14 runtime.
  - One-line config change, nothing else.

- **build: upgrade deps for Node 12+ (firebase-admin 9, CRA 4)** (`10d82da`)
  - Bumps functions deps (firebase-admin 8.10→9.5, firebase-functions 3.5→3.13.2, babel/firebase-tools), upgrades react-scripts 3.4.1→4.0.3 at the root, changes the functions Node engine from 10 to >=12, and regenerates both lockfiles (~13k lock lines). src/ind...

- **feat: add 2020 supplement to bhajan index** (`25083fa`)
  - Adds create-index/2020Supplement.txt (174 titles) plus its transliterated .changed.txt variant, registers the new supplement in create-index/create-index.py, adds the ṅ transliteration mapping to translation.csv, regenerates the bhajan-index JSON/text artif...
  - Also piggybacks broad dependency bumps (React 16.13→17.0.1, react-scripts-adjacent packages, react-ga 3, etc.).

## 2020-05-30

- **feat: add Google Tag Manager (GTM-KF3RQXP) to index.html** (`0337ad4`)
  - Adds the Google Tag Manager bootstrap script and noscript iframe (container GTM-KF3RQXP) to public/index.html, refreshes the expiring WakeLock origin-trial token, and reindents/reformats the entire file (2-space nesting, prettier style).
  - No other behavior changes.

## 2020-05-10

- **feat: link buy button to Amazon search instead of CD Baby** (`c449638`)
  - Changes the buy button href in src/RenderPage.js from the per-song CD Baby URL (cdbabyBuyUrls[0]) to an Amazon search URL built from the bhajan name (https://www.amzn.com/s?k=<encoded name> amma).
  - The rest of the diff is Prettier-driven reformatting (multiline conditionals, JSX reindentation, && instead of ternary parens) with no behavior change.

## 2020-04-12

- **include babelrc** (`26e2885`)
  - Checks in a root .babelrc enabling @babel/plugin-proposal-optional-chaining, needed after the react-scripts 3.4.1 bump in the preceding commit changed how babel config is resolved.
  - Also comments out an experimental wakelock polling interval (setInterval) in src/index.js.

- **fix: renew wakelock on release and disable search autocomplete** (`e478557`)
  - The screen wake lock now re-requests itself when released and the origin-trial token in index.html is refreshed for a later expiry.
  - The search input gets autoComplete="off", debug console.log calls and redundant goOnline() calls are removed from firebase.js, and dependencies are bumped (firebase 7.14.0, react 16.13.1, react-scripts 3.4.1) with ~6000 lines of yarn.lock churn.

## 2020-04-04

- **switch the buy links to amazon digital** (`efa1c86`)
  - Search.js stops using the per-song CD Baby buy URLs (the cu field) and instead builds Amazon search links of the form amazon.com/s?k=<song name> amma from cdbabyNames, in both the result row and the info dialog (which drops the buy URL from its zip tuple).

## 2020-03-24

- **chore: switch PayPal checkout to live mode** (`a93b5fc`)
  - Flips the mode selector in Pay.js from ["sandbox", "live"][0] to [1], so checkout uses the live PayPal client ID and the process function records live transactions.
  - This is the go-live flip after the pay-page rework was tested in sandbox.

- **chore: remove commented-out plan card markup and unused CSS** (`a9a2461`)
  - Deletes the commented-out flexC plan-card JSX block from Pay.js and the 67 lines of matching unused styles from index.css, backing out the abandoned pricing-card experiment introduced in the preceding pay-page commit two minutes earlier.

- **feat: rework pay page around new 10-year plan lineup** (`3531c4a`)
  - Extracts PLANS into a new Plans.js module (10-year plan replacing lifetime, isBest flag) now shared by Admin.js and Pay.js.
  - The pay page is rewritten with a features list, no-refunds emphasis, and a plan-gated PayPal button with a large price display; an experimental plan-card layout is left commented out along with ~80 lines of index.css styles.
  - PayPal mode is switched back to sandbox for testing.

- **feat: replace lifetime plan with 10-year plan in payment function** (`630e2cf`)
  - functions/src/index.js restructures PLANS from an object keyed by plan id into an array looked up with find(), and swaps lifetimeIndividual50 for a tenIndividual50 10-year plan at $49.99 flagged isBest.
  - The file is heavily prettier-reformatted, and functions/.babelrc raises the compile target from node 8.16 to node 10.

## 2020-01-30

- **fix scroll behavior** (`c67c48e`)
  - In Search.js, document scroll position is only propagated into react-virtualized's WindowScroller while isScrolling is true, stopping the scroll-position fighting. componentWillReceiveProps is renamed to UNSAFE_componentWillReceiveProps (React 16.9 deprecat...

## 2020-01-12

- **fix: merge Vol3 into index, add firebase appId, tune search** (`312bcdf`)
  - Adds create-index/Vol3.txt as an index source in create-index.py and regenerates the index/cdbaby artifacts; removes seven unused yearly supplement PDFs and swaps in a smaller vol3.pdf; adds the missing firebase appId to the web config (required by firebase...

- **add preliminary wakelock (may not work in all browsers)** (`90e8abb`)
  - src/index.js requests a navigator.wakeLock("screen") on startup and re-requests it on visibilitychange and fullscreenchange events, releasing cleanly when unsupported. public/index.html adds a WakeLock origin-trial token meta tag (the file is also reformatt...

- **chore: bump app dependencies (firebase 7.6, react 16.12)** (`a7512b1`)
  - package.json-only dependency refresh — firebase 6.3.5 to 7.6.2, firebaseui 4.4.0, react/react-dom 16.12.0, reactstrap 8.2.0, core-js 3.6.3, react-modal 3.11.1 — plus a 538-line yarn.lock regeneration.
  - Pushed together with the wakelock and various-fixes commits from the same session.

## 2019-12-03

- **feat: show signed-in user and logout link on pay page** (`fccc862`)
  - Pay.js adds a highlighted yellow banner greeting the signed-in user, showing their email and membership expiry, with a "Logout / Change User" link to /logout.
  - The page copy is restructured (no-refunds note, free-vs-paid description, prefilled mailto support link containing name/email/uid), and a .yellowBg style is added to App.css (which also gets prettier-reformatted).

## 2019-11-30

- **Merge branches 'master' and 'update-song' of github.com-hsingh23:hsingh23/bhajans2** (`ce0d156`)
  - Merge commit joining master (0e06faf, the squash-merged PR #16) with the update-song branch (f83ed60).
  - Both parents carry identical trees — the same one-line index fix applied on both sides — so the merge introduces no code or data changes and only reconciles history.

## 2019-10-09

- **fix: correct page number for subhra saroruha nilaye devi (#16)** (`1cec139`)
  - Squash-merge of PR #16 onto master, carrying the identical one-line-per-file correction of "subhra saroruha nilaye devi" from Vol4-181 to Vol4-180 in all six index artifacts.
  - Its tree is byte-identical to the update-song branch commit f83ed60, making the later merge of the two a no-op.

- **fix: correct page number for subhra saroruha nilaye devi (Vol4-180)** (`9e26ef7`)
  - Fixes the entry for "subhra saroruha nilaye devi" from Vol4-181 to Vol4-180 across all six index artifacts — the create-index source/txt files and the generated public JSON indexes.
  - This is the branch-side (update-song) commit of the same change later squash-merged as PR #16.

## 2019-10-07

- **chore: bump Cloud Functions deps (firebase-admin 8.6, babel 7.6)** (`f23f180`)
  - Updates functions/package.json only — firebase-admin ~8.6.0, @babel/cli/core/preset-env 7.6.2, firebase-tools 7.4.0, xo 0.25.3 — plus a 2201-line yarn.lock regeneration.
  - No source changes.

- **feat: add admin tool to grant paid access by uid** (`771312c`)
  - Rewrites Admin.js from a beta-approval table into a form that writes a paid subscription (plan, price, expiry) for any uid directly to the Firebase database, with a plan Select dropdown.
  - Pay.js gains About and pricing copy announcing the move out of beta.
  - Dependencies are bumped (react 16.10.2, react-scripts 3.2.0, firebaseui 4.2.0, react-router-dom 5.1.2) with attendant reformatting of Admin/Pay/Search and vscode/eslint settings tweaks.

## 2019-08-12

- **chore: remove unused reactfire dependency** (`66717f8`)
  - Single-line change deleting the reactfire entry from package.json dependencies.
  - Nothing in src/ imports reactfire at this point, so this only slims the install and lockfile.

- **Add more sheet music (#14)** (`810e531`)
  - Squash-merged PR #14 that expands the sheet music list by ~490 entries.
  - Introduces react-snap as a postbuild prerendering step, adds preconnect/preload hints and an earlier HTTPS redirect in index.html, and adds aria-labels to buttons across Search.js and App.js.
  - Also drops bootstrap/react-bootstrap/stripe deps, bumps firebase to 6.3.5 and react to 16.9.0, adds husky/lint-staged prettier hooks, and adds PayPal debug logging in the functions source.

## 2019-08-11

- **fix: default to lifetime plan and fall back to auth uid on Pay page** (`aa406df`)
  - Three one-line fixes in src/Pay.js two days after the PayPal launch: the default selected plan changes from PLANS[1] (5-year) to PLANS[2] (lifetime); the login redirect triggers when auth.currentUser is missing OR localStorage.uid is unset; and the payment ...

## 2019-08-09

- **feat: add self-serve PayPal payment flow** (`b1d339b`)
  - PR #12 merge replacing the manual "email us after paying" flow.
  - Pay.js is rebuilt with react-paypal-button-v2 and a react-select plan picker ($9.99/1yr, $39.99/5yr, $49.99/lifetime); a rewritten functions/src/index.js adds a paypal-rest-sdk cloud function that verifies order IDs against PayPal, writes paid/ and transact...
  - Also adds the 2019 supplement content and PDF, jaro-winkler fuzzy matching in mergelinks.js with sample URLs re-pointed to the singwithamma S3 bucket, a new Profile.js, Login/Logout/index.js updates, and dep upgrades.

## 2019-05-13

- **chore: regenerate yarn.lock** (`e699c65`)
  - Touches only yarn.lock (1568 insertions, 1471 deletions), regenerating it minutes after PR #9 (c6c9f1f) merged dependency upgrades.
  - Likely reconciles the lockfile with package.json after the merge (the PR's own lockfile may have been based on a different resolution).

- **feat: add bhajan info modal with audio stop control** (`c7438ae`)
  - PR #9 merge.
  - Search.js gains a per-bhajan info modal (toggled by an info icon) listing all book locations, sheet music links, CD Baby sample/buy links, and tags, with a play/stop toggle for samples; row height grows from 100 to 200 to fit new buttons, and App.css is res...
  - Dependencies jump: react 16.8.6, bootstrap 4.3.1, react-router-dom 5.0.0, core-js 3, prop-types 15.7.2, classnames added.

## 2018-12-03

- **feat: add reset page to recover from a stuck service worker** (`61f084b`)
  - Adds public/reset.html, a standalone page that unregisters all service worker registrations, sets localStorage.reset = 1, and redirects back to index.html after 10 seconds; index.html gains an inline script that reloads once when that flag is set (flag clea...
  - Narrows sw-precache staticFileGlobs from build/*.html to build/index.html so the navigateFallback does not intercept reset.html, and drops the crossorigin attribute from the preload link added the day before.

## 2018-12-02

- **fix: serve service worker from both old and new URLs** (`d94c7fa`)
  - The build script now copies build/service-worker2.js to build/service-worker.js after sw-precache runs, so clients requesting either URL (old registrations vs new ones) get a valid worker.
  - Adds public/android-chrome-512x512.png (248 KB) that manifest.json references, and prepends a large commented-out block of CRA service-worker boilerplate to registerServiceWorker.js (the active code, which registers service-worker2.js on load, is unchanged)...

- **fix: correct preload credentials and defer analytics bootstrap** (`272732d`)
  - Adds crossorigin to the bhajan-index2.json preload link in index.html so the preload matches the credentials mode of the later fetch() and is actually reused (previously the browser downloaded the large JSON twice and warned about the unused preload).
  - Moves registerServiceWorker() out of the deferred doOnce IIFE so it runs immediately, and wraps the UserReport/Google Analytics bootstrap in setTimeout(doOnce, 5000) to keep it off the critical path.

- **feat: link audio and sheet music to all matching bhajans** (`ca5c1cc`)
  - In create-index/cdbaby/mergelinks.js, the many-match case now calls addSong/addSheetMusic for every match instead of stopping at a `debugger;` after adding only the first, so CD Baby tracks and sheet music attach to all matching bhajans (regenerates bhajan-...
  - Also adds SEO/PWA polish: a meta description and reformatted public/index.html, a new robots.txt allowing all crawlers, and a 512x512 android-chrome icon entry in manifest.json.

- **feat: improve bhajan search matching and upgrade dependencies** (`baa16b1`)
  - Rewrites Search.js's makeSearchable normalization: strips 'h', maps z->r, folds vowels (ee->i, oo/uu->u), collapses doubled consonants, and folds consonant classes ([tdl]->T, [vw]->V, [ie]*y->Y) so differently transliterated spellings match.
  - Upgrades many deps (react 16.6.3, firebase 5.6.0, react-scripts 2.1.1 with browserslist, react-highlight-words 0.14, whatwg-fetch 3, recompose 0.30), renames the package to "bhajans", regenerates index data, and adds create-index/temp.js (merges language ta...
  - Reformats src files from double to single quotes.

## 2018-08-08

- **fix: disable broken linkify and regenerate bhajan index** (`33695ce`)
  - Comments out Search.js's linkify method, which the previous commit left referencing an undefined `result` variable (instead of `results`) with a stray `debugger;` statement in the render path; removes a console.log.
  - On the data side, restricts create-index.py's supplement inputs to 2018Supplement.txt and Vol7.txt, disables its Python-2 tag-merging block, removes four incorrect language tags from tags.txt, and updates the create-index source data — regenerating public/b...

## 2018-08-06

- **feat: replace emoji icons with FontAwesome and fix search crash** (`e2bfb32`)
  - Adds @fortawesome/fontawesome-svg-core, free-solid-svg-icons, and react-fontawesome, registering heart/music/play/stop/compact-disc/cart-arrow-down; swaps the emoji buttons (💖💟💿🎧🎼) for FontAwesome icons in App.js, Search.js, and RenderPage.js, and remo...
  - Fixes Search's wrappedName which returned `{ child }` (an object literal) instead of `child`, crashing rows without a matching location; also sorts fetched bhajans with lodash-es orderBy, adds a mostly-unused ErrorBoundary class, and bumps deps (firebase 5....
  - Regenerates public/bhajan-index2.json (~19.7k lines changed).

- **fix: package.json to reduce vulnerabilities (#6)** (`26c726e`)
  - Automated Snyk PR changing a single line in package.json: bootstrap 4.1.1 -> 4.1.2.
  - Fixes npm:bootstrap:20180529, a cross-site scripting vulnerability in bootstrap's tooltip/collapse components, as linked in the commit body.

## 2018-06-28

- **fix: make favorites load reliably and stop login redirect loops** (`c0b0b7a`)
  - App.js now always fetches /bhajan-index2.json on mount instead of skipping when window.searchableBhajans is already set (the skip left App's bhajans state empty, breaking favorites rendering).
  - Login.js handlers (signedIn/redirectOnLogin) become class methods and authUi.reset() is called before start() to clear stale FirebaseUI state.
  - Auth-gate redirects in Admin.js, Pay.js, and RenderPage.js switch from history.push to history.replace so users cannot navigate back into a redirect loop; the rest is Prettier reformatting.

## 2018-06-27

- **fix: guard Firebase messaging on unsupported browsers** (`04a7373`)
  - Wraps firebase.messaging() in a try/catch in src/firebase.js, defaulting the messaging variable to null, and guards getMessageID(), onTokenRefresh, and onMessage behind an `if (messaging)` check.
  - Also reflows checkRefOnce chaining.
  - Without this, firebase.messaging() throws on browsers where FCM is unsupported.

- **fix: force service worker refresh by renaming worker file** (`35e6f71`)
  - Renames the generated service worker from service-worker.js to service-worker2.js in both sw-precache-config.js (swFilePath) and src/registerServiceWorker.js (registration URL), so browsers register it as a brand-new worker and bypass the previously cached ...
  - Also deletes package-lock.json (~456 lines, repo standardizes on yarn), regenerates yarn.lock, and removes a dead `map` variable and unused import in App.js.

- **perf: speed up initial page load** (`078abd0`)
  - Performance pass: adds a <link rel=preload> for bhajan-index2.json, strips Bugsnag/UserReport/Google Analytics inline scripts from index.html and re-bootstraps them from JS after render, switches firebase to modular imports (app/database/auth/messaging), an...
  - Also a large stack upgrade in the same commit: React 15 -> 16.4.1, bootstrap 3.3.7 -> 4.1.1, plus Login refactored to class properties with authUi.reset(), history.replace for auth redirects, reworked database.rules.json (adds confirmedPayment and beta node...

- **build: raise service worker precache size limit to 4 MB** (`7e637ba`)
  - One-line change to sw-precache-config.js adding maximumFileSizeToCacheInBytes: 4097152 (~4 MB).
  - This raises sw-precache's default per-file precache ceiling so larger build assets are included in the service worker cache.

## 2018-06-26

- **build: update dependencies** (`4de1bb3`)
  - Updates ~20 entries in package.json, the largest being firebase ^4.3.1 -> ^5.1.0 and firebaseui ^2.3.0 -> ^3.1.0; also pins react-router-dom 4.3.1, react-virtualized 9.20.0, reactstrap 6.1.0, react-bootstrap 0.32.1, and react-scripts 1.1.4.
  - Regenerates yarn.lock (~1551 changed lines) and touches public/bhajan-index2.json (1 line, regenerated index).

- **feat: add missing 2018 supplement PDF** (`d9bb885`)
  - Adds the binary file public/pdfs/2018supl.pdf (414,323 bytes) and nothing else.
  - This is the sheet-music PDF that the bhajan index links to for 2018 supplement locations (e.g.
  - "2018supl-N" page refs).

- **feat: add 2018 supplement to bhajan index** (`621fdd5`)
  - Adds create-index/2018Supplement.txt (and a .changed.txt variant) listing 78 new bhajans with language and 2018supl-N page references, registers 2018Supplement.txt first in create-index.py's supplements list, and extends translation.csv with diacritic→ASCII...
  - Regenerates public/bhajan-index2.json (~38k changed lines) from the updated inputs.
  - Also touches create-index/cdbaby/mergelinks.js.

## 2017-09-20

- **chore: add sheetmusic PDF filename list for index** (`fc1465d`)
  - Adds create-index/sheetmusiclist.txt containing 1529 lines of sheet-music PDF filenames (e.g.
  - AbhayamAbhayamAmmaG.pdf, AdiParasaktiBb.pdf) used as source data for the index-generation scripts.
  - Pure data-file addition; no code changes.

## 2017-09-18

- **fix: resolve iPhone issues (polyfills, scrolling, service worker)** (`8a82d27`)
  - Squashed PR (#1) fixing iPhone problems: swaps the local public/shim.min.js for the cdn.polyfill.io/v2/polyfill.min.js script (and deletes the local shim), guards document.scrollingElement with document.body and window.pageYOffset fallbacks in Search.js's s...
  - Also adds package-lock.json (npm alongside yarn) and bumps firebase, react-bootstrap, react-modal, react-virtualized.

- **chore: add satsang rules to Firebase database rules** (`9d3c017`)
  - Adds a satsang/$userId node to database.rules.json allowing a user to read their own flag (auth.uid === $userId) and restricting writes to admins (root admin child === '1').
  - This backs the presenter-view feature from 64d536a, which reads satsang/<uid> after login to set localStorage.presenter.

- **fix: fetch bhajan index from absolute path** (`289daf6`)
  - Changes the bhajan index fetch in src/App.js from './bhajan-index2.json' to '/bhajan-index2.json'.
  - With hash-based routing and the service-worker navigate fallback, the relative URL could resolve against an unexpected base on iOS, leaving the app with no bhajan list; the absolute path always resolves from the origin root.

## 2017-09-09

- **chore: add Apple Pay domain verification file** (`61bc9e5`)
  - Adds the single-file public/.well-known/apple-developer-merchantid-domain-association, Apple's required domain-verification file for enabling Apple Pay on the site (presumably for the Stripe-backed /pay flow).
  - No code changes.

## 2017-09-03

- **feat: add presenter view with satsang role check** (`28e7d17`)
  - On login (whenUser), src/firebase.js reads satsang/<uid> and sets localStorage.presenter = true when the user is flagged.
  - RenderPage then shows the full-width native PDF embed only when localStorage.presenter is set AND the viewport is wider than 1200px, so presenters on large screens get the native viewer while everyone else keeps the canvas renderer.

- **fix: correct inverted presenter condition in PDF viewer** (`1d1f846`)
  - Single-token fix in src/RenderPage.js changing the embed branch condition from !localStorage.presenter to localStorage.presenter.
  - This corrects the inverted logic introduced four minutes earlier in b8bf954, so the native PDF embed now renders for presenters instead of non-presenters.

- **fix: revert react-pdf-js upgrade to v1** (`8574f75`)
  - Pins react-pdf-js back to v1 (^2.0.3 → "1", pdfjs-dist 1.8.557) in package.json/yarn.lock because the v2 upgrade from earlier that evening broke PDF rendering.
  - Also changes the RenderPage embed branch condition from a hardcoded false to !localStorage.presenter (introducing the presenter flag with inverted logic that the next commit corrects) and appends payment/telemetry ideas to the TODO file.

- **feat: update deps, add polyfill shim, FAQ page and PDF hotkeys** (`08d401d`)
  - Large mixed commit: bumps firebase 4.1→4.3, react-pdf-js 1.0→2.0.3, react-router-dom, and adds react-bootstrap, react-hotkeys, react-modal, reactstrap, core-js, whatwg-fetch.
  - Loads public/shim.min.js as a polyfill in index.html.
  - Adds a new FAQ page and /faq route, wraps RenderPage in HotKeys for left/right arrow pagination, tracks initialPage so "previous" stops at the entry page, raises the whenUser login prompt timeout from 3s to 10s, scales sheet music PDFs at 2, and rewrites th...

## 2017-08-22

- **Merge branch 'master' of github.com:hsingh23/bhajans2** (`d69e8fa`)
  - Merge commit joining f4f7468 (email template update on the local line) with b0f343d (Bugsnag addition pulled from github.com:hsingh23/bhajans2).
  - The diffstat versus first parent shows only the bugsnag files coming in; no conflicts since the two commits touched different files.
  - Introduces no new changes itself.

- **fix: reference site URL in beta welcome email template** (`fc89735`)
  - In src/Admin.js the beta-team welcome email body now says "the beta team for https://sing.withamma.com/#/" instead of "this website".
  - The remaining ~34 changed lines are prettier reformatting (single to double quotes across imports, db.ref calls, and Links).
  - No logic changes.

## 2017-08-07

- **chore: add Bugsnag error reporting and pdf files list** (`4473404`)
  - Vendors public/bugsnag-3.min.js and loads it in public/index.html with an inline data-apikey, moving the https-redirect script below the noscript block.
  - Also adds public/pdfs/files.txt, a 1529-line list of bhajan PDF filenames (likely a manifest for syncing/precache planning).
  - The hardcoded Bugsnag API key is committed in the HTML.

## 2017-07-28

- **feat: include tags in searchable bhajan text** (`2549608`)
  - In src/Search.js the precomputed searchable string changes from name + lyrics-joined-by-comma to name + lyrics-joined-without-separator + tags (o.t).
  - This lets queries match bhajan tags and removes commas from the searchable text.
  - One-line change to the search index construction.

## 2017-07-26

- **chore: expose firebase and messaging on window for debugging** (`5ec16cb`)
  - Assigns window.firebase and window.messaging in src/firebase.js so the Firebase app and messaging instances can be inspected from the browser console.
  - Two-line addition with no other changes.

- **fix: disable Firebase goOnline/goOffline switching** (`3c3e25c`)
  - Comments out the db.goOffline() and db.goOnline() calls inside the goOffline/goOnline wrappers in src/firebase.js, keeping the connection permanently online while still logging on/off history events.
  - Also adds an h1 heading ("Create an account or log in.") above the FirebaseUI auth widget on the Login page, plus prettier quote/format churn.

- **style: swap home icon for back icon on bhajan page nav** (`34a5a1b`)
  - Changes the nav link emoji on the bhajan render page from 🏠 (aria-label home) to 🔙 (aria-label back).
  - The link still routes to '/', so this is purely a visual/semantic label tweak.

- **chore: add debug logging around notification permission flow** (`2c84b58`)
  - Adds console.log statements before and after messaging.requestPermission() in src/firebase.js to trace the FCM permission/token flow.
  - The rest of the diff is mechanical prettier reformatting (function() → function ()).
  - Part of a late-night FCM debugging series on the same day.

- **fix: rename FCM service worker back to firebase-messaging-sw.js** (`33f9d94`)
  - Renames public/firebase-messaging-service-worker.js back to public/firebase-messaging-sw.js and updates sw-precache-config.js importScripts to reference the restored filename.
  - The interior console.log tag was also (accidentally) left saying firebase-messaging-service-worker.js.
  - Firebase Messaging requires the service worker to live at /firebase-messaging-sw.js, so the earlier rename had broken background-message registration.

- **fix: reset page to 1 when viewing sheet music PDFs** (`5a812a5`)
  - Small RenderPage cleanup: removes a redundant var in the constructor and, importantly, sets page = 1 in the .pdf (sheet music) branch of render — previously the stale location-derived page number was used, which could start a single-page sheet PDF on the wr...
  - Also uses destructuring assignment for [book, page].

- **style: narrow PDF viewer width and right-align RenderPage nav** (`e93861b`)
  - Removes the empty .capitalize rule from App.css, makes the RenderPage header nav a right-justified flex row, narrows the PDF max width from 1220px to 920px, and drops unused book/url vars in the constructor (keeping only page).

- **feat: add sheet music links and S3-hosted sheet PDF viewer** (`ab0313e`)
  - Adds a readSheetMusic() pass to mergelinks.js that matches sheetmusic PDF filenames to bhajans and records them in a new sm field, growing public/bhajan-index2.json by ~19k lines.
  - RenderPage now detects .pdf locations and loads the sheet from the amma-bhajans-sheetmusic S3 bucket at scale 1 instead of a book page, and Search rows gain a 🎼 sheet-music link; emoji buttons get accessible aria-label spans.
  - The sheetmusic source directory is gitignored.

- **fix: restore location/id argument order in search row links** (`d402222`)
  - Corrects the wrappedName call in Search.js rowRenderer — the previous commit swapped the arguments, producing /pdf/<id>/<name> style paths; this restores location as the path segment and passes <id>/<name> as the route name so links match /pdf/:location/:id...
  - Remaining hunks are prettier reformatting (indentation only).

## 2017-07-25

- **fix: normalize version suffixes and dedupe tags in bhajan index build** (`9ca5736`)
  - Rewrites "(Tamil version)"-style suffixes in 2017Supplement.txt and Vol7.txt (and .changed.txt outputs) to "- Tamil version" so the tag regex in create-index.py captures them, then regenerates bhajan-index.json/bhajan-index2.json (public and create-index co...

- **fix: parse supplement tags correctly and route bhajans by index id** (`d897d02`)
  - Fixes a crash/bug in create-index.py's supplement tag parsing — the old code split on `a` instead of the `tag` variable and truncated at the first bracket — now it captures the whole parenthesized suffix as tags and merges them into bhajans2.
  - Regenerates public/bhajan-index2.json with the tags, saves cdbaby match reports (manyMatches.json, noMatch.json), replaces the 1900-line CRA boilerplate README with a short project one, ignores emails.txt, and changes the bhajan route from /pdf/:location/:n...

- **fix: rename firebase messaging SW to avoid precache caching** (`434a3ee`)
  - Renames public/firebase-messaging-sw.js to public/firebase-messaging-service-worker.js and updates sw-precache-config.js importScripts to match (also dropping trailing commas).
  - The new name keeps the messaging worker from being swept up/confused with the precache service worker's own file handling.

- **fix: wait 8s before auto-reloading on new service worker content** (`ea1771d`)
  - In registerServiceWorker.js, changes the setTimeout for window.location.reload after the "New content is available; please refresh." alert from 3000ms to 8000ms, giving users time to read the toast before the page reloads.

- **fix: use Gmail compose link only on desktop-width screens** (`defebe7`)
  - Adds a document.documentElement.clientWidth > 1024 condition to the Gmail-vs-mailto branch of createEmailTemplate in Admin.js, so narrow/mobile viewports get the plain mailto: link instead of the Gmail web compose URL.

- **fix: keep Firebase online for admins, export goOnline/goOffline** (`d5bfcbe`)
  - Guards the 15-second auto-offline timer (and the goOffline inside it) so it does not fire when localStorage.admin is set, and adds goOnline/goOffline to the firebase.js IIFE return/export list so other modules can use them.

- **feat: add cdbaby audio samples and buy links to bhajan pages** (`dc245d9`)
  - RenderPage now reads the bhajan entry (name, cdbaby buy/sample URLs) from the index and shows buy (💿) and play (🎧) buttons plus the favorite toggle; audio plays through a shared #audio tag, and the PDF component is memoized with recompose's onlyUpdateForK...
  - Search rows get the same buy/sample buttons. src/firebase.js is rewritten into an IIFE that tracks online/offline transitions with a history log, no-ops them during a 15-second initial wait, and exports goOnline/goOffline.
  - The rest of the diff is prettier reformatting across Admin/App/Beta/Logout/Pay.

- **fix: call goOnline before each messaging read/write** (`bd34391`)
  - Adds db.goOnline() immediately before each of the three messaging operations in getMessageID (the once read, the metadata set, and the token set) in src/firebase.js.
  - This belt-and-braces approach retries the previously failing token registration.

- **fix: only write messaging token when changed; rename key to currentToken** (`a45129a`)
  - In getMessageID, only writes the token to messages/<uid>/tokens when it is not already present (previously it always wrote) and only sets metadata when missing, plus renames the localStorage key from newGcmToken to currentToken (also in onTokenRefresh).
  - Adds extensive console.log tracing around each step of the flow.

- **fix: go online before reading messaging token ref** (`508a0d3`)
  - Adds a db.goOnline() call before the once('value') read of messages/<uid> in getMessageID in src/firebase.js.
  - Because other code paths take the database offline, the token-registration read (and subsequent writes) were silently failing.

- **fix(firebase): guard FCM token registration with try/catch and logs** (`f1d8c1c`)
  - Reworks getMessageID() in src/firebase.js: the requestPermission/getToken sequence and subsequent DB writes are wrapped in try/catch so failures log instead of throwing unhandled, and console.log calls trace the returned token and onTokenRefresh events.
  - Removes a goOnline/goOffline pair around the token save that later commits re-add.
  - Also removes a trailing comma in the config and reformats function parens (prettier churn).

- **fix(render): use Component instead of PureComponent** (`24dc1e2`)
  - One-line change in src/RenderPage.js: the class now extends Component instead of PureComponent.
  - The rest of the commit is yarn.lock churn (~820 lines) from dependency refresh.
  - Committed with a `!fixup` marker, i.e. intended to be squashed into a prior commit.

- **fix(render): render pagination arrows before click zones** (`8b2e7b9`)
  - In src/RenderPage.js, reorders the pagination spans so the pdf-prev-arrow/pdf-next-arrow visuals come before the invisible pdf-previous/pdf-next click zones, fixing arrow placement/hit-area overlap; the rest of the file is a prettier reformat (single quotes...
  - Also enables prettier.singleQuote in .vscode/settings.json, with corresponding yarn.lock churn from tooling installs.

## 2017-07-24

- **feat(admin): add Facebook page link to beta welcome email** (`b7660ff`)
  - Two-line addition to the email template body in src/Admin.js createEmailTemplate(): inserts a "Please like our Facebook page" line with the sing.withamma Facebook URL between the welcome text and the feedback link.

- **feat: improve cdbaby matching, add beta-push cloud function, CSS polish** (`6893b7a`)
  - Grab-bag commit.
  - Broadens the transliteration folding in makeSearchable (shared by create-index/cdbaby/mergelinks.js and src/Search.js) and tightens matching to startsWith, then regenerates the bhajan/cdbaby index data. create-index.py now extracts language tags from supple...
  - Adds a functions/ Firebase Cloud Functions package with a confirmBeta trigger that pushes an FCM notification to all admins.

## 2017-07-18

- **feat(admin): open thank-you email when approving beta user** (`80789d2`)
  - Adds createEmailTemplate() to src/Admin.js that builds a Gmail compose URL (when the admin's stored email is gmail) or a mailto: link containing a pre-written welcome message with feedback and Facebook links. setBeta() now calls window.open() with that URL ...

## 2017-07-17

- **fix(render): always use react-pdf-js so PDFs can't be downloaded** (`fbde754`)
  - Hardcodes the render branch in src/RenderPage.js to `false`, disabling the native `<embed>` PDF path in favor of the react-pdf-js canvas renderer, and comments out the now-unused canRenderPdfNatively helper.
  - Also makes registerServiceWorker.js auto-reload the page 3 seconds after a "new content available" update alert.
  - Remaining changes are JSX re-indentation.

## 2017-07-16

- **feat: make bhajan tags searchable and visible in results** (`91d2de4`)
  - Search.js rowRenderer now destructures the 't' (tags) field from the index entry and appends it to the bhajan name for both the search text and the Highlighter component, so users can find bhajans by tag (e.g. deity names).
  - Also adds user.json to .gitignore.

- **feat: add CD Baby song previews and buy links; restructure app routing** (`5f2d754`)
  - Large commit (119 files).
  - Adds a create-index/cdbaby pipeline (per-CD JSON scraped from CD Baby, mergelinks.js, sample mp3 URL lists, cookies) that merges sample ('cs') and buy ('cu') URLs into bhajan-index2.json, plus a tags.txt feed.
  - Search rows gain a ▶ play button (via a new <audio> element in index.html) and a $ buy link, and the transliteration-normalizing makeSearchable regexes are broadened.

## 2017-07-12

- **updates firebase worker** (`09925e4`)
  - Adds messaging.setBackgroundMessageHandler to public/firebase-messaging-sw.js, which reads the payload's notification title/body/icon (with fallback defaults) and calls self.registration.showNotification so push messages received while the page is closed di...

## 2017-07-11

- **update search to adapt new render view** (`e970cf1`)
  - Search.js now fetches bhajan-index2.json, builds searchable text from o.n + o.l.join(','), reads name/location via destructured fields instead of splitting "##" strings, and uses location[0] for the pdf link.
  - The client-side linkify for multiple locations is removed.
  - On the generator side, moves tags like [ganesha] from the location column into the bhajan-name column of 2011Supplement files, reorders supplement merging so bhajanmritam entries win, and sw-precache precaches bhajan-index2.json instead of the flat index.

- **fix: emit sorted array of {n, l} objects in bhajan-index2.json** (`0cf902d`)
  - Fixes the index2 generator so each entry carries 'n': bhajan alongside its location list, and changes the output from a JSON object to a sorted array of those objects (matching client expectations).
  - Regenerates public/bhajan-index2.json accordingly and jots TODO notes about precomputing searchable text and the back button.

- **feat: generate structured bhajan-index2.json with per-bhajan objects** (`4d23de0`)
  - Extends create-index.py to parse location lists into arrays and build a new bhajans2 dict mapping each bhajan to {"l": [locations]}, merging optional music.txt, video.txt, and sheetmusic.txt sidecar files.
  - Emits the new public/bhajan-index2.json alongside the legacy flat string index, and regenerates bhajan-index.txt/json with comma-separated locations (full 1652-line rewrite of the index).

- **fixes firebase notification issue** (`21be16c`)
  - One-line null guard in getMessageID: changes `if (!snap.val().tokens)` to `if (!snap.val() || !snap.val().tokens)` so users with no existing messages/<uid> node are initialized instead of throwing on null.

## 2017-07-09

- **style: ellipsize long bhajan titles and fix header nav width** (`ab48d92`)
  - On RenderPage, adds textOverflow: 'ellipsis' to the bhajan name container and replaces the floated nav style with flex: '0 0 80px' so long names shrink with ellipsis and the back/favorite buttons occupy a fixed 80px column.

- **updates google analytics** (`5826b77`)
  - Drops the react-ga dependency usage in favor of the standard Google analytics.js snippet inlined in public/index.html (create UA-101960783-1, send pageview).
  - Search.js and index.js switch to the global window.ga API for setting userId and sending pageviews on route change.

## 2017-07-08

- **fix: harden FCM token registration and beta redirect** (`df47097`)
  - Rewrites getMessageID to read the existing messages/<uid> snapshot, initialize displayName/email/tokens if absent, and set the new token as tokens/<token>='1' instead of an update() call that could clobber data.
  - Fixes a doubled closing brace in the /beta redirect URLs in Login.js and uncomments credentialHelper: NONE in the firebaseui config.

- **fix: convert getMessageID IIFE to a named function** (`e5e80f4`)
  - Converts the immediately-invoked (async function getMessageID(){...})() expression into a declared async function followed by an explicit getMessageID() call.
  - This keeps initial registration behavior while allowing messaging.onTokenRefresh to invoke it again after a token rotation.

- **style: replace Back link with compact circle button** (`e7e42a3`)
  - On the bhajan render page, changes the "Back" text link to a ◀ circle button (button-circle) so the header nav takes less horizontal space.

- **fix: handle FCM token refresh and add gcm_sender_id to manifest** (`0aa51f2`)
  - Adds a messaging.onTokenRefresh handler that removes the stale token from Firebase, clears localStorage.newGcmToken, and re-runs registration; toggles db offline/online before writing to force a reconnect.
  - Also adds gcm_sender_id (103953800507) to manifest.json and reformats it.

- **fix: store FCM tokens in a map with user info; fix beta copy** (`faef910`)
  - Changes the Firebase push registration to key the GCM token under localStorage.newGcmToken and to write a tokens map plus displayName/email via update() instead of overwriting with a single token.
  - On the Beta page, replaces the placeholder facebook link with the real page URL and tightens the copy.

- **style: make "Only My Favorites" button green** (`11c8c98`)
  - One-line class change swapping button-primary for button-action on the "Only My Favorites" link so the favorites toggle renders green, matching the heart accent.

- **fix: use router location.pathname to detect favorites view** (`2d46ec2`)
  - Changes filterBhajans to derive the favorites-only mode from this.props.location.pathname rather than window.location.hash, matching the previous commit's move toward react-router props.

- **update reactga** (`29377cf`)
  - Converts react-ga from a require to a proper ES import, hopts CSS imports to the top of index.js, and initializes ReactGA with { debug: 1 } to log analytics traffic during development.

- **fix: show active favorite heart in red (button-caution)** (`15ab115`)
  - Changes the active favorite button classes from button-action to button-caution so the ♥ appears red on both the bhajan page and list rows.
  - Also removes the pointless this.filterBhajans() expression inside removeFavorite's setState callback that was evaluated as a statement with no effect.

- **fix: register service worker only in production and style nav links** (`0216721`)
  - Restyles the header title as a real link and turns the "Only My Favorites"/"Home" nav links into styled buttons (button-glow/rounded/raised).
  - Removes text-decoration on header links.
  - Most importantly, changes registerServiceWorker.js to only register the service worker when NODE_ENV is production instead of unconditionally.

- **refactor: extract favorites into withFavorites HOC, tune service worker** (`7fecc67`)
  - Moves all favorite load/add/remove/render logic out of Search.js into a new withFavorites.js higher-order component that wraps Search and RenderPage via routes in index.js, sharing one favorites instance across views.
  - Simplifies service worker registration to a single SW (temporarily force-enabled outside production), adds a standalone sw-precache npm script, and configures sw-precache with navigateFallback plus importScripts of firebase-messaging-sw.js.
  - RenderPage gains a favorite button, a styled Back button, and flips to native PDF embed.

## 2017-07-07

- **fix: drop native window.alert for service worker update messages** (`4650231`)
  - Removes the duplicate window.alert calls for "New content is available" and "Content is cached for offline use" in registerServiceWorker.js, keeping only the styled notie alert({ text }) notifications.

- **fix: restore scroll position when returning to the search list** (`85f3c96`)
  - Captures document.scrollingElement.scrollTop into window.scrollTop on every WindowScroller render and restores it via a setTimeout in componentWillMount so navigating back from a bhajan page returns to the previous list position.
  - The bulk of the diff is prettier-style JSX reformatting of the same components.

## 2017-07-06

- **fix: pass options to notie alert and add hosting rewrites** (`dc81f9c`)
  - Corrects the notie alert invocations to take an options object ({ text }) instead of a bare string, and imports alert from notie in registerServiceWorker.js (falling back to window.alert alongside it).
  - Adds a hosting section to firebase.json that serves the build directory and rewrites all routes to /index.html for SPA routing.

- **feat: add Firebase Cloud Messaging (GCM) push notification support** (`c2e8b0c`)
  - Adds a firebase-messaging-sw.js background service worker, requests notification permission, registers the device token under messages/<uid> in the Firebase DB, and shows incoming messages via the newly added notie alert library (package.json, yarn.lock, no...
  - Adds database.rules.json rules for the messages node allowing admin reads and owner writes.
  - Also registers both service workers, adds a Netlify-style _redirects SPA fallback, enables native PDF embed in RenderPage, and makes setRefOnce/removeRefOnce resolve properly.

## 2017-07-05

- **build: precache top-level minified CSS in the service worker** (`695ecd7`)
  - Adds 'build/*.min.css' to staticFileGlobs in sw-precache-config.js and reformats the array to one glob per line, so files like the recently added buttons.min.css are available offline.

- **build: reorder sw-precache globs to test PDF precache behavior** (`3e5cfa7`)
  - Moves 'build/pdfs/*.pdf' from first to last in the sw-precache-config.js staticFileGlobs array; no other changes.

- **feat: alert users when service worker caches or updates content** (`fbca415`)
  - Adds `alert()` calls alongside the existing console.log statements in src/registerServiceWorker.js for the two sw-precache lifecycle events: "New content is available; please refresh." on update and "Content is cached for offline use." after initial precach...

- **style: clarify beta page copy and waiting-for-approval message** (`6b770bd`)
  - Rewrites the Beta page text in src/Beta.js: friendlier welcome emphasizing free access until September 1st 2017, a separate paragraph about email/push surveys, and a richer "awaiting approval" state that explains the site auto-redirects on approval and asks...
  - Trims related TODO items; no logic changes.

## 2017-07-04

- **feat: archive user record when admin approves beta access** (`ddbb3b9`)
  - Adds a `confirmedBeta` database node: Admin.setBeta now snapshots the pending user record into confirmedBeta/<uid> before removing the confirmBeta entry and granting beta.
  - Adds matching database rules restricting confirmedBeta reads/writes to admins, and fixes the invalid trailing commas that made database.rules.json malformed JSON.

- **adds firebase to project mix** (`804c320`)
  - Adds .firebaserc (project bhajans-588f5), firebase.json pointing at database.rules.json, and an initial database.rules.json defining per-node security: paid/beta/admin writable only by admins, confirmPayment/confirmBeta readable/writable by any authenticate...
  - Ignores the /functions directory.

- **feat: add my-favorites route and fix next-redirect handling** (`b6296c2`)
  - Adds a `/my-favorites` route rendering the (renamed App→Search) component filtered to favorites, with a Home/Only-My-Favorites nav toggle and refiltering on favorite removal; adds a catch-all `<Redirect>` to `/`.
  - Fixes redirect bugs by making `getNext()` read the `next` param from the hash (not the query string) and default to `/`, dropping the broken `'/' + getNext()` concatenation in Beta/Login/Logout/Pay.
  - Guards favorite writes with `get(auth, 'currentUser.uid')` and further compresses 2011supl.pdf.

- **reduce render quality for faster renders** (`395ba84`)
  - Changes the pdf.js `scale` prop in src/RenderPage.js from 4 to 3, reducing canvas resolution of rendered PDF pages in exchange for faster renders.

- **feat: add bhajan favorites with Firebase sync and local cache** (`1ff66d8`)
  - Adds heart toggle buttons on each search row that add/remove a bhajan to favorites, persisted via new getJson/setJson localStorage helpers and synced to `favorites/<uid>` in Firebase through new `whenUser` (auth with timeout) and `removeRefOnce` helpers; ad...
  - Also refactors Beta.js to poll `/beta/<uid>` every 2s for approval, store photoURL on login, and expose window.firebase on localhost for debugging.

## 2017-07-03

- **fix space related search bug and improve index** (`671536a`)
  - Changes the space-stripping step in src/Search.js makeSearchable from `.replace(' ', '')` (first occurrence only) to `.replace(/ /g, '')` so every space in a query is removed before matching.
  - Also regenerates the create-index and public bhajan-index artifacts plus bhajanmritam.txt.

- **fix: normalize accented characters in 2017 supplement index** (`307b38c`)
  - Fixes the mojibake introduced with the 2017 supplement by expanding create-index/translation.csv with additional mappings (à→a, è→e, ì→i, ñ→n, ê→n, ç→s, ä→r, etc. and their uppercase forms), regenerating 2017Supplement.txt.changed.txt and the bhajan-index f...
  - Removes the "fix 2017 supl" TODO item.

- **fix: deduplicate remaining diacritic 2017supl index entries** (`f944261`)
  - Second pass over the 2017 supplement cleanup: merges more diacritic variant entries into their ASCII counterparts (e.g.
  - "amma devi (tulu version)" gains the 2017supl-6 reference), normalizes partially-diacritic spellings such as "antardaréanattinuîîa" to "antardaréanattinulla", and regenerates bhajan-index.txt/json plus public/bhajan-index.json with four new translation.csv ...

- **fix: merge diacritic 2017supl entries into canonical index rows** (`6ba4ac9`)
  - Merges duplicate bhajan-index entries where the 2017Supplement had added diacritic-marked variants (e.g.
  - "ammà ammà enum") alongside existing ASCII entries (e.g.
  - "amma amma enum").

- **fix: improve search transliteration and credential helper** (`f18a785`)
  - Adds an 'hr' -> 'hri' replacement to the makeSearchable pipeline in src/Search.js so transliterated names like "hari"/"hri" match.
  - In src/Beta.js, replaces a broken this.setState call inside a plain async function (which had no correct this binding) with a `var worked` flag.
  - In src/Login.js, comments out the credentialHelper: NONE option so FirebaseUI uses its default account-chooser credential helper.

## 2017-07-02

- **feat: add logout route and client-side GA page tracking** (`aefa771`)
  - Adds a Logout component/route that signs out from Firebase, clears localStorage, and returns to the next URL.
  - Login re-enables the beta redirect and sets firebaseui credentialHelper to NONE.
  - Analytics moves from the inline GA snippet in index.html (removed) to react-ga: initialized in index.js with a logPageView router hook, and Search sets the GA userId from localStorage.uid.

- **feat: restrict sign-in to email and keep login reachable** (`2b17b96`)
  - Login's firebaseui config drops Google and Facebook, leaving only firebase.auth.EmailAuthProvider.
  - Also comments out the componentDidMount redirect that bounced already-beta users away from /login, so they can still reach the sign-in screen.

- **feat: force https in production and add admin navigation** (`caa1433`)
  - index.html gains an inline script that upgrades http: to https: outside localhost.
  - Login additionally checks the admin ref and sets localStorage.admin; the Search header title then links admins to /admin.
  - Beta gets an optedIn "Awaiting approval" state, redirects already-beta users on mount, and stops force-navigating after opt-in. getNext() is fixed to return '' default with callers prefixing '/', and create-index/2017Supplement.txt is re-indented.

- **feat: switch access model from paid to beta opt-in** (`57708a3`)
  - Adds a Beta component and /beta route: users see a consent page (free until Sept 1, 2017) and opting in writes to confirmBeta; Login now checks the beta ref and caches localStorage.beta instead of paid, and RenderPage gates on the beta flag.
  - Admin is reworked to manage confirmBeta/beta refs with a "beta" approval button.
  - Also adds Google Analytics (react-ga dep plus GA and UserReport snippets in index.html), a favicon img in page headers, and route reordering.

## 2017-07-01

- **docs: reorganize TODO into prioritized sections** (`139ffa3`)
  - TODO-only change: replaces the flat checklist with prioritized sections — soon (amma icon, analytics, facebook page, redirection fixes, payment auto-refresh), complex (a /beta/uid invite model, heart songs favorites), and meh (font sizing, https redirect) —...

- **style: fix header overflow, pin base font size, update favicons** (`d7a8930`)
  - CSS fixes: .App-header width changes from 100vw to 100% with box-sizing: border-box so padding no longer causes horizontal overflow, and body gets an explicit 16px font-size.
  - Removes the Bootstrap CSS import from index.js, replaces both favicon files (jpg grows to ~104KB, png shrinks to ~3.5KB), and appends a batch of new TODO items (font size, https redirect, vol2 checks, etc.).

- **fix: align bhajan index locations with renamed volume files** (`338d3de`)
  - Rewrites location keys across the index data sources — create-index/bhajan-index.txt, create-index/bhajanmritam.txt, and the generated bhajan-index.json files (create-index and public) — renaming prefixes like vol1-165/indianvol1or2-1 to voli1-165/voli0-1 (...
  - The change aligns index entries with the renamed PDF volume files so search-result links resolve.

## 2017-06-30

- **refactor: remove swipe handling that broke pinch zoom** (`133254c`)
  - Reverts the react-swipe-events integration added in 93c2bfd: removes the ReactSwipeEvents wrapper and import from RenderPage and drops the react-swipe-events dependency from package.json, leaving the scale-4 pdf.js rendering intact.

- **style: render PDF pages at full natural height** (`bcf5746`)
  - Drops the maxHeight calc from the PDF component's inline style in RenderPage so the scale-4 page renders at its full natural height instead of being constrained to the viewport minus the header.

- **fix: rework Pay flow and fix post-login redirects** (`c9709d6`)
  - Adds src/util.js with a getNext() helper that parses the ?next= query param, and uses it across Login, Pay, and RenderPage instead of broken match.params reads.
  - Pay now checks the paid ref before writing a confirmPayment record (including a date), short-circuits already-paid users to localStorage.paid=1, and Login/Pay pass search strings through.
  - Also removes stray swipe handlers from pagination spans, stops awaiting goOnline/goOffline in firebase.js, renames window.bhajans to window.searchableBhajans, and adds keys to generated links.

- **style: bump PDF render scale from 3 to 4** (`bd19961`)
  - One-line change raising the react-pdf-js scale prop from 3 to 4 in RenderPage, increasing the resolution at which bhajan pages are rasterized.

- **fix: improve search location links and highlight styling** (`7ce5937`)
  - Search's location parser now strips commas and slashes before splitting, so malformed location strings still produce clean Links, and the link span gains the rightAligned class.
  - Fixes the search input's class attribute to className, guards value with `filter || ''`, removes mark padding, and raises the virtualized row height from 80 to 100 to fit wrapped content.

- **style: space out bhajan row content with space-between** (`3a0fd83`)
  - Changes .bhajanRow justify-content from center to space-between so the bhajan title and its volume/page links sit at opposite edges of each row; also re-expands the body font-family declaration onto multiple lines.

- **feat: add swipe navigation and higher PDF render scale** (`5af65ac`)
  - Wraps the PDF viewer in react-swipe-events with swipe-left/right page navigation and injects react-tap-event-plugin.
  - Permanently switches rendering to react-pdf-js at scale 3 by short-circuiting the native embed branch with `false &&`, removes the unused react-pdf and react-pdf-component deps, and drops stale TODO items about the 2017 supplement and vol7 optimization.

- **fix: force pdf.js renderer on iOS to honor page links** (`5d24235`)
  - Removes the isIos() clause from canRenderPdfNatively(), so iOS is no longer treated as a native-PDF-capable platform and falls through to the react-pdf-js renderer like other unsupported browsers.

## 2017-06-29

- **fix: correct inverted admin-check condition** (`4bbec62`)
  - Flips the admin snapshot condition from !== null back to === null so users missing an admin record (non-admins) are redirected to login instead of admins being redirected.
  - Reformats the admin table cells to show name and email with the uid as small text, and rewrites Pay page copy to describe paying at the cash register on tour in addition to the PayPal flow.

- **fix: fall back to cached uid in admin auth check** (`50d3083`)
  - Admin's awaitCurrentUser now falls back to localStorage.uid when auth.currentUser is not yet populated, and adds console.log debugging for both the missing-uid case and the admin snapshot value.
  - Also changes the admin-snapshot redirect condition from === '1' to !== null (an inversion that the following !fixup commit corrects to === null).

- **fix: wait for auth state before admin check; fix table markup** (`6e9a227`)
  - Reworks Admin.componentWillMount to wait 500ms for auth.currentUser before checking the admin ref and subscribing to confirmPayment, instead of calling the async checkRefOnce without awaiting it.
  - Wraps the user table rows in a tbody and adds key/uid props to fix React list rendering.
  - Login now calls signedIn unconditionally and retries after 500ms when only a cached localStorage.uid exists, and firebase.js exports the initialized firebaseApp for db access.

- **feat: add Firebase auth with login, pay, and admin gating** (`0f688eb`)
  - Introduces Firebase (firebase, firebaseui, reactfire, bootstrap deps) and wires it through a new src/firebase.js module that manages the realtime DB connection and one-shot ref helpers.
  - Adds Login (firebaseui with Google/Email/Facebook providers), Pay (records users awaiting payment confirmation), and Admin (lists pending users and lets an admin mark them paid) components with corresponding routes in index.js.
  - RenderPage now redirects unpaid/unauthenticated users to /pay and /login, and App.css gains a .restPage layout block.

## 2017-06-28

- **fix: start stripping spaces from search queries** (`349ada3`)
  - Adds `.replace(' ', '')` to the makeSearchable chain in src/Search.js, intending to make queries with spaces match the spaceless searchable lines.
  - Because String.replace with a string argument only replaces the first occurrence, multi-word queries with more than one space still fail; the follow-up commit 091bd3b corrects it to a global regex.

- **adds 2017 suplement** (`a69bcba`)
  - Adds create-index/2017Supplement.txt plus its .changed.txt variant, registers it first in the supplements list of create-index.py, and regenerates bhajan-index.txt/json with ~55 new 2017supl entries (some merged into existing names such as anudinamum).
  - The new entries contain accented/mojibake characters (e.g.
  - "ammà", "amätalayam") that a later commit normalizes.

- **fixes page number off by 2/3 issue** (`b65df06`)
  - Swaps in corrected binaries for six PDFs (2012supl, 2013supl, 2014supl, 2015supl, 2017supl, vol7) with sizes roughly halved.
  - No source code changes; the replacement PDFs fix an off-by-2/3 page offset so index locations land on the right pages.

- **adds Vol7** (`82b8335`)
  - Adds create-index/Vol7.txt and its .changed.txt variant, registers "Vol7.txt" in the supplements list of create-index/create-index.py, and guards the line parser to skip empty lines (previously a blank line would throw into the exception handler).
  - Regenerates bhajan-index.txt/json accordingly.

- **feat: add Vol 7 and 2017 supplement PDFs and rebuild index** (`8d29001`)
  - Adds public/pdfs/2017supl.pdf (stored as a text-diffable PDF, ~2476 lines) and public/pdfs/vol7.pdf (1.05MB binary), and regenerates create-index artifacts (bhajan-index.txt/json, bhajanmritam.txt) from the updated sources.
  - TODO is updated to track adding vol7/2017supl to the index and optimizing vol7.

## 2017-06-25

- **feat: add page-nav arrows and enable native PDF rendering** (`9f84813`)
  - Adds CSS-only animated prev/next chevron arrows overlaid on the PDF viewer (RenderPage.js plus new .arrow/.pdf-next-arrow/.pdf-prev-arrow styles and grow keyframes), hinting that tapping the screen sides navigates pages.
  - Flips `false && canRenderPdfNatively()` to enabled, so browsers with native PDF support use an `<embed>` instead of pdf.js.
  - Also adds a `spaced` class to the search Highlighter and prunes TODO items.

- **minify pdfs and update service worker** (`d18020a`)
  - Re-compresses four supplement PDFs (e.g.
  - 2011supl.pdf 3.78MB→598KB, 2015supl.pdf 3.43MB→691KB) so they fit under sw-precache's 2.1MB per-file limit noted in TODO.
  - Also fixes the staticFileGlobs entry from 'bhajan-index.json' to 'build/bhajan-index.json' so the index is actually found and precached for offline use.

## 2017-06-24

- **fix mobile search - casing** (`e0b0305`)
  - Adds `.toLowerCase()` as the first step of the `makeSearchable` normalization chain in src/Search.js so typed queries match the lowercased bhajan index lines.
  - Also updates TODO, removing "investigate broken mobile search" and noting a page-tap hint idea.
  - One-line functional change.

- **fix: allow clearing search input to empty filter** (`924c9ef`)
  - Remove the truthiness check on e.target.value in the search input's onChange so an empty string is passed to filterBhajans, letting users clear the search and see the full bhajan list again.

- **refactor: store bhajan cache and filter on window only** (`4fce6a3`)
  - Restructure Search to keep fetchedBhajans, searchableBhajans, and searchFilter exclusively on window, computing searchable forms once after fetch and reducing component state to just filteredBhajans.
  - Fix onDocumentComplete signature (total pages only), permanently disable the native <embed> path (`false &&`), remove the red debug background from the pagination zone, and collapse CSS formatting.

- **fix: set total page count so PDF pagination works** (`30b0966`)
  - Add an onDocumentComplete handler in RenderPage that stores the document's total page count and current page in state, which the previous commit referenced but never defined; this makes the prev/next pagination bounds and tap zones actually appear.

- **fix: make search input controlled by state, not window global** (`952ad19`)
  - Fix the mobile search input by making it a controlled input reading this.state.filter rather than the window.searchFilter global directly, and initialize state after ensuring the global exists.
  - Also make the next-page tap zone visible with a red background (debugging aid) and minor CSS whitespace cleanup.

- **feat: paginate pdf.js viewer and brand the PWA manifest** (`0eb718d`)
  - Convert RenderPage to a stateful PureComponent that tracks the current page and total pages via react-pdf-js callbacks, with invisible left/right half-screen click zones for previous/next page.
  - Fix a search input bug that prevented clearing the filter (onChange now always calls filterBhajans), brand the manifest as "Amma bhajan searcher" with proper icons and orange theme color, and adjust sw-precache globs.

- **feat: render all PDFs via react-pdf-js** (`5611d77`)
  - Third experiment in the PDF-rendering series: add react-pdf-js, react-pdf-component, and recompose, and switch RenderPage to render PDFs with react-pdf-js unconditionally (the native-embed branch is short-circuited with `false ?`).
  - Regenerated .vscode/tags and substantial yarn.lock additions.

## 2017-06-23

- **feat: use react-pdf as fallback renderer instead of Google viewer** (`7930862`)
  - Add react-pdf (with pdfjs-dist) and use it in RenderPage to replace the Google Docs gview iframe fallback for browsers without native PDF support, passing the PDF path and pageIndex. yarn.lock churn includes removal of entries orphaned by earlier dependency...

- **feat: fall back to Google Docs viewer when native PDF is unsupported** (`beb8847`)
  - Add a canRenderPdfNatively() check (mimeTypes lookup, legacy ActiveX Acrobat detection, iOS UA test) to RenderPage; when native PDF embedding is unavailable, render the PDF inside an iframe pointing at Google Docs gview instead of an <embed>.

- **feat: use HashRouter, window-cached search state, and larger input** (`dd16e90`)
  - Replace BrowserRouter with HashRouter (needed for static hosting), move the bhajan list and current filter onto window so search state survives route changes, and restyle the search input (larger font, padding, border) replacing bootstrap-ish markup.
  - Prune unused dependencies (redux, react-redux, lodash, moment, react-toolbox, etc.) and bump React to 15.6.1; update TODO with sw-precache PDF size warnings.

## 2017-06-20

- **feat: add sw-precache offline caching and halfway-sort vol3 index** (`3a85db6`)
  - Wire sw-precache into the build script with a config that precaches static assets, PDFs, and the bhajan index for offline use.
  - Regenerate bhajan-index (txt/json) with roughly half of vol3 re-sorted, make create-index.py write the JSON directly into public/, and add a TODO file capturing hosting/auth/backlog notes.

## 2017-06-19

- **feat: add initial bhajan search app with PDF viewer and index generator** (`f628d6d`)
  - Bootstrap a create-react-app project ("Amma's Bhajans") with a fuzzy-transliteration search page over a bhajan index (react-virtualized list with highlighting), a PDF viewer route that embeds volume/supplement PDFs at a given page, and a Python script plus ...
  - Ships 26000+ lines including bootstrap.css, volume PDFs, favicons, manifest, and a large yarn.lock.
