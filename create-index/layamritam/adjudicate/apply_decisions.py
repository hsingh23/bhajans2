#!/usr/bin/env python3
"""Apply the high-confidence rows of decisions.csv to the app's data. Idempotent.

What changes (P(right) >= HIGH unless noted):
  - language / deity: the decided label replaces ours where Layamritam (or a third label) wins.
  - second tags (lg2 / d2): a song that mixes two languages or has two central deities keeps both
    labels, for every decided row with P >= SECOND_MIN. The filters match either tag.
  - Amma rule: a Devi song whose lyrics name Amma (Amṛtānandamayī, Amṛtēśvarī, Amṛtapurī) becomes
    d Amma, d2 Devi; every other Devi song Layamritam tags Amma gets d2 Amma.
  - taal / raga: written to ../music-overrides.json (src "adjudicated"), which
    music-meta/build_music_json.py applies after its own labels and Layamritam's fills.
  - duplicates: a new song that is the same recording and lyrics as an index song is merged into it.
    Its extra.pdf page becomes another page of that song; extra-manifest.json records "mergedInto"
    so merge_metadata.py does not add it back.

Writes ../../bhajan-categories.json, ../../../public/bhajan-index2.json, ../music-overrides.json and
../extra-manifest.json. Rebuild bhajan-music.json afterwards:
    create-index/music-meta/.venv/bin/python create-index/music-meta/build_music_json.py --write
Run from the repo root:  python3 create-index/layamritam/adjudicate/apply_decisions.py [--dry-run]
"""
import csv
import json
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path

HERE = Path(__file__).parent
LAY = HERE.parent
ROOT = LAY.parent.parent
CATEGORIES = LAY.parent / "bhajan-categories.json"
INDEX = ROOT / "public" / "bhajan-index2.json"
MANIFEST = LAY / "extra-manifest.json"
OVERRIDES = LAY / "music-overrides.json"
RAGAS = LAY.parent / "music-meta" / "reference" / "ragas.json"

HIGH = 0.9  # the report's "high" band
SECOND_MIN = 0.7  # second tags: any decided row that is not low-confidence
TAAL_SHAPE = {"keherwa": (8, "4/4", "quarter", 2), "dadra": (6, "6/8", "dotted-quarter", 3)}

# Same recording as the index song's sample, and the index song's printed page has the same lyrics.
# (nandalala nandalala (hindi) is the same recording as nanda lala nanda lala's sample but its lyrics
# differ, so it is not merged.)
MERGES = {"prem jo diyo (sindhi)": "prem jo diyo", "mere hrdaya sri ram base (hindi)": "mere hrdaya (gujrati)"}
# Language of the merge targets: their printed pages are Sindhi / Hindi lyrics, as Layamritam says.
EXTRA_LANG = {"prem jo diyo": "Sindhi", "mere hrdaya (gujrati)": "Hindi"}
AMMA_NAMED = re.compile(r"amrtanandamay|amrtesvari|amrtapur")


def fold(s):
    s = unicodedata.normalize("NFKD", s.lower())
    return "".join(c for c in s if not unicodedata.combining(c)).replace("-", "")


def amma_named():
    """Songs whose Layamritam lyrics name Amma. rows.json is local only (it holds Layamritam lyrics),
    so the result is cached in amma_named.json next to this script."""
    cache = HERE / "amma_named.json"
    rows_file = HERE / "rows.json"
    if rows_file.exists():
        names = sorted(r["song"] for r in json.loads(rows_file.read_text())
                       if r["kind"] == "judgment" and r["field"] == "deity"
                       and AMMA_NAMED.search(fold(" ".join(" ".join(x["lyrics"]) for x in r["lay"]))))
        cache.write_text(json.dumps(names, ensure_ascii=False, indent=1) + "\n")
    return set(json.loads(cache.read_text()))


def first(s):
    return s.split(";")[0].strip() if s else ""


def main(dry=False):
    rows = list(csv.DictReader(open(HERE / "decisions.csv")))
    cats = json.loads(CATEGORIES.read_text())
    index = json.loads(INDEX.read_text())
    manifest = json.loads(MANIFEST.read_text())
    overrides = json.loads(OVERRIDES.read_text()) if OVERRIDES.exists() else {}
    raga_names = {r["name"] for r in json.loads(RAGAS.read_text())}
    named = amma_named()
    stats = Counter()
    want = {}  # song -> {key: value} for bhajan-categories / the index

    def put(song, key, value, why):
        if song not in cats:
            stats[f"skipped (not in categories): {why}"] += 1
            return
        want.setdefault(song, {})[key] = value
        stats[why] += 1

    for r in rows:
        song, field, p = r["song"], r["field"], float(r["p"] or 0)
        key = {"language": "lg", "deity": "d"}.get(field)
        if r["kind"] == "conflict" and key:
            dec = r["decision"].strip()
            if not dec or "/" in dec:
                continue
            primary = cats.get(song, {}).get(key)
            if r["winner"] != "app" and p >= HIGH and dec != primary:
                put(song, key, dec, f"{field} changed")
                primary = dec
            second = first(r["second"])
            if p >= SECOND_MIN and second:
                # A mixed song: whichever of the decided label and the rater's second label is not primary.
                other = next((x for x in (dec, second) if x != primary), None)
                if other:
                    put(song, key + "2", other, f"{field} second tag")
        elif r["kind"] == "judgment" and field == "deity" and r["app"] == "Devi" and "Amma" in r["layamritam"]:
            if song in named:
                put(song, "d", "Amma", "deity Devi -> Amma (lyrics name Amma)")
                put(song, "d2", "Devi", "deity second tag (Amma rule)")
            else:
                put(song, "d2", "Amma", "deity second tag (Amma rule)")
        elif r["kind"] == "conflict" and field == "taal" and r["winner"] == "layamritam" and p >= HIGH:
            tid = {"6": "dadra", "8": "keherwa"}.get(r["decision"])
            if not tid:
                stats["taal skipped (no shape for this beat count)"] += 1
                continue
            b, ts, pulse, sub = TAAL_SHAPE[tid]
            overrides.setdefault(song, {})["t"] = {"id": tid, "b": b, "ts": ts, "pulse": pulse, "sub": sub,
                                                   "c": round(min(p, 0.9), 2), "src": "adjudicated"}
            stats["taal changed"] += 1
        elif field == "raga" and r["winner"] == "layamritam" and p >= HIGH:
            rid = r["decision"]
            if rid not in raga_names:
                stats["raga skipped (not one raga)"] += 1
                continue
            # Audio-only evidence is partly circular (our label came from the same audio): stay below "definite".
            c = min(p, 0.9) if "sheet:" in r["evidence"] else min(p, 0.8)
            overrides.setdefault(song, {})["r"] = [{"id": rid, "sec": "all", "c": round(c, 2), "src": "adjudicated"}]
            stats[f"raga changed ({r['kind']})"] += 1
    for song, lg in EXTRA_LANG.items():
        put(song, "lg", lg, "language changed (merge target)")

    # Apply labels; drop a second tag that equals the final primary label.
    by_name = {e["n"]: e for e in index}
    for song, kv in want.items():
        for k, v in kv.items():
            cats[song][k] = v
        for k in ("lg", "d"):
            if cats[song].get(k + "2") == cats[song].get(k):
                cats[song].pop(k + "2")
        e = by_name.get(song)
        if e is not None:
            for k in ("lg", "lg2", "d", "d2"):
                if k in cats[song]:
                    e[k] = cats[song][k]
                else:
                    e.pop(k, None)

    # Merge duplicates into the index song.
    for e in manifest:
        if e["n"] in MERGES:
            e["mergedInto"] = MERGES[e["n"]]
    index = merge_into(index, manifest, stats)
    for dup in MERGES:
        if cats.pop(dup, None) is not None:
            stats["categories entry removed (merged)"] += 1
        overrides.pop(dup, None)

    for k, v in sorted(stats.items()):
        print(f"{k}: {v}")
    if dry:
        return
    CATEGORIES.write_text(json.dumps(cats, ensure_ascii=False, indent=0) + "\n")
    INDEX.write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")))
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n")
    OVERRIDES.write_text(json.dumps(dict(sorted(overrides.items())), ensure_ascii=False, indent=1) + "\n")


def merge_into(index, manifest, stats=None):
    """Fold every manifest song with "mergedInto" into its target: the extra page becomes another page
    of the target, which also takes the sample if it has none. Shared with merge_metadata.py."""
    by_name = {e["n"]: e for e in index}
    gone = set()
    for m in manifest:
        target = by_name.get(m.get("mergedInto"))
        if not target:
            continue
        loc = f"extra-{m['page']}"
        if loc not in target["l"]:
            target["l"].append(loc)
            target.setdefault("lo", {})[loc] = 0
        dup = by_name.get(m["n"])
        if dup:
            for k in ("cs", "cn"):
                if dup.get(k) and not target.get(k):
                    target[k] = dup[k]
            gone.add(m["n"])
            if stats is not None:
                stats["songs merged"] += 1
    return [e for e in index if e["n"] not in gone]


if __name__ == "__main__":
    main(dry="--dry-run" in sys.argv)
