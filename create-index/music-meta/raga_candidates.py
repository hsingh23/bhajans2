#!/usr/bin/env python3
"""Deterministic raga evidence + candidate ranking for each song.

Evidence (relative to Sa):
  sheet: exact melody notes -> swara weights, which swaras are used going up vs
         down (aroha/avaroha evidence), per-section swara sets (raga changes);
  audio: tuning-corrected pitch-class histogram of the recording, whole song and
         per 30 s window (needs Sa from features/tonic.json, else sheet Sa).
Candidates: every raga in reference/ragas.json scored on how well its note set
explains the song's notes (missing raga notes cost little, extra song notes cost
a lot unless they are rare / listed anya swaras).
Writes features/raga_evidence.json. The final naming step is done by a model
that reads this evidence; this file only narrows and ranks.
"""
import json
from pathlib import Path

import numpy as np

from pitch import load, pc_hist
from tonic_feats import url_key

HERE = Path(__file__).parent
SW = ["S", "r1", "R2", "g2", "G3", "M1", "M2", "P", "d1", "D2", "n2", "N3"]


def ragas():
    return json.loads((HERE / "reference/ragas.json").read_text())


def score_raga(w, raga, rare=0.02):
    """w: 12 weights (sum 1) relative to Sa. Lower is better."""
    R = set(raga["pcs"])
    anya = {SW.index(s) for s in raga.get("anya_swaras", []) if s in SW} | set(raga.get("extra_pcs", []))
    used = {i for i in range(12) if w[i] >= rare}
    extra = sum(w[i] for i in used - R - anya) + 0.3 * sum(w[i] for i in used & anya - R)
    missing = len(R - used)
    return round(10 * extra + 0.35 * missing + 0.02 * len(R ^ used), 3)


def rank(w, table, k=6):
    return sorted(((score_raga(w, r), r["name"]) for r in table))[:k]


def direction_usage(notes):
    """Swaras approached from below (ascending) vs from above (descending)."""
    up, down = np.zeros(12), np.zeros(12)
    for a, b in zip(notes, notes[1:]):
        if b > a:
            up[b % 12] += 1
        elif b < a:
            down[b % 12] += 1
    return up, down


def sections(notes, n=48):
    out = []
    for i in range(0, max(len(notes) - n // 2, 1), n):
        seg = notes[i:i + n]
        h = np.bincount(np.array(seg) % 12, minlength=12).astype(float)
        out.append(h / h.sum())
    return out


def fmt(w, rare=0.02):
    return " ".join(f"{SW[i]}={int(round(100 * w[i]))}" for i in range(12) if w[i] >= rare)


def main():
    table = ragas()
    sheet = json.loads((HERE / "features/sheet.json").read_text())
    matches = json.loads((HERE / "box-matches-verified.json").read_text())
    tonic_p = HERE / "features/tonic.json"
    tonic = json.loads(tonic_p.read_text()) if tonic_p.exists() else {}
    sa_p = HERE / "features/tonic_sheet_sa.json"  # tonic-model overlay of sheet_sa.json
    if not sa_p.exists():
        sa_p = HERE / "features/sheet_sa.json"
    sheet_sa = json.loads(sa_p.read_text()) if sa_p.exists() else {}
    index_cs = {s["n"]: s.get("cs") or [] for s in json.loads((HERE.parent.parent / "public/bhajan-index2.json").read_text())}
    out = {}
    for name in index_cs:
        m = matches.get(name)
        ev = {}
        sh = sheet.get(name)
        if sh and "error" not in sh:
            so = sheet_sa.get(name, {}).get("sa_offset", 0)
            notes = [x - so for x in sh["notes"]]  # re-express relative to the chosen Sa
            w = np.roll(np.array(sh["pc_hist"]), -so)
            up, down = direction_usage(notes)
            secs = sections(notes)
            sec_sets = [fmt(s, 0.04) for s in secs]
            ev["sheet"] = {
                "key": sh["key"], "sa_offset_from_key_root": so,
                "sa_confidence": sheet_sa.get(name, {}).get("confidence"), "swaras": fmt(w), "rare": [SW[i] for i in range(12) if 0 < w[i] < 0.02],
                "ascending_use": fmt(up / max(up.sum(), 1), 0.01),
                "descending_use": fmt(down / max(down.sum(), 1), 0.01),
                "section_swaras": sec_sets, "candidates": rank(w, table),
                "section_candidates": [rank(s, table, 2) for s in secs],
            }
        rec = m[0] if m and m[0].get("accept") else None
        cd_src = None
        if not rec:
            # No Box recording: fall back to the CD sample's cached pitch track.
            for u in index_cs.get(name, []):
                f = HERE / "features/tonic_cache/cd" / f"{url_key(u)}.npz"
                t = [x for x in tonic.get(name, {}).get("recordings") or [] if x.get("source") == f"cd:{u}"]
                if f.exists() and t and t[0].get("tonic_pc") is not None:
                    rec, cd_src = {"id": f"cd:{u}"}, (dict(np.load(f)), t[0]["tonic_pc"])
                    break
        if rec:
            d = cd_src[0] if cd_src else load(rec["id"])
            sa = None
            t = [x for x in tonic.get(name, {}).get("recordings") or [] if x.get("source") == f"box:{rec['id']}"]
            if t and t[0].get("tonic_pc") is not None:
                sa = t[0]["tonic_pc"]
            if cd_src:
                sa = cd_src[1]
            elif sh and "error" not in sh:
                sa = None  # audio Sa unknown until tonic.json exists; fall back below
            if d is not None:
                h, off = pc_hist(d["f0"])
                if sa is None and sh and "error" not in sh:
                    from pitch import template_tonic
                    sa = (template_tonic(h, sh["pc_hist"])[0][1]
                          + sheet_sa.get(name, {}).get("sa_offset", 0)) % 12
                if sa is not None:
                    w = np.roll(h, -sa)
                    f0 = d["f0"]
                    win = 3000  # 30 s at 10 ms
                    wins = []
                    for i in range(0, len(f0) - win // 2, win):
                        seg = f0[i:i + win]
                        if (seg > 0).mean() > 0.3:
                            hw, _ = pc_hist(seg, off)
                            wins.append(np.roll(hw, -sa))
                    ev["audio"] = {
                        "source": rec["id"] if cd_src else f"box:{rec['id']}", "sa_pc": int(sa), "tuning_cents": round(off, 1),
                        "swaras": fmt(w), "candidates": rank(w, table),
                        "window_top": [rank(x, table, 1)[0][1] for x in wins],
                    }
        if ev:
            out[name] = ev
    (HERE / "features/raga_evidence.json").write_text(json.dumps(out, ensure_ascii=False, indent=0))
    print(f"evidence for {len(out)} songs; sheet {sum('sheet' in v for v in out.values())}, audio {sum('audio' in v for v in out.values())}")


if __name__ == "__main__":
    main()
