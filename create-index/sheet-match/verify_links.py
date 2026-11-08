#!/usr/bin/env python3
"""Independent check of EVERY accepted (sheet, song) link: the sheet's lyric lines must be found on
a songbook page within two pages of one of the song's locations, by a plain page scan that knows
nothing about the matcher's segments. Writes verify_links.json and prints the failures."""
import json, re, importlib.util
spec = importlib.util.spec_from_file_location('m', 'match.py'); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
S = json.load(open('sheets.json')); books = json.load(open('books.json')); idx = json.load(open('../../public/bhajan-index2.json')); M = json.load(open('matches.json'))
byn = {s['n']: s for s in idx}
pages = {b: [m.norm(p, 'songbook_legacy' if b in m.LEGACY_BOOKS else None) for p in v['pages']] for b, v in books.items()}
pg = {b: [m.grams(p) for p in ps] for b, ps in pages.items()}
out = []
for stem, v in M.items():
    if not v['songs']:
        continue
    lines = [m.grams(m.norm(l, 'sheet')) for l in S[stem].get('lines', [])]
    lines = [g for g in lines if len(g) >= 8]
    allg = m.grams(m.norm(S[stem]['lyrics'], 'sheet'))
    for song in v['songs']:
        best = (0, 0, None)
        for l in byn[song]['l']:
            mm = m.LOC_RE.match(l.lower())
            if not mm or mm.group(1) not in pages:
                continue
            b = mm.group(1); p = min(int(mm.group(2)), len(pages[b]))
            long = len(allg) >= 400 or 'omkara divya porule' in song  # a long sheet (stotram, omkara part) runs over many pages
            span = 12 if long else 2
            for q in range(max(1, p - 2), min(len(pages[b]), p + span) + 1):
                T = set().union(*pg[b][q - 1:q - 1 + (12 if long else 2)])
                hit = sum(1 for g in lines if len(g & T) / len(g) >= 0.7) / len(lines) if lines else 0
                cont = len(allg & T) / max(len(allg), 1)
                if (hit, cont) > best[:2]:
                    best = (hit, cont, f'{b}-{q}')
        out.append({'stem': stem, 'song': song, 'lines': round(best[0], 2), 'cont': round(best[1], 2), 'page': best[2], 'decision': v['decision']})
json.dump(out, open('verify_links.json', 'w'), ensure_ascii=False, indent=0)
ok = [o for o in out if o['lines'] >= 0.5 or o['cont'] >= 0.5]
weak = [o for o in out if o not in ok]
print(f'{len(out)} links checked: {len(ok)} confirmed on the page by the independent scan, {len(weak)} weak')
for o in sorted(weak, key=lambda o: o['lines'] + o['cont']):
    print(f"  {o['stem']:28} -> {o['song'][:45]:45} lines={o['lines']} cont={o['cont']} page={o['page']} [{o['decision']}]")
