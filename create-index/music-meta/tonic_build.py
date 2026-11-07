#!/usr/bin/env python3
"""Task 3: write features/tonic.json — the shruti (Sa) of every song's recordings.

For each song in box-matches-verified.json with an accepted Box recording, and for every
CD sample (`cs` URL in bhajan-index2.json) whose features are cached:
  - sheet songs whose sheet-template match is confident -> method "sheet-template"
  - everything else -> method "audio-model" (the ranker trained by tonic_train.py)
Output: {song: {recordings: [{source, tonic_pc, note, kattai, confidence, method,
alternatives, high_confidence}], human: [{raw, notes}]}}
Run first: tonic_train.py --nohpcp and tonic_train.py --cd --nohpcp (the models), then
tonic_sheet_sa.py (model tie-break of the sheet Sa position).
"""
import json
from pathlib import Path

import numpy as np

import pitch
import tonic_lib as T

HERE = Path(__file__).parent


def model_scores(model, X):
    if "cols" in model:
        X = X[:, model["cols"]]
    return ((X - np.array(model["mu"])) / np.array(model["sd"])) @ np.array(model["w"])


def softmax(s, t):
    s = (s - s.max()) / t
    p = np.exp(s)
    return p / p.sum()


def load_models():
    """{"box": (full, fallback), "cd": (full, fallback)}; full needs HPCP, fallback does not."""
    def ld(n):
        p = HERE / "features" / n
        return json.loads(p.read_text()) if p.exists() else None
    return {"box": (ld("tonic_model.json"), ld("tonic_model_nohpcp.json")),
            "cd": (ld("tonic_model_cd.json"), ld("tonic_model_cd_nohpcp.json"))}


# Use the HPCP (drone/accompaniment) model where it measured better on held-out truth:
# CD: 88.2% vs 88.6% OOF (equal) but 57% vs 43% coverage at the 95% level; Box: 92.7% vs 92.9%, so no.
PREFER_FULL = {"box": False, "cd": True}


def pick_model(models, kind, vec):
    full, fb = models[kind]
    if full is not None and vec.get("has_hpcp") and (fb is None or PREFER_FULL[kind]):
        return full
    return fb


def estimate(source, sheet_hist, models, sa=None):
    """sa: {"sa_offset", "confidence"} — where Sa sits relative to the sheet's key root."""
    rec = T.load(source)
    if rec is None:
        return None
    vec = T.rec_vectors(rec)
    if vec is None:
        return {"source": source, "tonic_pc": None, "note": None, "kattai": None, "confidence": 0.0,
                "method": "none", "alternatives": [], "high_confidence": False, "why": "too little voiced pitch"}
    out = {"source": source}
    model = pick_model(models, source.split(":")[0], vec)
    truth_rule = model["truth"]
    out["model"] = "full" if "U[0]" in model["features"] else "no-hpcp"
    p = softmax(model_scores(model, T.candidate_matrix(vec)), model["temperature"])
    order = np.argsort(-p)
    if sheet_hist is not None:
        t, c, mg = T.template(vec["H"], sheet_hist)
        off = (sa or {}).get("sa_offset", 0)
        sconf = (sa or {}).get("confidence", "low")
        k = (t[0][1] + off) % 12
        if c >= truth_rule["corr"] and mg >= truth_rule["margin"] and sconf != "low":
            # confidence: template match is the label source; scale by how far above threshold
            conf = 0.9 + 0.09 * min(1.0, (c - truth_rule["corr"]) / 0.08) * min(1.0, mg / 0.5)
            if sconf == "medium":
                conf = 0.75
            out.update(tonic_pc=k, method="sheet-template", confidence=round(conf, 3),
                       alternatives=[[T.PC[(pc + off) % 12], round(cc, 3)] for cc, pc in t[1:4]],
                       sheet_corr=round(c, 3), sheet_margin=round(mg, 3), sheet_sa_offset=off,
                       sheet_sa_confidence=sconf, audio_model_agrees=bool(order[0] == k))
        else:
            out["sheet_template_top"] = [T.PC[k], round(c, 3), round(mg, 3), sconf]
    if "tonic_pc" not in out:
        k = int(order[0])
        out.update(tonic_pc=k, method="audio-model", confidence=round(float(p[k]), 3),
                   alternatives=[[T.PC[j], round(float(p[j]), 3)] for j in order[1:4]])
    out["note"] = T.PC[out["tonic_pc"]]
    out["kattai"] = T.KATTAI[out["tonic_pc"]]
    out["high_confidence"] = bool(out["confidence"] >= (0.9 if out["method"] == "sheet-template" else model["high_conf"])
                                  or (out["method"] == "sheet-template" and out["audio_model_agrees"]))
    out["tuning_cents"] = round(float(vec["off"]), 1)
    return out


def main():
    models = load_models()
    sheet = json.loads((HERE / "features" / "sheet.json").read_text())
    tsa = HERE / "features" / "tonic_sheet_sa.json"
    sa_map = json.loads(tsa.read_text()) if tsa.exists() else T.sheet_sa()
    trust = T.sheet_trust()
    box = json.loads((HERE / T.MATCHES).read_text())
    rub = json.loads((HERE / "rubric.json").read_text())
    idx = {e["n"]: e for e in json.loads((HERE.parent.parent / "public" / "bhajan-index2.json").read_text())}
    out = {}
    stats = {"box": 0, "box_missing_features": 0, "cd": 0, "cd_missing_features": 0}
    names = list(dict.fromkeys(list(box) + [n for n, e in idx.items() if e.get("cs")]))
    for name in names:
        m = box.get(name) or []
        # a PDF that belongs to another song (sheet_trust "mismatch") is ignored
        sh = sheet[name]["pc_hist"] if name in sheet and trust.get(name) != "mismatch" else None
        recs = []
        if m and m[0]["accept"]:
            r = estimate(f"box:{m[0]['id']}", sh, models, sa_map.get(name))
            if r is None:
                stats["box_missing_features"] += 1
            else:
                r["box_name"] = m[0]["name"]
                r["box_folder"] = m[0]["folder"]
                recs.append(r)
                stats["box"] += 1
        for u in (idx.get(name) or {}).get("cs") or []:
            r = estimate(f"cd:{u}", sh, models, sa_map.get(name))
            if r is None:
                stats["cd_missing_features"] += 1
            else:
                recs.append(r)
                stats["cd"] += 1
        h = rub.get(name) or {}
        human = [{"raw": raw} for raw in h.get("shruti_raw", [])]
        if h.get("shruti_notes"):
            human.append({"notes": h["shruti_notes"], "pcs": h["shruti_pcs"]})
        if recs or human:
            out[name] = {"recordings": recs, "human": human}
    (HERE / "features" / "tonic.json").write_text(json.dumps(out, indent=1, ensure_ascii=False))
    recs = [r for v in out.values() for r in v["recordings"]]
    for kind in ("box", "cd"):
        rr = [r for r in recs if r["source"].startswith(kind)]
        if rr:
            hi = sum(r["high_confidence"] for r in rr)
            st = sum(r["method"] == "sheet-template" for r in rr)
            print(f"{kind}: {len(rr)} recordings, sheet-template {st}, high confidence {hi} ({hi / len(rr):.0%})")
    print(stats, f"songs written: {len(out)}")


if __name__ == "__main__":
    main()
