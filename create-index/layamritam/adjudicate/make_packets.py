#!/usr/bin/env python3
"""Blind rater packets for language/deity: conflict rows + agreeing controls, labels hidden.

Writes packets/lang_deity_<k>.json (items with an opaque id) and packets/key.json (id -> truth
context). Raters see title, Layamritam lyrics (IAST) and English meaning only.
"""
import json
import random
import sys
from pathlib import Path

HERE = Path(__file__).parent
LAY = HERE.parent
ROOT = LAY.parent.parent
sys.path.insert(0, str(LAY))
import lmeta  # noqa: E402

random.seed(7)
DUMP = ROOT / "layamritam"


def text_of(lyrics, meaning, cap_l=900, cap_m=600):
    lyr = " | ".join(x.replace("$", " / ").strip() for x in lyrics if x.strip())
    mea = " | ".join(x.strip() for x in meaning if x.strip())
    return lyr[:cap_l], mea[:cap_m]


def main():
    rows = json.loads((HERE / "rows.json").read_text())
    items, key = [], {}
    songs = {}  # index name -> (fields, lay song)
    for r in rows:
        if r["kind"] == "conflict" and r["field"] in ("language", "deity") and r["lay"]:
            songs.setdefault(r["song"], {"fields": set(), "row": r})["fields"].add(r["field"])
    # controls: matched songs whose language and deity agree
    meta = lmeta.load_metadata()
    cat = {s["songId"]: s for s in json.loads((DUMP / "songs_catalog.json").read_text())}
    m = json.loads((LAY / "matches.json").read_text())
    index = json.loads((ROOT / "public" / "bhajan-index2.json").read_text())
    conflict_names = {r["song"] for r in rows if r["kind"] in ("conflict", "judgment")}
    pool = []
    for sid, v in m.items():
        if v.get("decision") != "lyrics":
            continue
        s = index[v["idx"]]
        lab = lmeta.labels(cat[int(sid)], meta)
        if s["n"] in conflict_names or not lab["lg"] or lab["lg"] != s.get("lg") or s.get("d") not in lab["d"]:
            continue
        f = DUMP / "lyrics" / f"{sid}.json"
        parts = sorted(json.loads(f.read_text()).get("parts") or [], key=lambda p: p["displayOrder"])
        if not parts:
            continue
        pool.append((s, cat[int(sid)], parts))
    controls = random.sample(pool, 40)

    n = 0
    for name, v in songs.items():
        r = v["row"]
        lay = r["lay"][0]
        lyr, mea = text_of(lay["lyrics"], lay["meaning"])
        n += 1
        iid = f"s{n:03d}"
        items.append({"id": iid, "title": lay["title"], "lyrics": lyr, "meaning": mea})
        key[iid] = {"song": name, "control": False, "fields": sorted(v["fields"]),
                    "app_lg": r["index"].get("lg"), "app_d": r["index"].get("d"),
                    "lay_lg": [x["lg"] for x in r["lay"]], "lay_d": [x["d"] for x in r["lay"]]}
    for s, c, parts in controls:
        lyr, mea = text_of([p.get("lyrics") or "" for p in parts], [p.get("meaning") or "" for p in parts])
        n += 1
        iid = f"s{n:03d}"
        items.append({"id": iid, "title": c["songTitle"], "lyrics": lyr, "meaning": mea})
        key[iid] = {"song": s["n"], "control": True, "fields": ["language", "deity"],
                    "app_lg": s.get("lg"), "app_d": s.get("d"), "lay_lg": [s.get("lg")], "lay_d": [[s.get("d")]]}
    random.shuffle(items)
    out = HERE / "packets"
    out.mkdir(exist_ok=True)
    k = 4
    for b in range(k):
        (out / f"lang_deity_{b}.json").write_text(json.dumps(items[b::k], ensure_ascii=False, indent=1))
    (out / "key.json").write_text(json.dumps(key, ensure_ascii=False, indent=1))
    print(len(items), "items in", k, "packets;", sum(v["control"] for v in key.values()), "controls")


if __name__ == "__main__":
    main()
