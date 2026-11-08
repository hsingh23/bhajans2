#!/bin/bash
# Usage: run_worker.sh <worker number 00-09> [chunk size]
# Feeds the worker's batch to pi (zai/glm-5.3-flash) a few songs at a time, skipping songs already in its output.
cd "$(dirname "$0")"
W=$1; CHUNK=${2:-8}
B=${BATCHES:-batches}; O=${OUTDIR:-out}
IN=$B/batch_$W.jsonl; OUT=$O/out_$W.jsonl; LOG=logs/${O}_worker_$W.log
mkdir -p "$O" logs; touch "$OUT"
while true; do
  TODO=$(python3 - "$IN" "$OUT" "$CHUNK" <<'PY'
import json, sys
done = set()
for line in open(sys.argv[2]):
    try: done.add(json.loads(line)["i"])
    except Exception: pass
rows = [l for l in open(sys.argv[1]) if json.loads(l)["i"] not in done]
sys.stdout.write("".join(rows[: int(sys.argv[3])]))
PY
)
  [ -z "$TODO" ] && { echo "worker $W done $(date)" >> "$LOG"; break; }
  BEFORE=$(wc -l < "$OUT")
  PROMPT="$(sed "s#OUTFILE#$OUT#g" prompt.md)
$TODO"
  echo "=== $(date) chunk starting at $(echo "$TODO" | head -1 | cut -c1-80)" >> "$LOG"
  timeout 1800 pi -p --model zai/glm-5.3-flash --no-session --tools bash "$PROMPT" </dev/null >> "$LOG" 2>&1
  AFTER=$(wc -l < "$OUT")
  if [ "$AFTER" -le "$BEFORE" ]; then
    FAILS=$((FAILS+1)); echo "no progress ($FAILS)" >> "$LOG"
    [ "$FAILS" -ge 3 ] && { echo "worker $W giving up $(date)" >> "$LOG"; break; }
    sleep 60
  else FAILS=0; fi
done
