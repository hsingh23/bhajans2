#!/usr/bin/env python3
"""Rhythm feature cache for taal (beat-cycle) classification.

For every accepted recording (box-matches-verified.json first candidate with accept=true)
whose audio/<box_id>.opus exists, writes features/taal_cache/<box_id>.npz with:
  beat_logit, down_logit   Beat This! frame logits (50 fps, float16)
  beats, downbeats         Beat This! minimal-postprocessed positions (s)
  onset, onset_perc        librosa onset strength (mean / median over mel bands;
                           median favours percussive onsets) (sr 22050, hop 256 -> 86.13 fps)
  chroma, mfcc             beat-synchronous chroma (12 x nb) and MFCC (13 x nb)
  duration
Sheet-music songs are processed first. Safe to re-run (skips existing files).
Usage: python taal_extract.py [workers=3] [device=mps]
"""
import json
import os
import sys
import time
import traceback
from multiprocessing import get_context
from pathlib import Path

import numpy as np

HERE = Path(__file__).parent
AUDIO = HERE / "audio"
OUT = HERE / "features" / "taal_cache"
SR = 22050
HOP = 256

_model = None
_post = None


def _init(device):
    global _model, _post
    import torch

    torch.set_num_threads(1)
    from beat_this.inference import Audio2Frames
    from beat_this.model.postprocessor import Postprocessor

    _model = Audio2Frames(checkpoint_path="final0", device=device)
    _post = Postprocessor(type="minimal")


def work(bid):
    out = OUT / f"{bid}.npz"
    if out.exists():
        return bid, "skip"
    import librosa
    import soundfile as sf
    import soxr

    try:
        sig, sr = sf.read(str(AUDIO / f"{bid}.opus"), dtype="float32")
    except Exception:
        sig, sr = librosa.load(str(AUDIO / f"{bid}.opus"), sr=None, mono=True)
    if sig.ndim == 2:
        sig = sig.mean(1)
    if sr != SR:
        sig = soxr.resample(sig, sr, SR)
    sig = sig.astype(np.float32)
    if len(sig) < SR * 10:
        raise ValueError("shorter than 10 s")
    bl, dl = _model(sig, SR)
    beats, downs = _post(bl, dl)
    bl = bl.cpu().numpy().astype(np.float16)
    dl = dl.cpu().numpy().astype(np.float16)

    S = np.abs(librosa.stft(sig, n_fft=2048, hop_length=HOP))
    M = librosa.power_to_db(librosa.feature.melspectrogram(S=S**2, sr=SR, n_mels=96), ref=np.max)
    onset = librosa.onset.onset_strength(S=M, sr=SR, hop_length=HOP)
    # median across bands favours broadband (percussive) onsets; HPSS was 70 s/song
    onset_p = librosa.onset.onset_strength(S=M, sr=SR, hop_length=HOP, aggregate=np.median)
    chroma = librosa.feature.chroma_stft(S=S**2, sr=SR, hop_length=HOP)
    mfcc = librosa.feature.mfcc(S=M, n_mfcc=13)
    bf = np.clip(np.round(np.asarray(beats) * SR / HOP).astype(int), 0, S.shape[1] - 1)
    if len(bf) > 2:
        cs = librosa.util.sync(chroma, bf, aggregate=np.median)
        ms = librosa.util.sync(mfcc, bf, aggregate=np.mean)
    else:
        cs = np.zeros((12, 0)); ms = np.zeros((13, 0))
    tmp = out.with_suffix(".part.npz")
    np.savez_compressed(
        tmp, beat_logit=bl, down_logit=dl,
        beats=np.asarray(beats, np.float32), downbeats=np.asarray(downs, np.float32),
        onset=onset.astype(np.float16), onset_perc=onset_p.astype(np.float16),
        chroma=cs.astype(np.float16), mfcc=ms.astype(np.float16),
        duration=np.float32(len(sig) / SR),
    )
    os.replace(tmp, out)
    return bid, "ok"


def safe(bid):
    try:
        return work(bid)
    except Exception:  # noqa: BLE001
        return bid, "fail " + traceback.format_exc(limit=2).replace("\n", " | ")


def todo():
    bm = json.loads((HERE / "box-matches-verified.json").read_text())
    sheet = json.loads((HERE / "features" / "sheet_meter.json").read_text())
    rub = json.loads((HERE / "rubric.json").read_text())
    pri = []
    for s, c in bm.items():
        if not c or not c[0].get("accept"):
            continue
        bid = c[0]["id"]
        p = 0 if s in sheet else (1 if rub.get(s, {}).get("taal_beats") else 2)
        pri.append((p, bid))
    seen, ids = set(), []
    for p, bid in sorted(pri):
        if bid in seen:
            continue
        seen.add(bid)
        if (AUDIO / f"{bid}.opus").exists() and not (OUT / f"{bid}.npz").exists():
            ids.append(bid)
    return ids


def main():
    workers = int(sys.argv[1]) if len(sys.argv) > 1 else 3
    device = sys.argv[2] if len(sys.argv) > 2 else "mps"
    OUT.mkdir(parents=True, exist_ok=True)
    ids = todo()
    print(f"{len(ids)} to extract", flush=True)
    t0 = time.time()
    ok = fail = 0
    with get_context("spawn").Pool(workers, initializer=_init, initargs=(device,)) as pool:
        for bid, st in pool.imap_unordered(safe, ids):
            if st.startswith("fail"):
                fail += 1
                with open(OUT / "_failures.txt", "a") as f:
                    f.write(f"{bid}\t{st}\n")
            else:
                ok += 1
            if (ok + fail) % 25 == 0:
                print(f"{ok + fail}/{len(ids)} ok={ok} fail={fail} {time.time() - t0:.0f}s", flush=True)
    print(f"done ok={ok} fail={fail} {time.time() - t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
