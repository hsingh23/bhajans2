#!/usr/bin/env python3
"""Model-based tie-break for where Sa sits in a sheet score (complements sheet_sa.py).

sheet_sa.py picks Sa among {PDF key root, final note} with raga fit, the final
note and Essentia's drone tonic as tie-breaker. On held-out truth songs the
audio tonic model separates "Sa vs Sa+d" better than Essentia (see
features/tonic_eval.json, baselines_and_models.tiebreak), so for sheets whose
sheet_sa confidence is not high we let the model choose between the candidates
on the Box recording (template key root + candidate offset).

Writes features/tonic_sheet_sa.json: {song: {sa_offset, confidence, source,
sheet_sa: {...}, model: {offset: prob}, essentia_offset, key_root_pc, corr}}.
Run after tonic_train.py.
"""
import json
from pathlib import Path

import numpy as np

import tonic_lib as T
from tonic_build import model_scores, softmax

HERE = Path(__file__).parent
PAIR_MIN = 0.75  # model must give the chosen candidate >= 75% of the pair's probability


def main():
    model = json.loads((HERE / "features" / "tonic_model_nohpcp.json").read_text())
    sheet = json.loads((HERE / "features" / "sheet.json").read_text())
    box = json.loads((HERE / T.MATCHES).read_text())
    ssa = T.sheet_sa()
    out = {}
    changed = 0
    for name, sv in sheet.items():
        sa = ssa.get(name)
        if not sa:
            continue
        rec_out = {"sa_offset": sa["sa_offset"], "confidence": sa["confidence"], "source": "sheet_sa",
                   "sheet_sa": sa}
        m = box.get(name) or []
        rec = T.load_box(m[0]["id"]) if m and m[0]["accept"] else None
        vec = T.rec_vectors(rec) if rec else None
        if vec is not None:
            t, c, mg = T.template(vec["H"], sv["pc_hist"])
            kr = t[0][1]
            p = softmax(model_scores(model, T.candidate_matrix(vec)), model["temperature"])
            cands = sa.get("sa_candidates") or [sa["sa_offset"]]
            probs = {int(o): float(p[(kr + o) % 12]) for o in cands}
            ess = int(np.argmax(vec["ESS"])) if vec["ESS"].any() else None
            rec_out.update(key_root_pc=kr, corr=round(c, 3), margin=round(mg, 3),
                           model={str(o): round(v, 3) for o, v in probs.items()},
                           essentia_offset=None if ess is None else (ess - kr) % 12)
            if sa["confidence"] != "high" and len(probs) > 1 and c >= 0.8:
                best = max(probs, key=probs.get)
                share = probs[best] / max(sum(probs.values()), 1e-9)
                if share >= PAIR_MIN:
                    if best != sa["sa_offset"]:
                        changed += 1
                    rec_out.update(sa_offset=best, confidence="medium" if share < 0.9 else "high-model",
                                   source="tonic-model", pair_share=round(share, 3))
        out[name] = rec_out
    (HERE / "features" / "tonic_sheet_sa.json").write_text(json.dumps(out, indent=1, ensure_ascii=False))
    from collections import Counter
    print("sources:", Counter(v["source"] for v in out.values()), "confidence:", Counter(v["confidence"] for v in out.values()),
          f"model overrode sheet_sa offset in {changed}")


if __name__ == "__main__":
    main()
