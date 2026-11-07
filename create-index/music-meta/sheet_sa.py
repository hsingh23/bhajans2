#!/usr/bin/env python3
"""Decide where Sa sits in each sheet-music score (relative to the PDF's key root).

The arranger's key root is Sa in most songs, but pentatonic ragas are often
notated from another degree (hindolam written as a minor key whose 5th is Sa;
revati from the 2nd). The final melody note is the strongest single clue.
Candidates: key root (0) and the final note's pitch class. Each is scored by
  - raga fit: best reference raga score of the note set rotated to that Sa
  - audio: Essentia's drone-based tonic, expressed relative to the key root
    found by sheet-template matching, votes for one candidate
  - ending: the melody ends on that candidate.
Writes features/sheet_sa.json: {song: {sa_offset, sa_candidates, confidence, why}}.
"""
import json
from pathlib import Path

import numpy as np

from pitch import hz_to_pc, load, pc_hist, template_tonic
from raga_candidates import ragas, rank

HERE = Path(__file__).parent


def main():
    table = ragas()
    sheet = json.loads((HERE / "features/sheet.json").read_text())
    matches = json.loads((HERE / "box-matches-verified.json").read_text())
    out = {}
    for name, sh in sheet.items():
        if "error" in sh:
            continue
        w = np.array(sh["pc_hist"])
        last = sh["notes"][-1] % 12
        cands = sorted({0, last})
        fits = {c: rank(np.roll(w, -c), table, 1)[0] for c in cands}
        audio_vote = None
        m = matches.get(name)
        if m and m[0].get("accept"):
            d = load(m[0]["id"])
            if d is not None:
                h, _ = pc_hist(d["f0"])
                best = template_tonic(h, sh["pc_hist"])
                if best[0][0] >= 0.8:
                    audio_vote = (hz_to_pc(float(d["tonic_hz"])) - best[0][1]) % 12
        if len(cands) == 1:
            out[name] = {"sa_offset": 0, "sa_candidates": [0], "confidence": "high",
                         "why": f"ends on key root; best raga {fits[0][1]}"}
            continue
        score = {}
        for c in cands:
            s = -fits[c][0]                      # raga fit (higher better)
            s += 1.5 if audio_vote == c else 0   # drone tonic agrees
            s += 0.4 if c == last else 0         # melody ends here
            s += 0.4 if c == 0 else 0            # arranger's key root
            score[c] = s
        pick = max(score, key=score.get)
        other = [c for c in cands if c != pick][0]
        margin = score[pick] - score[other]
        conf = "high" if margin >= 1.0 else "medium" if margin >= 0.4 else "low"
        out[name] = {
            "sa_offset": pick, "sa_candidates": cands, "confidence": conf,
            "why": (f"key root -> {fits[0][1]} (fit {fits[0][0]}), final note +{last} -> "
                    f"{fits[last][1]} (fit {fits[last][0]}); essentia vote {audio_vote}; margin {margin:.2f}"),
        }
    (HERE / "features/sheet_sa.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    from collections import Counter
    print("sa_offset:", Counter(v["sa_offset"] for v in out.values()).most_common())
    print("confidence:", Counter(v["confidence"] for v in out.values()).most_common())


if __name__ == "__main__":
    main()
