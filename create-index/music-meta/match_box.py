#!/usr/bin/env python3
"""Match each song in public/bhajan-index2.json to recordings in the Box inventory.

Writes box-matches.json: {song_name: [{id, name, folder, score}, ...]} best first.
Box titles are usually the first few words of the bhajan's first line, with
diacritics, track numbers and the odd suffix ("WM", "(Vintage)", "(bhagesri)").
"""
import json
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

from rapidfuzz import fuzz, process

HERE = Path(__file__).parent
INDEX = HERE.parent.parent / "public" / "bhajan-index2.json"
INVENTORY = HERE.parent / "box" / "box-inventory.json"
OUT = HERE / "box-matches.json"

AUDIO_EXT = {"mp3", "m4a", "wav", "aif"}
SKIP_FOLDERS = ("1 MP3/Talks", "1 MP3/Playlists", "1 MP3/Amma/For Mike")
# Higher = preferred recording of the same song (Amma's studio releases first).
FOLDER_RANK = [
    ("1 MP3/Amma/Amma Bhajans 2025 UPD", 9), ("1 MP3/Amma/Amma Bhajans 20", 8),
    ("1 MP3/Amma/Amritanjali", 7), ("1 MP3/Amma/World Tour Albums", 6),
    ("1 MP3/Amma/Languages", 5), ("1 MP3/Amma/", 4), ("1 MP3/Swami Bhajans", 2),
    ("1 MP3/Amma's Devotees/Instrumental", 0), ("1 MP3/", 1),
]


def folder_rank(folder):
    return next(r for p, r in FOLDER_RANK if folder.startswith(p))
LANG_WORDS = r"(malayalam|hindi|sanskrit|tamil|telugu|kannada|bengali|marathi|gujarati|punjabi|oriya|odia|tulu|english|french|german|spanish|italian|japanese|braj bhasha|version|kannada version|assamese|nepali|konkani|rajasthani|bhojpuri)"


def ascii_fold(s):
    s = unicodedata.normalize("NFKD", s)
    return "".join(c for c in s if not unicodedata.combining(c))


sys.path.insert(0, str(HERE.parent))
from bkey import bkey, oneWordKey  # noqa: E402  shared phonetic key (src/bkey-rules.json)


def phonetic(s):
    """The app's shared key (src/bkey-rules.json) as one word, collapsed a little further for
    Box track titles, which are typed by many hands: y/i, remaining vowel length, doubled letters."""
    k = oneWordKey(s)
    for a, b in [("y", "i"), ("aa", "a"), ("ee", "i"), ("oo", "u"), ("ii", "i"), ("uu", "u")]:
        k = k.replace(a, b)
    return re.sub(r"(.)\1+", r"\1", k)


def clean_index_name(n):
    n = re.sub(r"\(" + LANG_WORDS + r"[^)]*\)", " ", n.lower())
    n = re.sub(r"\b" + LANG_WORDS + r"\s*$", " ", n)
    return phonetic(ascii_fold(n).replace("-", " "))


def clean_box_name(n):
    n = ascii_fold(n).lower()
    n = re.sub(r"\.(mp3|m4a|wav|aif)$", "", n)
    n = re.sub(r"^\s*(\d+-)?\d+\s*[-.]?\s*", "", n)  # "01 ", "1-04 ", "12. "
    n = re.sub(r"\b(wm|44k16b\S*|\d{6})\b", " ", n)
    hint = re.findall(r"\(([^)]*)\)", n)
    n = re.sub(r"\([^)]*\)?", " ", n).replace("-", " ").replace("_", " ")
    return phonetic(n), hint


def main():
    index = json.loads(INDEX.read_text())
    inv = json.loads(INVENTORY.read_text())
    files = [
        f for f in inv["files"]
        if f["ext"] in AUDIO_EXT and not f["folder"].startswith(SKIP_FOLDERS)
    ]
    box_keys, meta = [], []
    for f in files:
        key, hint = clean_box_name(f["name"])
        if len(key) < 4:
            continue
        box_keys.append(key)
        meta.append({**f, "hint": hint})

    out = {}
    for song in index:
        keys = {clean_index_name(song["n"])} | {phonetic(ascii_fold(c)) for c in song.get("cn", [])}
        cands = defaultdict(float)
        for key in keys:
            if not key:
                continue
            for _, _, i in process.extract(key, box_keys, scorer=fuzz.WRatio, limit=15):
                b = box_keys[i]
                # Box titles are prefixes of the first line: compare against the same-length prefix.
                # Box titles are the first words of the song: align the title inside the key.
                a = fuzz.partial_ratio_alignment(b, key) if len(b) <= len(key) + 2 else None
                s = max(a.score if a and a.dest_start <= 2 else 0, fuzz.ratio(b, key))
                cands[i] = max(cands[i], s)
        # Best text match first; among near-ties (within 3 points) prefer canonical albums.
        top = max(cands.values(), default=0)
        ranked = sorted(
            cands.items(),
            key=lambda kv: (-(kv[1] >= top - 3), -folder_rank(meta[kv[0]]["folder"]), -kv[1]),
        )
        out[song["n"]] = [
            {
                "id": meta[i]["id"],
                "name": meta[i]["name"],
                "folder": meta[i]["folder"],
                "size": meta[i]["size"],
                "hint": meta[i]["hint"],
                "score": round(s, 1),
                # accept only when the text score is high AND the Box title is a word-prefix of the
                # song key (or the other way round): a high fuzz score alone linked "Mama Janani" to "amba janani"
                "accept": s >= 90,
            }
            for i, s in ranked if s >= 70
        ][:12]
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1))
    n = len(index)
    for t in (95, 90, 85, 80):
        hit = sum(1 for v in out.values() if v and v[0]["score"] >= t)
        print(f"best score >= {t}: {hit}/{n} ({hit / n:.0%})")


if __name__ == "__main__":
    main()
