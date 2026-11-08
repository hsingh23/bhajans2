"""Pass 3: word-type evidence. A legacy word with non-ASCII letters is paired with the
Unicode words of the same length whose ASCII letters agree at every ASCII position of the
legacy word (non-ASCII positions are wildcards that must hold a non-ASCII letter in the
Unicode word too). Only unambiguous matches (one Unicode type, freq>=2) are counted.
Run: python3 fm_words.py pages.json OUT.json"""
import json, re, sys, collections
pages = json.load(open(sys.argv[1]))
W = re.compile(r"[^\W\d_]+")
def words(books):
    c = collections.Counter()
    for b in books:
        for t in pages[b]:
            for w in W.findall(t):
                if len(w) >= 4 and any(ord(ch) > 127 for ch in w): c[w] += 1
    return c
leg = words([b for b in pages if b.startswith("vol")])
uni = words([b for b in pages if not b.startswith("vol")])
# index unicode words by (length, ascii-pattern)
def pat(w): return "".join(ch if ord(ch) < 128 else "*" for ch in w)
idx = collections.defaultdict(list)
for w, f in uni.items():
    if f >= 2: idx[pat(w.lower())].append(w.lower())
pairs = collections.Counter(); ex = collections.defaultdict(list); n = 0
for w, f in leg.items():
    wl = w.lower()
    cands = idx.get(pat(wl), [])
    if len(cands) != 1: continue
    u = cands[0]; n += 1
    for a, b in zip(w, u):
        if ord(a) > 127:
            pairs[(a, b)] += 1
            if len(ex[(a, b)]) < 6: ex[(a, b)].append(f"{w} = {u}")
json.dump({"pairs": [[a, b, v] for (a, b), v in pairs.most_common()], "ex": {f"{a}\t{b}": v for (a, b), v in ex.items()}},
          open(sys.argv[2], "w"), ensure_ascii=False)
print("matched word types", n)
by = collections.defaultdict(collections.Counter)
for (a, b), v in pairs.items(): by[a][b] += v
for a, cn in sorted(by.items(), key=lambda kv: -sum(kv[1].values())):
    print(repr(a), sum(cn.values()), cn.most_common(5), ex[(a, cn.most_common(1)[0][0])][:3])
