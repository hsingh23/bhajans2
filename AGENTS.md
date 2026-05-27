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
- Do not chain `codegraph_search` + `codegraph_node` when you just want context. Use `codegraph_context`.
- Do not loop `codegraph_node` over many symbols. Use one capped `codegraph_explore`.
- Index lag: the file watcher debounces about 500ms behind writes. Avoid querying immediately after editing a file in the same turn.

### If `.codegraph/` doesn't exist

The MCP server returns "not initialized." Run `codegraph init -i` in the repo root to build the index.
<!-- CODEGRAPH_END -->

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
