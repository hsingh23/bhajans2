#!/usr/bin/env python3
"""False-negative audit: for given sheet stems, scan EVERY songbook page (not the per-song
segments) for the sheet's lyric lines, and list the index songs located at or near the best pages."""
import json, re, sys, importlib.util
spec = importlib.util.spec_from_file_location('m', 'match.py'); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
S = json.load(open('sheets.json')); books = json.load(open('books.json')); idx = json.load(open('../../public/bhajan-index2.json'))
M = json.load(open('matches.json'))
pages = {b: [m.norm(p, 'songbook_legacy' if b in m.LEGACY_BOOKS else None) for p in v['pages']] for b, v in books.items()}
page_grams = {b: [m.grams(p) for p in ps] for b, ps in pages.items()}
loc_songs = {}
for s in idx:
    for l in s['l']:
        mm = m.LOC_RE.match(l.lower())
        if mm: loc_songs.setdefault((mm.group(1), int(mm.group(2))), []).append(s['n'])

def scan(stem):
    sh = S[stem]
    lines = [m.grams(m.norm(l, 'sheet')) for l in sh.get('lines', [])]
    lines = [g for g in lines if len(g) >= 8]
    allg = m.grams(m.norm(sh['lyrics'], 'sheet'))
    best = []
    for b, pgs in page_grams.items():
        for i in range(len(pgs)):
            T = pgs[i] | (pgs[i + 1] if i + 1 < len(pgs) else set())
            hit = sum(1 for g in lines if len(g & T) / len(g) >= 0.7) / len(lines) if lines else 0
            cont = len(allg & T) / max(len(allg), 1)
            if hit >= 0.5 or cont >= 0.5:
                best.append((round(hit, 2), round(cont, 2), b, i + 1))
    best.sort(reverse=True)
    return best[:4]

def readable(b, p):
    which = 'songbook_legacy' if b in m.LEGACY_BOOKS else None
    raw = books[b]['pages'][p - 1]
    return re.sub(r'\s+', ' ', m.decode(raw, which) if which else raw)[:300]

stems = sys.argv[1:] or [k for k, v in M.items() if v['decision'] == 'none']
for k in stems:
    v = M[k]
    print(f"\n==== {k} [{v['decision']}] linked={v['songs']} title={v.get('title')} refs={v.get('refs')}")
    print("   SHEET:", re.sub(r'\s+', ' ', m.decode(' | '.join(S[k]['lines'][:3]), 'sheet'))[:260])
    for hit, cont, b, p in scan(k):
        near = sorted({n for q in range(p - 2, p + 3) for n in loc_songs.get((b, q), [])})
        print(f"   page {b}-{p}: lines={hit} cont={cont} songs nearby={near[:6]}")
        print("      ", readable(b, p))
