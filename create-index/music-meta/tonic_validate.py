#!/usr/bin/env python3
"""Checks of the final tonic labels beyond the held-out truth set (run after tonic_build.py).

1. Harder band: trusted sheets with high-confidence Sa whose template match is
   just below the truth threshold (corr 0.80-0.90 or margin 0.10-0.20 for Box). The
   audio model never trained on them; compare it with the template label.
2. CD/Box consistency on songs WITHOUT sheet music (the population the model is
   for): where the CD sample's pitch histogram matches the Box recording's at a
   confident rotation r, the two independent audio-model predictions should differ
   by r. Correlated errors (same song, same Pa/Sa trap) make this optimistic.
3. Agreement with the human shruti labels, by source / method / confidence.
Writes features/tonic_validation.json.
"""
import collections
import json
from pathlib import Path

import numpy as np

import tonic_lib as T
from tonic_build import load_models, model_scores, pick_model, softmax

HERE = Path(__file__).parent


def harder_band(models):
    sheet = json.loads((HERE / "features" / "sheet.json").read_text())
    box = json.loads((HERE / T.MATCHES).read_text())
    ssa, trust = T.sheet_sa(), T.sheet_trust()
    ok, conf, his = [], [], []
    for name, sv in sheet.items():
        sa = ssa.get(name) or {}
        if sa.get("confidence") != "high" or trust.get(name) not in T.TRUSTED:
            continue
        m = box.get(name) or []
        if not m or not m[0]["accept"]:
            continue
        rec = T.load_box(m[0]["id"])
        vec = T.rec_vectors(rec) if rec else None
        if vec is None:
            continue
        model = pick_model(models, "box", vec)
        t, c, mg = T.template(vec["H"], sv["pc_hist"])
        in_truth = c >= model["truth"]["corr"] and mg >= model["truth"]["margin"]
        if in_truth or c < 0.80 or mg < 0.10:
            continue
        label = (t[0][1] + sa["sa_offset"]) % 12
        p = softmax(model_scores(model, T.candidate_matrix(vec)), model["temperature"])
        ok.append(int(np.argmax(p)) == label)
        conf.append(float(p.max()))
        his.append(p.max() >= model["high_conf"])
    ok, conf = np.array(ok), np.array(conf)
    hi = np.array(his, bool)
    return {"n": int(len(ok)), "accuracy": float(ok.mean()) if len(ok) else None,
            "high_conf_coverage": float(hi.mean()) if len(ok) else None,
            "high_conf_accuracy": float(ok[hi].mean()) if hi.any() else None}


def main():
    models = load_models()
    tonic = json.loads((HERE / "features" / "tonic.json").read_text())
    sheet = json.loads((HERE / "features" / "sheet.json").read_text())
    res = {"harder_band_box": harder_band(models)}
    print("harder band (Box, template corr 0.80-0.90):", res["harder_band_box"])

    t1 = json.loads((HERE / "features" / "tonic_task1.json").read_text())
    cons = collections.Counter()
    for d in t1["direct_rows"]:
        if d["corr"] < 0.9 or d["margin"] < 0.15 or d["song"] in sheet:
            continue
        recs = {r["source"]: r for r in tonic.get(d["song"], {}).get("recordings", [])}
        b, c = recs.get(f"box:{d['box_id']}"), recs.get(f"cd:{d['url']}")
        if not b or not c or b["tonic_pc"] is None or c["tonic_pc"] is None:
            continue
        agree = (b["tonic_pc"] - c["tonic_pc"]) % 12 == d["rot_box_minus_cd"] % 12
        both_hi = b["high_confidence"] and c["high_confidence"]
        cons[("all", agree)] += 1
        cons[("both high", agree)] += 1 if both_hi else 0
    res["cd_box_consistency_nosheet"] = {
        k: {"n": cons[(k, True)] + cons[(k, False)],
            "agree": cons[(k, True)] / max(1, cons[(k, True)] + cons[(k, False)])} for k in ("all", "both high")}
    print("CD/Box consistency, no-sheet songs:", res["cd_box_consistency_nosheet"])

    hum = collections.defaultdict(collections.Counter)
    for song, v in tonic.items():
        pcs = next((h["pcs"] for h in v["human"] if "pcs" in h), None)
        if not pcs:
            continue
        for r in v["recordings"]:
            if r["tonic_pc"] is None:
                continue
            d = min(((r["tonic_pc"] - h) % 12 for h in pcs), key=lambda x: min(x, 12 - x))
            d = d - 12 if d > 6 else d
            key = f"{r['source'].split(':')[0]} {r['method']} {'high' if r['high_confidence'] else 'low'}"
            hum[key][d] += 1
    res["vs_human"] = {}
    for k, c in sorted(hum.items()):
        n = sum(c.values())
        res["vs_human"][k] = {"n": n, "exact": c[0] / n, "within1": (c[0] + c[1] + c[-1]) / n,
                              "fourth_fifth": (c[5] + c[-5]) / n, "dist": dict(sorted(c.items()))}
        print(f"vs human {k:32} n={n:4} exact {c[0] / n:.0%} within1 {(c[0] + c[1] + c[-1]) / n:.0%} "
              f"4th/5th {(c[5] + c[-5]) / n:.0%}")
    (HERE / "features" / "tonic_validation.json").write_text(json.dumps(res, indent=1))


if __name__ == "__main__":
    main()
