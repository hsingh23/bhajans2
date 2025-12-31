# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: Sing With Amma - Bhajan Search Engine

A Progressive Web App (PWA) for searching and viewing bhajans (devotional songs) with PDF lyrics, audio playback, and user favorites. Built with React 19, Vite, and Firebase.

## Tech Stack

- **Runtime**: Bun (use `bun` for all package management and script execution in the root project)
- **Framework**: React 19 with Vite
- **UI**: Material UI (@mui/material) + FontAwesome icons
- **State**: React Query (@tanstack/react-query)
- **Routing**: React Router DOM v7
- **Backend**: Firebase (Hosting, Realtime Database, Auth, Cloud Functions, Cloud Messaging)
- **Build**: Vite with React Compiler optimization
- **Testing**: Vitest (unit), Playwright (E2E), MSW (mocking)
- **Linting**: ESLint v9 with React Compiler plugin

## Common Commands

```bash
# Development
bun dev              # Start Vite dev server on port 3000
bun run build        # Build for production (outputs to build/)
bun run preview      # Preview production build

# Code Quality
bun run lint         # ESLint with cache
bun run test         # Run Vitest unit tests with coverage
bun run test:e2e     # Run Playwright E2E tests
bun run validate     # Full validation: typecheck + lint + test
                      # IMPORTANT: Always run this before completing tasks
```

**Important**: You are not done with any task until `bun run validate` passes completely.

## Monorepo Structure

This is effectively a monorepo with different package managers:

- **Root project**: Use **Bun** (`bun install`, `bun run <script>`)
- **functions/**: Use **Yarn** (`cd functions && yarn install`, `yarn build`, `yarn deploy`)

## Firebase Cloud Functions

Located in `functions/` directory with separate package.json:
- **Runtime**: Node.js (via Firebase Functions)
- **Package Manager**: Yarn (not Bun)
- **Build**: `yarn build` transpiles src/ to dist/ with Babel
- **Deploy**: `yarn deploy` deploys only functions

Key commands in functions/:
```bash
cd functions
yarn build           # Build functions for deployment
yarn deploy          # Deploy to Firebase
yarn serve           # Local development with Firebase emulators
```

## App Architecture

### Routing (React Router v7)
```
/               - Main search interface (Search.jsx)
/pay             - Payment/contribution page
/profile         - User profile (requires auth)
/my-favorites    - User's favorite bhajans (requires auth)
/pdf/:id/:name   - PDF viewer for specific bhajan (requires auth)
/login           - Firebase Auth login
```

### Key Components

- **App.jsx**: Main router with public/protected route definitions, loads bhajan data
- **Search.jsx**: Search interface with virtualized list (react-virtualized), real-time filtering
- **RenderPage.jsx**: PDF/audio viewer with invertible colors, keyboard shortcuts
- **Profile.jsx**: User profile management
- **Admin.jsx**: Admin interface

### Data Flow

1. **Bhajan Data**: Pre-processed JSON loaded from `public/bhajan-index2.json` (~400KB)
2. **User Data**: Firebase Realtime Database (favorites, preferences)
3. **Authentication**: Firebase Auth with custom UI
4. **PDFs**: Served from `public/pdfs/`, cached by service worker

### Firebase Configuration

- **Config**: `src/firebase.js` contains Firebase v9 modular SDK initialization
- **Database**: Realtime Database with rules in `database.rules.json`
- **Hosting**: Configured in `firebase.json` (serves from `build/` directory)

## Code Conventions

- **Commits**: Conventional Commits format enforced by commitlint (`feat:`, `fix:`, `refactor:`, etc.)
- **Git Hooks**: Husky runs pre-commit hooks
- **React**: Functional components with hooks, React Compiler enabled for optimization
- **Styling**: Vanilla CSS with mobile-first approach in `src/App.css`
- **Typing**: Loose TypeScript with `@ts-nocheck` directives throughout

## Testing

- **Unit tests**: `src/**/*.test.jsx` or `src/**/*.spec.jsx` - use Vitest + jsdom
- **E2E tests**: `e2e/` directory - use Playwright
- **Mocks**: MSW (Mock Service Worker) configured, worker in `public/mockServiceWorker.js`

## Performance Features

- **React Compiler**: Automatically optimizes components (check `react-compiler/react-compiler` ESLint rule)
- **Virtualized lists**: For large bhajan datasets
- **Service Worker**: Caches PDFs for 30 days (CacheFirst strategy)
- **PWA**: Installable as desktop/mobile app

## Data Processing Tools

The `create-index/` directory contains Python scripts for processing bhajan data and generating searchable indices and PDFs. This is separate from the main React app.
