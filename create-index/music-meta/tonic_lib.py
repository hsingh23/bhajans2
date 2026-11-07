"""Tonic (Sa) estimation: recording loading, per-recording pitch-class vectors,
sheet-template matching and per-candidate features for the 12-way ranker.

Every vector is a 12-bin pitch-class profile with bin 0 = C (absolute). For a
candidate tonic k the vectors are rotated so bin 0 = the candidate Sa, then
concatenated; a linear model over that is a set of learned Sa-relative templates.
"""
import json
from pathlib import Path

import numpy as np

import pitch
from tonic_feats import CACHE, note_events, url_key

HERE = Path(__file__).parent
# verified Box mapping (falls back to the raw matcher output)
MATCHES = "box-matches-verified.json" if (HERE / "box-matches-verified.json").exists() else "box-matches.json"
PC = pitch.PC
KATTAI = {0: "1", 1: "1.5", 2: "2", 3: "2.5", 4: "3", 5: "4", 6: "4.5", 7: "5", 8: "5.5", 9: "6", 10: "6.5", 11: "7"}

# ---------------------------------------------------------------- scales
def _melakartas():
    """The 72 melakarta scales as pitch-class sets relative to Sa."""
    ri_ga = [(1, 2), (1, 3), (1, 4), (2, 3), (2, 4), (3, 4)]
    da_ni = [(8, 9), (8, 10), (8, 11), (9, 10), (9, 11), (10, 11)]
    out = []
    for ma in (5, 6):
        for r, g in ri_ga:
            for d, n in da_ni:
                out.append(frozenset({0, r, g, ma, 7, d, n}))
    return out


PENTA = {  # common audava / shadava ragas used in bhajans
    "mohanam": {0, 2, 4, 7, 9}, "hindolam": {0, 3, 5, 8, 10}, "shivaranjani": {0, 2, 3, 7, 9},
    "madhyamavati": {0, 2, 5, 7, 10}, "shuddha_saveri": {0, 2, 5, 7, 9}, "abhogi": {0, 2, 3, 5, 9},
    "hamsadhwani": {0, 2, 4, 7, 11}, "revati": {0, 1, 5, 7, 10}, "megh": {0, 2, 5, 7, 10},
    "sindhu_bhairavi_core": {0, 2, 3, 5, 7, 8, 10}, "kalyani_core": {0, 2, 4, 6, 7, 9, 11},
    "sriranjani": {0, 2, 3, 5, 9, 10}, "kafi_like": {0, 2, 3, 5, 7, 9, 10},
    "chandrakauns": {0, 3, 5, 8, 11}, "bhupal_todi": {0, 1, 3, 7, 8}, "vasanta": {0, 1, 4, 5, 9, 11},
    "durga": {0, 2, 5, 7, 9}, "malkauns": {0, 3, 5, 8, 10}, "hamsanandi": {0, 1, 4, 6, 9, 11},
}


def _scales():
    mela = _melakartas()
    penta = [frozenset(s) for s in PENTA.values()]
    p = HERE / "reference" / "ragas.json"
    if p.exists():  # raga table from the raga worker: janya / Hindustani scales by "pcs"
        try:
            data = json.loads(p.read_text())
            items = data.values() if isinstance(data, dict) else data
            for it in items:
                if not isinstance(it, dict) or it.get("melakarta"):
                    continue  # melakartas are already in MELA; keep janya / Hindustani scales
                pcs = it.get("pcs") or it.get("scale_pcs") or it.get("arohana_pcs")
                if pcs and 0 in pcs:
                    penta.append(frozenset(int(x) % 12 for x in pcs))
        except Exception:  # noqa: BLE001
            pass
    return mela, penta


MELA, OTHER_SCALES = _scales()


def _scale_masks(scales):
    m = np.zeros((len(scales), 12))
    for i, s in enumerate(scales):
        m[i, list(s)] = 1
    return m


MELA_M, OTHER_M = _scale_masks(MELA), _scale_masks(OTHER_SCALES)


def scale_fit(h_rot, masks):
    """Best fit of a Sa-relative histogram to a scale table: mass inside minus mass
    outside, minus a small penalty per scale note that is (nearly) absent."""
    inside = masks @ h_rot
    missing = masks @ (h_rot < 0.015).astype(float)
    return float(np.max(2 * inside - 1 - 0.04 * missing))


# ---------------------------------------------------------------- loading
def load_box(bid):
    """Recording dict (f0, tonic_hz, hpcp, hpcp_low may be None) or None if no f0 yet."""
    d = pitch.load(bid)
    c = CACHE / "box" / f"{bid}.npz"
    extra = dict(np.load(c)) if c.exists() else {}
    if d is None:
        if "f0" not in extra:
            return None
        d = extra
    rec = {"f0": d["f0"], "tonic_hz": float(d.get("tonic_hz", 0) or 0),
           "hpcp": extra.get("hpcp"), "hpcp_low": extra.get("hpcp_low"), "hpcp_unv": extra.get("hpcp_unv")}
    return rec


def load_cd(url):
    c = CACHE / "cd" / f"{url_key(url)}.npz"
    if not c.exists():
        return None
    d = dict(np.load(c))
    return {"f0": d["f0"], "tonic_hz": float(d["tonic_hz"]), "hpcp": d["hpcp"], "hpcp_low": d["hpcp_low"],
            "hpcp_unv": d.get("hpcp_unv")}


def load(source):
    kind, key = source.split(":", 1)
    return load_box(key) if kind == "box" else load_cd(key)


# ---------------------------------------------------------------- vectors
def _norm(v):
    v = np.asarray(v, float)
    s = v.sum()
    return v / s if s > 0 else v


def _fold120(h, off):
    pcs = np.round((np.arange(120) * 10 - off) / 100).astype(int) % 12
    return _norm(np.bincount(pcs, weights=np.asarray(h, float), minlength=12))


VEC_NAMES = ["H", "L", "F", "E", "LAST", "LOW", "LOWH", "ESS", "D", "P", "U"]


def rec_vectors(rec):
    """Absolute (C=0) 12-bin vectors for one recording, or None if too little pitch."""
    f0 = rec["f0"]
    if (f0 > 0).sum() < 500:
        return None
    H, off = pitch.pc_hist(f0)
    nt = note_events(f0)
    out = {"H": H, "off": off}
    if len(nt) < 10:
        return None
    cents, dur, gap = nt[:, 0], nt[:, 1], nt[:, 2]
    pcs = np.round((cents - off) / 100).astype(int) % 12

    def hist(mask, w):
        return _norm(np.bincount(pcs[mask], weights=w[mask], minlength=12))

    out["L"] = hist(dur >= 0.35, dur)
    fw = np.minimum(dur, 1.5)
    out["F"] = hist(gap >= 0.5, fw)
    # song-final notes: phrase-final notes in the last 15% of the voiced material
    n = len(nt)
    tail = np.zeros(n, bool)
    tail[int(n * 0.85):] = True
    out["E"] = hist(tail & (gap >= 0.3), fw)
    last = np.zeros(12)
    held = np.flatnonzero(dur >= 0.3)
    if len(held):
        last[pcs[held[-1]]] = 1
    out["LAST"] = last
    sus = dur >= 0.25
    if sus.sum() >= 5:
        lo = np.percentile(cents[sus], 4)
        low = np.zeros(12)
        low[int(np.round((lo - off) / 100)) % 12] = 1
        out["LOW"] = low
        out["LOWH"] = hist(sus & (cents <= lo + 150), dur)
    else:
        out["LOW"] = np.zeros(12)
        out["LOWH"] = np.zeros(12)
    ess = np.zeros(12)
    if rec["tonic_hz"] and rec["tonic_hz"] > 0:
        c = 1200 * np.log2(rec["tonic_hz"] / pitch.C4)
        ess[int(np.round((c - off) / 100)) % 12] = 1
    out["ESS"] = ess
    out["D"] = _fold120(rec["hpcp_low"], off) if rec.get("hpcp_low") is not None else np.zeros(12)
    out["P"] = _fold120(rec["hpcp"], off) if rec.get("hpcp") is not None else np.zeros(12)
    out["U"] = _fold120(rec["hpcp_unv"], off) if rec.get("hpcp_unv") is not None else np.zeros(12)
    out["has_hpcp"] = rec.get("hpcp") is not None
    return out


def candidate_matrix(vec):
    """(12, D) feature matrix: row k = features for candidate Sa = pitch class k."""
    rows = []
    for k in range(12):
        parts = [np.roll(vec[nm], -k) for nm in VEC_NAMES]
        h = parts[0]
        extra = [scale_fit(h, MELA_M), scale_fit(h, OTHER_M)]
        rows.append(np.concatenate(parts + [np.array(extra)]))
    return np.array(rows)


FEATURE_NAMES = [f"{nm}[{i}]" for nm in VEC_NAMES for i in range(12)] + ["mela_fit", "other_fit"]


def sheet_sa():
    """features/sheet_sa.json (sheet_sa.py): where Sa sits relative to the PDF key root."""
    p = HERE / "features" / "sheet_sa.json"
    return json.loads(p.read_text()) if p.exists() else {}


TRUSTED = {"trusted", "trusted-unique"}


def sheet_trust():
    """features/sheet_trust.json (sheet_trust.py): is the linked PDF really this song?"""
    p = HERE / "features" / "sheet_trust.json"
    return {k: v.get("trust") for k, v in json.loads(p.read_text()).items()} if p.exists() else {}


def template(H, sheet_hist):
    """[(corr, pc)] best first (pitch.template_tonic) plus corr and margin."""
    t = pitch.template_tonic(H, sheet_hist)
    return t, t[0][0], t[0][0] - t[1][0]


def signed(d):
    d = int(d) % 12
    return d - 12 if d > 6 else d


def err_type(pred, truth):
    d = (pred - truth) % 12
    if d == 0:
        return "ok"
    if d == 7:
        return "Pa-as-Sa"  # predicted the truth's Pa (a fifth up)
    if d == 5:
        return "Ma-as-Sa"  # predicted the truth's Ma (a fourth up)
    if d in (1, 11):
        return "semitone"
    return f"other({signed(d):+d})"
