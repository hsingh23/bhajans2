#!/usr/bin/env python3
"""Split the bhajan index into 10 worker batches of songs to check on Amazon."""
import json, os
here = os.path.dirname(os.path.abspath(__file__))
idx = json.load(open(os.path.join(here, "../../public/bhajan-index2.json")))
os.makedirs(os.path.join(here, "batches"), exist_ok=True)
N = 10
for w in range(N):
    with open(os.path.join(here, f"batches/batch_{w:02d}.jsonl"), "w") as f:
        for i, b in enumerate(idx):
            if i % N != w:
                continue
            cn = b.get("cn") or []
            row = {"i": i, "n": b["n"], "cd_names": cn, "lang": b.get("lg"), "deity": b.get("d"),
                   "app_query": f"{cn[0]} amma" if cn else None}
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
print("songs", len(idx))
