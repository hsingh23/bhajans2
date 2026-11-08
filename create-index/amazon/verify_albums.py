#!/usr/bin/env python3
"""Look up the album and artist of every matched track ASIN in out*/; cached in albums.jsonl (rerun-safe)."""
import glob, json, os, sys
from concurrent.futures import ThreadPoolExecutor
from amz import album_of

here = os.path.dirname(os.path.abspath(__file__)); os.chdir(here)
cache = {}
if os.path.exists("albums.jsonl"):
    for l in open("albums.jsonl"):
        r = json.loads(l)
        if not r.get("error"):
            cache[r["asin"]] = r
files = glob.glob("out*/out_*.jsonl") + (["recheck.jsonl"] if os.path.exists("recheck.jsonl") else [])
asins = sorted({m["asin"] for f in files for l in open(f) for m in json.loads(l).get("matches", [])})
todo = [a for a in asins if a not in cache]
print(f"{len(asins)} ASINs, {len(todo)} to look up", flush=True)
with open("albums.jsonl", "a") as out, ThreadPoolExecutor(int(sys.argv[1]) if len(sys.argv) > 1 else 3) as pool:
    for k, r in enumerate(pool.map(album_of, todo), 1):
        out.write(json.dumps(r, ensure_ascii=False) + "\n"); out.flush()
        if k % 50 == 0:
            print(k, flush=True)
print("done", flush=True)
