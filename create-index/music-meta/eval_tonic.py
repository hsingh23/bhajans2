#!/usr/bin/env python3
"""Baseline: Essentia TonicIndianArtMusic vs human shruti (any listed value counts).

Usage: python eval_tonic.py [max_songs]
"""
import json
import math
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

HERE = Path(__file__).parent
PC = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def tonic_pc(path):
    import essentia.standard as es

    audio = es.MonoLoader(filename=str(path), sampleRate=44100)()
    hz = es.TonicIndianArtMusic()(audio)
    return hz, round(12 * math.log2(hz / 261.6256)) % 12


def job(args):
    name, fid, truth = args
    try:
        hz, pc = tonic_pc(HERE / "audio" / f"{fid}.opus")
    except Exception as e:  # noqa: BLE001
        return name, None, None, truth, str(e)
    return name, hz, pc, truth, None


def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 80
    rub = json.loads((HERE / "rubric.json").read_text())
    matches = json.loads((HERE / "box-matches.json").read_text())
    jobs = []
    for name, r in rub.items():
        m = matches.get(name) or []
        if r["shruti_pcs"] and m and m[0]["accept"] and (HERE / "audio" / f"{m[0]['id']}.opus").exists():
            jobs.append((name, m[0]["id"], r["shruti_pcs"]))
    jobs = jobs[:limit]
    with ProcessPoolExecutor(12) as pool:
        res = list(pool.map(job, jobs))
    hit = fifth = n = 0
    for name, hz, pc, truth, err in res:
        if err:
            print("ERR", name, err[:80])
            continue
        n += 1
        ok = pc in truth
        p5 = any((t - pc) % 12 in (5, 7) for t in truth)  # off by a fourth/fifth (Pa or Ma taken as Sa)
        hit += ok
        fifth += (not ok) and p5
        if not ok:
            print(f"MISS {name[:40]:40} got {PC[pc]:3} ({hz:.0f} Hz) truth {[PC[t] for t in truth]}{'  (4th/5th)' if p5 else ''}")
    print(f"\nexact {hit}/{n} = {hit / max(n, 1):.0%}; misses that are a 4th/5th off: {fifth}")


if __name__ == "__main__":
    main()
