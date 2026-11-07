#!/usr/bin/env python3
"""Low-level tonic (shruti) features shared by the tonic scripts.

- analyse_audio(path): Melodia f0 (same settings as extract_audio.py), Essentia
  tonic and two 120-bin HPCP profiles (full band and low band 40-260 Hz, where
  the tanpura/harmonium drone and bass sit). Used for CD samples, and the HPCP
  part for Box recordings (whose f0 already lives in features/audio).
- note_events(f0): stable-note segmentation of an f0 track, giving per-note
  pitch (cents re C4), duration and the silence that follows it, from which we
  get phrase-final notes, long-note histograms and the lowest sustained pitch.

Cache: features/tonic_cache/{box,cd}/<key>.npz
"""
import hashlib
from pathlib import Path

import numpy as np

HERE = Path(__file__).parent
CACHE = HERE / "features" / "tonic_cache"
SR = 16000
C4 = 261.6256


def url_key(url):
    return hashlib.md5(url.encode()).hexdigest()[:16]


def hpcp_profiles(a, f0=None, sr=SR):
    """Energy-weighted mean HPCP (120 bins, bin 0 = C): full band, low band (40-260 Hz)
    and, when an f0 track (10 ms hop) is given, full band over frames where the
    melody is silent (accompaniment / drone only)."""
    import essentia.standard as es

    w = es.Windowing(type="blackmanharris62")
    spec = es.Spectrum()
    frames = [spec(w(fr)) for fr in es.FrameGenerator(a, frameSize=4096, hopSize=2048, startFromZero=True)]
    unv = None
    if f0 is not None:
        v = np.asarray(f0) > 0
        unv = []
        for k in range(len(frames)):
            lo, hi = k * 2048 // 160, (k * 2048 + 4096) // 160
            seg = v[lo:hi]
            unv.append(len(seg) > 0 and seg.mean() < 0.1)
    out = {}
    for name, lo, hi in (("hpcp", 60, 5000), ("hpcp_low", 40, 260)):
        peaks = es.SpectralPeaks(sampleRate=sr, minFrequency=lo, maxFrequency=hi,
                                 magnitudeThreshold=1e-5, maxPeaks=60, orderBy="magnitude")
        hp = es.HPCP(size=120, referenceFrequency=C4, sampleRate=sr, minFrequency=lo,
                     maxFrequency=hi, normalized="none", weightType="cosine", harmonics=0 if name == "hpcp_low" else 4,
                     nonLinear=False, windowSize=1.0, bandPreset=False)
        acc = np.zeros(120)
        acc_u = np.zeros(120)
        for k, sp in enumerate(frames):
            f, m = peaks(sp)
            if len(f):
                h = hp(f, m)
                acc += h
                if unv is not None and unv[k]:
                    acc_u += h
        out[name] = (acc / max(acc.sum(), 1e-9)).astype(np.float32)
        if name == "hpcp" and unv is not None:
            out["hpcp_unv"] = (acc_u / max(acc_u.sum(), 1e-9)).astype(np.float32)
            out["unv_frac"] = np.float32(np.mean(unv)) if unv else np.float32(0)
    return out


def analyse_audio(path, f0=None):
    """Features for one audio file; pass an existing f0 track to skip Melodia and the tonic."""
    import essentia.standard as es

    a44 = es.MonoLoader(filename=str(path), sampleRate=44100)()
    a = es.Resample(inputSampleRate=44100, outputSampleRate=SR, quality=1)(a44)
    if len(a) < SR * 5:
        raise ValueError("shorter than 5 s")
    res = {}
    if f0 is None:
        eq = es.EqualLoudness(sampleRate=SR)(a)
        f0, _ = es.PredominantPitchMelodia(
            sampleRate=SR, frameSize=1024, hopSize=160, minFrequency=70, maxFrequency=1100
        )(eq)
        res["f0"] = np.asarray(f0, np.float32)
        try:
            res["tonic_hz"] = np.float32(es.TonicIndianArtMusic()(a44))
        except Exception:  # noqa: BLE001
            res["tonic_hz"] = np.float32(0)
        res["duration"] = np.float32(len(a) / SR)
    res.update(hpcp_profiles(a, f0))
    return res


def note_events(f0, hop=0.01, max_dev=35.0, min_dur=0.12):
    """Greedy stable-note segmentation. Returns array rows (cents, dur_s, gap_after_s)."""
    f0 = np.asarray(f0, float)
    voiced = f0 > 0
    c = np.zeros_like(f0)
    c[voiced] = 1200 * np.log2(f0[voiced] / C4)
    notes = []
    i, n = 0, len(f0)
    while i < n:
        if not voiced[i]:
            i += 1
            continue
        j = i
        ref = c[i]
        s = 0.0
        while j < n and voiced[j] and abs(c[j] - ref) < max_dev:
            s += c[j]
            j += 1
            ref = s / (j - i)
        dur = (j - i) * hop
        if dur >= min_dur:
            notes.append([ref, dur, j])
        i = j if j > i else i + 1
    if not notes:
        return np.zeros((0, 3))
    arr = np.array(notes, float)
    # silence after each note: unvoiced run from its end to the next voiced frame
    vidx = np.flatnonzero(voiced)
    gaps = []
    for end in arr[:, 2].astype(int):
        k = np.searchsorted(vidx, end)
        gaps.append(((vidx[k] - end) if k < len(vidx) else 300) * hop)
    arr[:, 2] = gaps
    return arr
