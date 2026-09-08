# 007 — Firebase goOnline/goOffline bandwidth shims (and their retreat)

**Date:** 2017-07 · **Status:** retired (shims remain as no-ops)

## Context

In 2017 the Realtime Database maintained a persistent websocket; on flaky
mobile networks and with Firebase's then-free tier, staying online cost
battery, data, and money. Several 2017 commits ("don't even go offline",
"I wonder", "see if this makes a difference") show blind debugging of
connection management.

## Decision

Wrap every RTDB interaction in `goOnline()` / `goOffline()` shims exported from
`src/firebase.js`, keeping the socket closed except around actual reads/writes;
admins and debug sessions stay permanently online; a 15-second timer closed the
connection for non-admins after boot.

## Consequences

- Correctness bugs followed: messaging token writes raced offline state
  (`d6f7f9e`, `fea1f32` forced `goOnline` before each messaging read), and the
  shims grew `dbHistory` debug instrumentation (`2614e17`).
- Eventually the team gave up: `3c3e25c` ("don't even go offline") disabled the
  switching; the functions remain exported no-ops today, and the 2025 modular
  rewrite kept them as inert compatibility shims (`69cc968`).
- Lesson recorded: hand-managing Firebase connection state for marginal
  bandwidth savings produced a month of heisenbugs; the modern app simply
  stays connected.

## Evidence

`3c3e25c`, `ffa8d49`→`3245f47` (online-for-admins fix), `d6f7f9e`,
`fea1f32`, `2614e17` (window debug), `69cc968` (modular rewrite).
