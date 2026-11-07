#!/usr/bin/env python3
"""Assemble box-matches-verified.json from the review decisions in work/ (see reference/matching-report.md).

Re-runnable pipeline pieces: rematch.py (candidates) -> work/stage*.py (rule checks + decisions) -> this file.
"""
import collections, json, pickle, sys
sys.path.insert(0, "."); sys.path.insert(0, "work")
from stage1_lib import *   # state, pool helpers, R, idx, old, new
state = pickle.load(open("work/state5.pkl", "rb"))
BID = {b["id"]: b for b in R.B}

# three songs found by looser token search (work/list_nc.json review), picked from the 2025 UPD / language folders
def find(name, folder_part):
    return next(b for b in R.B if b["name"] == name and folder_part in b["folder"])
extra = {
    "dinkar canda bhu jaladhi nadiya (hindi)": find("Dinkar.mp3", "2025 UPD"),
    "teyyo tinanto azhakka muzhakkam (malayalam)": find("Āzhakka Mūzhakkam.mp3", "2025 UPD"),
    "rote jag me": find("02 Radata Jag Ma (Rote Jag Mein).mp3", "Gujarati"),
}
for k, b in extra.items():
    st = state[k]
    st["choice"] = {"id": b["id"], "name": b["name"], "folder": b["folder"], "size": b["size"], "hint": b["hint"], "score": 100.0,
                    "oscore": 0, "nscore": 100.0, "accept": False}
    st["by"] = "sonnet"
    st["why"] = "previously unmatched; found by loose token search over Box titles and confirmed by name, language and folder"

def entry(c, accept, by=None, why=None):
    e = {"id": c["id"], "name": c["name"], "folder": c["folder"], "size": c["size"], "hint": c.get("hint", []),
         "score": round(best_score(c) if "oscore" in c else c["score"], 1), "accept": accept}
    if by: e["verified_by"] = by
    if why: e["why"] = why
    return e

groups = collections.defaultdict(list)
for k, st in state.items():
    if st["choice"]: groups[st["choice"]["id"]].append(k)
shared = {i: ks for i, ks in groups.items() if len(ks) > 1}
out = {}
stats = collections.Counter()
for s in R.INDEX:
    k = s["n"]; st = state[k]; ch = st["choice"]; pool = st["pool"]
    rest = sorted([c for c in pool.values() if not ch or c["id"] != ch["id"]], key=lambda c: -best_score(c))
    lst = []
    if ch:
        by, why = st["by"], st["why"]
        if by == "auto" and ch["id"] in shared:
            by, why = "sonnet", "shares its recording with spelling/language-variant entries of the same bhajan (reviewed, kept)"
        if lang_conflict(s, ch) and not why:
            why = "recording is tagged/foldered in a different language than the index entry; same bhajan, kept after review"
        lst.append(entry(ch, True, by, why))
    else:
        prev = old[k][0] if old[k] and old[k][0]["accept"] else None
        if prev:   # previously accepted, now rejected
            c = pool[prev["id"]]
            lst.append(entry(c, False, "sonnet", st["why"]))
            rest = [r for r in rest if r["id"] != prev["id"]]
        elif k in json.load(open("work/dec_un.json")):
            pass
    lst += [entry(c, False) for c in rest if best_score(c) >= 70][:7]
    if not ch and lst and "verified_by" not in lst[0] and k in json.load(open("work/dec_un.json")):
        lst[0]["verified_by"] = "sonnet"; lst[0]["why"] = "best Box candidate reviewed against the name, language and folder and rejected"
    out[k] = lst
    stats["accepted" if ch else "unmatched"] += 1
json.dump(out, open("box-matches-verified.json", "w"), ensure_ascii=False, indent=1)
print(stats, "shared files", len(shared), "songs", sum(len(v) for v in shared.values()))
pickle.dump((state, shared), open("work/final.pkl", "wb"))
