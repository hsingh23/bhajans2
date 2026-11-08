#!/usr/bin/env python3
"""Combine every evidence file into one decision per disagreement row.

Inputs (all in this folder): rows.json, ld_tally.json (blind Opus+Sonnet raters),
lay_notes.json (Layamritam's own language notes in its meaning field), taal_lay.json +
taal_lines.json (our taal model and lyric-line test on Layamritam's recordings),
raga_verdict.json (scale fit on sheet music and audio), dup_audio.json (same-recording test).
Writes decisions.csv and decisions.json; prints the class-level tallies used in the report.

Probabilities are P(decision is right). The measured inputs:
  raters      Opus/Sonnet agree on 92% (language) / 89% (deity) of conflicts -> ~0.95 each;
              both 40/40 on blind agreeing controls. Shared training -> we cap two-rater
              agreement at 0.93, 0.97 when Layamritam's own note says the same.
  taal        Layamritam vs trusted sheet meters 794/817 (0.972); our model agrees with
              Layamritam on 96.6% (high conf) / 95.1% (low conf) of matched songs -> 0.99 / 0.975; sheet 0.92 (PRIOR_W); line test
              11/11 clear cases agree with the sheet (LR ~4).
  raga        sheet head-to-head 0.97 / 0.87 / 0.60 by margin, audio 0.87 / 0.74 / 0.52
              (raga_calib.py on the 88-song answer key; audio is partly circular).
"""
import csv
import json
import math
import re
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).parent
MM = HERE.parents[1] / "music-meta"


def odds(p):
    p = min(max(p, 1e-4), 1 - 1e-4)
    return p / (1 - p)


def prob(o):
    return o / (1 + o)


def wilson(k, n, z=1.96):
    if not n:
        return (0.0, 0.0)
    p = k / n
    d = 1 + z * z / n
    c = p + z * z / (2 * n)
    m = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return (round((c - m) / d, 2), round((c + m) / d, 2))


def band(p):
    return "high" if p >= 0.9 else "medium" if p >= 0.7 else "low"


LANG_NOTE_IN = " in "


def note_lang(sid, notes):
    n = notes.get(str(sid))
    if not n:
        return None
    lg, text = n
    # "(malayalam) in kannada" = a Malayalam song sung in Kannada -> Kannada
    if LANG_NOTE_IN in text:
        tail = text.split(LANG_NOTE_IN, 1)[1].split()[0]
        for k, v in {"kannada": "Kannada", "gujrati": "Gujarati", "gujarati": "Gujarati", "telugu": "Telugu",
                     "tamil": "Tamil", "hindi": "Hindi", "malayalam": "Malayalam"}.items():
            if tail.startswith(k):
                return v
    return lg


def main():
    rows = json.loads((HERE / "rows.json").read_text())
    ld = {(t["song"], t["field"]): t for t in json.loads((HERE / "ld_tally.json").read_text())}
    notes = json.loads((HERE / "lay_notes.json").read_text())
    taal_lay = json.loads((HERE / "taal_lay.json").read_text())
    lines = json.loads((HERE / "taal_lines.json").read_text())
    raga = {(v["song"], v["kind"]): v for v in json.loads((HERE / "raga_verdict.json").read_text())}
    dup = json.loads((HERE / "dup_audio.json").read_text())
    taal = json.loads((MM / "features" / "taal.json").read_text())
    matches = json.loads((HERE.parent / "matches.json").read_text())
    index = json.loads((HERE.parents[2] / "public" / "bhajan-index2.json").read_text())
    hp = HERE / "work" / "human_taal_sheet.json"
    human = json.loads(hp.read_text()) if hp.exists() else {}
    out = []

    for r in rows:
        k, f, song = r["kind"], r["field"], r["song"]
        d = dict(kind=k, field=f, song=song, page=r["page"], app=r["app"], layamritam=r["layamritam"])

        if f in ("language", "deity") and k == "conflict":
            t = ld[(song, f)]
            key = "lg" if f == "language" else "d"
            nl = [note_lang(l["songId"], notes) for l in r["lay"]] if f == "language" else []
            nl = next((x for x in nl if x), None)
            votes = [t["opus"], t["sonnet"]]
            if t["opus"] == t["sonnet"]:
                choice = t["opus"]
                p = 0.93
                if nl and nl == choice:
                    p = 0.97
                elif nl and nl != choice:
                    p = 0.8
                p = min(p, (t["oc"] + t["sc"]) / 2 + 0.1)
            else:
                # split raters: take the more confident one, low confidence
                choice = t["opus"] if t["oc"] >= t["sc"] else t["sonnet"]
                if nl in votes:
                    choice, p = nl, 0.7
                else:
                    p = 0.55
            second = [x for x in (t["opus2"], t["sonnet2"]) if x and x != choice]
            winner = "app" if choice == t["app"] else "layamritam" if choice in t["lay"].split("/") else "neither"
            why = []
            if t["mixed"] or second:
                why.append("mixed: also " + "/".join(sorted(set(second))))
            if nl:
                why.append(f"Layamritam note says {nl}")
            if f == "language" and "(" in song and winner != "app":
                why.append("index title tag disagrees with the lyrics")
            d.update(decision=choice, second=";".join(sorted(set(second))), winner=winner, p=round(p, 2),
                     evidence=f"opus {t['opus']} ({t['oc']}): {t['owhy']} | sonnet {t['sonnet']} ({t['sc']}): {t['swhy']}",
                     cause="; ".join(why))

        elif f == "taal":
            a = taal.get(song, {})
            app_b = a.get("beats_class")
            lay_b = sorted({b for l in r["lay"] for _, b in l["taals"]})
            hc = bool(a.get("high_confidence"))
            unval = any("unvalidated" in x for x in a.get("flags", []))
            p_app_model = 0.99 if hc else 0.975  # from agreement with Layamritam: 96.6% (high) / 95.1% (low) = a * 0.972
            o = odds(p_app_model) / odds(0.972)  # app vs Layamritam priors, both measured
            ev = [f"app {app_b} ({a.get('source')}, conf {a.get('confidence')}, {'high' if hc else 'low'})"]
            recs = taal_lay.get(song, [])
            same = [x for x in recs if (x["same_recording_score"] or 0) >= 0.6]
            diff = [x for x in recs if x["same_recording_score"] is not None and x["same_recording_score"] < 0.6]
            rendition = False
            if diff and not same and all(x["lay_pred_class"] in lay_b for x in diff):
                rendition = True
            for x in same:
                if x["lay_pred_class"] != app_b:  # our model flips on a copy of the same audio: unstable
                    o *= 0.5
            for x in recs:
                ev.append(f"model on Layamritam {x['songId']}: {x['lay_pred_class']} "
                          f"({max(x['lay_pred'].values()):.2f}), same recording {x['same_recording_score']}")
            sm = a.get("sheet_meter")
            if sm and a.get("source", "").startswith("sheet"):
                ev.append(f"trusted sheet {sm if isinstance(sm, str) else sm}")
            # lyric-line test: only informative between 3-beat and 2/4-beat bars at the tracked pulse
            ln = lines.get(song)
            if ln:
                x = max(ln, key=lambda z: z["two"] + z["three"])
                vote = "3" if x["three"] > x["two"] + 1 else "2" if x["two"] > x["three"] + 1 else None
                pulse = a.get("pulse")
                if vote:
                    ev.append(f"lyric lines: {x['two']} of 2/4-bar length, {x['three']} of 3-bar length")
                    # discriminative only where the two classes predict different bar lengths at
                    # the tracked pulse: 6/8 felt in two also gives 2-beat bars, like 4/4
                    if app_b == 8 and 6 in lay_b:
                        o *= 0.25 if vote == "3" else 1.5
                    elif app_b == 6 and pulse == "quarter" and 8 in lay_b:
                        o *= 4.0 if vote == "3" else 0.25
            hb = human.get(song, "")
            hn = {int(x) for x in re.findall(r"\d", hb)}
            if hn and len(hn) == 1:  # the user's "taal and bols" sheet: ~0.89 vs sheets, noisy
                h = hn.pop()
                h = 8 if h == 4 else h
                ev.append(f"human taal sheet: {hb}")
                if h == app_b:
                    o *= 4
                elif h in lay_b:
                    o /= 4
            p_app = prob(o)
            if rendition:
                choice, p, winner = f"{app_b} on our recording; Layamritam's {lay_b} on theirs", 0.75, "both (different renditions)"
            elif 0.35 < p_app < 0.65:
                choice, p, winner = "", max(p_app, 1 - p_app), "unresolved"
            elif p_app >= 0.5:
                choice, p, winner = str(app_b), p_app, "app"
            else:
                choice, p, winner = "/".join(map(str, lay_b)), 1 - p_app, "layamritam"
            d.update(decision=choice, second="", winner=winner, p=round(p, 2), evidence=" | ".join(ev),
                     cause="different recordings" if rendition else ("same recording" if same else ""))

        elif f == "raga":
            v = raga.get((song, k))
            if not v or v["p_app"] is None:
                d.update(decision="", second="", winner="unresolved", p=0.5, evidence="no sheet/audio evidence or app has no raga",
                         cause="")
            else:
                pa = v["p_app"]
                if "human" in v["lay_src"]:  # Layamritam human raga label: shrink toward it
                    pa = prob(odds(pa) / 2)
                winner = "app" if pa >= 0.5 else "layamritam"
                choice = v["app"] if pa >= 0.5 else "/".join(v["lay"])
                p = max(pa, 1 - pa)
                ev = "; ".join(f"{s}: margin {e['margin']:+.2f} vs {e['lay_best']} -> P(app) {e['p_app']}" for s, e in v["evidence"].items())
                circ = list(v["evidence"]) == ["audio"]
                d.update(decision=choice, second="", winner=winner if p >= 0.7 else "unresolved", p=round(p, 2),
                         evidence=ev + (" (audio only: partly circular)" if circ else ""),
                         cause=f"Layamritam {'/'.join(v['lay_src'])} label")

        elif k == "new song":
            sid = str(r["lay"][0]["songId"]) if r["lay"] else None
            mt = matches.get(sid, {})
            best_alt = max(mt.get("alt", []), key=lambda a: a["lyric"], default=None)
            da = dup.get(song, {})
            if da.get("best", 0) >= 0.5:
                d.update(decision=f"duplicate of '{r['app']}': merge", winner="layamritam's song is an index song", p=0.9,
                         evidence=f"same recording as the index song's sample (score {da['best']})", second="", cause="audio identity")
            elif best_alt and best_alt["lyric"] >= 0.6 and not best_alt["name"].startswith("omkara divya porule"):
                shared_page = set((r["index"] or {}).get("l", [])) & set(next((x.get("l", []) for x in index if x["n"] == best_alt["name"]), []))
                d.update(decision=f"duplicate of '{best_alt['name']}' (not '{r['app']}'): merge", winner="index song (other name)",
                         p=0.55 if shared_page else 0.8, evidence=f"{best_alt['lyric']:.0%} of its lyrics are in '{best_alt['name']}'"
                         + (f" (shares page {sorted(shared_page)} with '{r['app']}': text may bleed across)" if shared_page else ""), second="",
                         cause="matcher rejected it for a language-label difference")
            elif mt.get("decision") == "version" and (
                    (r["index"] or {}).get("lg") == "Sanskrit"
                    or {(r["index"] or {}).get("lg"), r["lay"][0]["lg"]} == {"Tamil", "Malayalam"}):
                # the "other language" rests on a label pair that is itself often wrong (Sanskrit vs
                # Malayalam, Tamil vs Malayalam are the commonest language conflicts)
                d.update(decision=f"probably the same song as '{r['app']}' (language labels disagree); read both",
                         winner="unresolved", p=0.55, second="",
                         evidence=f"{mt.get('lyric', 0):.0%} shared, index says {(r['index'] or {}).get('lg')}, Layamritam {r['lay'][0]['lg']}, audio {da.get('best')}",
                         cause="version call depends on a doubtful language label")
            elif mt.get("decision") == "version":
                d.update(decision="keep as a separate song (other-language version); cross-link", winner="both",
                         p=0.8, evidence=f"{mt.get('lyric', 0):.0%} shared with '{r['app']}', audio score {da.get('best')}",
                         second="", cause="translation")
            else:
                d.update(decision="keep as a new song", winner="new song", p=0.85,
                         evidence=f"best lyric share {mt.get('lyric')} (noise floor ~0.25 from 'omkara divya porule - 14'), audio {da.get('best')}",
                         second="", cause="title-only coincidence")

        elif k == "judgment":
            d.update(decision="policy", winner="policy", p=None, evidence="see report: Amma vs Devi rule", second="", cause="")
        else:
            continue
        d["band"] = band(d["p"]) if d.get("p") is not None else ""
        out.append(d)

    cols = ["kind", "field", "song", "page", "app", "layamritam", "decision", "second", "winner", "p", "band", "cause", "evidence"]
    with (HERE / "decisions.csv").open("w", newline="") as fh:
        w = csv.DictWriter(fh, cols)
        w.writeheader()
        for d in out:
            w.writerow({c: d.get(c, "") for c in cols})
    (HERE / "decisions.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))

    for (k, f) in sorted({(d["kind"], d["field"]) for d in out}):
        ds = [d for d in out if d["kind"] == k and d["field"] == f]
        c = Counter(d["winner"] for d in ds)
        b = Counter(d["band"] for d in ds)
        resolved = [d for d in ds if d["winner"] in ("app", "layamritam")]
        na = sum(d["winner"] == "app" for d in resolved)
        print(f"{k}/{f}: n={len(ds)} winners={dict(c)} bands={dict(b)} "
              f"app-right share among app/lay = {na}/{len(resolved)} {wilson(na, len(resolved))}")


if __name__ == "__main__":
    main()
