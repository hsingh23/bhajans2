#!/bin/bash
# Progress of the 10 Amazon workers.
cd "$(dirname "$0")"
python3 - <<'PY'
import json, glob, collections
tot = collections.Counter(); bad = 0; n = 0
for f in sorted(glob.glob("out/out_*.jsonl")):
    for l in open(f):
        try: r = json.loads(l); tot[r.get("status")] += 1; n += 1
        except Exception: bad += 1
print(f"done {n}/2768", dict(tot), f"bad_lines={bad}")
PY
echo "workers running: $(pgrep -f run_worker.sh | wc -l | tr -d ' ')"; grep -hE "^worker [0-9]+ (done|giving up)" logs/*.log 2>/dev/null
