"""Collect character co-occurrence evidence between three encodings of the same lyrics.

  sheet  : Finale "IndicTranslitAbc" lyrics in sheets.json (syllabified)
  legacy : songbook vol1-7 PDFs (legacy 8-bit font)
  uni    : 2025 + 20xx supplement PDFs (real Unicode IAST)

Documents are matched by shared 10-grams of an ASCII-letter skeleton, then aligned
with difflib; substitutions flanked by >=3 equal chars are counted as (src, dst) pairs.
Run: python3 fm_align.py pages.json OUT.json
"""
import json, re, sys, collections, difflib
from pathlib import Path
HERE = Path(__file__).parent
pages = json.load(open(sys.argv[1]))
sheets = json.load(open(HERE / "sheets.json"))
N = 10
ROMAN = {"I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6, "VII": 7}

def page_lyrics(t):
    out = []
    for ln in t.split("\n"):
        if any(ord(c) > 127 and c.isalpha() for c in ln):
            out.append(re.sub(r"[^\w]", "", ln))
    return "".join(out)

def sheet_lyrics(s):
    t = re.sub(r"\b(Chorus|Verse|Coda|Bridge|Intro|Refrain|Ending|Fine|D\.?S\.?|al)\b", " ", s)
    t = re.sub(r"\d+\.", " ", t)
    return re.sub(r"[^\w]", "", t).replace("_", "")

def sk(s):
    s = re.sub(r"[^a-z]", "", s.lower())
    s = s.replace("chh", "c").replace("ch", "c")
    # 2025 writes voiced intervocalic stops (ulagil, maganē) where vol1-7 / sheets write
    # ulakil, makanē; fold voicing and s/c, w/v so the skeletons still meet
    return s.translate(str.maketrans("gdbsw", "ktpcv"))

def shingles(s): return {s[i:i + N] for i in range(max(0, len(s) - N + 1))}

docs = {"legacy": {}, "uni": {}, "sheet": {}}
for b, pl in pages.items():
    kind = "legacy" if b.startswith("vol") else "uni"
    for i in range(len(pl)):
        # page plus the next one (songs run over)
        docs[kind][(b, i + 1)] = page_lyrics(pl[i]) + page_lyrics(pl[i + 1] if i + 1 < len(pl) else "")
for stem, s in sheets.items():
    docs["sheet"][stem] = sheet_lyrics(s.get("lyrics") or "")

def index(kind):
    idx = collections.defaultdict(set)
    for k, txt in docs[kind].items():
        for g in shingles(sk(page_lyrics_single(kind, k))): idx[g].add(k)
    return idx

def page_lyrics_single(kind, k):  # index on the single page so the best hit is the start page
    if kind == "sheet": return docs["sheet"][k]
    return page_lyrics(pages[k[0]][k[1] - 1])

IDX = {k: index(k) for k in ("legacy", "uni")}

def best(src_txt, kind, min_frac=0.15, min_hits=8):
    S = shingles(sk(src_txt))
    votes = collections.Counter()
    for g in S:
        for k in IDX[kind].get(g, ()): votes[k] += 1
    if not votes: return None, 0
    k, v = votes.most_common(1)[0]
    if v < min_frac * len(S) or v < min_hits: return None, v / max(1, len(S))
    return k, v / len(S)

def align(a, c, pairs, ex, tag):
    al, cl = a.lower(), c.lower()
    sm = difflib.SequenceMatcher(None, al, cl, autojunk=False)
    ops = sm.get_opcodes()
    ok = lambda m: 0 <= m < len(ops) and ops[m][0] == "equal" and ops[m][2] - ops[m][1] >= 3
    for n, (op, i1, i2, j1, j2) in enumerate(ops):
        if op == "equal":
            if i2 - i1 < 4: continue  # short equal runs inside edits are chance matches
            for k in range(i1, i2):
                if ord(a[k]) > 127 or ord(c[j1 + k - i1]) > 127:
                    key = (a[k], c[j1 + k - i1].lower()); pairs[key] += 1
                    if len(ex[key]) < 5:
                        ex[key].append(f"{tag}: …{a[max(0,k-10):k+10]}… ~ …{c[max(0,j1+k-i1-10):j1+k-i1+10]}…")
        elif ok(n - 1) and ok(n + 1) and max(i2 - i1, j2 - j1) <= 3:
            segs = ([(a[k], cl[j1 + k - i1]) for k in range(i1, i2)] if op == "replace" and i2 - i1 == j2 - j1
                    else [(a[i1:i2], cl[j1:j2])])
            for key in segs:
                if key[0].lower() == key[1]: continue
                pairs[key] += 1
                if len(ex[key]) < 5:
                    ex[key].append(f"{tag}: …{a[max(0,i1-10):i2+10]}… ~ …{c[max(0,j1-10):j2+10]}…")
    return sm.ratio()

result = {}
def run(name, src_kind, dst_kind, items):
    pairs = collections.Counter(); ex = collections.defaultdict(list); links = []
    for key, txt, forced in items:
        if len(txt) < 30: continue
        tgt = None; score = 0
        if forced:
            # candidate pages from the footer ref; keep whichever aligns best
            cands = [k for k in forced if k in docs[dst_kind]]
            if cands:
                Sx = shingles(sk(txt))
                def sc(k):
                    return len(Sx & shingles(sk(page_lyrics(pages[k[0]][k[1]-1])))) / max(1, len(Sx))
                k0 = max(cands, key=sc)
                if sc(k0) >= 0.15: tgt, score = k0, sc(k0)
        if tgt is None:
            tgt, score = best(txt, dst_kind)
        if tgt is None:
            links.append([str(key), None, round(score, 2)]); continue
        r = align(txt, docs[dst_kind][tgt], pairs, ex, f"{key} -> {tgt[0]}-{tgt[1]}")
        links.append([str(key), f"{tgt[0]}-{tgt[1]}", round(score, 2), round(r, 2)])
    result[name] = {"pairs": [[a, b, v] for (a, b), v in pairs.most_common()],
                    "ex": {f"{a}\t{b}": v for (a, b), v in ex.items()}, "links": links}
    print(name, "linked", sum(1 for l in links if l[1]), "of", len(links))

# legacy pages -> unicode
run("legacy_uni", "legacy", "uni", [(k, page_lyrics(pages[k[0]][k[1]-1]), None) for k in docs["legacy"]])
# sheets -> unicode (no forced ref; search)
run("sheet_uni", "sheet", "uni", [(k, v, None) for k, v in docs["sheet"].items()])
# sheets -> legacy, footer ref first (Book N p -> volN p, p-1, p+1), else search
items = []
for k, v in docs["sheet"].items():
    forced = []
    for r in sheets[k].get("refs") or []:
        bk = r.get("book"); pg = r.get("page")
        if bk and pg:
            n = ROMAN.get(bk.upper(), int(bk) if bk.isdigit() else None)
            if n: forced += [(f"vol{n}", int(pg) + d) for d in (0, -1, 1)]
    items.append((k, v, forced or None))
run("sheet_legacy", "sheet", "legacy", items)
json.dump(result, open(sys.argv[2], "w"), ensure_ascii=False)
