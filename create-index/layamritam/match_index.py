#!/usr/bin/env python3
"""Match every Layamritam song (layamritam/ dump) to the index song it is, if any.

Evidence per (layamritam song, index song) pair:
  lyric  - share of the Layamritam lyrics' character 5-grams found in the index song's
           printed songbook text (segments from ../sheet-match/match.py)
  cover  - share of the printed text's 5-grams found in the Layamritam lyrics
  title  - fuzzy ratio between the Layamritam title / first line and the index name

Index songs that are only printed in books we have no PDF for (voli*) can only be found
by title. Writes matches.json: {songId: {decision, idx, name, lyric, cover, title, alt}}.

Run from the repo root: uv run --with rapidfuzz python create-index/layamritam/match_index.py
"""
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

from rapidfuzz import fuzz

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE.parent / "sheet-match"))
import match as M  # noqa: E402

sys.path.insert(0, str(HERE))
import lmeta  # noqa: E402

DUMP = ROOT / "layamritam"

T_LYRIC = 0.50  # share of the Layamritam text found in a printed song to call it that song
T_TITLE = 90  # title ratio for a title-only match (no printed text to compare)
T_STRONG = 0.75  # lyric share that wins even when the languages disagree (then a metadata conflict)


def load_dump():
    cat = json.loads((DUMP / "songs_catalog.json").read_text())
    songs = []
    for s in cat:
        f = DUMP / "lyrics" / f"{s['songId']}.json"
        parts = json.loads(f.read_text()).get("parts") or [] if f.exists() else []
        parts = sorted(parts, key=lambda x: x["displayOrder"])
        songs.append((s, parts))
    return songs


def lyric_text(parts):
    return " ".join((p.get("lyrics") or "").replace("$", " ") for p in parts)


def title_keys(s, parts):
    keys = [s["songTitle"]]
    if parts:
        keys.append((parts[0].get("lyrics") or "").split("$")[0])
    out = []
    for k in keys:
        k = re.sub(r"\.\.\.|…|\(\d+\)", " ", k)
        for x in [M.strip_parens(k)] + re.findall(r"\(([^)]*)\)", k):
            n = M.norm(x)
            if len(n) >= 4:
                out.append(n)
    return list(dict.fromkeys(out))


def main():
    index = json.loads(M.INDEX.read_text())
    books = json.loads((HERE.parent / "sheet-match" / "books.json").read_text())
    pages, heads, starts = M.book_pages(books)
    segments = M.song_segments(index, pages, heads, starts)
    seg_grams = [M.grams(t) for *_, t in segments]
    inv = defaultdict(set)
    for si, g in enumerate(seg_grams):
        for x in g:
            inv[x].add(si)
    has_text = {segments[si][0] for si in range(len(segments))}

    def aliases(n):
        out = []
        for inner in re.findall(r"\(([^)]*)\)", n):
            inner = re.sub(M.LANG_TAG_RE, " ", inner).strip(" ,")
            if len(inner) >= 5 and re.search(r"[a-z]{3}", inner):
                out.append(M.norm(inner))
        return out

    names = [[M.norm(M.strip_parens(s["n"]))] + aliases(s["n"]) + [M.norm(c) for c in s.get("cn", [])] for s in index]

    def title_score(keys, i):
        best = 0
        for a in keys:
            for b in names[i]:
                if not a or not b:
                    continue
                k = min(len(a), len(b), 14)
                if k >= 6 and a[:k] == b[:k]:
                    sc = 100
                else:
                    sc = fuzz.ratio(a, b[:len(a) + 3]) if len(b) > len(a) else fuzz.ratio(a, b)
                best = max(best, sc)
        return best

    meta = lmeta.load_metadata()
    out = {}
    for s, parts in lmeta.load_songs():
        sid = str(s["songId"])
        keys = title_keys(s, parts)
        text = M.norm(lyric_text(parts))
        g = M.grams(text)
        rows = {}
        if len(g) >= 20:
            hits = Counter()
            for x in g:
                for si in inv.get(x, ()):
                    hits[si] += 1
            for si, h in hits.most_common(40):
                i = segments[si][0]
                c = h / len(g)
                cov = h / max(1, len(seg_grams[si]))
                if c > rows.get(i, {}).get("lyric", 0):
                    rows[i] = {"lyric": round(c, 3), "cover": round(cov, 3), "loc": f"{segments[si][1]}-{segments[si][2]}"}
        for i in range(len(index)):
            ts = title_score(keys, i)
            if ts >= 80:
                rows.setdefault(i, {"lyric": 0, "cover": 0})["tscore"] = ts
        for i, r in rows.items():
            r.setdefault("tscore", title_score(keys, i))
        ranked = sorted(rows.items(), key=lambda kv: (kv[1]["lyric"] + kv[1]["cover"] * 0.3 + kv[1]["tscore"] / 400), reverse=True)
        ll = lmeta.language(meta["language"].get(s.get("languageId"), ""))
        same = lambda i: ll is None or index[i]["lg"] == ll  # noqa: E731
        decision, best, version_of = "missing", None, None
        if ranked:
            # A same-language candidate with real lyric overlap beats a stronger other-language one
            # (a Telugu version of a Malayalam song shares names and refrains with it).
            pick = ranked[0]
            if not same(pick[0]) and pick[1]["lyric"] < T_STRONG:
                pick = next(((i, r) for i, r in ranked if same(i) and (r["lyric"] >= 0.3 or r["tscore"] >= T_TITLE)), pick)
            i, r = pick
            if r["lyric"] >= T_LYRIC and (same(i) or r["lyric"] >= T_STRONG):
                decision, best = "lyrics", i
            elif r["lyric"] >= 0.3 and r["tscore"] >= 80 and same(i):
                decision, best = "lyrics+title", i
            elif r["tscore"] >= T_TITLE and same(i) and (i not in has_text or not g):
                decision, best = "title", i  # nothing printed to compare against
            elif r["tscore"] >= T_TITLE and same(i):
                decision, best = "doubt", i  # name and language agree but the printed lyrics do not
            elif r["lyric"] >= 0.3 or r["tscore"] >= 80:
                decision, version_of = "version", i
                ranked = [pick] + [x for x in ranked if x[0] != i]  # another-language version of an index song
            if best is not None:
                ranked = [pick] + [x for x in ranked if x[0] != i]
        out[sid] = {
            "decision": decision,
            "title": s["songTitle"],
            "hasLyrics": bool(g),
            "idx": best,
            "name": index[best]["n"] if best is not None else None,
            "lg": ll,
            "versionOf": index[version_of]["n"] if version_of is not None else None,
            **({k: v for k, v in ranked[0][1].items()} if ranked and (best is not None or version_of is not None) else {}),
            "alt": [{"idx": i, "name": index[i]["n"], **r} for i, r in ranked[: 4] if i not in (best, version_of)][:3],
        }
    (HERE / "matches.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    print(Counter(v["decision"] for v in out.values()))
    print("with lyrics:", Counter(v["decision"] for v in out.values() if v["hasLyrics"]))
    taken = Counter(v["idx"] for v in out.values() if v["idx"] is not None)
    print("index songs matched:", len(taken), "matched by >1 layamritam song:", sum(1 for c in taken.values() if c > 1))


if __name__ == "__main__":
    main()
