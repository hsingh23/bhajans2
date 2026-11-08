#!/usr/bin/env python3
"""Second look at songs the workers marked not_found: search each CD name (and the song name) on
Amazon Digital Music and keep results by Amma whose title has the same phonetic key (bkey).
Writes recheck.jsonl (rerun-safe). Songs it finds still need a human-style check of the title."""
import glob, json, os, re, sys, difflib, subprocess
from concurrent.futures import ThreadPoolExecutor
here = os.path.dirname(os.path.abspath(__file__)); os.chdir(here)
sys.path.insert(0, "..")
from bkey import oneWordKey

AMMA = re.compile(r"^(amma|mata amritanandamayi|amma group|amma's devotees|amritanandamayi)$", re.I)
idx = {b["n"]: b for b in json.load(open("../../public/bhajan-index2.json"))}
rows = [json.loads(l) for f in glob.glob("out*/out_*.jsonl") for l in open(f)]
done = {json.loads(l)["n"] for l in open("recheck.jsonl")} if os.path.exists("recheck.jsonl") else set()
todo = [r for r in rows if r["status"] == "not_found" and r["n"] not in done and r["n"] in idx]

def strip_tags(t):
    return re.sub(r"\(.*?\)|\[.*?\]|\bvintage\b|\bremastered\b|\bversion\b|\binstrumental\b", " ", t, flags=re.I)

def check(r):
    b = idx[r["n"]]
    names = list(dict.fromkeys([strip_tags(r["n"]).strip()] + (b.get("cn") or [])[:2]))
    keys = {oneWordKey(n) for n in names if n.strip()}
    hits, queries = [], []
    for n in names[:2]:
        q = f"{strip_tags(n).strip()} amma"; queries.append(q)
        out = subprocess.run(["python3", "amz.py", "search", q], capture_output=True, text=True).stdout
        if out.strip() == "BLOCKED":
            return {"n": r["n"], "status": "blocked", "queries": queries}
        for line in out.splitlines():
            p = line.split(" | ")
            if len(p) < 4 or p[2] != "by" or not AMMA.match(p[3].strip()):
                continue
            tk = oneWordKey(strip_tags(p[1]))
            score = max(difflib.SequenceMatcher(None, tk, k).ratio() for k in keys)
            if score >= 0.85:
                price = re.search(r"\$[0-9.]+", line)
                hits.append({"asin": p[0], "title": p[1], "artist": p[3], "price": price.group(0) if price else None, "score": round(score, 2)})
        if hits:
            break
    return {"n": r["n"], "status": "found" if hits else "not_found", "matches": hits, "queries": queries}

with open("recheck.jsonl", "a") as out, ThreadPoolExecutor(3) as pool:
    for k, res in enumerate(pool.map(check, todo), 1):
        out.write(json.dumps(res, ensure_ascii=False) + "\n"); out.flush()
        if k % 100 == 0: print(k, "/", len(todo), flush=True)
print("done", flush=True)
