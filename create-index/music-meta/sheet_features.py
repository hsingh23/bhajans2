#!/usr/bin/env python3
"""Read the notes out of each song's sheet-music PDF (vector Finale exports).

For every index song with `sm` PDFs, pick the original-key file (suffix "o")
when present, else the first readable one, and write features/sheet.json:
  key, minor, sa_pc, notes (melody as semitones relative to Sa, in reading
  order), pc_hist (12 bins relative to Sa), swaras (pitch classes with >=1.5%
  of notes, as Carnatic swara names) and chords (as written, transposed to C).
Uses the bhajan-transpose skill's score parser. Run with `uv run --with pymupdf`.
"""
import json
import sys
import urllib.parse
import urllib.request
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(ROOT / ".claude/skills/bhajan-transpose/scripts"))
import keys as K  # noqa: E402
from score import Score  # noqa: E402

PDF_DIRS = [ROOT.parent / "bhajans2-sheetmusic-transposed"]
CACHE = HERE / "features" / "pdf-cache"
S3 = "https://singwithamma.s3.amazonaws.com/sheetmusic/"
SWARA = ["S", "r1", "R2", "g2", "G3", "M1", "M2", "P", "d1", "D2", "n2", "N3"]
NOTE = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]


def local_pdf(name):
    for d in PDF_DIRS:
        if (d / name).exists():
            return d / name
    CACHE.mkdir(parents=True, exist_ok=True)
    p = CACHE / name
    if not p.exists():
        urllib.request.urlretrieve(S3 + urllib.parse.quote(name), p)
    return p


def chord_rel(ch, sa):
    root = ch[0]
    acc = 1 if ch[1:2] == "#" else -1 if ch[1:2] == "b" else 0
    pc = (K.NAT[root] + acc - sa) % 12
    rest = ch[1 + (acc != 0):]
    return NOTE[pc] + rest


def analyse(song):
    files = song["sm"]
    ordered = sorted(files, key=lambda f: not (K.parse_filename(f) or (0, 0, False))[2])
    last_err = None
    for f in ordered[:4]:
        parsed = K.parse_filename(f)
        if not parsed:
            continue
        try:
            sc = Score(str(local_pdf(f)))
            midi = sc.pitches()
        except Exception as e:  # noqa: BLE001
            last_err = f"{f}: {e}"
            continue
        if len(midi) < 8:
            last_err = f"{f}: only {len(midi)} notes read"
            continue
        key = parsed[1]
        sa = key.pc
        rel = [m - sa for m in midi]
        hist = [0] * 12
        for r in rel:
            hist[r % 12] += 1
        n = len(rel)
        return {
            "name": song["n"],
            "file": f,
            "original_key_file": parsed[2],
            "key": str(key),
            "minor": key.minor,
            "sa_pc": sa,
            "n_notes": n,
            "range": [min(rel), max(rel)],
            "pc_hist": [round(h / n, 4) for h in hist],
            "swaras": [SWARA[i] for i in range(12) if hist[i] / n >= 0.015],
            "rare_swaras": [SWARA[i] for i in range(12) if 0 < hist[i] / n < 0.015],
            "notes": rel,
            "chords_in_C": [chord_rel(c, sa) for c in sc.chords()],
            "warnings": sc.warnings()[:5],
        }
    return {"name": song["n"], "error": last_err or "no parseable PDF"}


def main():
    index = json.loads((ROOT / "public/bhajan-index2.json").read_text())
    songs = [s for s in index if s.get("sm")]
    with ProcessPoolExecutor(12) as pool:
        res = list(pool.map(analyse, songs, chunksize=4))
    out = HERE / "features" / "sheet.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps({r["name"]: r for r in res}, ensure_ascii=False))
    ok = sum(1 for r in res if "error" not in r)
    print(f"{ok}/{len(res)} songs read; errors: {len(res) - ok}")
    for r in [r for r in res if "error" in r][:10]:
        print("  ", r["name"], "->", r["error"][:120])


if __name__ == "__main__":
    main()
