#!/usr/bin/env python3
"""Pick the Layamritam songs whose lyrics are not in any songbook and append them to the
manifest that orders the extra lyrics book (public/pdfs/extra.pdf).

A song is new when match_index.py found no index song with its lyrics: "missing",
"version" (another-language version of an index song) or "doubt" (an index song has the
same name and language but different lyrics, e.g. Omkara Divya Porule 47-66). Several
Layamritam recordings of one song (same language, shared lyrics) become one entry.

extra-manifest.json is append-only: songs already in it keep their place (and page) and
new ones go at the end, so links into the book never move. Run from the repo root:
    python3 create-index/layamritam/select_new.py [--dry-run]
"""
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / "sheet-match"))
import lmeta  # noqa: E402
from match import grams, norm  # noqa: E402
from rapidfuzz import fuzz  # noqa: E402

MANIFEST = HERE / "extra-manifest.json"
NEW_DECISIONS = {"missing", "version", "doubt"}
SAME_SONG = 0.6  # 5-gram containment between two Layamritam songs that makes them one song

def lyric_parts(parts, title=None):
    """Parts worth printing: drop a leading part that only repeats the title (its meaning is
    empty or just "(tamil)") - the printed heading already says it."""
    out = [p for p in parts if (p.get("lyrics") or "").strip()]
    if len(out) > 1:
        m0 = (out[0].get("meaning") or "").strip()
        if not m0 or re.fullmatch(r"\(.*\)", m0):
            first = norm(out[0]["lyrics"].split("(")[0])
            same_as_title = title and first and len(first) >= 5 and (
                fuzz.ratio(first, norm(lmeta.clean_title(title).split("(")[0])) >= 80
                or fuzz.partial_ratio(first, norm(lmeta.clean_title(title))) >= 90)
            if first and (same_as_title or norm(out[1]["lyrics"]).startswith(first[: max(5, len(first) - 2)])):
                out = out[1:]
    return out


def index_name(title, lg, taken):
    """The index name (`n`): the folded, lower-case printed title, alias included, plus the language."""
    main, alias = lmeta.display_title(title)
    t = lmeta.fold(main + (f" ({alias})" if alias else "")).lower().replace("ṙ", "r")
    t = re.sub(r"[\"“”‘’]", "", t)
    t = re.sub(r"[.#$\[\]/]+", " ", t)  # Firebase keys (favorites are stored under the name) forbid these
    t = re.sub(r"\s+", " ", t).strip(" .,-")
    n = f"{t} ({lg.lower()})" if lg and f"({lg.lower()})" not in t else t
    base, k = n, 2
    while n in taken:
        n = f"{base} {k}"
        k += 1
    taken.add(n)
    return n


def main(dry=False):
    matches = json.loads((HERE / "matches.json").read_text())
    index = json.loads(lmeta.ROOT.joinpath("public/bhajan-index2.json").read_text())
    meta = lmeta.load_metadata()
    songs = {str(s["songId"]): (s, p) for s, p in lmeta.load_songs()}
    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else []
    in_manifest = {str(e["songId"]) for e in manifest} | {str(x) for e in manifest for x in e.get("same", [])}

    cands = []
    for sid, m in matches.items():
        if m["decision"] not in NEW_DECISIONS or not m["hasLyrics"]:
            continue
        s, parts = songs[sid]
        lp = lyric_parts(parts, s["songTitle"])
        if not lp:
            continue
        lab = lmeta.labels(s, meta)
        g = grams(norm(" ".join(p["lyrics"] for p in lp)))
        if len(g) < 20:
            continue
        meanings = sum(1 for p in lp if (p.get("meaning") or "").strip() and not re.fullmatch(r"\s*\(.*\)\s*", p["meaning"]))
        key = norm(re.sub(r"\s+[A-G](#|b)?\s*$", "", lmeta.clean_title(s["songTitle"])))
        cands.append({"sid": sid, "g": g, "key": key, "lg": lab["lg"], "meanings": meanings, "len": len(g), "m": m, "s": s})

    # One entry per song: cluster recordings that share lyrics within a language.
    parent = {c["sid"]: c["sid"] for c in cands}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    by_lang = defaultdict(list)
    for c in cands:
        by_lang[c["lg"]].append(c)
    for group in by_lang.values():
        for i, a in enumerate(group):
            for b in group[i + 1:]:
                inter = len(a["g"] & b["g"])
                share = inter / min(a["len"], b["len"])
                if share >= SAME_SONG or (share >= 0.4 and a["key"] == b["key"]):
                    parent[find(a["sid"])] = find(b["sid"])
    for c in cands:  # Layamritam's own "lyrics come from song X" link
        src = str(c["s"].get("lyricSourceSongId") or "")
        if src in parent:
            parent[find(c["sid"])] = find(src)
    clusters = defaultdict(list)
    for c in cands:
        clusters[find(c["sid"])].append(c)

    taken = {s["n"] for s in index} | {e["n"] for e in manifest}
    added = []
    for members in sorted(clusters.values(), key=lambda ms: min(int(c["sid"]) for c in ms)):
        ids = {c["sid"] for c in members}
        if ids & in_manifest:
            continue
        best = max(members, key=lambda c: (c["meanings"], "vintage" not in c["s"]["songTitle"].lower(), c["len"], -int(c["sid"])))
        m = best["m"]
        entry = {
            "songId": int(best["sid"]),
            "same": sorted(int(c["sid"]) for c in members if c is not best),
            "n": index_name(best["s"]["songTitle"], best["lg"], taken),
            "title": best["s"]["songTitle"],
            "lg": best["lg"],
            "why": m["decision"],
            "versionOf": m.get("versionOf") or (m.get("name") if m["decision"] == "doubt" else None),
        }
        added.append(entry)
    print(f"candidates {len(cands)} -> {len(clusters)} songs; already in manifest {len(manifest)}; adding {len(added)}")
    no_lang = [e for e in added if not e["lg"]]
    if no_lang:
        print("no language:", [(e["songId"], e["title"]) for e in no_lang])
    if not dry:
        MANIFEST.write_text(json.dumps(manifest + added, ensure_ascii=False, indent=1) + "\n")


if __name__ == "__main__":
    main(dry="--dry-run" in sys.argv)
