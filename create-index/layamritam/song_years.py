#!/usr/bin/env python3
"""Give each index song the year it was first sung, as far as the data can tell (`y`).

Sources, in order:
1. Layamritam's `recordingYear` for every recording matched to the song (matches.json
   lyrics / lyrics+title / title, plus the extra-book songs of extra-manifest.json). The
   song gets the earliest one.
2. A recording can be a re-recording of a much older song (Vol 1 songs re-recorded for
   the 2020/2025 albums). A song cannot be newer than the last edition of a book it is
   printed in, so a year after that edition is dropped. Edition years are read from
   the books' front pages (BOOK_LATEST); Vol 3 prints none and gets 2009, the year
   Vol 1 and Vol 2 were reissued.
3. Songs Layamritam doesn't date that are printed in a 2019-2025 supplement get the
   supplement's year: for dated songs it equals the earliest recording 99% of the time
   (2018supl is off by one for 30%, so it is not used).

Everything else (mostly songs only in the old volumes, whose year can only be narrowed
to a decade) has no `y`. song-years.json keeps every year seen and where it came from.

Writes `y` into public/bhajan-index2.json in place (see create-index README: a full
rebuild reorders other fields). Idempotent. Run from the repo root:
    python3 create-index/layamritam/song_years.py [--dry-run]
"""
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
INDEX = ROOT / "public" / "bhajan-index2.json"
CATALOG = ROOT / "layamritam" / "songs_catalog.json"
OUT = HERE / "song-years.json"
MATCHED = {"lyrics", "lyrics+title", "title"}

# Latest edition or printing named on each volume's front page (public/pdfs/volN.pdf).
BOOK_LATEST = {"vol1": 2009, "vol2": 2009, "vol3": 2009, "vol4": 2011, "vol5": 2011,
               "vol6": 2011, "vol7": 2017}
# Location prefixes that are other editions of a volume.
ALIAS = {"voli0": "vol1", "voli1": "vol1", "voli2": "vol2", "voli3": "vol3", "vol3old": "vol3",
         "ii1": "vol2"}
SUPPLEMENT_YEAR_FROM = 2019


def book_of(loc):
    prefix = re.sub(r"-\d+$", "", loc)
    return ALIAS.get(prefix, prefix)


def latest_possible(locs):
    """The last year a song printed at these locations can come from (None: no bound)."""
    bounds = []
    for loc in locs:
        b = book_of(loc)
        if b in BOOK_LATEST:
            bounds.append(BOOK_LATEST[b])
        elif m := re.match(r"(\d{4})(supl\d?)?$", b):
            bounds.append(int(m.group(1)))
    return min(bounds) if bounds else None


def supplement_year(locs):
    years = [int(m.group(1)) for b in map(book_of, locs) if (m := re.match(r"(\d{4})(supl\d?)?$", b))]
    return min(years) if years and min(years) >= SUPPLEMENT_YEAR_FROM else None


def main():
    dry = "--dry-run" in sys.argv
    index = json.loads(INDEX.read_text())
    names = {s["n"] for s in index}
    catalog = {str(s["songId"]): s for s in json.loads(CATALOG.read_text())}
    matches = json.loads((HERE / "matches.json").read_text())
    manifest = json.loads((HERE / "extra-manifest.json").read_text())

    recordings = defaultdict(dict)  # song name -> {songId: year}
    for sid, m in matches.items():
        if m["decision"] in MATCHED and m["name"] in names:
            recordings[m["name"]][sid] = catalog[sid].get("recordingYear")
    for e in manifest:
        name = e.get("mergedInto") or e["n"]
        for sid in [e["songId"], *e.get("same", [])]:
            recordings[name][str(sid)] = catalog[str(sid)].get("recordingYear")

    out, stats = {}, Counter()
    for song in index:
        name, locs = song["n"], song["l"]
        recs = {sid: y for sid, y in recordings.get(name, {}).items() if y}
        bound = latest_possible(locs)
        kept = {sid: y for sid, y in recs.items() if bound is None or y <= bound}
        year, src = None, None
        if kept:
            year, src = min(kept.values()), "recording"
        elif (sy := supplement_year(locs)) is not None:
            year, src = sy, "songbook"
        if recs and len(kept) < len(recs):
            stats["re-recordings dropped" if kept or year else "songs whose only recordings are re-recordings"] += 1
        stats[src or "no year"] += 1
        if year is not None:
            song["y"] = year
        else:
            song.pop("y", None)
        if recs or year:
            out[name] = {"y": year, "src": src, "latestPossible": bound,
                         "recordings": dict(sorted(recs.items(), key=lambda kv: (kv[1], int(kv[0]))))}

    print(dict(stats), "of", len(index), "songs")
    if not dry:
        INDEX.write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")))
        OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1, sort_keys=True) + "\n")
        print(f"wrote y into {INDEX.relative_to(ROOT)} and {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
