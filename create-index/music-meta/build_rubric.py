#!/usr/bin/env python3
"""Join the human-curated "Bhajan Shruti Living Document" labels onto index songs.

Inputs: sheet/main.csv and sheet/golden.csv (exported from the Google Sheet),
public/bhajan-index2.json. Output: rubric.json keyed by index song name with the
human shruti / raaga / taal labels and the parsed shruti as note names.

Shruti is in kattai numbering: 1=C 1.5=C# 2=D 2.5=D# 3=E 4=F 4.5=F# 5=G 5.5=G#
6=A 6.5=A# 7=B (the sheet's own "5 (G)", "4 (F)", "5.5 (G#)" entries confirm it).
"""
import csv
import json
import re
from collections import defaultdict
from pathlib import Path

from rapidfuzz import fuzz, process

from match_box import ascii_fold, clean_index_name, phonetic

HERE = Path(__file__).parent
INDEX = HERE.parent.parent / "public" / "bhajan-index2.json"

KATTAI = {1: "C", 1.5: "C#", 2: "D", 2.5: "D#", 3: "E", 4: "F", 4.5: "F#",
          5: "G", 5.5: "G#", 6: "A", 6.5: "A#", 7: "B"}
NOTE_PC = {"C": 0, "C#": 1, "DB": 1, "D": 2, "D#": 3, "EB": 3, "E": 4, "F": 5, "F#": 6,
           "GB": 6, "G": 7, "G#": 8, "AB": 8, "A": 9, "A#": 10, "BB": 10, "B": 11}
PC_NOTE = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def parse_shruti(raw):
    """Return the set of pitch classes a free-form shruti cell allows ('4.5 or 5', '5 (G)', 'A#')."""
    s = raw.strip().upper().replace("1/2", ".5").replace(" 1/2", ".5")
    if not s or s in {"0", "?"}:
        return []
    pcs = set()
    for letter in re.findall(r"\b([A-G][#B]?)(?![A-Z])", s):
        if letter in NOTE_PC:
            pcs.add(NOTE_PC[letter])
    for num in re.findall(r"(?<![\d.])(\d(?:\.5)?)(?![\d])", s):
        v = float(num)
        v = int(v) if v.is_integer() else v
        if v in KATTAI:
            pcs.add(NOTE_PC[KATTAI[v]])
    return sorted(pcs)


def norm_raga(r):
    r = ascii_fold(r).lower().strip()
    r = re.sub(r"\s+(keys?|\?)$", "", r)
    return re.sub(r"[^a-z]", "", r)


def main():
    index = json.loads(INDEX.read_text())
    keys = [clean_index_name(s["n"]) for s in index]
    by_loc = defaultdict(list)
    for i, s in enumerate(index):
        for loc in s["l"]:
            by_loc[loc].append(i)

    rub = defaultdict(lambda: {"shruti_raw": [], "raaga_raw": [], "taal_beats_raw": [], "hints": [], "rows": []})

    def find(name, lang, locs=()):
        for loc in locs:
            if loc in by_loc:
                return by_loc[loc][0], 100.0, "location"
        k = phonetic(ascii_fold(name.lower()))
        if not k:
            return None, 0, ""
        hits = process.extract(k, keys, scorer=fuzz.ratio, limit=5)
        best = None
        for _, score, i in hits:
            lang_ok = not lang or lang.lower() in index[i]["n"] or index[i].get("lg", "").lower() == lang.lower()
            if score >= 92 or (score >= 85 and lang_ok):
                if best is None or (lang_ok, score) > best[:2]:
                    best = (lang_ok, score, i)
        return (best[2], best[1], "name") if best else (None, 0, "")

    unmatched = 0
    for tab, rows in (("main", csv.DictReader(open(HERE / "sheet/main.csv"))),
                      ("golden", csv.DictReader(open(HERE / "sheet/golden.csv")))):
        for n, r in enumerate(rows, start=2):
            if tab == "main":
                shruti, raaga, taal, hint = r["shrutiRecording"], r["raaga"], "", r["hints"]
                name, lang, locs = r["canonicalName"] or r["bhajanName"], r["canonicalLanguage"], ()
            else:
                shruti, raaga, taal, hint = r["Recording Shruti"], r["Raaga"], r["Taal (5,6,7,8)"], r["Hints"]
                name, lang = r["bhajan"] or r["Bhajan"], r["language"]
                locs = [x.strip() for x in (r["most likely location"] + "," + r["location"]).split(",") if x.strip()]
            if not (shruti.strip() or raaga.strip() or taal.strip()):
                continue
            i, score, how = find(name, lang, locs)
            if i is None:
                unmatched += 1
                continue
            e = rub[index[i]["n"]]
            if shruti.strip() and shruti.strip() not in e["shruti_raw"]:
                e["shruti_raw"].append(shruti.strip())
            if raaga.strip() and raaga.strip() not in e["raaga_raw"]:
                e["raaga_raw"].append(raaga.strip())
            if taal.strip() and taal.strip() not in e["taal_beats_raw"]:
                e["taal_beats_raw"].append(taal.strip())
            if hint.strip() and hint.strip() not in e["hints"]:
                e["hints"].append(hint.strip())
            e["rows"].append(f"{tab}:{n} {how} {score:.0f} '{name}'")

    out = {}
    for name, e in rub.items():
        pcs = sorted({p for raw in e["shruti_raw"] for p in parse_shruti(raw)})
        beats = sorted({int(b) for raw in e["taal_beats_raw"] for b in re.findall(r"\b([5-8])\b", raw)})
        out[name] = {
            **e,
            "shruti_pcs": pcs,
            "shruti_notes": [PC_NOTE[p] for p in pcs],
            "raaga": sorted({norm_raga(x) for raw in e["raaga_raw"] for x in re.split(r"[/,+&]| and | then ", raw) if norm_raga(x)}),
            "taal_beats": beats,
        }
    (HERE / "rubric.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    print(f"songs with labels: {len(out)} (unmatched sheet rows: {unmatched})")
    print("  shruti:", sum(1 for v in out.values() if v["shruti_pcs"]))
    print("  raaga:", sum(1 for v in out.values() if v["raaga"]))
    print("  taal beats:", sum(1 for v in out.values() if v["taal_beats"]))


if __name__ == "__main__":
    main()
