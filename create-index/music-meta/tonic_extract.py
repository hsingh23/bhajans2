#!/usr/bin/env python3
"""Run extract_audio.extract on a prioritised id list (give it descending ids), so it can
run beside the background extract job without both working on the same file.
Each output goes through its own temp name (no shared .part file), then the
HPCP cache entry (tonic_cache.do_box) is filled for the same id.

Usage: python tonic_extract.py <id_list.txt> [workers] [--no-hpcp]
"""
import os
import sys
import traceback
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

HERE = Path(__file__).parent


def job(bid, hpcp=True):
    import numpy as np

    import extract_audio as ea
    from tonic_cache import do_box

    out = ea.OUT / f"{bid}.npz"
    src = ea.AUDIO / f"{bid}.opus"
    if not out.exists() and not (ea.OUT / f"{bid}.part.npz").exists():
        # same computation as extract_audio.extract, private temp name
        tmp_dir = ea.OUT / f".tonic-{os.getpid()}"
        tmp_dir.mkdir(exist_ok=True)
        orig = ea.OUT
        try:
            ea.OUT = tmp_dir
            ea.extract(src)
        finally:
            ea.OUT = orig
        made = tmp_dir / f"{bid}.npz"
        if made.exists() and not out.exists():
            np.load(made)["f0"]  # sanity: readable
            made.rename(out)
        elif made.exists():
            made.unlink()
    if out.exists() and hpcp:
        do_box(bid)
    return bid


def main():
    ids = [x.strip() for x in Path(sys.argv[1]).read_text().split() if x.strip()]
    workers = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 3
    hpcp = "--no-hpcp" not in sys.argv
    done = (lambda b: (HERE / "features" / "tonic_cache" / "box" / f"{b}.npz").exists()) if hpcp else \
        (lambda b: (HERE / "features" / "audio" / f"{b}.npz").exists())
    ids = [b for b in ids if (HERE / "audio" / f"{b}.opus").exists() and not done(b)]

    print(f"{len(ids)} to do", flush=True)
    ok = fail = 0
    with ProcessPoolExecutor(workers) as pool:
        futs = {pool.submit(job, b, hpcp): b for b in ids}
        for fut in as_completed(futs):
            try:
                fut.result()
                ok += 1
            except Exception:  # noqa: BLE001
                fail += 1
                with open(HERE / "features" / "tonic_cache" / "_failures_extract.txt", "a") as f:
                    f.write(f"{futs[fut]}\t{traceback.format_exc(limit=2)!r}\n")
            if (ok + fail) % 25 == 0:
                print(f"{ok + fail}/{len(ids)} ok={ok} fail={fail}", flush=True)
    print(f"done ok={ok} fail={fail}", flush=True)


if __name__ == "__main__":
    main()
