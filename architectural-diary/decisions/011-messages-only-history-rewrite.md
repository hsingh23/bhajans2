# 011 — Messages-only history rewrite for documentation

**Date:** 2026-09-08 · **Status:** done (one-time)

## Context

Nine years of quick personal commits left `master` with messages like
`chore: life`, `try 3`, `again`, `Green`, `!fixup`, `WIP`, one message that
was a pasted AI-chat response ("Perfect! The commit was successful…"), and one
message polluted with ANSI terminal escape codes. The history was unreadable
as documentation, which blocked accurate CHANGELOG/diary generation.

## Decision

Rewrite commit **messages only** on `master` via
`git filter-branch --msg-filter`, keyed by the original commit SHAs:

- every commit's diff was analyzed (by model workers, one file per commit) and
  188 of 228 messages replaced with accurate Conventional Commit messages;
  39 messages judged already adequate were left untouched
- authors, author/committer dates, and every tree/blob were preserved
  byte-for-byte — verified: same commit count (228), empty
  `git diff` against the pre-rewrite ref, identical author/date listing
- merge commits kept their standard git-generated messages
- pushed with `--force-with-lease`; local backup branch
  `backup/pre-docs-20260908` retains the pre-rewrite history

## Consequences

- All commit hashes changed (messages feed the hash), so external links to
  commits older than 2026-09-08 are stale; the backup branch maps old→new
  positionally.
- `CHANGELOG.md`, `AGENTS.md`, `README.md`, this diary, and `prompt.md` were
  generated immediately after, so they cite stable post-rewrite hashes.
- Branches off old master (e.g. `codex/symphony-orchestration`) were NOT
  rewritten; merging them later will bring old-style messages on their side,
  which is acceptable.

## Evidence

The rewrite itself (this documentation commit follows it); backup ref
`backup/pre-docs-20260908`.
