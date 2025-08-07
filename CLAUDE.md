# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Sing With Amma (https://sing.withamma.com/) is a React-based bhajan search engine with Firebase backend. The app allows users to search, favorite, and listen to bhajans (devotional songs) with PDF sheet music support.

## Development Commands

### Main Application
```bash
# Install dependencies (uses pnpm)
pnpm install

# Start development server (requires --openssl-legacy-provider for Node 16+)
pnpm start

# Build production bundle
pnpm build

# Run tests
pnpm test

# Run Cypress E2E tests
npx cypress open
```

### Firebase Functions
```bash
# Navigate to functions directory
cd functions

# Install dependencies
yarn install

# Build functions
yarn build

# Serve locally
yarn serve

# Deploy to Firebase
yarn deploy
# or from root: firebase deploy --only functions
```

### Deployment
```bash
# Deploy entire app (hosting + functions + database rules)
firebase deploy

# Deploy specific services
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only database
```

## Architecture

### Frontend Structure
- **src/App.js**: Main app component handling routing and favorites management
- **src/Search.js**: Core search functionality with virtualized list rendering
- **src/firebase.js**: Firebase configuration and authentication utilities
- **src/Profile.js**: User profile management
- **src/RenderPage.js**: PDF rendering for sheet music
- **src/Pay.js**: Payment integration via PayPal

### Data Flow
1. Bhajan index loaded from `/bhajan-index2.json` (static JSON)
2. User favorites synced with Firebase Realtime Database when authenticated
3. Local storage fallback for non-authenticated users
4. Audio samples and PDFs served from public directory

### Firebase Services
- **Authentication**: Email/password and social providers
- **Realtime Database**: User favorites and metadata
- **Functions**: Backend services in `functions/src/`
- **Hosting**: Static site deployment to Firebase Hosting

### Key Dependencies
- React 17 with React Router v5
- Firebase SDK v8 (frontend) / v9 (functions)
- React Virtualized for performance with large lists
- Material-UI v4 for UI components
- React Query for data fetching
- PayPal Button v2 for payments

## Important Technical Notes

1. **Node Version**: Requires Node >=16.0.0
2. **OpenSSL Legacy Provider**: Required flag for React Scripts with Node 16+
3. **Package Manager**: Uses pnpm (v10.11.1) for main app, yarn for Firebase functions
4. **Service Worker**: Custom service worker generated with sw-precache
5. **PDF Support**: Sheet music PDFs in `public/pdfs/` with pattern `vol[1-7].pdf` and `[year]supl[n].pdf`

## Additional Details

### Project Layout
- `src/`: React app source (routes, pages, firebase helpers, styles)
- `public/`: Static assets, SPA shell (`index.html`), search indexes (`bhajan-index*.json`), PDFs under `public/pdfs/`
- `functions/`: Firebase Cloud Functions (source in `src/`, built to `dist/`)
- `create-index/`: Scripts and source texts to build the search index JSON
- `cypress/`: E2E tests and Cypress config
- Config: `firebase.json`, `database.rules.json`, `.babelrc`, `.eslintrc`, `config-overrides.js`

### Routing
Top-level routes are defined in `src/index.js` and `src/App.js` using Hash Router:
- `/login`, `/logout`, `/pay`, `/beta`, `/admin`, `/faq` (direct routes in `index.js`)
- App shell (`App.js`) handles:
  - `/` → search page
  - `/my-favorites` → filtered view of favorites
  - `/profile` → profile page
  - `/pay` → payment page
  - `/pdf/:location/:id/:name` → in-app PDF viewer for bhajan/sheet music

### Search Algorithm (tolerant matching)
Implemented in `src/Search.js > makeSearchable()`:
- Lowercases and strips non-alphanumerics
- Normalizes common variations (e.g., collapses repeated vowels, maps `z→r`, removes `h`, folds `ee→i`, `oo|uu→u`, etc.)
- Precomputes `window.searchableBhajans` from the JSON index; filters against normalized user input
- Uses `react-virtualized` (`List`, `WindowScroller`, `AutoSizer`) for performant rendering

### Favorites and Data Model
- Local: `localStorage.favorites` stores a map of `{ [bhajanName]: 1 }`
- Remote: When signed-in, favorites sync to Firebase at `favorites/{uid}/{bhajanName} = "1"`
- Fetch/load: `App.js` merges local favorites with server-side on login (`checkRefOnce`)

### Notifications (FCM)
- `src/firebase.js` requests notification permission (if supported)
- Stores FCM tokens under `messages/{uid}/tokens/{token} = 1` with user metadata
- Handles token refresh and foreground messages

### Analytics and Error Monitoring
- Bugsnag error boundary wraps the app (`index.js`)
- Google Analytics + Google Tag Manager loaded via `public/index.html` and initialized in `index.js`
- UserReport script deferred in `index.js`

### Service Worker and Performance
- Build pipeline: `react-scripts build` → `sw-precache` → copy `service-worker2.js` to `service-worker.js`
- `react-snap` runs in `postbuild` for static prerendering of routes where possible

### Index Generation Pipeline
- Source texts and utilities in `create-index/` (e.g., `create-index.py`, `*.txt`, `cdbaby.json`)
- Outputs `public/bhajan-index2.json` consumed by the app

### Security and Access Control (Realtime Database)
See `database.rules.json` for details:
- `favorites/{userId}`: read/write by that user only
- `messages/{userId}`: owner read/write; admins can read
- `admin`, `paid`, `beta`, `confirmed*`: admin-only writes; select reads
- `satsang/{userId}`: readable by owner; write restricted to admins

### Cloud Functions
- Source: `functions/src/` → transpiled to `functions/dist/` via Babel
- Example callable used by frontend: `getUserByEmail` (`firebase.functions('us-central1').httpsCallable('getUserByEmail')`)
- Dev scripts: `yarn build`, `yarn serve` (watches + serves with Firebase CLI), `yarn deploy`

### Running Locally — Tips
- Node ≥16 required; CRA scripts pass `--openssl-legacy-provider` automatically via `package.json`
- Use `pnpm` per `packageManager`; `yarn` is used inside `functions/`
- If you switch Firebase projects locally, run `cd functions && yarn setup` (`firebase use --add`)

### Troubleshooting
- OpenSSL errors on Node 16+: ensure you run via `pnpm start`/`pnpm build` so the legacy flag is applied
- FCM requires HTTPS and user permission; in local dev it may not be available
- If PDFs don’t open, verify route is `/pdf/:location/:id/:name` and file exists under `public/pdfs/`

## Testing

- **Unit Tests**: `pnpm test` (uses Jest via React Scripts)
- **E2E Tests**: Cypress tests in `cypress/e2e/` - focus on Firebase authentication flows
- **Functions**: XO linter for Firebase functions (`cd functions && yarn lint`)

## Firebase Configuration

- Project ID: `bhajans-588f5`
- Database rules in `database.rules.json`
- Hosting rewrites all routes to `index.html` (SPA)
- Functions source in `./functions` directory