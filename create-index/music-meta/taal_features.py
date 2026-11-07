#!/usr/bin/env python3
"""Turn a features/taal_cache/<box_id>.npz into a flat rhythm feature vector.

Everything is measured relative to the Beat This! beat period T (median inter-beat
interval), so the features describe *ratios*: how strongly the music repeats every
2,3,4,5,6,7,8 beats, and whether one beat is split in 2 or in 3.
"""
import numpy as np

FPS_B = 50.0  # Beat This! logits
FPS_O = 22050 / 256  # librosa onset envelope
LAGS = list(range(1, 17))
FRACS = {"q1": 1 / 4, "t1": 1 / 3, "h": 1 / 2, "t2": 2 / 3, "q3": 3 / 4}
CYCLES = [2, 3, 4, 5, 6, 7, 8]
VERSION = 2


def _sig(x):
    return 1 / (1 + np.exp(-x))


def _accent(env, fps, beats, half=0.05):
    w = max(1, int(round(half * fps)))
    idx = np.round(beats * fps).astype(int)
    out = np.empty(len(idx))
    for k, i in enumerate(idx):
        seg = env[max(0, i - w): i + w + 1]
        out[k] = seg.max() if len(seg) else 0.0
    return out


def _seq_ac(x, lags):
    """Normalised autocorrelation of a beat-synchronous sequence at integer lags."""
    x = np.asarray(x, float)
    x = (x - x.mean()) / (x.std() + 1e-9)
    n = len(x)
    return np.array([np.mean(x[:-L] * x[L:]) if n > L + 8 else 0.0 for L in lags])


def _seq_sim(M, lags):
    """Mean cosine similarity of beat-synchronous vectors L beats apart."""
    M = np.asarray(M, float)
    M = M - M.mean(1, keepdims=True)
    M = M / (np.linalg.norm(M, axis=0, keepdims=True) + 1e-9)
    n = M.shape[1]
    return np.array([np.mean(np.sum(M[:, :-L] * M[:, L:], 0)) if n > L + 8 else 0.0 for L in lags])


def _fold_contrast(x, L, win=None):
    """How unequal the L metric positions are (windowed so a dropped beat only hurts locally)."""
    x = np.asarray(x, float)
    win = win or 4 * L
    vals = []
    for s in range(0, len(x) - win + 1, L * 2):
        seg = x[s: s + win]
        seg = (seg - seg.mean()) / (seg.std() + 1e-9)
        prof = seg[: (len(seg) // L) * L].reshape(-1, L).mean(0)
        vals.append(prof.max() - np.median(prof))
    return float(np.mean(vals)) if vals else 0.0


def _profile(env, fps, beats, span=1, nb=24):
    """Average onset envelope across `span` beats, resampled to nb bins (start at a beat)."""
    t = np.arange(len(env)) / fps
    rows = []
    for i in range(0, len(beats) - span, span):
        a, b = beats[i], beats[i + span]
        if b - a <= 0:
            continue
        grid = a + (b - a) * np.arange(nb) / nb
        rows.append(np.interp(grid, t, env))
    if not rows:
        return np.ones(nb)
    p = np.mean(np.array(rows), 0)  # median zeroes the sparse off-beat onsets
    p = p - p.min()
    return p / (p.max() + 1e-9)


def _env_ac(env, fps, T, mults, win_s=24.0):
    """Windowed onset-envelope autocorrelation at m*T (local max within +-4%)."""
    env = np.asarray(env, float)
    n = int(win_s * fps)
    hop = n // 2
    out = []
    for s in range(0, max(1, len(env) - n), hop):
        seg = env[s: s + n]
        if len(seg) < n // 2:
            break
        seg = seg - seg.mean()
        f = np.fft.rfft(seg, 2 * len(seg))
        ac = np.fft.irfft(f * np.conj(f))[: len(seg)]
        ac = ac / (ac[0] + 1e-9)
        row = []
        for m in mults:
            c = m * T * fps
            lo, hi = int(np.floor(c * 0.96)) - 1, int(np.ceil(c * 1.04)) + 1
            row.append(ac[max(lo, 1): min(hi, len(ac) - 1) + 1].max() if lo < len(ac) - 1 else 0.0)
        out.append(row)
    return np.mean(out, 0) if out else np.zeros(len(mults))


def features(d):
    beats = np.asarray(d["beats"], float)
    downs = np.asarray(d["downbeats"], float)
    f = {}
    if len(beats) < 24:
        return None
    ibi = np.diff(beats)
    T = float(np.median(ibi))
    f["bpm"] = 60 / T
    f["log_bpm"] = np.log2(60 / T)
    f["ibi_cv"] = float(np.std(ibi) / T)
    f["ibi_iqr"] = float(np.subtract(*np.percentile(ibi, [75, 25])) / T)
    f["beats_per_min_of_audio"] = len(beats) / float(d["duration"]) * 60

    # Beat This! own bar guess: beats between successive downbeats
    if len(downs) > 3:
        bi = np.searchsorted(beats, downs - 0.02)
        nb = np.diff(bi)
        for k in (2, 3, 4):
            f[f"bt_bar{k}"] = float(np.mean(nb == k))
        f["bt_bar_other"] = float(np.mean((nb < 2) | (nb > 4)))
    else:
        f.update(bt_bar2=0.0, bt_bar3=0.0, bt_bar4=0.0, bt_bar_other=1.0)

    bl = _sig(np.asarray(d["beat_logit"], float))
    dl = _sig(np.asarray(d["down_logit"], float))
    on = np.asarray(d["onset"], float)
    op = np.asarray(d["onset_perc"], float)
    seqs = {
        "db": _accent(dl, FPS_B, beats),
        "on": _accent(on, FPS_O, beats),
        "op": _accent(op, FPS_O, beats),
        "bl": _accent(bl, FPS_B, beats),
    }
    # beat-level energy between beats: is the off-beat loud?
    for name, x in seqs.items():
        ac = _seq_ac(x, LAGS)
        for L, v in zip(LAGS, ac):
            f[f"ac_{name}_{L}"] = v
        for L in CYCLES:
            f[f"fold_{name}_{L}"] = _fold_contrast(x, L)
    for name in ("chroma", "mfcc"):
        M = np.asarray(d[name], float)
        if M.shape[1] > 30:
            M = M[:, : len(beats)]
            sim = _seq_sim(M, LAGS)
            base = sim.mean()
            for L, v in zip(LAGS, sim):
                f[f"sim_{name}_{L}"] = v - base
        else:
            for L in LAGS:
                f[f"sim_{name}_{L}"] = 0.0

    # subdivision: average onset profile inside one beat, two beats and three beats
    for env, en in ((on, "on"), (op, "op")):
        for span in (1, 2, 3):
            p = _profile(env, FPS_O, beats, span=span, nb=24 * span)
            nbins = len(p)
            for fk, fr in FRACS.items():
                # positions inside each beat of the span
                vals = []
                for j in range(span):
                    c = int(round((j + fr) * 24))
                    vals.append(p[max(0, c - 1): c + 2].max())
                f[f"prof{span}_{en}_{fk}"] = float(np.mean(vals))
            if span > 1:
                f[f"prof{span}_{en}_beatvar"] = float(np.std([p[j * 24] for j in range(span)]))
            _ = nbins
        f[f"trip_{en}"] = (f[f"prof1_{en}_t1"] + f[f"prof1_{en}_t2"]) / 2 - f[f"prof1_{en}_h"]
        f[f"quad_{en}"] = (f[f"prof1_{en}_q1"] + f[f"prof1_{en}_q3"]) / 2 - (f[f"prof1_{en}_t1"] + f[f"prof1_{en}_t2"]) / 2

    mults = [1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4, 1, 3 / 2, 2, 3, 4, 5, 6, 7, 8]
    for env, en in ((op, "op"), (dl, "dl")):
        fps = FPS_O if en == "op" else FPS_B
        ac = _env_ac(env, fps, T, mults)
        base = ac[mults.index(1)] + 1e-6
        for m, v in zip(mults, ac):
            f[f"eac_{en}_{m:.3f}"] = v / base
    return f
