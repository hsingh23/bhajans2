# 010 — PPTX presentation pipeline becomes the 2025 songbook source

**Date:** 2025-12-31 → 2026-01 · **Status:** active

## Context

From 2017–2020 each yearly supplement was typed into `.txt` files by hand and
converted by `create-index/` scripts. For 2025 the source material arrived as
PowerPoint presentations (one deck per bhajan evening, Tamil + transliteration
+ translation), and the community also wanted a printable digest-format PDF
songbook.

## Decision

Add a Python toolchain under `create-index/ppts/` (run with `uv`):

1. Parse year folders of `.pptx` files (2021–2025) into a structured XML
   intermediate, with robust language detection (Tamil Unicode vs Roman) and
   searchable-title extraction (`c904d0b`).
2. Generate the digest-format PDF songbook: custom page size, running headers,
   page numbers, bold-italic translations, alphabetical TOC.
3. Feed the extracted titles/locations back into `bhajan-index2.json` so app
   search covers the 2025 songbook; a `?2025=1|0` URL param toggled visibility
   during rollout, then 2025 was enabled by default (`47f6f73`).

## Consequences

- 2025 songs became searchable without hand-typed text files; the same source
  produces both the app index and the printed songbook.
- The 2026-01 "missing bhajans" incident (`aa0cd98`) came from merging legacy
  `.txt`-derived entries with PPTX-derived ones — location patterns
  (`2025-…`) are now load-bearing for both search display (`f91cfd7`) and the
  toggle filter in `App.jsx`.
- Python enters an otherwise JS repo (uv-managed), an accepted polyglot
  trade-off for PPTX/PDF tooling.

## Evidence

`8b32857` (2025 pipeline + dark mode), `c904d0b` (searchable titles +
language detection), `47f6f73` (enable 2025 by default), `aa0cd98` (index
repair + legacy file reorganization), `f91cfd7` (songbook location
precedence).
