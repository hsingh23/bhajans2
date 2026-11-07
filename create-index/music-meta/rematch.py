#!/usr/bin/env python3
"""Second-pass matcher: squashed-prefix scoring, songbook keys, language-aware flags. Writes work/cands.json"""
import json, re, sys
from pathlib import Path
from rapidfuzz import fuzz, process
sys.path.insert(0, str(Path(__file__).parent))
from match_box import ascii_fold, phonetic, clean_index_name, clean_box_name, LANG_WORDS, AUDIO_EXT, SKIP_FOLDERS, folder_rank

HERE = Path(__file__).parent
ROOT = HERE.parent
INDEX = json.load(open(ROOT.parent / "public" / "bhajan-index2.json"))
INV = json.load(open(ROOT / "box" / "box-inventory.json"))
OLD = json.load(open(HERE / "box-matches.json"))

LANGS = ["malayalam","tamil","hindi","kannada","telugu","bengali","sanskrit","marathi","gujarati","punjabi","english","french","german","spanish","odia","tulu"]
def folder_lang(folder, name):
    t = (folder + "/" + name).lower()
    found = [l for l in LANGS if re.search(r"\b" + l + r"\b", t)]
    return found

def squash(s): return s.replace(" ", "")

# songbook entries: file -> [(raw, loc)]
BOOKS = {}
for p in ROOT.glob("*.txt"):
    if p.name.endswith(".changed.txt") or "##" not in p.read_text(errors="ignore")[:3000]: continue
    if p.name in ("bhajan-index.txt","better-search.txt","sorted.search.bhajanmritam.txt","tags.txt","music.txt","video.txt","sheetmusiclist.txt","downloadurls.txt"): continue
    for line in p.read_text(errors="ignore").splitlines():
        if "##" in line:
            a, b = line.split("##", 1)
            for loc in b.strip().lower().split("/"):
                BOOKS.setdefault(loc.strip(), []).append(a.strip())

def songbook_keys(song):
    keys = set()
    base = clean_index_name(song["n"])
    for loc in song["l"]:
        for raw in BOOKS.get(loc.lower(), []):
            k = clean_index_name(ascii_fold(raw))
            if k and fuzz.ratio(squash(k)[:len(squash(base))], squash(base)) >= 86:
                keys.add(k)
    return keys - {base}

def index_keys(song):
    n = song["n"].lower()
    keys = {clean_index_name(n)}
    # parenthetical alternate titles that are not language tags
    for par in re.findall(r"\(([^)]*)\)", n):
        if not re.fullmatch(r"\s*" + LANG_WORDS + r"[^)]*", par):
            keys.add(phonetic(ascii_fold(par)))
            keys.add(clean_index_name(re.sub(r"\([^)]*\)", " ", n)))
    for c in song.get("cn", []):
        ck = phonetic(ascii_fold(c))
        if len(squash(ck)) >= 9:  # short CD names ("amma", "ma om") are too generic
            keys.add(ck)
    sb = songbook_keys(song)
    return {k for k in keys if k}, sb

files = [f for f in INV["files"] if f["ext"] in AUDIO_EXT and not f["folder"].startswith(SKIP_FOLDERS)]
B = []
for f in files:
    key, hint = clean_box_name(f["name"])
    if len(squash(key)) < 3: continue
    B.append({**f, "key": key, "sq": squash(key), "hint": hint, "flang": folder_lang(f["folder"], f["name"])})
SQ = [b["sq"] for b in B]

def pair_score(ik, b):
    isq = squash(ik)
    pre = isq[: len(b["sq"]) + 1]
    s_full = fuzz.ratio(b["sq"], isq)
    s_pre = fuzz.ratio(b["sq"], pre)
    # a short/generic Box title that is merely a prefix of a longer first line is weak evidence
    if len(b["sq"]) < 9 and len(isq) > len(b["sq"]) + 3:
        s_pre = min(s_pre, 66 + 2 * (len(b["sq"]) - 5 if len(b["sq"]) > 5 else 0))
    return max(s_pre, s_full)

def main():
    out = {}
    for song in INDEX:
        keys, sb = index_keys(song)
        cands = {}
        for src, ks in (("n", keys), ("songbook", sb)):
            for k in ks:
                sk = squash(k)
                for _, _, i in process.extract(sk, SQ, scorer=fuzz.WRatio, limit=25):
                    s = pair_score(k, B[i])
                    if i not in cands or s > cands[i][0]:
                        cands[i] = (s, src, k)
        top = max((v[0] for v in cands.values()), default=0)
        ranked = sorted(cands.items(), key=lambda kv: (-(kv[1][0] >= top - 3), -folder_rank(B[kv[0]]["folder"]), -kv[1][0]))
        lst = []
        for i, (s, src, k) in ranked:
            if s < 70: continue
            b = B[i]
            lst.append({"id": b["id"], "name": b["name"], "folder": b["folder"], "size": b["size"], "hint": b["hint"],
                        "score": round(s, 1), "src": src, "key": k, "flang": b["flang"]})
            if len(lst) >= 8: break
        out[song["n"]] = lst
    json.dump(out, open(HERE / "work" / "cands.json", "w"), ensure_ascii=False, indent=0)
    a = sum(1 for v in out.values() if v and v[0]["score"] >= 90)
    print("new >=90:", a)
if __name__ == '__main__':
    main()
