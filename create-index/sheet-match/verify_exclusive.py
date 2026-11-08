#!/usr/bin/env python3
"""For every accepted link, is the linked song the song whose own printed text (heading to next
heading) holds the most of the sheet's lyric lines? Lists links where another song's text scores
higher (aliases printed under one heading share the same text and count as ties)."""
import json, importlib.util
spec = importlib.util.spec_from_file_location('m', 'match.py'); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
S = json.load(open('sheets.json')); books = json.load(open('books.json')); idx = json.load(open('../../public/bhajan-index2.json')); M = json.load(open('matches.json'))
pages, heads, starts = m.book_pages(books); segs = m.song_segments(idx, pages, heads, starts)
seg_grams = [(idx[i]['n'], b, p, m.grams(t), t) for i, b, p, placed, t in segs]
out = []; bad = 0
for stem, v in M.items():
    if not v['songs']:
        continue
    lines = [m.grams(m.norm(l, 'sheet')) for l in S[stem].get('lines', [])]
    lines = [g for g in lines if len(g) >= 8]
    if not lines:
        continue
    scores = {}
    for name, b, p, T, t in seg_grams:
        hit = sum(1 for g in lines if len(g & T) / len(g) >= 0.7) / len(lines)
        if hit > scores.get(name, (0, None, None))[0]:
            scores[name] = (hit, f'{b}-{p}', t[:40])
    ranked = sorted(scores.items(), key=lambda kv: -kv[1][0])
    for song in v['songs']:
        own = scores.get(song, (0, None, None))
        better = [(n, s) for n, s in ranked if s[0] > own[0] + 0.05 and n not in v['songs']]
        # a tie with text printed on the same page is an alias (same song, two index names)
        same_text = [n for n, s in better if s[2] == own[2]]
        better = [(n, s) for n, s in better if n not in same_text]
        row = {'stem': stem, 'song': song, 'own': round(own[0], 2), 'page': own[1], 'better': [(n, round(s[0], 2), s[1]) for n, s in better[:3]]}
        out.append(row)
        if better:
            bad += 1
            print(f"  {stem:26} -> {song[:40]:40} own={row['own']} page={row['page']}  better: {row['better']}")
json.dump(out, open('verify_exclusive.json', 'w'), ensure_ascii=False, indent=0)
print(f'{len(out)} links: {len(out) - bad} are the best-scoring song for their sheet, {bad} have another song scoring higher')
