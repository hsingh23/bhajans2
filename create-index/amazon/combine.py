#!/usr/bin/env python3
"""Merge worker results, the not_found recheck and album/artist lookups into amazon-buy.json,
one entry per index song (keyed by song name), plus a summary on stdout.

status: "verified"   an Amma track whose album page names Amma (or Amma's devotees) as the artist
        "unverified" a match the worker or recheck chose, but Amazon shows no album artist
        "not_found"  no Amma recording found
Matches whose album belongs to another artist are dropped (kept under "rejected")."""
import glob, json, os, re, sys, difflib
here = os.path.dirname(os.path.abspath(__file__)); os.chdir(here)
sys.path.insert(0, "..")
from bkey import oneWordKey

AMMA = re.compile(r"\bamma\b|amritanandamayi|amrita|amritapuri|ma center|swami amrita", re.I)
idx = json.load(open("../../public/bhajan-index2.json"))
work = {}
for f in sorted(glob.glob("out/out_*.jsonl")) + sorted(glob.glob("out2/out_*.jsonl")):
    for l in open(f):
        r = json.loads(l); work[r["n"]] = r
re_ = {json.loads(l)["n"]: json.loads(l) for l in open("recheck.jsonl")} if os.path.exists("recheck.jsonl") else {}
albums = {}
for l in open("albums.jsonl"):
    x = json.loads(l)
    if x["asin"] not in albums or not x.get("error"):
        albums[x["asin"]] = x

strip = lambda t: re.sub(r"\(.*?\)|\[.*?\]|\b(vintage|remastered|version|instrumental|live|feat\..*)\b", " ", t, flags=re.I)

def title_score(song, title):
    keys = [oneWordKey(strip(n)) for n in [song["n"]] + (song.get("cn") or []) if strip(n).strip()]
    tk = oneWordKey(strip(title))
    return max((difflib.SequenceMatcher(None, tk, k).ratio() for k in keys), default=0)

out, stats = {}, {}
for b in idx:
    w = work.get(b["n"])
    if w is None:
        out[b["n"]] = {"status": "unchecked"}; stats["unchecked"] = stats.get("unchecked", 0) + 1; continue
    cands = [dict(m, source="worker") for m in w.get("matches", [])]
    r = re_.get(b["n"])
    if r and r.get("status") == "found":
        cands += [dict(m, source="recheck") for m in r["matches"]]
    kept, rejected, seen = [], [], set()
    for m in cands:
        if m["asin"] in seen: continue
        seen.add(m["asin"])
        a = albums.get(m["asin"], {})
        artist = a.get("artist")
        m = {"asin": m["asin"], "url": f"https://www.amazon.com/dp/{m['asin']}", "title": m.get("title"),
             "price": m.get("price"), "version": m.get("version"), "source": m["source"],
             "album": a.get("album"), "album_title": a.get("album_title"), "album_artist": artist,
             "title_score": round(title_score(b, m.get("title") or ""), 2)}
        if artist and not AMMA.search(artist):
            rejected.append(m); continue
        m["verified"] = bool(artist)
        kept.append(m)
    kept.sort(key=lambda m: (not m["verified"], m["version"] not in (None, "original"), -m["title_score"]))
    status = "verified" if any(m["verified"] for m in kept) else "unverified" if kept else "not_found"
    e = {"status": status, "matches": kept, "app_button_ok": w.get("app_button_ok"),
         "confidence": w.get("confidence"), "found_by_recheck": bool(kept) and all(m["source"] == "recheck" for m in kept)}
    if kept and kept[0]["title_score"] < 0.7: e["title_doubt"] = True
    if rejected: e["rejected"] = rejected
    out[b["n"]] = e
    stats[status] = stats.get(status, 0) + 1

json.dump(out, open("amazon-buy.json", "w"), ensure_ascii=False, indent=1)
found = [e for e in out.values() if e["status"] in ("verified", "unverified")]
print("songs", len(out), stats)
print("found by recheck only", sum(e.get("found_by_recheck", False) for e in found))
print("title doubts", sum(e.get("title_doubt", False) for e in found))
print("rejected (other artist)", sum(1 for e in out.values() if e.get("rejected")))
print("app button shows Amma's track", sum(e["app_button_ok"] is True for e in found), "misses", sum(e["app_button_ok"] is False for e in found), "no button", sum(e["app_button_ok"] is None for e in found))
