#!/usr/bin/env python3
"""Read the time signature(s) out of each song's sheet-music PDF (vector Finale exports).

Writes features/sheet_meter.json:
  {song: {file, time_signatures: ["6/8", ...] in order of appearance, first, changes,
          how: "glyph"|"path"|"none", measures, [note]}}

Finale draws a time signature as stacked digit glyphs of the music font (Maestro or
Petrucci) at the same x: numerator on the 4th staff line (pos 6), denominator on the 2nd
(pos 2).  Maestro stores digits as the plain chars "(4)"; Petrucci/Maestro-with-codes store
them as code 0x13 + digit (<0017> = 4).  Two-digit numbers (12/8) are adjacent glyphs.
Common time / cut time are single glyphs centred on the staff (pos 4) after the clef/key.
Uses the bhajan-transpose skill's parser (staves, barlines). Run:
  uv run --no-project -q --with pymupdf python sheet_meter.py
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(ROOT / ".claude/skills/bhajan-transpose/scripts"))
import pymupdf  # noqa: E402
from score import Page  # noqa: E402

PDF_DIRS = [ROOT.parent / "bhajans2-sheetmusic-transposed"]
CACHE = HERE / "features" / "pdf-cache"
S3 = "https://singwithamma.s3.amazonaws.com/sheetmusic/"
OUT = HERE / "features" / "sheet_meter.json"
SHEET = HERE / "features" / "sheet.json"


def local_pdf(name):
    for d in PDF_DIRS:
        if (d / name).exists():
            return d / name
    CACHE.mkdir(parents=True, exist_ok=True)
    p = CACHE / name
    if not p.exists():
        for attempt in range(4):
            try:
                urllib.request.urlretrieve(S3 + urllib.parse.quote(name), p)
                break
            except Exception:
                if attempt == 3:
                    raise
                time.sleep(1 + attempt)
    return p


def digit_of(code):
    """Raw Tj operand -> digit char, or None."""
    m = re.fullmatch(r"\((\d)\)", code)
    if m:
        return m.group(1)
    m = re.fullmatch(r"<([0-9A-Fa-f]{4})>", code)
    if m:
        v = int(m.group(1), 16) - 0x13
        if 0 <= v <= 9:
            return str(v)
    return None


def cluster(units, size):
    """Group digit units on one row into numbers: adjacent glyphs within ~0.8 em."""
    units = sorted(units, key=lambda u: u.x)
    groups = []
    for u in units:
        if groups and u.x - groups[-1][-1].x < size * 0.8:
            groups[-1].append(u)
        else:
            groups.append([u])
    return groups


def staff_sigs(pg, s):
    """Time signatures on one staff, left to right: [(x, 'n/d'|'C'|'C|', how)]."""
    us = [u for u in pg.units if u.kind == "text" and u.staff is s and u.family and u.code]
    size = pg.music_size
    sigs = []
    top, bot = [], []
    for u in us:
        d = digit_of(u.code.decode("latin1"))
        if d is None or u.size < size * 0.85:
            continue
        p = s.pos(u.y)
        u.d = d
        if abs(p - 6) < 0.3:
            top.append(u)
        elif abs(p - 2) < 0.3:
            bot.append(u)
    tg, bg = cluster(top, size), cluster(bot, size)
    used = set()
    for t in tg:
        cx = (t[0].x + t[-1].x) / 2
        best = None
        for i, b in enumerate(bg):
            if i in used:
                continue
            dx = abs((b[0].x + b[-1].x) / 2 - cx)
            if dx < size * 0.5 and (best is None or dx < best[0]):
                best = (dx, i)
        if best:
            used.add(best[1])
            b = bg[best[1]]
            n = "".join(u.d for u in t)
            d = "".join(u.d for u in b)
            sigs.append((min(t[0].x, b[0].x), f"{int(n)}/{int(d)}", "glyph"))
    return sigs


def odd_glyphs(pg, s):
    """Unrecognised music-font glyphs centred on the staff before the first note (common/cut time?)."""
    us = [u for u in pg.units if u.kind == "text" and u.staff is s and u.family]
    heads = [u.x for u in us if u.role in ("note", "half", "whole", "rest")]
    fx = min(heads + [s.x1])
    return [u for u in us if u.role == "unknown" and u.x < fx and abs(s.pos(u.y) - 4) < 0.3]


def analyse(args):
    song, name = args
    res = {"file": name, "time_signatures": [], "first": None, "changes": 0, "how": "none", "measures": 0}
    try:
        doc = pymupdf.open(str(local_pdf(name)))
    except Exception as e:  # noqa: BLE001
        res["note"] = f"open failed: {e}"
        return song, res
    sigs, measures, odd = [], 0, []
    try:
        for i in range(len(doc)):
            pg = Page(doc, i)
            for s in pg.staves:
                for x, t, how in staff_sigs(pg, s):
                    sigs.append(t)
                # barlines: all but the staff's opening line
                measures += max(0, len([b for b in s.barxs if b > s.x0 + 2]))
                for u in odd_glyphs(pg, s):
                    odd.append((u.family, u.code.decode("latin1")))
    except Exception as e:  # noqa: BLE001
        res["note"] = f"parse failed: {e}"
    # collapse consecutive repeats of the same signature (a restated sig is not a change)
    seq = []
    for t in sigs:
        if not seq or seq[-1] != t:
            seq.append(t)
    res["time_signatures"] = seq
    res["measures"] = measures
    if seq:
        res["first"] = seq[0]
        res["changes"] = len(seq) - 1
        res["how"] = "glyph"
    if odd:
        res["unknown_glyphs"] = sorted({f"{a}:{b}" for a, b in odd})
    return song, res


def main():
    sheet = json.loads(SHEET.read_text())
    jobs = [(k, v["file"]) for k, v in sheet.items()]
    out = {}
    with ProcessPoolExecutor(12) as ex:
        for k, r in ex.map(analyse, jobs, chunksize=4):
            out[k] = r
    OUT.write_text(json.dumps(out, indent=1, ensure_ascii=False))
    from collections import Counter
    c = Counter(r["first"] or "none" for r in out.values())
    print(len(out), "songs;", sum(1 for r in out.values() if r["changes"]), "change meter")
    for k, v in c.most_common():
        print(f"{v:5d}  {k}")


if __name__ == "__main__":
    main()
