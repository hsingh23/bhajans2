#!/usr/bin/env python3
"""Extract reusable audio features for every cached recording (audio/<box_id>.opus).

Writes features/audio/<box_id>.npz with:
  f0        predominant-melody pitch in Hz, 10 ms hop (0 = unvoiced), float32
  tonic_hz  Essentia TonicIndianArtMusic estimate
  bpm, beats (s), onset (onset-strength envelope, 100 Hz), duration
Safe to re-run; existing outputs are skipped. Usage: python extract_audio.py [workers]
"""
import sys
import traceback
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

import numpy as np

HERE = Path(__file__).parent
AUDIO = HERE / "audio"
OUT = HERE / "features" / "audio"
SR = 16000


def extract(path):
    out = OUT / f"{path.stem}.npz"
    if out.exists():
        return "skip"
    import essentia.standard as es

    a44 = es.MonoLoader(filename=str(path), sampleRate=44100)()
    a = es.Resample(inputSampleRate=44100, outputSampleRate=SR, quality=1)(a44)
    if len(a) < SR * 5:
        raise ValueError("shorter than 5 s")
    eq = es.EqualLoudness(sampleRate=SR)(a)
    f0, _ = es.PredominantPitchMelodia(
        sampleRate=SR, frameSize=1024, hopSize=160, minFrequency=70, maxFrequency=1100
    )(eq)
    tonic = es.TonicIndianArtMusic()(a44)
    bpm, beats, _, _, _ = es.RhythmExtractor2013(method="degara")(a44)
    # onset-strength envelope at 100 Hz (spectral flux), for meter analysis
    w = es.Windowing(type="hann")
    spec = es.Spectrum()
    flux = es.Flux()
    env = [flux(spec(w(fr))) for fr in es.FrameGenerator(a, frameSize=1024, hopSize=160)]
    tmp = out.with_suffix(".part.npz")
    np.savez_compressed(
        tmp, f0=np.asarray(f0, np.float32), tonic_hz=np.float32(tonic), bpm=np.float32(bpm),
        beats=np.asarray(beats, np.float32), onset=np.asarray(env, np.float16),
        duration=np.float32(len(a) / SR),
    )
    tmp.rename(out)
    return "ok"


def main():
    workers = int(sys.argv[1]) if len(sys.argv) > 1 else 12
    OUT.mkdir(parents=True, exist_ok=True)
    only = set(Path(sys.argv[2]).read_text().split()) if len(sys.argv) > 2 else None
    files = sorted(p for p in AUDIO.glob("*.opus") if not p.name.endswith(".part.opus"))
    if only is not None:
        files = [p for p in files if p.stem in only]
    files = [p for p in files if not (OUT / f"{p.stem}.npz").exists()]
    print(f"{len(files)} to extract", flush=True)
    ok = fail = 0
    with ProcessPoolExecutor(workers) as pool:
        futs = {pool.submit(extract, p): p for p in files}
        for fut in as_completed(futs):
            try:
                fut.result()
                ok += 1
            except Exception:  # noqa: BLE001
                fail += 1
                with open(OUT / "_failures.txt", "a") as f:
                    f.write(f"{futs[fut].stem}\t{traceback.format_exc(limit=1)!r}\n")
            if (ok + fail) % 50 == 0:
                print(f"{ok + fail}/{len(files)} ok={ok} fail={fail}", flush=True)
    print(f"done ok={ok} fail={fail}")


if __name__ == "__main__":
    main()
