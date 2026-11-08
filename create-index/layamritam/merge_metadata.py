#!/usr/bin/env python3
"""Merge Layamritam into the app's data, never overwriting a value the app already has.

1. New songs (extra-manifest.json, after render_pdf.py gave them pages) are appended to
   public/bhajan-index2.json - appended, because array position is the song id in viewer
   URLs - and to ../bhajan-categories.json.
2. Raga and taal from Layamritam fill songs that have none in public/bhajan-music.json
   (new songs and matched songs). The fills are kept in music-additions.json so
   music-meta/build_music_json.py re-applies them after a rebuild.
3. Where Layamritam disagrees with the app (language, deity, raga, taal) nothing changes;
   the pair goes on metadata-review.md / metadata-review.csv to double-check by hand.
   adjudicate/apply_decisions.py settles them; manifest songs it marks "mergedInto" are
   folded into that index song instead of being added.

Idempotent. Run from the repo root after match_index.py, select_new.py and render_pdf.py:
    uv run --with rapidfuzz python create-index/layamritam/merge_metadata.py [--dry-run]
"""
import csv
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / "music-meta"))
import lmeta  # noqa: E402
sys.path.insert(0, str(HERE / "adjudicate"))
from apply_decisions import merge_into  # noqa: E402
from build_music_json import english  # noqa: E402

INDEX = ROOT / "public" / "bhajan-index2.json"
MUSIC = ROOT / "public" / "bhajan-music.json"
REF = ROOT / "public" / "music-reference.json"
CATEGORIES = HERE.parent / "bhajan-categories.json"
ADDITIONS = HERE / "music-additions.json"
BOOK = "extra"
MATCHED = {"lyrics", "lyrics+title", "title"}

RAGA_C = {"human": 0.8, "ai": 0.6}  # below the UI's 0.85: shown as "close to"
TAAL_C = 0.75  # below the UI's 0.8: shown as "probably"
TAAL_SHAPE = {"keherwa": (8, "4/4", "quarter", 2), "dadra": (6, "6/8", "dotted-quarter", 3),
              "rupak": (7, "7/8", "eighth", 2), "khandachapu": (5, "5/8", "eighth", 2)}
# Deity pairs that are judgment calls rather than errors: reported in their own section.
SOFT_DEITY = [{"Amma", "Devi"}, {"Amma", "Universal"}, {"Amma", "Guru"}, {"Devi", "Universal"}, {"Krishna", "Vishnu"}]


def music_from(lab):
    """A bhajan-music.json entry (r / t only) from one song's Layamritam labels, or {}."""
    e = {}
    ragas = {}
    for r in lab["ragas"]:  # one entry per raga, however many recordings name it; a human label wins
        if r["id"] not in ragas or r["src"] == "human":
            ragas[r["id"]] = r
    if ragas:
        e["r"] = [{"id": r["id"], "sec": "all", "c": RAGA_C.get(r["src"], 0.6), "src": "layamritam"} for r in ragas.values()]
    tid = next((t for t, _ in lab["taals"] if t in TAAL_SHAPE), None)
    if tid:
        b, ts, pulse, sub = TAAL_SHAPE[tid]
        e["t"] = {"id": tid, "b": b, "ts": ts, "pulse": pulse, "sub": sub, "c": TAAL_C, "src": "layamritam"}
    return e


def main(dry=False):
    index = json.loads(INDEX.read_text())
    music = json.loads(MUSIC.read_text())
    ref = json.loads(REF.read_text())
    cats = json.loads(CATEGORIES.read_text())
    manifest = json.loads((HERE / "extra-manifest.json").read_text())
    matches = json.loads((HERE / "matches.json").read_text())
    meta = lmeta.load_metadata()
    songs = {str(s["songId"]): s for s, _ in lmeta.load_songs()}
    labels = {sid: lmeta.labels(s, meta) for sid, s in songs.items()}
    by_name = {s["n"]: i for i, s in enumerate(index)}
    additions = {}
    stats = Counter()

    # 1. New songs.
    for e in manifest:
        if not e.get("page"):
            sys.exit(f"{e['n']} has no page: run render_pdf.py first")
        if e.get("mergedInto"):  # a duplicate of an index song: its page is folded in below
            continue
        lab = labels[str(e["songId"])]
        d = lab["d"][0] if lab["d"] else None
        if not d and e.get("versionOf") in by_name:
            d = index[by_name[e["versionOf"]]]["d"]
        loc = f"{BOOK}-{e['page']}"
        entry = {"l": [loc], "n": e["n"], "lg": e["lg"] or "Other", "d": d or "Other", "lo": {loc: 0}}
        mu = music_from(lab)
        for sid in e.get("same", []):  # another recording of the same song may carry the labels
            for k, v in music_from(labels[str(sid)]).items():
                mu.setdefault(k, v)
        if mu:
            additions[e["n"]] = mu  # also for songs added by an earlier run, so a rerun keeps their fills
        if e["n"] in by_name:
            cur = index[by_name[e["n"]]]
            if cur["l"] != [loc]:
                sys.exit(f"{e['n']} is in the index at {cur['l']}, manifest says {loc}")
            continue
        by_name[e["n"]] = len(index)
        index.append(entry)
        cats[e["n"]] = {"lg": entry["lg"], "d": entry["d"]}
        stats["songs added"] += 1
    index[:] = merge_into(index, manifest, stats)  # adjudicate/apply_decisions.py set "mergedInto"
    by_name = {s["n"]: i for i, s in enumerate(index)}

    # 2 + 3. Matched songs: fill what is missing, list what disagrees.
    per_song = defaultdict(list)
    for sid, m in matches.items():
        if m["decision"] in MATCHED and m["idx"] is not None:
            if index[m["idx"]]["n"] != m["name"]:  # positions come from match_index.py's run
                sys.exit(f"matches.json idx {m['idx']} is {index[m['idx']]['n']!r}, not {m['name']!r}: rerun match_index.py")
            per_song[m["idx"]].append((sid, m))
    review = []
    pcs = {k: set(v["pcs"]) for k, v in ref["ragas"].items()}

    def same_scale(a, b):
        return a in pcs and b in pcs and pcs[a] == pcs[b]

    def related(a, b):  # same notes, or a pentatonic/hexatonic raga inside the other's scale
        return a in pcs and b in pcs and (pcs[a] <= pcs[b] or pcs[b] <= pcs[a])

    def add_review(kind, i, field, app, lay, sids, m):
        review.append({
            "kind": kind, "song": index[i]["n"], "page": index[i]["l"][0], "field": field, "app": app,
            "layamritam": lay, "layamritam_songs": "; ".join(f"{songs[s]['songTitle']} [{s}]" for s in sids),
            "evidence": m["decision"] + (f" lyric={m.get('lyric', 0):.2f}" if m["decision"] != "title" else ""),
        })

    for i, pairs in sorted(per_song.items()):
        s = index[i]
        sids = [sid for sid, _ in pairs]
        labs = [labels[sid] for sid in sids]
        best = max((m for _, m in pairs), key=lambda m: m.get("lyric", 0))
        lgs = {lab["lg"] for lab in labs if lab["lg"]}
        if lgs and s["lg"] not in lgs:
            add_review("conflict", i, "language", s["lg"], " / ".join(sorted(lgs)), sids, best)
        ds = [set(lab["d"]) for lab in labs if lab["d"]]
        if ds and not any(s["d"] in x for x in ds):
            lay = " / ".join(sorted(set().union(*ds)))
            soft = any({s["d"], x} in SOFT_DEITY for x in set().union(*ds))
            add_review("judgment" if soft else "conflict", i, "deity", s["d"], lay, sids, best)
        cur = music.get(s["n"], {})
        fill = {}
        lay_r = [r for lab in labs for r in lab["ragas"]]
        if lay_r:
            app_r = [r["id"] for r in cur.get("r", []) if r.get("src") != "layamritam"]
            if cur.get("rn") == "none":  # the app hears a Western-style tune, not a raga: a classification, not a gap
                srcs = sorted({r["src"] for r in lay_r})
                add_review("conflict", i, "raga", "none (Western-style tune)",
                           " / ".join(sorted({r["raw"] for r in lay_r})) + f" ({'/'.join(srcs)})", sids, best)
            elif not app_r:
                fill["r"] = music_from({"ragas": [r for r in lay_r if r["raw"] == lay_r[0]["raw"]], "taals": []})["r"]
            elif not any(lmeta.same_raga(a, r["id"]) or related(a, r["id"]) for a in app_r for r in lay_r):
                srcs = sorted({r["src"] for r in lay_r})
                app_c = max(r.get("c", 0) for r in cur["r"])
                kind = "conflict" if "human" in srcs or app_c >= 0.85 else "weak"
                add_review(kind, i, "raga", ", ".join(app_r) + f" (c={app_c})",
                           " / ".join(sorted({r["raw"] for r in lay_r})) + f" ({'/'.join(srcs)})", sids, best)
            elif not any(lmeta.same_raga(a, r["id"]) or same_scale(a, r["id"]) for a in app_r for r in lay_r):
                stats["raga related (one scale inside the other), not listed"] += 1
        lay_t = [t for lab in labs for t in lab["taals"]]
        if lay_t:
            app_t = cur.get("t") if cur.get("t", {}).get("src") != "layamritam" else None
            if not app_t:
                t = music_from({"ragas": [], "taals": lay_t}).get("t")
                if t:
                    fill["t"] = t
            elif not any(lmeta.TAAL_BEATS.get(app_t["id"]) == b for _, b in lay_t):
                raw = " / ".join(sorted({x for lab in labs for x in lab["raw"]["taal"] if x}))
                add_review("conflict", i, "taal", f"{app_t['id']} ({app_t['b']} beats)", raw, sids, best)
        if fill:
            additions[s["n"]] = fill

    # Songs added as new that may be an index song after all.
    for e in manifest:
        if e.get("mergedInto"):
            continue
        m = matches[str(e["songId"])]
        near = next((a for a in m.get("alt", []) if a["name"] == e.get("versionOf")), None) or (
            {"lyric": m.get("lyric", 0)} if m["decision"] == "version" else None)
        lyr = (near or {}).get("lyric", 0)
        if e["why"] == "doubt" or (e["why"] == "version" and lyr >= 0.5):
            review.append({
                "kind": "new song", "song": e["n"], "page": f"{BOOK}-{e['page']}", "field": "same song?",
                "app": e["versionOf"], "layamritam": f"{songs[str(e['songId'])]['songTitle']} ({e['lg']})",
                "layamritam_songs": str(e["songId"]),
                "evidence": f"{e['why']}: " + ("same name and language, different lyrics" if e["why"] == "doubt"
                                               else f"other language, {lyr:.0%} of its lyrics shared"),
            })

    # Apply music fills (fills only; a value the app computed is never replaced). Layamritam parts
    # from an earlier run that are no longer wanted are taken out first, so reruns converge.
    def ours(v):
        return (isinstance(v, dict) and v.get("src") == "layamritam") or (
            isinstance(v, list) and bool(v) and all(r.get("src") == "layamritam" for r in v))

    touched = set(additions)
    for n, e in list(music.items()):
        for k in ("r", "t"):
            if ours(e.get(k)) and k not in additions.get(n, {}):
                if k == "r" and e.get("rn") == "none":
                    e["r"] = []
                else:
                    del e[k]
                touched.add(n)
                stats[f"removed stale {k}"] += 1
    for n, fill in additions.items():
        e = music.setdefault(n, {})
        for k, v in fill.items():
            if k == "r" and e.get("rn") == "none":
                continue
            if not e.get(k) or ours(e[k]):
                if e.get(k) != v:
                    stats[f"filled {k}"] += 1
                e[k] = v
    for n in touched:
        e = music[n]
        cs = [p["c"] for p in [e.get("sh"), e.get("t"), *(e.get("r") or [])[:1]] if p and "c" in p]
        if cs:
            e["c"] = round(sum(cs) / len(cs), 2)
        else:
            e.pop("c", None)
        if not set(e) - {"c", "en"}:
            del music[n]
            continue
        e["en"] = english(e, ref["ragas"], ref["taals"])

    stats.update(f"review {r['kind']} {r['field']}" for r in review)
    for k, v in sorted(stats.items()):
        print(f"{k}: {v}")
    if dry:
        return
    INDEX.write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")))
    MUSIC.write_text(json.dumps(music, ensure_ascii=False, separators=(",", ":")))
    CATEGORIES.write_text(json.dumps(cats, ensure_ascii=False, indent=0) + "\n")
    ADDITIONS.write_text(json.dumps(additions, ensure_ascii=False, indent=1) + "\n")
    write_review(review)


ORDER = {("new song", "same song?"): 0, ("conflict", "language"): 1, ("conflict", "deity"): 2, ("conflict", "taal"): 3,
         ("conflict", "raga"): 4, ("judgment", "deity"): 5, ("weak", "raga"): 6}
CSV_ONLY = {5, 6}  # long, low-value groups: counted in the markdown, rows in the CSV
TITLES = {
    0: ("Added as new songs, but may be an index song", "Layamritam has these lyrics under a name (or a near-copy of the lyrics in another "
        "language) that the index already has. If it is the same song, delete the new entry and add its page to the old one."),
    1: ("Language", "The index language (Sonnet-labelled, Nov 2026) differs from Layamritam's."),
    2: ("Deity", "The index deity differs from every deity Layamritam lists."),
    3: ("Taal", "Different beat cycle. The app's taal comes from audio analysis of the recording."),
    4: ("Raga", "Different scales, where it matters: Layamritam's label is 'human' or the app's label is confident "
        "(c >= 0.85). The app's raga is an Opus label from the recording; Layamritam marks 96% of theirs 'ai' "
        "(machine-labelled). Same scale under another name, or one scale inside the other, is not listed."),
    5: ("Deity judgment calls", "Amma/Devi, Amma/Universal and similar: both readings are defensible."),
    6: ("Raga, both sides uncertain", "Layamritam 'ai' label against an app label below 0.85 confidence."),
}


def write_review(review):
    review.sort(key=lambda r: (ORDER[(r["kind"], r["field"])], "(human" not in r["layamritam"], r["song"]))
    with (HERE / "metadata-review.csv").open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(review[0].keys()))
        w.writeheader()
        w.writerows(review)
    out = ["# Layamritam metadata to double-check", "",
           "Written by `merge_metadata.py`. Nothing below was changed in the app: each row is a place where Layamritam "
           "disagrees with the app's data (or a new song that may duplicate an index song). Fix the right side by hand "
           "(`create-index/bhajan-categories.json` + `public/bhajan-index2.json` for language/deity, "
           "`public/bhajan-music.json` for raga/taal). `metadata-review.csv` has the same rows for a spreadsheet.", ""]
    groups = defaultdict(list)
    for r in review:
        groups[ORDER[(r["kind"], r["field"])]].append(r)
    for k in sorted(groups):
        title, note = TITLES[k]
        if k in CSV_ONLY:
            out += [f"## {title} ({len(groups[k])})", "", note + " Rows are in `metadata-review.csv` only.", ""]
            continue
        out += [f"## {title} ({len(groups[k])})", "", note, "", "| song | page | app | Layamritam | Layamritam song | evidence |",
                "|---|---|---|---|---|---|"]
        for r in groups[k]:
            cells = [r["song"], r["page"], r["app"] or "", r["layamritam"], r["layamritam_songs"], r["evidence"]]
            out.append("| " + " | ".join(str(c).replace("|", "/") for c in cells) + " |")
        out.append("")
    (HERE / "metadata-review.md").write_text("\n".join(out))


if __name__ == "__main__":
    main(dry="--dry-run" in sys.argv)
