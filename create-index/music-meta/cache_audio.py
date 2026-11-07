#!/usr/bin/env python3
"""Download every Box audio file (except talks) and keep a compact analysis copy.

The shared link expires 2026-11-14 and the full set is ~100 GB, so each file is
downloaded to a temp path, transcoded to 24 kHz mono Opus (~1.5 MB per song)
under audio/<box_id>.opus, and the original deleted. Safe to re-run: existing
outputs are skipped.
"""
import json
import subprocess
import sys
import tempfile
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

HERE = Path(__file__).parent
INV = json.loads((HERE.parent / "box" / "box-inventory.json").read_text())
AUDIO = HERE / "audio"
AUDIO.mkdir(exist_ok=True)
LOG = HERE / "audio" / "_failures.jsonl"
SKIP = ("1 MP3/Talks",)
EXT = {"mp3", "m4a", "wav", "aif"}


def url(fid):
    return INV["download_url_template"].replace("{id}", fid)


def fetch(f):
    out = AUDIO / f"{f['id']}.opus"
    if out.exists() and out.stat().st_size > 1000:
        return "skip"
    with tempfile.TemporaryDirectory() as td:
        src = Path(td) / f"src.{f['ext']}"
        for attempt in range(4):
            try:
                req = urllib.request.Request(url(f["id"]), headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=180) as r, open(src, "wb") as w:
                    while chunk := r.read(1 << 20):
                        w.write(chunk)
                if f.get("size") and abs(src.stat().st_size - f["size"]) > 1024:
                    raise IOError(f"size {src.stat().st_size} != {f['size']}")
                break
            except Exception as e:  # noqa: BLE001
                if attempt == 3:
                    raise
                time.sleep(5 * (attempt + 1))
        tmp = out.with_suffix(".part.opus")
        subprocess.run(
            ["ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-i", str(src),
             "-vn", "-ac", "1", "-ar", "24000", "-c:a", "libopus", "-b:a", "48k", str(tmp)],
            check=True,
        )
        tmp.rename(out)
    return "ok"


def main():
    workers = int(sys.argv[1]) if len(sys.argv) > 1 else 8
    files = [f for f in INV["files"] if f["ext"] in EXT and not f["folder"].startswith(SKIP)]
    # Amma's own albums first, so the most useful audio lands earliest.
    files.sort(key=lambda f: (not f["folder"].startswith("1 MP3/Amma/"), f["folder"], f["name"]))
    done = fail = 0
    t0 = time.time()
    with ThreadPoolExecutor(workers) as pool:
        futs = {pool.submit(fetch, f): f for f in files}
        for fut in as_completed(futs):
            f = futs[fut]
            try:
                fut.result()
                done += 1
            except Exception as e:  # noqa: BLE001
                fail += 1
                with open(LOG, "a") as lg:
                    lg.write(json.dumps({"id": f["id"], "name": f["name"], "err": str(e)}) + "\n")
            n = done + fail
            if n % 50 == 0 or n == len(files):
                print(f"{n}/{len(files)} ok={done} fail={fail} {time.time() - t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
