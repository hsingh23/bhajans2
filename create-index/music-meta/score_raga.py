#!/usr/bin/env python3
"""Score raga raters (jsonl outputs) against the adjudicated answer key.

  python score_raga.py work/raga/pilot_glm53.jsonl work/raga/pilot_sonnet*.jsonl ...

A prediction is correct when its primary raga (after alias normalisation) is one of
the key's ragas, or is in the accepted-alternative cluster for that song
(reference/raga-adjudication.md "Scoring guidance"). Also reports top-any
(primary or listed alternatives) and accuracy on the rater's high-confidence subset.
"""
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).parent

KHARAHARA = {"kharaharapriya", "natabhairavi", "abheri", "anandabhairavi", "kafi", "kapi",
             "sriranjani", "jaunpuri", "asavari", "darbarikanada"}
ALSO = {
    "ajnabi rah ke (hindi)": {"jog", "shubhapantuvarali"}, "ninna mamate": {"jog", "shubhapantuvarali"},
    "vadikorinetra": {"jog", "shubhapantuvarali"}, "bandu bidabarade": {"jog", "shubhapantuvarali"},
    "tanjamena vandom": {"gambhiranata"}, "tancamena vantom": {"gambhiranata"},
    "sri rama namame": {"arabhi", "shankarabharanam", "dheerasankarabharanam"},
    "prema sagara": {"durga", "shuddhasaveri"},
    "andela ravali": {"shuddhadhanyasi", "dhani"}, "callaga cudu (telugu)": {"shuddhadhanyasi", "dhani"},
    "sri gananayaka (hindi)": {"shuddhadhanyasi", "dhani"}, "krsna ninna bala lile": {"shuddhadhanyasi", "dhani"},
    "amba sambhavi (sanskrit)": {"shivaranjani"}, "barutihalu (kannada)": {"shivaranjani"},
    "khol darvaza": {"shuddhadhanyasi"},
    "belli bettadodeya (kannada)": KHARAHARA, "manassil nila sarasil (malayalam)": KHARAHARA,
    "bhaktige sopana": KHARAHARA,
    "jamuna ke tal par (hindi)": {"gourimanohari"}, "sambho sankara": {"shankarabharanam", "dheerasankarabharanam"},
    "devadideva (telugu)": {"hanumatodi", "hindustanibhairavi"}, "mariyamma": {"hanumatodi", "hindustanibhairavi"},
    "ma tere carano": {"jaijaiwanti", "pilu"},
}


def key(s):
    return re.sub(r"[^a-z]", "", (s or "").lower())


def main():
    table = json.loads((HERE / "reference/ragas.json").read_text())
    alias = {}
    for r in table:
        for a in [r["name"], *r.get("aliases", [])]:
            alias.setdefault(key(a), r["name"])
    norm = lambda s: alias.get(key(s), key(s))  # noqa: E731
    by = {r["name"]: r for r in table}
    pcs = lambda n: frozenset(by[n]["pcs"]) if n in by else None  # noqa: E731
    equiv = defaultdict(set)  # Carnatic <-> Hindustani names for the same raga
    for r in table:
        for h in re.split(r"[/,;]| or ", r.get("hindustani_equiv") or ""):
            h = norm(h.split("(")[0])
            if h in by and pcs(h) == pcs(r["name"]):
                equiv[r["name"]].add(h)
                equiv[h].add(r["name"])
    ans = json.loads((HERE / "rubric_raga_adjudicated.json").read_text())
    for path in sys.argv[1:]:
        rows = {}
        for line in Path(path).read_text().splitlines():
            if line.strip():
                r = json.loads(line)
                rows[r["song"]] = r
        stats = defaultdict(int)
        misses = []
        for song, a in ans.items():
            if "mismatch" in json.dumps(a).lower() or song not in rows:
                continue
            r = rows[song]
            if r.get("error"):
                stats["error"] += 1
                continue
            gold = {norm(x["name"]) for x in a.get("ragas", [])} | {norm(x) for x in ALSO.get(song, set())}
            if not a.get("ragas"):
                gold |= {"none"}
            pred = [norm(x.get("name")) for x in r.get("ragas", [])] or (["none"] if r.get("no_raga") else [])
            alts = {norm(x.split("(")[0]) for x in r.get("alternatives", []) if isinstance(x, str)}
            stats["n"] += 1
            gold_eq = gold | {e for g in gold for e in equiv[g]}
            ok = bool(pred) and pred[0] in gold_eq
            scale_ok = bool(pred) and pcs(pred[0]) is not None and any(pcs(g) == pcs(pred[0]) for g in gold if pcs(g))
            stats["scale"] += scale_ok or ok
            stats["top1"] += ok
            stats["any"] += bool(gold & (set(pred) | alts))
            conf = r.get("confidence")
            stats[f"n_{conf}"] += 1
            stats[f"ok_{conf}"] += ok
            if not ok:
                misses.append(f"  {song[:34]:34} pred={pred[:2]} gold={sorted(gold)[:4]} conf={conf}")
        n = max(stats["n"], 1)
        hi = max(stats["n_high"], 1)
        print(f"{path}: n={stats['n']} top1={stats['top1'] / n:.0%} scale={stats['scale'] / n:.0%} any={stats['any'] / n:.0%} "
              f"high-conf {stats['ok_high']}/{stats['n_high']}={stats['ok_high'] / hi:.0%} "
              f"medium {stats['ok_medium']}/{stats['n_medium']} low {stats['ok_low']}/{stats['n_low']} errors={stats['error']}")
        if "-v" in sys.argv[0:1] or len(sys.argv) == 2:
            print("\n".join(misses))


if __name__ == "__main__":
    main()
