# 008 — Favorites: localStorage-first with last-login RTDB merge

**Date:** 2017-07-04 → ongoing · **Status:** active (known limitation)

## Context

Favorites (hearting a bhajan) must work instantly offline and survive device
loss, without paying for a backend round-trip on every tap. Devices and the
cloud can disagree.

## Decision

- Source of truth at runtime: React state in `App.jsx`, mirrored to
  `localStorage["favorites"]` on every change (`getJson`/`setJson` in
  `src/util.jsx`).
- On every auth state change (`onAuthStateChanged`), fetch
  `favorites/<uid>` **once** and merge over the local object with a plain
  `Object.assign({}, prev, remoteFavorites || {})` (`1ff66d8`).
- The `my-favorites` route reuses the search list with a filter over the
  favorites map (`8475624`-era "hack: my-favorites" that stuck).

## Consequences

- Taps never wait on the network; offline favorites sync at next login.
- Deletions do not propagate correctly: without tombstones, a remote `true`
  can resurrect a locally-unfavorited song. The code itself documents this
  ("This simple merge doesn't fully solve distributed deletions") — accepted
  for a single-user-per-device audience.
- Null-remote crashes fixed defensively in `App.jsx` (`aa0cd98` era hardening).

## Evidence

`1ff66d8` (add favorites + Firebase sync), `8475624` (my-favorites route),
`734b5ca` (favorites sometimes working — load reliability), `29c96b4`
(modern rewrite keeps the merge, adds the null guard comment).
