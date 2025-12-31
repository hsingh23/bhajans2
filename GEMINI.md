# Project Context: Sing With Amma (Bhajans)

## Overview
**Sing With Amma** is a web application serving as a search engine for bhajans (devotional songs). It allows users to search, view lyrics, access PDFs, and listen to audio samples. The project is a monorepo-style structure utilizing **React** for the frontend and **Firebase** for backend services (Hosting, Functions).

## Tech Stack

### Frontend (Root)
*   **Framework**: React 19 + Vite
*   **Runtime/Package Manager**: **Bun** (Strictly enforced for root operations per `AGENTS.md`)
*   **Language**: JavaScript / TypeScript
*   **UI Library**: Material UI (@mui/material)
*   **State Management**: React Query (@tanstack/react-query)
*   **Testing**: Vitest (Unit), Playwright (E2E), MSW (Mocking)
*   **Linting/Formatting**: ESLint v9, Prettier

### Backend (Firebase Functions)
*   **Location**: `functions/` directory
*   **Runtime**: Node.js
*   **Package Manager**: **Yarn** (as seen in `functions/package.json` scripts)
*   **Framework**: Firebase Cloud Functions

### Data Processing
*   **Location**: `create-index/`
*   **Language**: Python
*   **Purpose**: Processes text files (bhajan supplements) to generate search indices (`bhajan-index.json`).

## Key Directories

*   `src/`: Main React application source code.
*   `functions/`: Firebase Cloud Functions source code.
*   `create-index/`: Python scripts and raw text data for generating bhajan indices.
*   `public/`: Static assets including PDFs (`pdfs/`) and images.
*   `e2e/`: Playwright end-to-end tests.
*   `ppts/`: Python tools for songbook/presentation generation (managed via `uv`/`pyproject.toml`).

## Development Workflow

### Setup
1.  **Root (Frontend)**: Run `bun install`
2.  **Functions (Backend)**: Run `cd functions && yarn install`

### Running the App
*   **Frontend Dev Server**: `bun dev` (Starts Vite)
*   **Backend**: `cd functions && yarn serve` (Starts Firebase Functions emulator)

### Validation & Testing
*   **Full Check**: `bun run validate` (Runs Typecheck, Lint, and Unit Tests). **Must pass before completion.**
*   **Unit Tests**: `bun run test` (Vitest)
*   **E2E Tests**: `bun run test:e2e` (Playwright)
*   **Lint**: `bun run lint`

## Conventions
*   **Commits**: Follow **Conventional Commits** (e.g., `feat: ...`, `fix: ...`). Enforced by Husky + Commitlint.
*   **Code Style**: Prettier and ESLint are configured.
*   **Package Management**:
    *   Use **Bun** for the root project.
    *   Use **Yarn** specifically inside `functions/`.

## Critical Files
*   `AGENTS.md`: Specific instructions for AI agents.
*   `package.json`: Root scripts and dependencies.
*   `firebase.json`: Firebase configuration (Hosting, Functions, Emulators).
*   `vite.config.js`: Frontend build configuration.
