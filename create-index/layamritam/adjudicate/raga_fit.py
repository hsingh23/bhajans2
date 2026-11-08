#!/usr/bin/env python3
"""Raga conflicts: which label's scale fits the notes actually sung / written?

Evidence per song, both relative to Sa:
  audio - melody pitch-class mass from our recording (music-meta/features/raga_evidence.json)
  lay   - the same from Layamritam's own recording (work/lay_swaras.json, if built)
  sheet - note histogram of the song's sheet music, Sa from tonic_sheet_sa (trusted sheets only)
A raga fits a histogram when little mass sits outside its scale and few of its notes are
missing. Writes raga_fit.json and prints the verdict tally.
"""
import json
import re
import sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent.parent.parent
MM = ROOT / "create-index" / "music-meta"
SW = {"S": 0, "r1": 1, "R2": 2, "g2": 3, "G3": 4, "M1": 5, "M2": 6, "P": 7, "d1": 8, "D2": 9, "n2": 10, "N3": 11}
OUT_MAX = 0.07   # melody mass allowed outside the scale (ornaments, pitch-tracker noise)
MISS_MIN = 0.012  # a scale note with less mass than this counts as missing


def hist_from_swaras(s):
    h = [0.0] * 12
    for k, v in re.findall(r"(\w+)=(\d+)", s):
        if k in SW:
            h[SW[k]] += float(v)
    t = sum(h) or 1
    return [x / t for x in h]


def fit(h, pcs):
    pcs = set(pcs)
    out = sum(h[i] for i in range(12) if i not in pcs)
    miss = [i for i in pcs if h[i] < MISS_MIN]
    return {"outside": round(out, 3), "missing": len(miss), "ok": out <= OUT_MAX and len(miss) <= 1}


def main():
    ref = json.loads((ROOT / "public" / "music-reference.json").read_text())["ragas"]
    rows = [r for r in json.loads((HERE / "rows.json").read_text()) if r["field"] == "raga"]
    ev = json.loads((MM / "features" / "raga_evidence.json").read_text())
    sheet = json.loads((MM / "features" / "sheet.json").read_text())
    trust = json.loads((MM / "features" / "sheet_trust.json").read_text())
    ssa = json.loads((MM / "features" / "tonic_sheet_sa.json").read_text())
    music = json.loads((ROOT / "public" / "bhajan-music.json").read_text())
    lsw = json.loads((HERE / "work" / "lay_swaras.json").read_text()) if (HERE / "work" / "lay_swaras.json").exists() else {}
    res = []
    for r in rows:
        song = r["song"]
        app = [x["id"] for x in (music.get(song, {}).get("r") or [])][:1]
        lay = list(dict.fromkeys(g["id"] for l in r["lay"] for g in l["ragas"]))
        lay_src = sorted({g["src"] or "?" for l in r["lay"] for g in l["ragas"]})
        hs = {}
        a = ev.get(song, {}).get("audio")
        if a and a.get("swaras"):
            hs["audio"] = hist_from_swaras(a["swaras"])
        sh = sheet.get(song)
        if sh and trust.get(song, {}).get("trust") in ("trusted", "trusted-unique") and song in ssa:
                        hs["sheet"] = list(sh['pc_hist'])  # already relative to Sa
        for l in r["lay"]:
            if str(l["songId"]) in lsw:
                hs.setdefault("lay_audio", hist_from_swaras(lsw[str(l["songId"])]["swaras"]))
        fits = {}
        for name, h in hs.items():
            fits[name] = {rid: fit(h, ref[rid]["pcs"]) for rid in app + lay if rid in ref}
        res.append({"song": song, "kind": r["kind"], "app": app, "app_c": (music.get(song, {}).get("r") or [{}])[0].get("c"),
                    "lay": lay, "lay_src": lay_src, "fits": fits,
                    "hist": {k: [round(x, 3) for x in v] for k, v in hs.items()}})
    (HERE / "raga_fit.json").write_text(json.dumps(res, ensure_ascii=False, indent=1))
    for kind in ("conflict", "weak"):
        c = Counter()
        for x in res:
            if x["kind"] != kind:
                continue
            for src, f in x["fits"].items():
                a_ok = any(f[i]["ok"] for i in x["app"] if i in f)
                l_ok = any(f[i]["ok"] for i in x["lay"] if i in f)
                c[(src, {(1, 0): "app only", (0, 1): "lay only", (1, 1): "both", (0, 0): "neither"}[(a_ok, l_ok)])] += 1
        print(kind, sorted(c.items()))


if __name__ == "__main__":
    main()
