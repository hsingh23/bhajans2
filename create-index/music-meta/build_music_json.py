#!/usr/bin/env python3
"""Assemble the app's musician data from the pipeline outputs.

Inputs (all under create-index/music-meta):
  features/tonic.json          shruti per recording (Box + CD samples)
  work/raga/full/out_*.jsonl   raga labels (Opus), one JSON per song
  features/taal.json           beat-cycle class, meter, tempo
  features/sheet.json + features/tonic_sheet_sa.json + features/sheet_trust.json   chords
  reference/ragas.json, reference/taals.json
Outputs (contract: reference/music-data-spec.md):
  public/bhajan-music.json, public/music-reference.json   (with --write; else a dry run + stats)

Shruti shown = the recording the app plays (the CD sample) when its estimate is
confident, else the full Box recording. Raga Sa shifts from the labeller move the
shruti only when the labeller was highly confident.
"""
import glob
import json
import re
import sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
PC = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]
KATTAI = ["1", "1.5", "2", "2.5", "3", "4", "4.5", "5", "5.5", "6", "6.5", "7"]
CONF = {"high": 0.9, "medium": 0.7, "low": 0.45}
TAAL_BY_CLASS = {8: ("keherwa", "adi"), 6: ("dadra", "rupakam"), 7: ("rupak", "mishrachapu"),
                 5: ("khandachapu", None)}
ROMAN = ["I", "bII", "II", "bIII", "III", "IV", "#IV", "V", "bVI", "VI", "bVII", "VII"]


def key(s):
    return re.sub(r"[^a-z]", "", (s or "").lower())


def load_jsonl(pattern):
    out = {}
    for p in sorted(glob.glob(str(HERE / pattern))):
        for line in open(p):
            if line.strip():
                r = json.loads(line)
                if not r.get("error"):
                    out[r["song"]] = r
    return out


NEW_RENDITION_FOLDERS = ("1 MP3/Amma/Amma Bhajans 2024",)  # Box key matches the CD only ~30% here


def pick_shruti(t):
    """Shruti of what the app plays (the CD sample) when we can, else the full Box recording.

    The 2020/2021 Box folders are the CD recordings (same key 99-100%); the 2024 folder holds new
    renditions, usually 1-2 semitones lower. When the CD estimate and the Box estimate disagree, the
    other one goes in `alt` and confidence drops so the UI does not state the key as certain.
    """
    recs = [r for r in (t or {}).get("recordings", []) if r.get("tonic_pc") is not None]
    if not recs:
        return None
    cd = [r for r in recs if r["source"].startswith("cd:")]
    box = [r for r in recs if r["source"].startswith("box:")]
    new_rendition = any((r.get("box_folder") or "").startswith(NEW_RENDITION_FOLDERS) for r in box)
    if cd and (cd[0].get("high_confidence") or new_rendition or not box):
        best = cd[0]
    elif box and box[0].get("high_confidence"):
        best = box[0]
    else:
        best = (cd + box)[0]
    c = min(float(best.get("confidence", 0.5)), 0.97)
    others = {r["tonic_pc"] for r in recs if r["tonic_pc"] != best["tonic_pc"]}
    if others and (cd and best is not cd[0]):
        c = min(c, 0.75)  # the sample the app plays may be in another key
    elif others and new_rendition and best is cd[0]:
        c = min(c, 0.85 if best.get("high_confidence") else 0.7)
    alt = sorted(others if (cd and box) else {r["tonic_pc"] for r in recs if r["tonic_pc"] != best["tonic_pc"] and r.get("high_confidence")})
    return {"pc": best["tonic_pc"], "k": KATTAI[best["tonic_pc"]], "alt": alt, "c": round(c, 2),
            "src": "cd" if best["source"].startswith("cd:") else "box"}


def roman(ch):
    m = re.match(r"^([A-G])(b|#)?(.*)$", ch)
    if not m:
        return None
    pc = (FLAT.index(m.group(1)) + {"b": -1, "#": 1, None: 0}[m.group(2)]) % 12
    qual = m.group(3)
    r = ROMAN[pc]
    if qual.startswith("m") and not qual.startswith("maj"):
        r = r.lower()
        qual = qual[1:]
    return r + qual.replace("maj", "M")


def chords(name, sheet, sa_over, trust):
    sh = sheet.get(name)
    if not sh or "error" in sh or trust.get(name, {}).get("trust") not in ("trusted", "trusted-unique"):
        return None
    so = (sa_over.get(name) or {}).get("sa_offset", 0)
    rel = []
    for c in sh.get("chords_in_C", []):
        m = re.match(r"^([A-G])(b|#)?(.*)$", c)
        if not m:
            continue
        pc = (FLAT.index(m.group(1)) + {"b": -1, "#": 1, None: 0}[m.group(2)] - so) % 12
        rn = roman(FLAT[pc] + m.group(3).split("/")[0])
        if rn:
            rel.append(rn)
    if len(rel) < 3:
        return None
    return [c for c, _ in Counter(rel).most_common(6)]


def scale_notes(pcs, sa):
    return " ".join(FLAT[(sa + p) % 12] for p in sorted(set(pcs)))


def english(entry, ragas, taals):
    parts = []
    sh = entry.get("sh")
    if sh:
        parts.append(f"Sing in {FLAT[sh['pc']]} ({sh['k']} kattai).")
    rs = entry.get("r") or []
    if rs and sh:
        r = ragas.get(rs[0]["id"])
        if r:
            notes = scale_notes(r["pcs"], sh["pc"])
            close = "" if rs[0]["c"] >= 0.85 else "close to "
            mix = f", moving into {', '.join(ragas[x['id']]['name'] for x in rs[1:] if x['id'] in ragas)}" if len(rs) > 1 else ""
            parts.append(f"Raga {close}{r['name']} ({r['western']}): {notes}{mix}.")
    elif entry.get("rn") == "none":
        parts.append("A Western-style tune rather than a raga.")
    t = entry.get("t")
    if t:
        tl = taals.get(t["id"], {})
        count = {8: "1-2-3-4", 6: "1-2-3, 4-5-6" if t.get("sub") == 3 else "1-2-3", 7: "1-2-3, 1-2, 1-2",
                 5: "1-2, 1-2-3"}.get(t["b"], "")
        bpm = f" at about {t['bpm']} BPM" if t.get("bpm") else ""
        parts.append(f"{t['b']}-beat {tl.get('name', t['id'])} ({t['ts']}): count {count}{bpm}.")
    return " ".join(parts)


def main():
    write = "--write" in sys.argv
    index = json.loads((ROOT / "public/bhajan-index2.json").read_text())
    tonic = json.loads((HERE / "features/tonic.json").read_text())
    taal = json.loads((HERE / "features/taal.json").read_text())
    sheet = json.loads((HERE / "features/sheet.json").read_text())
    sa_over = json.loads((HERE / "features/tonic_sheet_sa.json").read_text())
    trust = json.loads((HERE / "features/sheet_trust.json").read_text())
    raga_out = load_jsonl("work/raga/full/out_*.jsonl")
    table = json.loads((HERE / "reference/ragas.json").read_text())
    ttable = json.loads((HERE / "reference/taals.json").read_text())["taals"]
    alias = {}
    for r in table:
        for a in [r["name"], *r.get("aliases", [])]:
            alias.setdefault(key(a), r["name"])
    by = {r["name"]: r for r in table}

    def title(n):
        return re.sub(r"(?<=[a-z])(?=(bhairavi|kalyani|kalyan|sarang|kanada|kannada|malhar|todi|varali|gowla|bhushani)$)", " ", n).title()

    renamed = {k: v for k, v in json.loads((HERE / "reference/renamed-songs.json").read_text()).items() if not k.startswith("_")}
    music, used_r, used_t, unknown = {}, set(), set(), Counter()
    for s in index:
        n = s["n"]
        e = {}
        old = renamed.get(n)  # features stored under the song's name before an index correction
        sh = pick_shruti(tonic.get(n) or tonic.get(old))
        base_pc = sh["pc"] if sh else None  # Sa before any labeller shift; the sheet offset is relative to it
        rr = raga_out.get(n) or raga_out.get(old)
        if rr:
            shift = int(rr.get("sa_shift") or 0) % 12
            if sh and shift:
                if rr.get("confidence") == "high":
                    sh = {**sh, "pc": (sh["pc"] + shift) % 12, "k": KATTAI[(sh["pc"] + shift) % 12],
                          "c": round(min(sh["c"], 0.8), 2)}
                else:
                    sh = {**sh, "c": round(min(sh["c"], 0.6), 2)}
            if rr.get("no_raga"):
                e["r"], e["rn"] = [], "none"
            else:
                rs = []
                for x in rr.get("ragas") or []:
                    rid = alias.get(key(x.get("name")))
                    if not rid:
                        unknown[x.get("name")] += 1
                        continue
                    c = CONF.get(rr.get("confidence"), 0.45)
                    tr = trust.get(n, {})
                    if tr.get("n_shared", 0) >= 3 and tr.get("trust") not in ("trusted",):
                        c = min(c, 0.45)  # sheet linked to many songs and not verified against this recording
                    rs.append({"id": rid, "sec": x.get("sections") if isinstance(x.get("sections"), str) else "part",
                               "c": c})
                    used_r.add(rid)
                if rs:
                    e["r"] = rs
        if sh:
            so = (sa_over.get(n) or {}).get("sa_offset", 0)
            if so and trust.get(n, {}).get("trust") in ("trusted", "trusted-unique", "unverified"):
                # PDFs are named by the arranger's key root, which sits so semitones below Sa.
                sh = {**sh, "pdf_pc": (base_pc - so) % 12}
            e["sh"] = sh
        t = taal.get(n) or taal.get(old)
        if t and t.get("beats_class") in TAAL_BY_CLASS:
            tid, alt = TAAL_BY_CLASS[t["beats_class"]]
            mg = (t.get("audio_pred") or {}).get("meter_group") or ""
            sm = t.get("sheet_meter")
            ts = sm if isinstance(sm, str) and re.match(r"^\d+/\d+$", sm) else (
                {8: "4/4", 6: "6/8" if t.get("subdivision") == 3 or mg == "68" else "3/4", 7: "7/8", 5: "5/8"}[t["beats_class"]])
            e["t"] = {"id": tid, **({"alt": alt} if alt else {}), "b": t["beats_class"], "ts": ts,
                      **({"bpm": int(t["bpm"])} if t.get("bpm") else {}), "pulse": t.get("pulse") or "quarter",
                      "sub": t.get("subdivision") or 2,
                      # Not high-confidence (e.g. audio model unvalidated for this album): keep below the UI's 0.8 bar.
                      "c": round(float(t.get("confidence", 0.5)) if t.get("high_confidence") else min(float(t.get("confidence", 0.5)), 0.6), 2)}
            used_t.update(x for x in (tid, alt) if x)
        ch = chords(n, sheet, sa_over, trust)
        if ch:
            e["ch"] = ch
        if not e:
            continue
        cs = [x for x in [e.get("sh", {}).get("c"), *(r["c"] for r in e.get("r", [])[:1]), e.get("t", {}).get("c")] if x is not None]
        if cs:  # a song with only chords (sheet music, no recording or raga) has no overall confidence
            e["c"] = round(sum(cs) / len(cs), 2)
        music[n] = e

    # Raga / taal from Layamritam for songs this pipeline has none for (written by
    # create-index/layamritam/merge_metadata.py; it never replaces a value computed here).
    additions = HERE.parent / "layamritam" / "music-additions.json"
    if additions.exists():
        names = {s["n"] for s in index}
        for n, fill in json.loads(additions.read_text()).items():
            if n not in names:
                continue
            e = music.setdefault(n, {})
            for k, v in fill.items():
                if not e.get(k) and not (k == "r" and e.get("rn") == "none"):  # "no raga" is a classification
                    e[k] = v
                    if k == "r":
                        used_r.update(r["id"] for r in v)
                    elif k == "t":
                        used_t.add(v["id"])
            cs = [p["c"] for p in [e.get("sh"), e.get("t"), *(e.get("r") or [])[:1]] if p and "c" in p]
            if cs:
                e["c"] = round(sum(cs) / len(cs), 2)

    ragas_ref = {}
    for rid in sorted(used_r):
        r = by[rid]
        ragas_ref[rid] = {"name": title(rid), "hi": r.get("hindustani_equiv"), "aroha": r["aroha"], "avaroha": r["avaroha"],
                          "pcs": r["pcs"], "western": r.get("western"), "mood": r.get("mood")}
    taals_ref = {}
    for t in ttable:
        if t["name"] in used_t:
            taals_ref[t["name"]] = {"name": title(t["name"]), "system": t["system"], "beats": t["beats"],
                                    "vibhag": t.get("vibhag"), "bols": t.get("theka_bols"), "clap": t.get("clap_wave"),
                                    "western": t.get("western"), "feel": t.get("feel")}
    for e in music.values():
        e["en"] = english(e, ragas_ref, taals_ref)

    stats = Counter()
    for e in music.values():
        stats["songs"] += 1
        stats["shruti"] += "sh" in e
        stats["shruti_high"] += e.get("sh", {}).get("c", 0) >= 0.85
        stats["raga"] += bool(e.get("r"))
        stats["raga_high"] += bool(e.get("r")) and e["r"][0]["c"] >= 0.85
        stats["no_raga"] += e.get("rn") == "none"
        stats["taal"] += "t" in e
        stats["taal_high"] += e.get("t", {}).get("c", 0) >= 0.8
        stats["chords"] += "ch" in e
    print(dict(stats), "of", len(index), "index songs; raga labels read:", len(raga_out))
    if unknown:
        print("raga names not in table:", unknown.most_common(15))
    out_dir = Path(sys.argv[sys.argv.index("--out") + 1]) if "--out" in sys.argv else ROOT / "public"
    if write:
        (out_dir / "bhajan-music.json").write_text(json.dumps(music, ensure_ascii=False, separators=(",", ":")))
        (out_dir / "music-reference.json").write_text(
            json.dumps({"ragas": ragas_ref, "taals": taals_ref}, ensure_ascii=False, separators=(",", ":")))
        print(f"wrote {out_dir}/bhajan-music.json and music-reference.json")
    else:
        k = next((k for k, v in music.items() if v.get("r") and v.get("t")), next(iter(music)))
        print(k, json.dumps(music[k], ensure_ascii=False))


if __name__ == "__main__":
    main()
