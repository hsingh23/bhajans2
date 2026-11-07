#!/usr/bin/env python3
"""Decide whether each song's sheet-music link really is that song.

The index's `sm` links came from fuzzy name matching; short titles collapsed many
songs onto one PDF (e.g. "Amme*.pdf" is linked to 69 songs). A sheet is trusted when
  - its melody fits the song's own recording (sheet-template correlation >= 0.85
    with a clear margin), or
  - no audio check is possible and the PDF stem is linked to this song only.
It is "mismatch" when the recording clearly does not fit (corr < 0.6) and the
stem is shared; otherwise "unverified".
Writes features/sheet_trust.json {song: {trust, corr, margin, shared_with}}.
"""
import json
import re
from collections import defaultdict
from pathlib import Path

from pitch import load, pc_hist, template_tonic

HERE = Path(__file__).parent
ROOT = HERE.parent.parent


def stem(f):
    return re.sub(r"([A-G](sharp|#|b)?m?o?)\.pdf$", "", f)


def main():
    index = json.loads((ROOT / "public/bhajan-index2.json").read_text())
    sheet = json.loads((HERE / "features/sheet.json").read_text())
    matches = json.loads((HERE / "box-matches-verified.json").read_text())
    users = defaultdict(set)
    for s in index:
        for f in s.get("sm", []):
            users[stem(f)].add(s["n"])
    out = {}
    for name, sh in sheet.items():
        if "error" in sh:
            continue
        shared = sorted(users[stem(sh["file"])] - {name})
        corr = margin = None
        m = matches.get(name)
        if m and m[0].get("accept"):
            d = load(m[0]["id"])
            if d is not None:
                h, _ = pc_hist(d["f0"])
                best = template_tonic(h, sh["pc_hist"])
                corr, margin = round(best[0][0], 3), round(best[0][0] - best[1][0], 3)
        if corr is not None and corr >= 0.85 and margin >= 0.15:
            trust = "trusted"
        elif corr is not None and corr < 0.6 and shared:
            trust = "mismatch"
        elif corr is None and not shared:
            trust = "trusted-unique"
        else:
            trust = "unverified"
        out[name] = {"trust": trust, "corr": corr, "margin": margin, "file": sh["file"],
                     "shared_with": shared[:10], "n_shared": len(shared)}
    (HERE / "features/sheet_trust.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    from collections import Counter
    print(Counter(v["trust"] for v in out.values()))
    print("shared-stem songs by trust:", Counter(v["trust"] for v in out.values() if v["n_shared"]))


if __name__ == "__main__":
    main()
