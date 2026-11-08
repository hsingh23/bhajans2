#!/usr/bin/env python3
"""Join every Layamritam disagreement row (../metadata-review.csv) with the evidence we hold.

Per row: the index entry, every Layamritam song the row names (catalog labels, IAST lyrics,
meanings, which script translations are locked, lyricSourceSongId), and the index song's
printed songbook text. Writes rows.json next to this script.

Run from the repo root: uv run --with rapidfuzz python create-index/layamritam/adjudicate/build_rows.py
"""
import csv
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).parent
LAY = HERE.parent
ROOT = LAY.parent.parent
sys.path.insert(0, str(LAY.parent / "sheet-match"))
sys.path.insert(0, str(LAY))
import lmeta  # noqa: E402
import match as M  # noqa: E402

DUMP = ROOT / "layamritam"


def main():
    meta = lmeta.load_metadata()
    cat = {s["songId"]: s for s in json.loads((DUMP / "songs_catalog.json").read_text())}
    index = json.loads(M.INDEX.read_text())
    by_name = {s["n"]: i for i, s in enumerate(index)}
    books = json.loads((LAY.parent / "sheet-match" / "books.json").read_text())
    pages, heads, starts = M.book_pages(books)
    printed = {}
    for i, book, page, _placed, text in M.song_segments(index, pages, heads, starts):
        printed.setdefault(i, []).append(text)
    audio = {int(f.name.split(" ")[0]): f.name for f in (DUMP / "audio").iterdir() if f.name[0].isdigit()}

    def lay_song(sid):
        s = cat[sid]
        f = DUMP / "lyrics" / f"{sid}.json"
        parts = sorted((json.loads(f.read_text()).get("parts") or []) if f.exists() else [],
                       key=lambda p: p["displayOrder"])
        locked = sorted({meta["language"].get(t["languageId"], t["languageId"])
                         for p in parts for t in p.get("LyricPartTranslations") or [] if t.get("lyricsLockedYN") == "Y"})
        lab = lmeta.labels(s, meta)
        return {
            "songId": sid, "title": s["songTitle"], "lg_raw": meta["language"].get(s.get("languageId")),
            "lg": lab["lg"], "d": lab["d"], "ragas": lab["ragas"], "taals": lab["taals"],
            "taal_raw": [meta["taalam"].get(x["taalamId"]) for x in s.get("SongTaalams", [])],
            "deity_raw": [meta["deity"].get(x["deityId"]) for x in s.get("SongDeities", [])],
            "year": s.get("recordingYear"), "len": s.get("songLengthSecs"),
            "lyricSourceSongId": s.get("lyricSourceSongId"), "locked_scripts": locked,
            "lyrics": [(p.get("lyrics") or "") for p in parts],
            "meaning": [(p.get("meaning") or "") for p in parts],
            "starts": [p.get("startMSs") for p in parts],
            "audio": audio.get(sid),
        }

    rows = []
    for r in csv.DictReader((LAY / "metadata-review.csv").open()):
        ids = [int(x) for x in re.findall(r"\[(\d+)\]", r["layamritam_songs"])]
        if not ids and r["layamritam_songs"].strip().isdigit():
            ids = [int(r["layamritam_songs"])]
        idx_name = r["app"] if r["kind"] == "new song" else r["song"]
        i = by_name.get(idx_name)
        new_i = by_name.get(r["song"]) if r["kind"] == "new song" else None
        rows.append({
            **r, "ids": ids,
            "index": index[i] if i is not None else None, "index_pos": i,
            "printed": printed.get(i, []),
            "new_entry": index[new_i] if new_i is not None else None,
            "lay": [lay_song(s) for s in ids if s in cat],
        })
    (HERE / "rows.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1))
    print(len(rows), "rows;", sum(1 for r in rows if r["index"] is None), "without index entry")


if __name__ == "__main__":
    main()
