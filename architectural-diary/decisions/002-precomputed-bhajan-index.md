# 002 — Precomputed, committed bhajan index searched client-side

**Date:** 2017-06/07 → ongoing · **Status:** active

## Context

The product's core question is "which book and page is this bhajan in?" across
~7 volumes plus yearly supplements (2011–2025). Song data originates as PDFs
and hand-maintained text files, not a database. Search must work offline (PWA)
and be instant on phones.

## Decision

Do **not** put song data in a queryable backend. Instead:

1. Offline pipeline in `create-index/` parses the yearly `.txt` indexes
   (originally Python, later Node/Bun scripts) into a flat JSON array.
2. The JSON is committed to the repo and served as a static asset
   (`public/bhajan-index.json`, later `public/bhajan-index2.json`).
3. The client fetches it once at boot (`App.jsx`), sorts by name, and searches
   in memory over a precomputed "searchable" projection.

Commit `4d23de0` introduced the structured format: each entry became
`{ n: name, t: tags, l: locations[] }` instead of parallel arrays, so the
client could attach metadata (tags, sheet music, store links) per bhajan.

## Consequences

- Search is fully offline-capable and fast (virtualized list + memoized
  searchable strings); zero backend cost.
- Index regeneration is a manual, artifact-committed step — the 2026-01 fixes
  (`aa0cd98`, restoring bhajans dropped from the index) show the operational
  risk: a bad regeneration silently deletes songs from the app.
- Location strings double as a routing/link DSL: `vol4-180`, `2020supl2-5`
  become in-app render links; `cdbaby:…` / `sheet:…` prefixes become external
  links (see `f91cfd7` for the songbook-pattern precedence rule).

## Evidence

`f628d6d` (initial index generator), `4d23de0` (structured bhajan-index2.json),
`349ada3` (robust search), `aa0cd98` (index repair), `f91cfd7` (location
pattern precedence).
