#!/usr/bin/env python3
"""Fill features/tonic_cache/ for the tonic model.

  python tonic_cache.py cd  [workers] [url_list.txt]   CD samples (cs URLs from bhajan-index2.json)
  python tonic_cache.py box [workers] [id_list.txt]    Box recordings with cached audio

CD samples are downloaded to a temp dir, analysed (Melodia f0, Essentia tonic,
HPCP) and deleted; only features are kept. For Box recordings the f0/tonic come
from features/audio/<id>.npz (made by extract_audio.py), so only the HPCP
profiles are computed here; ids without that npz are skipped. Safe to re-run; existing outputs are skipped.
"""
import json
import sys
import tempfile
import traceback
import urllib.parse
import urllib.request
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

import numpy as np

from tonic_feats import CACHE, analyse_audio, url_key

HERE = Path(__file__).parent
INDEX = HERE.parent.parent / "public" / "bhajan-index2.json"


def all_cd_urls():
    seen = []
    for e in json.loads(INDEX.read_text()):
        for u in e.get("cs") or []:
            if u not in seen:
                seen.append(u)
    return seen


def do_cd(url):
    out = CACHE / "cd" / f"{url_key(url)}.npz"
    if out.exists():
        return "skip"
    with tempfile.TemporaryDirectory() as td:
        p = Path(td) / "s.mp3"
        parts = urllib.parse.urlsplit(url)
        safe = urllib.parse.urlunsplit(parts._replace(path=urllib.parse.quote(parts.path)))
        req = urllib.request.Request(safe, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=120) as r, open(p, "wb") as w:
            w.write(r.read())
        res = analyse_audio(p)
    tmp = out.with_suffix(".part.npz")
    np.savez_compressed(tmp, url=np.array(url), **res)
    tmp.rename(out)
    return "ok"


def do_box(bid):
    out = CACHE / "box" / f"{bid}.npz"
    if out.exists():
        return "skip"
    src = HERE / "audio" / f"{bid}.opus"
    feat = HERE / "features" / "audio" / f"{bid}.npz"
    if not feat.exists():
        raise FileNotFoundError("no features/audio npz yet (run extract_audio.py first)")
    res = analyse_audio(src, f0=np.load(feat)["f0"])
    tmp = out.with_suffix(".part.npz")
    np.savez_compressed(tmp, **res)
    tmp.rename(out)
    return "ok"


def main():
    mode = sys.argv[1]
    workers = int(sys.argv[2]) if len(sys.argv) > 2 else 6
    if len(sys.argv) > 3:
        items = Path(sys.argv[3]).read_text().split("\n")
        items = [x.strip() for x in items if x.strip()]
    elif mode == "cd":
        items = all_cd_urls()
    else:
        items = sorted(p.stem for p in (HERE / "audio").glob("*.opus") if ".part" not in p.name)
    (CACHE / mode).mkdir(parents=True, exist_ok=True)
    if mode == "cd":
        items = [u for u in items if not (CACHE / "cd" / f"{url_key(u)}.npz").exists()]
        fn = do_cd
    else:
        items = [b for b in items if (HERE / "audio" / f"{b}.opus").exists()
                 and (HERE / "features" / "audio" / f"{b}.npz").exists() and not (CACHE / "box" / f"{b}.npz").exists()]
        fn = do_box
    print(f"{mode}: {len(items)} to do", flush=True)
    ok = fail = 0
    with ProcessPoolExecutor(workers) as pool:
        futs = {pool.submit(fn, x): x for x in items}
        for fut in as_completed(futs):
            try:
                fut.result()
                ok += 1
            except Exception:  # noqa: BLE001
                fail += 1
                with open(CACHE / f"_failures_{mode}.txt", "a") as f:
                    f.write(f"{futs[fut]}\t{traceback.format_exc(limit=2)!r}\n")
            if (ok + fail) % 25 == 0:
                print(f"{ok + fail}/{len(items)} ok={ok} fail={fail}", flush=True)
    print(f"done {mode} ok={ok} fail={fail}", flush=True)


if __name__ == "__main__":
    main()
