#!/usr/bin/env python3
"""Taal conflicts: run the app's own taal classifier on Layamritam's recordings.

For every taal conflict row (rows.json) and every Layamritam recording it names that we
have audio for:
  1. transcode to 24 kHz mono Opus (the training audio's format) -> work/lay_audio/
  2. Beat This! + onset cache via music-meta/taal_extract.work -> work/lay_taal_cache/
  3. features + the final Ensemble trained on the trusted-sheet recordings -> class probs
  4. is it the same recording as our Box one? (cross-correlation of 20 s windows)
Writes taal_lay.json. Run with music-meta/.venv/bin/python from the repo root.
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).parent
ROOT = HERE.parent.parent.parent
MM = ROOT / "create-index" / "music-meta"
sys.path.insert(0, str(MM))
import taal_extract as te  # noqa: E402
import taal_features as tf  # noqa: E402
import taal_model as tm  # noqa: E402

WORK = HERE / "work"
LA = WORK / "lay_audio"
LC = WORK / "lay_taal_cache"
DUMP = ROOT / "layamritam" / "audio"


def opus(src, dst):
    if not dst.exists():
        subprocess.run(["ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-i", str(src), "-ac", "1", "-ar", "24000",
                        "-c:a", "libopus", "-b:a", "48k", str(dst)], check=True)


def pcm(path, sr=8000, start=0, dur=None):
    cmd = ["ffmpeg", "-nostdin", "-loglevel", "error", "-ss", str(start)] + (["-t", str(dur)] if dur else []) + [
        "-i", str(path), "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"]
    return np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, np.float32)


def same_score(a_path, b_path):
    """Best normalised cross-correlation of 20 s of a (from 30 s) anywhere in b's first 4 min (onset envelopes)."""
    import librosa
    a = pcm(a_path, start=30, dur=20)
    b = pcm(b_path, dur=240)
    if len(a) < 8000 * 10 or len(b) < len(a):
        return None
    ea = librosa.onset.onset_strength(y=a, sr=8000, hop_length=80)
    eb = librosa.onset.onset_strength(y=b, sr=8000, hop_length=80)
    ea = (ea - ea.mean()) / (ea.std() + 1e-9)
    best = 0.0
    n = len(ea)
    for i in range(0, len(eb) - n, 2):
        w = eb[i:i + n]
        s = float(np.dot(ea, (w - w.mean()) / (w.std() + 1e-9)) / n)
        best = max(best, s)
    return round(best, 3)


def main():
    rows = [r for r in json.loads((HERE / "rows.json").read_text()) if r["field"] == "taal"]
    LA.mkdir(parents=True, exist_ok=True)
    LC.mkdir(parents=True, exist_ok=True)
    te.AUDIO, te.OUT = LA, LC
    te._init("mps")
    jobs = []
    for r in rows:
        for l in r["lay"]:
            if l["audio"]:
                bid = f"lay{l['songId']}"
                opus(DUMP / l["audio"], LA / f"{bid}.opus")
                print(te.safe(bid))
                jobs.append((r["song"], l["songId"], bid))
    # model: trained exactly like taal_model final (all trusted-sheet recordings)
    acc, sheet, rub, songs, feats, keys = tm.dataset()
    trows = tm.train_rows(acc, sheet, songs, feats)
    X = np.array([[feats[b][k] for k in keys] for _, b, _, _ in trows])
    y = np.array([g for *_, g, _ in trows])
    model = tm.Ensemble().fit(X, y)
    taal = json.loads((MM / "features" / "taal.json").read_text())
    out = {}
    for song, sid, bid in jobs:
        try:
            f = tf.features(np.load(LC / f"{bid}.npz"))
        except Exception as e:  # noqa: BLE001
            print("feat fail", bid, e)
            continue
        P = tm.full_proba(model, np.array([[f[k] for k in keys]]))
        C = tm.to_class_probs(P, tm.GROUPS)[0]
        app = taal.get(song, {})
        box = acc.get(song, {})
        same = None
        if box.get("id") and (MM / "audio" / f"{box['id']}.opus").exists():
            same = same_score(LA / f"{bid}.opus", MM / "audio" / f"{box['id']}.opus")
        out.setdefault(song, []).append({
            "songId": sid, "lay_pred": {str(c): round(float(p), 3) for c, p in zip(tm.CLASSES, C)},
            "lay_pred_class": int(tm.CLASSES[int(C.argmax())]), "lay_bpm": round(float(f["bpm"]), 1),
            "same_recording_score": same, "box_folder": box.get("folder"), "box_id": box.get("id"),
        })
        print(song, sid, out[song][-1]["lay_pred_class"], round(float(C.max()), 2), "app", app.get("beats_class"), "same", same)
    (HERE / "taal_lay.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
