#!/usr/bin/env python3
"""Raga gold set: songs where the (noisy) human raga label and the sheet-music
note set independently agree. Disagreements are listed for adjudication.

Agreement = the human raga (after alias normalisation against reference/ragas.json)
explains the sheet's notes at the chosen Sa: song notes with >=2% weight are inside
the raga's notes + anya swaras, and the song uses all but at most one raga note.
Writes rubric_raga.json {gold: {song: raga}, disagree: {song: {...}}, unknown_names: [...]}.
"""
import json
import re
from pathlib import Path

import numpy as np

HERE = Path(__file__).parent
SW = ["S", "r1", "R2", "g2", "G3", "M1", "M2", "P", "d1", "D2", "n2", "N3"]


def key(s):
    return re.sub(r"[^a-z]", "", s.lower())


def main():
    table = json.loads((HERE / "reference/ragas.json").read_text())
    by = {r["name"]: r for r in table}
    alias = {}
    for r in table:
        for a in [r["name"], *r.get("aliases", [])]:
            alias.setdefault(key(a), r["name"])
    ev = json.loads((HERE / "features/raga_evidence.json").read_text())
    rub = json.loads((HERE / "rubric.json").read_text())
    gold, disagree, unknown = {}, {}, set()
    for song, r in rub.items():
        if not r["raaga"] or song not in ev or "sheet" not in ev[song]:
            continue
        sh = ev[song]["sheet"]
        w = np.zeros(12)
        for tok in sh["swaras"].split():
            sw, pct = tok.split("=")
            w[SW.index(sw)] = int(pct) / 100
        used = {i for i in range(12) if w[i] >= 0.02}
        names = [alias.get(x) for x in r["raaga"]]
        for raw, n in zip(r["raaga"], names):
            if n is None:
                unknown.add(raw)
        names = [n for n in names if n]
        ok = []
        for n in names:
            R = set(by[n]["pcs"])
            anya = {SW.index(s) for s in by[n].get("anya_swaras", []) if s in SW} | set(by[n].get("extra_pcs", []))
            if used <= R | anya and len(R - used) <= 1:
                ok.append(n)
        if ok:
            gold[song] = ok[0] if len(ok) == 1 else ok
        else:
            disagree[song] = {"human": r["raaga_raw"], "normalised": names, "sheet_swaras": sh["swaras"],
                              "sheet_top": [c[1] for c in sh["candidates"][:3]], "sa_conf": sh.get("sa_confidence"),
                              "hints": r["hints"]}
    out = {"gold": gold, "disagree": disagree, "unknown_names": sorted(unknown)}
    (HERE / "rubric_raga.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    print(f"gold {len(gold)}, disagree {len(disagree)}, unknown human names {len(unknown)}")


if __name__ == "__main__":
    main()
