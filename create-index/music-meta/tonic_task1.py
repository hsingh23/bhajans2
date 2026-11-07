#!/usr/bin/env python3
"""Task 1: do the human shruti labels describe the CD samples, the Box recordings, or neither?

For sheet songs with a human label, an accepted Box recording and CD sample(s),
compute the sheet-template tonic on both the Box recording and each CD sample,
keep the confident ones, and tabulate the signed differences (semitones, -5..+6):
  sample - human, box - human, sample - box.
Writes features/tonic_task1.json. Usage: python tonic_task1.py [corr] [margin] [--all]
"""
import collections
import json
import sys
from pathlib import Path

import pitch
import tonic_lib as T

HERE = Path(__file__).parent
CORR = float(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1][0].isdigit() else 0.90
MARGIN = float(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2][0].isdigit() else 0.20
CD_CORR, CD_MARGIN = 0.85, 0.15  # 1-minute samples: the CD truth thresholds from tonic_train.py --cd


def fgroup(folder):
    for k in ("Amma Bhajans 2024", "Amma Bhajans 2025 UPD", "Amma Bhajans 2021", "Amma Bhajans 2020"):
        if k in folder:
            return k.replace("Amma Bhajans ", "")
    return "other folders"


def fmt(c):
    tot = sum(c.values())
    if not tot:
        return "n=0"
    return (f"n={tot:3} exact={c[0] / tot:5.1%} within1={(c[0] + c[1] + c[-1]) / tot:5.1%}  "
            + " ".join(f"{d:+d}:{c[d]}" for d in range(-5, 7) if c[d]))
# default: only sheets that are really this song (sheet_trust.json) and whose Sa position
# (sheet_sa.json) is high confidence
HIGH_ONLY = "--all" not in sys.argv


def tmpl(rec, sheet_hist, off=0):
    """Sheet-template Sa (key root + sheet_sa offset) on one recording."""
    if rec is None:
        return None
    H, _ = pitch.pc_hist(rec["f0"])
    t, c, m = T.template(H, sheet_hist)
    return {"pc": (t[0][1] + off) % 12, "corr": round(c, 3), "margin": round(m, 3)}


def near(pred, pcs):
    """Signed difference from pred to the nearest allowed human pitch class."""
    return min((T.signed(pred - h) for h in pcs), key=abs)


def main():
    sheet = json.loads((HERE / "features" / "sheet.json").read_text())
    rub = json.loads((HERE / "rubric.json").read_text())
    box = json.loads((HERE / T.MATCHES).read_text())
    idx = {e["n"]: e for e in json.loads((HERE.parent.parent / "public" / "bhajan-index2.json").read_text())}
    ssa = T.sheet_sa()
    trust = T.sheet_trust()
    rows = []
    for name, sv in sheet.items():
        sa = ssa.get(name) or {"sa_offset": 0, "confidence": "low"}
        if HIGH_ONLY and (sa["confidence"] != "high" or trust.get(name) not in T.TRUSTED):
            continue
        off = sa["sa_offset"]
        hum = (rub.get(name) or {}).get("shruti_pcs") or []
        cs = (idx.get(name) or {}).get("cs") or []
        m = box.get(name) or []
        if not hum or not cs or not m or not m[0]["accept"]:
            continue
        b = tmpl(T.load_box(m[0]["id"]), sv["pc_hist"], off)
        samples = [(u, tmpl(T.load_cd(u), sv["pc_hist"], off)) for u in cs]
        samples = [(u, s) for u, s in samples if s]
        if b is None and not samples:
            continue
        rows.append({"song": name, "human": hum, "human_raw": rub[name]["shruti_raw"], "box_id": m[0]["id"],
                     "box_folder": m[0]["folder"], "sa_offset": off, "sa_conf": sa["confidence"], "box": b, "cd": [{"url": u, **s} for u, s in samples]})

    def conf(t):
        return t is not None and t["corr"] >= CORR and t["margin"] >= MARGIN

    def cconf(t):
        return t is not None and t["corr"] >= CD_CORR and t["margin"] >= CD_MARGIN

    byf = collections.defaultdict(collections.Counter)

    tabs = {"sample-human": collections.Counter(), "box-human": collections.Counter(),
            "sample-box": collections.Counter(), "sample-human(single-label)": collections.Counter(),
            "box-human(single-label)": collections.Counter()}
    n_s = n_b = n_sb = 0
    for r in rows:
        cds = [c for c in r["cd"] if cconf(c)]
        fg = fgroup(r["box_folder"])
        single = len(r["human"]) == 1
        if cds:
            n_s += 1
            d = near(cds[0]["pc"], r["human"])
            tabs["sample-human"][d] += 1
            byf[("sample-human", fg)][d] += 1
            if single:
                tabs["sample-human(single-label)"][d] += 1
        if conf(r["box"]):
            n_b += 1
            d = near(r["box"]["pc"], r["human"])
            tabs["box-human"][d] += 1
            byf[("box-human", fg)][d] += 1
            if single:
                tabs["box-human(single-label)"][d] += 1
        if cds and conf(r["box"]):
            n_sb += 1
            tabs["sample-box"][T.signed(cds[0]["pc"] - r["box"]["pc"])] += 1
    print(f"songs with sheet+human+cs+box features: {len(rows)}; confident sample {n_s}, box {n_b}, both {n_sb}")
    print(f"(confident: Box corr >= {CORR}, margin >= {MARGIN}; CD sample corr >= {CD_CORR}, margin >= {CD_MARGIN};"
          " human diff = to nearest listed shruti)")
    for k, c in tabs.items():
        tot = sum(c.values())
        if not tot:
            continue
        line = " ".join(f"{d:+d}:{c[d]}" for d in range(-5, 7) if c[d])
        print(f"{k:28} n={tot:3}  exact={c[0] / tot:5.1%}  within1={(c[0] + c[1] + c[-1]) / tot:5.1%}  {line}")
    # ---- paired test (no sample-side confidence needed): which rotation of the sheet fits the
    # CD sample better, the Box template tonic or the human label?
    pair = collections.Counter()
    for r in rows:
        if not conf(r["box"]) or not r["cd"] or len(r["human"]) != 1:
            continue  # single-label songs only, so picking the best-fitting label cannot bias it
        rec = T.load_cd(r["cd"][0]["url"])
        H, _ = pitch.pc_hist(rec["f0"])
        sh = sheet[r["song"]]["pc_hist"]
        t = {(pc + r["sa_offset"]) % 12: c for c, pc in T.template(H, sh)[0]}
        hb = r["box"]["pc"]
        hh = max(r["human"], key=lambda h: t[h])
        if hh == hb:
            pair["human == box tonic"] += 1
        else:
            pair["sample fits box tonic better" if t[hb] > t[hh] else "sample fits human label better"] += 1
    print("paired test (confident-Box sheet songs, single human label):", dict(pair))

    # ---- sheet-free direct test: rotate the CD sample's histogram against the Box recording's
    direct = collections.Counter()
    drows = []
    for name, cs in ((n, (idx.get(n) or {}).get("cs") or []) for n in box):
        m = box.get(name) or []
        if not cs or not m or not m[0]["accept"]:
            continue
        brec = T.load_box(m[0]["id"])
        crec = T.load_cd(cs[0])
        if brec is None or crec is None:
            continue
        hb, _ = pitch.pc_hist(brec["f0"])
        hc, _ = pitch.pc_hist(crec["f0"])
        t = pitch.template_tonic(hb, hc)  # rotation k: sample shifted up k semitones matches Box
        rot, c, mg = t[0][1], t[0][0], t[0][0] - t[1][0]
        drows.append({"song": name, "box_id": m[0]["id"], "url": cs[0], "rot_box_minus_cd": T.signed(rot),
                      "corr": round(c, 3), "margin": round(mg, 3)})
        if c >= 0.9 and mg >= 0.15:
            direct[T.signed(rot)] += 1
            byf[("direct box-cd", fgroup(m[0]["folder"]))][T.signed(rot)] += 1
    tot = sum(direct.values())
    print(f"direct CD-vs-Box histogram rotation (corr>=0.9, margin>=0.15): n={tot} of {len(drows)} pairs; "
          + " ".join(f"{d:+d}:{direct[d]}" for d in range(-5, 7) if direct[d]))

    # ---- chained: CD tonic = confident Box template tonic - (Box - CD rotation); compare with human
    chain = collections.Counter()
    dmap = {d["song"]: d for d in drows}
    for r in rows:
        d = dmap.get(r["song"])
        if conf(r["box"]) and d and d["corr"] >= 0.9 and d["margin"] >= 0.15:
            cd_pc = (r["box"]["pc"] - d["rot_box_minus_cd"]) % 12
            chain[near(cd_pc, r["human"])] += 1
            byf[("chained cd-human", fgroup(r["box_folder"]))][near(cd_pc, r["human"])] += 1
    tot = sum(chain.values())
    if tot:
        print(f"chained CD tonic - human: n={tot} exact={chain[0] / tot:.1%} "
              + " ".join(f"{d:+d}:{chain[d]}" for d in range(-5, 7) if chain[d]))
    # ---- independent referee: Essentia's drone tonic (Sa or Pa of it) on the disagreements
    ref = collections.Counter()
    for r in rows:
        cands = []
        if conf(r["box"]):
            cands.append(("box", T.load_box(r["box_id"]), r["box"]["pc"]))
        cds = [c for c in r["cd"] if cconf(c)]
        if cds:
            cands.append(("cd", T.load_cd(cds[0]["url"]), cds[0]["pc"]))
        for kind, rec, pc in cands:
            if pc in r["human"]:
                continue
            vec = T.rec_vectors(rec)
            if vec is None or not vec["ESS"].any():
                continue
            e = int(vec["ESS"].argmax())
            ft = (e - pc) % 12 in (0, 7)
            fh = any((e - h) % 12 in (0, 7) for h in r["human"])
            ref[(kind, "template only" if ft and not fh else "human only" if fh and not ft
                 else "both" if ft else "neither")] += 1
    print("Essentia drone tonic (as Sa or Pa) on template-vs-human disagreements supports:",
          {f"{a}: {b}": v for (a, b), v in sorted(ref.items())})
    print("\nby Box source folder:")
    for k in sorted(byf):
        print(f"  {k[0]:18} {k[1]:14} {fmt(byf[k])}")
    out = {"essentia_referee": {f"{a}: {b}": v for (a, b), v in ref.items()}, "by_folder": {f"{a} | {b}": dict(v) for (a, b), v in byf.items()}, "paired": dict(pair), "direct": dict(direct), "chained_cd_minus_human": dict(chain), "direct_rows": drows,
           "corr": CORR, "margin": MARGIN, "tables": {k: dict(v) for k, v in tabs.items()}, "rows": rows}
    (HERE / "features" / "tonic_task1.json").write_text(json.dumps(out, indent=1))


if __name__ == "__main__":
    main()
