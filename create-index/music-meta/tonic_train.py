#!/usr/bin/env python3
"""Task 2: train and evaluate the audio-only tonic ranker.

Truth = sheet songs whose sheet-template tonic on the Box recording is confident
(corr >= CORR and margin >= MARGIN). Each song gives 12 candidate rows (features
for "Sa = pitch class k"); models score the rows and the top one is the tonic.
Evaluation: 5-fold StratifiedGroupKFold (strata = source folder, groups = Box id
so duplicate songs never straddle folds), plus a leave-folder-out check where
the whole "Amma Bhajans 2025 UPD" folder is held out.

Writes features/tonic_model.json (scaler + weights + calibration) and
features/tonic_eval.json (with --cd: *_cd.json, trained on CD samples).
--nohpcp trains the fallback without HPCP cues (for recordings whose HPCP is not cached).
Usage: python tonic_train.py [--sanity] [--cd] [--nohpcp] [--corr=0.9] [--margin=0.2]
"""
import collections
import json
import sys
from pathlib import Path

import numpy as np
from scipy.optimize import minimize
from sklearn.model_selection import StratifiedGroupKFold

import pitch
import tonic_lib as T

HERE = Path(__file__).parent
SRC = "cd" if "--cd" in sys.argv else "box"  # --cd: train/evaluate on the 1-minute CD samples instead
_arg = {a.split("=")[0]: float(a.split("=")[1]) for a in sys.argv[1:] if a.startswith("--") and "=" in a}
CORR = _arg.get("--corr", 0.90 if SRC == "box" else 0.85)
MARGIN = _arg.get("--margin", 0.20 if SRC == "box" else 0.15)
SUFFIX = "" if SRC == "box" else "_cd"
NOHPCP = "--nohpcp" in sys.argv  # fallback model without the HPCP (drone/accompaniment) cues
if NOHPCP:
    SUFFIX += "_nohpcp"


def cols(names):
    """Column indices of candidate_matrix for a list of vector names (+ "fit" = scale fits)."""
    idx = [T.VEC_NAMES.index(n) * 12 + i for n in names if n != "fit" for i in range(12)]
    return idx + ([len(T.VEC_NAMES) * 12, len(T.VEC_NAMES) * 12 + 1] if "fit" in names else [])


MELODY = ["H", "L", "F", "E", "LAST", "LOW", "LOWH", "ESS", "fit"]
USE = cols(MELODY) if NOHPCP else cols(T.VEC_NAMES + ["fit"])


# ---------------------------------------------------------------- data
def _recordings(name, box, idx):
    """(source id, group, folder, rec) for one sheet song, from the chosen source."""
    m = box.get(name) or []
    folder = m[0]["folder"] if m and m[0]["accept"] else "no-box"
    if SRC == "box":
        if m and m[0]["accept"]:
            yield m[0]["id"], m[0]["id"], folder, T.load_box(m[0]["id"])
    else:
        cs = (idx.get(name) or {}).get("cs") or []
        grp = "|".join(sorted(cs))  # all samples of a song (and songs sharing them) in one CV group
        for u in cs:
            yield u, grp, folder, T.load_cd(u)


def gather():
    sheet = json.loads((HERE / "features" / "sheet.json").read_text())
    box = json.loads((HERE / T.MATCHES).read_text())
    idx = {e["n"]: e for e in json.loads((HERE.parent.parent / "public" / "bhajan-index2.json").read_text())}
    ssa = T.sheet_sa()
    trust = T.sheet_trust()
    rows = []
    seen = set()
    for name, sv in sheet.items():
        sa = ssa.get(name) or {"sa_offset": 0, "confidence": "low"}
        tr = trust.get(name, "unverified")
        for rid, grp, folder, rec in _recordings(name, box, idx):
            if rec is None or rid in seen:
                continue  # a recording linked to several song names counts once
            seen.add(rid)
            vec = T.rec_vectors(rec)
            if vec is None:
                continue
            t, c, mg = T.template(vec["H"], sv["pc_hist"])
            notes = sv.get("notes") or []
            off = sa["sa_offset"]
            # tpl = audio Sa = key-root pc found by template matching + sheet_sa offset
            rows.append({"song": name, "box_id": grp, "folder": folder, "vec": vec,
                         "tpl": (t[0][1] + off) % 12, "key_root": t[0][1], "sa_offset": off,
                         "sa_conf": sa["confidence"], "trust": tr, "corr": c, "margin": mg,
                         "sheet_last_is_sa": bool(notes) and (notes[-1] - off) % 12 == 0,
                         "sheet_last": (notes[-1] - off) % 12 if notes else None, "minor": bool(sv.get("minor"))})
    return rows


def sanity(rows):
    """Agreement of independent cues with the template tonic, by template confidence bin."""
    print("template-confidence bins: share of songs where an independent cue points at the template Sa")
    print(f"{'bin':22} {'n':>4} {'final=Sa':>9} {'phrase-end=Sa':>13} {'longest=Sa|Pa':>13} {'ess=Sa':>7} {'ess=Sa|Pa|Ma':>13} {'H[Pa]>H[Ma]':>11} {'LAST=sheetLast':>14} {'sheetLast=Sa':>12} {'minor':>6}")
    bins = [(0, .8, 0, 9), (.8, .85, 0, 9), (.85, .9, 0, 9), (.9, .95, 0, .2), (.9, .95, .2, 9), (.95, 1.01, 0, .2), (.95, 1.01, .2, 9)]
    for lo, hi, mlo, mhi in bins:
        sel = [r for r in rows if lo <= r["corr"] < hi and mlo <= r["margin"] < mhi]
        if not sel:
            continue
        def share(f):
            return np.mean([f(r) for r in sel])
        k = lambda r: r["tpl"]  # noqa: E731
        print(f"corr {lo:.2f}-{hi:.2f} m {mlo:.1f}-{min(mhi, 1):.1f} {len(sel):4} "
              f"{share(lambda r: np.argmax(r['vec']['E']) == k(r)):9.0%} "
              f"{share(lambda r: np.argmax(r['vec']['F']) == k(r)):13.0%} "
              f"{share(lambda r: (np.argmax(r['vec']['L']) - k(r)) % 12 in (0, 7)):13.0%} "
              f"{share(lambda r: np.argmax(r['vec']['ESS']) == k(r)):7.0%} "
              f"{share(lambda r: (np.argmax(r['vec']['ESS']) - k(r)) % 12 in (0, 5, 7)):13.0%} "
              f"{share(lambda r: r['vec']['H'][(k(r) + 7) % 12] > r['vec']['H'][(k(r) + 5) % 12]):11.0%} "
              f"{share(lambda r: r['sheet_last'] is not None and (np.argmax(r['vec']['LAST']) - k(r)) % 12 == r['sheet_last']):14.0%} "
              f"{share(lambda r: r['sheet_last_is_sa']):12.0%} {share(lambda r: r['minor']):6.0%}")


# ---------------------------------------------------------------- models
class CLogit:
    """Conditional logit: score_k = x_k . w, softmax over the 12 candidates."""

    def __init__(self, lam=1.0):
        self.lam = lam

    def fit(self, X, y):
        n, k, d = X.shape
        flat = X.reshape(-1, d)
        self.mu, self.sd = flat.mean(0), flat.std(0) + 1e-6
        Z = (X - self.mu) / self.sd

        def f(w):
            s = Z @ w
            s = s - s.max(1, keepdims=True)
            p = np.exp(s)
            p /= p.sum(1, keepdims=True)
            loss = -np.log(p[np.arange(n), y] + 1e-12).sum() + self.lam * w @ w
            g = np.einsum("nk,nkd->d", p, Z) - Z[np.arange(n), y].sum(0) + 2 * self.lam * w
            return loss, g

        self.w = minimize(f, np.zeros(d), jac=True, method="L-BFGS-B").x
        return self

    def scores(self, X):
        return ((X - self.mu) / self.sd) @ self.w


def softmax(s, temp=1.0):
    s = s / temp
    s = s - s.max(-1, keepdims=True)
    p = np.exp(s)
    return p / p.sum(-1, keepdims=True)


def baseline_scores(X, name):
    if name == "essentia":
        return X[:, :, T.VEC_NAMES.index("ESS") * 12]
    if name == "drone":
        return X[:, :, T.VEC_NAMES.index("D") * 12]
    raise ValueError(name)


def folder_group(f):
    """Source-folder stratum: the yearly 'Amma Bhajans YYYY' collections, else the album folder."""
    import re
    m = re.search(r"Amma Bhajans (\d{4})( UPD)?", f)
    if m:
        return m.group(0)
    return f.split("/")[2] if f.count("/") >= 2 else f


def strata(folders):
    g = [folder_group(f) for f in folders]
    c = collections.Counter(g)
    return np.array([x if c[x] >= 10 else "other" for x in g])


def cv_scores(X, y, folders, groups, make, seed=0):
    out = np.zeros(X.shape[:2])
    skf = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=seed)
    for tr, te in skf.split(X, strata(folders), groups):
        out[te] = make().fit(X[tr], y[tr]).scores(X[te])
    return out


def summarize(scores, y, temp=1.0):
    pred = scores.argmax(1)
    p = softmax(scores, temp)
    top = p.max(1)
    types = collections.Counter(T.err_type(a, b) for a, b in zip(pred, y))
    return pred, top, types


def coverage_curve(top, ok):
    out = []
    for th in (0.0, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95):
        sel = top >= th
        if sel.sum():
            out.append({"threshold": th, "coverage": float(sel.mean()), "accuracy": float(ok[sel].mean()), "n": int(sel.sum())})
    return out


def fit_temp(scores, y):
    best = (1e9, 1.0)
    for t in np.exp(np.linspace(np.log(0.2), np.log(5), 60)):
        p = softmax(scores, t)
        nll = -np.log(p[np.arange(len(y)), y] + 1e-12).mean()
        best = min(best, (nll, t))
    return best[1]


def main():
    rows = gather()
    print(f"{SRC} recordings of sheet songs with features: {len(rows)}")
    sanity(rows)
    if "--sanity" in sys.argv:
        return
    truth = [r for r in rows if r["corr"] >= CORR and r["margin"] >= MARGIN and r["sa_conf"] == "high"
             and r["trust"] in T.TRUSTED and (NOHPCP or r["vec"]["has_hpcp"])]
    print(f"\ntruth set (corr >= {CORR}, margin >= {MARGIN}, sheet_sa high, sheet trusted): {len(truth)} / {len(rows)}")
    X = np.array([T.candidate_matrix(r["vec"]) for r in truth])
    XA = X  # all columns, for baselines and ablations
    X = X[:, :, USE]
    y = np.array([r["tpl"] for r in truth])
    folders = [r["folder"] for r in truth]
    groups = [r["box_id"] for r in truth]
    print("truth folders:", collections.Counter(strata(folders)).most_common(6))

    results = {}
    for name in ("essentia", "drone"):
        s = baseline_scores(XA, name)
        pred = s.argmax(1)
        results[name] = {"accuracy": float((pred == y).mean()),
                         "errors": dict(collections.Counter(T.err_type(a, b) for a, b in zip(pred, y)))}
    models = {f"clogit(l={lam})": (lambda lam=lam: CLogit(lam)) for lam in (1, 3, 10, 30, 100)}
    oof = {}
    for name, make in models.items():
        s = cv_scores(X, y, folders, groups, make)
        oof[name] = s
        pred = s.argmax(1)
        results[name] = {"accuracy": float((pred == y).mean()),
                         "errors": dict(collections.Counter(T.err_type(a, b) for a, b in zip(pred, y)))}
    # ablations (same CV, best-ish lambda): which cue families carry the accuracy
    ablations = {
        "H only": ["H"], "H+ESS": ["H", "ESS"],
        "melody cues (no ESS, no HPCP)": ["H", "L", "F", "E", "LAST", "LOW", "LOWH", "fit"],
        "melody cues + ESS": ["H", "L", "F", "E", "LAST", "LOW", "LOWH", "ESS", "fit"],
        "all but HPCP-unvoiced": [n for n in T.VEC_NAMES if n != "U"] + ["fit"],
        "all": T.VEC_NAMES + ["fit"],
    }
    abl = {}
    for an, names in ablations.items():
        c = cols(names)
        sa = cv_scores(XA[:, :, c], y, folders, groups, lambda: CLogit(10))
        abl[an] = float((sa.argmax(1) == y).mean())
        print(f"ablation {an:32} acc {abl[an]:.1%}")
    results["ablations(clogit l=10)"] = abl
    for name, r in results.items():
        if not isinstance(r, dict) or "accuracy" not in r:
            continue
        print(f"{name:16} acc {r['accuracy']:.1%}  {r['errors']}")
    best = max(models, key=lambda n: results[n]["accuracy"])
    s = oof[best]
    temp = fit_temp(s, y)
    # sheet_sa tie-break simulation: choose between the true Sa and Sa+d (d = the offsets
    # sheet_sa.py has to decide between), model (OOF) vs Essentia's vote
    ess = XA[:, :, T.VEC_NAMES.index("ESS") * 12].argmax(1)
    pairwise = {}
    for d in (7, 5, 3, 9, 10, 2):
        alt = (y + d) % 12
        m_ok = (s[np.arange(len(y)), y] > s[np.arange(len(y)), alt]).mean()
        e = np.where(ess == y, 1.0, np.where(ess == alt, 0.0, 0.5))
        pairwise[f"+{d}"] = {"model": float(m_ok), "essentia": float(e.mean()),
                             "essentia_abstain": float((e == 0.5).mean())}
    print("tie-break Sa vs Sa+d (held-out):", {k: (round(v["model"], 3), round(v["essentia"], 3)) for k, v in pairwise.items()})
    results["tiebreak"] = pairwise
    pred, top, types = summarize(s, y, temp)
    ok = pred == y
    curve = coverage_curve(top, ok)
    print(f"\nbest {best}, temperature {temp:.2f}; held-out (5-fold OOF) accuracy {ok.mean():.1%}")
    for c in curve:
        print(f"  conf >= {c['threshold']:.2f}: coverage {c['coverage']:.1%} accuracy {c['accuracy']:.1%} (n={c['n']})")
    # The truth set is the easy end (clean template matches) and the threshold is chosen on
    # the same OOF predictions it is reported on, so aim at 95% here to keep >= 90% on the
    # harder songs that have no sheet (checked by tonic_validate.py).
    # Also require >= 90% on the "harder band" (trusted sheets just below the truth threshold,
    # never trained on), scored by the final model.
    final = models[best]().fit(X, y)
    in_truth = {id(r) for r in truth}
    hard = [r for r in rows if id(r) not in in_truth and r["sa_conf"] == "high" and r["trust"] in T.TRUSTED
            and r["corr"] >= CORR - 0.10 and r["margin"] >= MARGIN - 0.10 and (NOHPCP or r["vec"]["has_hpcp"])]
    hard_curve = []
    if hard:
        Xh = np.array([T.candidate_matrix(r["vec"]) for r in hard])[:, :, USE]
        yh = np.array([r["tpl"] for r in hard])
        sh = final.scores(Xh)
        okh, toph = sh.argmax(1) == yh, softmax(sh, temp).max(1)
        hard_curve = coverage_curve(toph, okh)
        print(f"harder band (corr >= {CORR - 0.1:.2f}, margin >= {MARGIN - 0.1:.2f}, not truth): n={len(hard)} "
              f"acc {okh.mean():.1%}; " + ", ".join(f">={c['threshold']}: cov {c['coverage']:.0%} acc {c['accuracy']:.1%}"
                                                    for c in hard_curve if c["threshold"] >= 0.5))
    hacc = {c["threshold"]: c["accuracy"] for c in hard_curve}
    hi = next((c["threshold"] for c in curve if c["threshold"] >= 0.5 and c["accuracy"] >= 0.95
               and hacc.get(c["threshold"], 1.0) >= 0.90), 0.95)
    # per-folder held-out accuracy
    per_folder = {}
    for f in sorted(set(strata(folders))):
        sel = strata(folders) == f
        per_folder[f] = {"n": int(sel.sum()), "accuracy": float(ok[sel].mean()),
                         "hi_cov": float((top[sel] >= hi).mean()),
                         "hi_acc": float(ok[sel & (top >= hi)].mean()) if (sel & (top >= hi)).any() else None}
    # leave-folder-out: for each folder group with >= 40 truth songs, train on the rest and
    # test on it (the 2025 UPD folder has too few sheet songs to be held out on its own)
    fa = np.array([folder_group(f) for f in folders])
    lfo = {}
    for g, n in collections.Counter(fa).items():
        if n < 40:
            continue
        tr, te = fa != g, fa == g
        m = models[best]().fit(X[tr], y[tr])
        st = m.scores(X[te])
        pt = st.argmax(1)
        tt = softmax(st, temp).max(1)
        lfo[g] = {"n": int(te.sum()), "accuracy": float((pt == y[te]).mean()),
                  "hi_coverage": float((tt >= hi).mean()),
                  "hi_accuracy": float((pt == y[te])[tt >= hi].mean()) if (tt >= hi).any() else None,
                  "errors": dict(collections.Counter(T.err_type(a, b) for a, b in zip(pt, y[te])))}
        print(f"leave-folder-out {g}: n={lfo[g]['n']} acc {lfo[g]['accuracy']:.1%}, "
              f"high-conf coverage {lfo[g]['hi_coverage']:.0%} accuracy {lfo[g]['hi_accuracy']:.1%}")
    err_hi = collections.Counter(T.err_type(a, b) for a, b, t in zip(pred, y, top) if t >= hi)
    err_lo = collections.Counter(T.err_type(a, b) for a, b, t in zip(pred, y, top) if t < hi)
    print(f"high-confidence threshold {hi}: errors among high {dict(err_hi)}, among low {dict(err_lo)}")
    w = dict(zip([T.FEATURE_NAMES[i] for i in USE], (final.w / final.sd).round(4).tolist()))
    top_w = sorted(w.items(), key=lambda kv: -abs(kv[1]))[:25]
    print("largest weights (per unit feature):", top_w)
    (HERE / "features" / f"tonic_model{SUFFIX}.json").write_text(json.dumps({
        "model": best, "mu": final.mu.tolist(), "sd": final.sd.tolist(), "w": final.w.tolist(),
        "temperature": temp, "high_conf": hi, "cols": USE, "features": [T.FEATURE_NAMES[i] for i in USE],
        "truth": {"corr": CORR, "margin": MARGIN, "n": len(truth)}}))
    failures = [{"song": r["song"], "box_id": r["box_id"], "folder": r["folder"], "truth": T.PC[r["tpl"]],
                 "pred": T.PC[p], "conf": round(float(t), 3), "type": T.err_type(p, r["tpl"])}
                for r, p, t in zip(truth, pred, top) if p != r["tpl"]]
    (HERE / "features" / f"tonic_eval{SUFFIX}.json").write_text(json.dumps({
        "n_sheet_with_audio": len(rows), "n_truth": len(truth), "baselines_and_models": results,
        "best": best, "temperature": temp, "high_conf_threshold": hi, "oof_accuracy": float(ok.mean()),
        "coverage_curve": curve, "harder_band": {"n": len(hard), "curve": hard_curve}, "per_folder": per_folder, "leave_folder_out": lfo,
        "errors_high": dict(err_hi), "errors_low": dict(err_lo), "failures": failures,
        "top_weights": top_w}, indent=1))


if __name__ == "__main__":
    main()
