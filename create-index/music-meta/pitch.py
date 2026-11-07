"""Shared pitch helpers: load a recording's features and fold its melody into pitch classes."""
import math
from pathlib import Path

import numpy as np

HERE = Path(__file__).parent
FEAT = HERE / "features" / "audio"
PC = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
C4 = 261.6256


def load(box_id):
    p = FEAT / f"{box_id}.npz"
    return dict(np.load(p)) if p.exists() else None


def cents(f0):
    v = f0[f0 > 0]
    return 1200 * np.log2(v / C4)


def tuning_offset(c):
    """Global tuning offset in cents (-50..50): where the recording's semitone grid sits vs A440."""
    ang = 2 * np.pi * (c % 100) / 100
    return float(np.angle(np.mean(np.exp(1j * ang))) * 100 / (2 * np.pi))


def pc_hist(f0, offset=None):
    """12-bin pitch-class histogram (C..B) of voiced frames, tuning-corrected, normalised."""
    c = cents(f0)
    if len(c) == 0:
        return np.zeros(12), 0.0
    off = tuning_offset(c) if offset is None else offset
    h = np.bincount(np.round((c - off) / 100).astype(int) % 12, minlength=12).astype(float)
    return h / h.sum(), off


def fine_hist(f0, offset=0.0, res=10):
    """Folded cents histogram (1200/res bins) relative to C, after removing the tuning offset."""
    c = cents(f0) - offset
    n = 1200 // res
    h = np.bincount(np.round(c / res).astype(int) % n, minlength=n).astype(float)
    return h / max(h.sum(), 1)


def hz_to_pc(hz):
    return round(12 * math.log2(hz / C4)) % 12


def template_tonic(audio_hist, sheet_hist):
    """Rotate the sheet's Sa-relative histogram over 12 keys; return [(corr, tonic_pc)] best first."""
    a = np.asarray(audio_hist, float)
    s = np.asarray(sheet_hist, float)
    out = []
    for k in range(12):
        r = np.roll(s, k)
        out.append((float(np.corrcoef(r, a)[0, 1]) if a.std() > 0 else 0.0, k))
    return sorted(out, reverse=True)
