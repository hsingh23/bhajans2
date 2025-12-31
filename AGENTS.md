# Agent Instructions

## Superpowers System

<EXTREMELY_IMPORTANT>
You have superpowers. Superpowers teach you new skills and capabilities. RIGHT NOW run: `~/.codex/superpowers/.codex/superpowers-codex bootstrap` and follow the instructions it returns.
</EXTREMELY_IMPORTANT>

## Tech Stack
- **Runtime**: Bun (Use `bun` for all package management and script execution)
- **Framework**: React 19 + Vite
- **Testing**: Vitest (Unit), Playwright (E2E), MSW (Mocking)
- **Styling**: Vanilla CSS (Mobile First)

## Coding Standards
- **Commits**: Use Conventional Commits (e.g., `feat: add new button`, `fix: resize issue`).
- **Formatting**: Prettier is configured. Run `bun run format` (if script exists) or rely on auto-format.
- **Linting**: ESLint v9 is configured.

## Workflows
- **Development**: `bun dev`
- **Testing**: `bun run test` (Unit), `bun run test:e2e` (E2E)
- **Validation**: `bun run validate`

IMPORTANT you are not done until `bun run validate` passes
