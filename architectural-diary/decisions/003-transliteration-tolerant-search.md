# 003 — Transliteration-tolerant fuzzy search in the browser

**Date:** 2017-06 → ongoing · **Status:** active

## Context

Bhajan names are Sanskrit words transliterated into Roman script by many
people: the same song appears as "govinda", "govind", "govinda hari", with
diacritics, or in Devanagari. Exact-substring search fails constantly. Users
are often at a sing-along needing a song in seconds.

## Decision

Normalize both sides (query and bhajan text) through a lossy "searchable"
transform (`makeSearchable()` in `src/Search.jsx`) before plain `includes()`
matching:

- lowercase + strip non-alphanumerics; drop aspirated `h` (`bhajan`→`bajan`)
- fold `va`→`v`, `z`→`r`, `ee`→`i`, `oo|uu`→`u`, collapse repeated consonants
  (`ganga`→`ganga`/`gana` classes), merge `[tdl]`→`T` (retroflex dental
  confusion), `[vw]`→`V`, handle `ny`, `y` finals
- apply to the concatenation of name + tags + locations, memoized per bhajan

The transform encodes real equivalence classes of romanized Sanskrit rather
than generic Levenshtein fuzzing — deliberately cheap (runs on every keystroke
over ~7k entries on phones, 2017-era hardware).

## Consequences

- No server round-trips; search works offline; one famous bug class (the 2017
  "space-related search bug", `091bd3b`/`349ada3`) came from spaces not being
  stripped on the query side — fixed by folding spaces into the normalization.
- Order-sensitive regex chains are hard to reason about; any new transliteration
  quirk means editing the chain (e.g. `7e20910` improved it; cdbaby matching
  has its own variant — `4dd8866` removed the harmful `ai?` collapse).
- Highlighting uses the raw filter against raw text (`react-highlight-words`),
  so matches can highlight imperfectly even when the fold matched — accepted
  trade-off.

## Evidence

`f628d6d` (initial search), `349ada3` (robust search incl. space stripping),
`7e20910` (transliteration + FirebaseUI credential helper), `4dd8866`
(cdbaby normalization fix), `648faee` (search tags too).
