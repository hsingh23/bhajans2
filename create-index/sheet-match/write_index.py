#!/usr/bin/env python3
"""Write the sheet-music links (`sm`) from matches.json into public/bhajan-index2.json.

For every song the files are ordered: the file it already opened by default first (if
that stem is still linked), then the original uploads (the pre-transposition list), then
the generated keys in the order of sheetmusiclist.txt.
Run: python3 write_index.py [--check]   (--check only reports what would change)
"""
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
INDEX = ROOT / "public" / "bhajan-index2.json"
LIST = ROOT / "create-index" / "sheetmusiclist.txt"
ORIG = HERE / "sheetmusiclist.orig.txt"
FILE_RE = re.compile(r"^(?P<song>.*?)(?P<root>[A-G])(?P<acc>sharp|#|b)?(?P<minor>m)?(?P<orig>o)?\.pdf$")


def stem_of(f):
    m = FILE_RE.match(f)
    return m.group("song") if m and m.group("song") else f


def main():
    check = "--check" in sys.argv
    index = json.loads(INDEX.read_text())
    matches = json.loads((HERE / "matches.json").read_text())
    files = [l.strip() for l in LIST.read_text().splitlines() if l.strip().endswith(".pdf")]
    originals = {l.strip() for l in ORIG.read_text().splitlines()} if ORIG.exists() else set()
    by_stem = defaultdict(list)
    for f in files:
        by_stem[stem_of(f)].append(f)
    for stem, fs in by_stem.items():  # originals first, otherwise keep list order
        fs.sort(key=lambda f: (f not in originals,))

    song_stems = defaultdict(list)
    for stem, v in matches.items():
        for song in v["songs"]:
            song_stems[song].append(stem)

    changed = added = removed = 0
    for s in index:
        old = s.get("sm", [])
        new = []
        for stem in song_stems.get(s["n"], []):
            new.extend(by_stem.get(stem, []))
        if old and old[0] in new:  # keep the key the app opened by default
            new.remove(old[0])
            new.insert(0, old[0])
        if new != old:
            changed += 1
            added += len(set(new) - set(old))
            removed += len(set(old) - set(new))
        if new:
            s["sm"] = new
        else:
            s.pop("sm", None)
    print(f"songs changed: {changed}, files added: {added}, files removed: {removed}, songs with sheet music: {sum(1 for s in index if s.get('sm'))}")
    if not check:
        INDEX.write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")))
        # cdbaby/mergelinks.js copies these lists back in whenever create-index.py rebuilds the index
        (HERE / "sm.json").write_text(json.dumps({s["n"]: s["sm"] for s in index if s.get("sm")}, ensure_ascii=False, indent=0))
        print("wrote", INDEX, "and sm.json")


if __name__ == "__main__":
    main()
