#!/usr/bin/env python3
"""Rule-based third opinion on language: count grammatical marker words in the IAST lyrics.

Independent of the LLM raters. Scores each language by marker hits per 100 words; Sanskrit
wins only when no regional language has grammar hits. Prints agreement with the rater
consensus (ld_tally.json) and writes lang_markers.json.
"""
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path

HERE = Path(__file__).parent


def fold(s):
    s = unicodedata.normalize("NFKD", s.lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    return s.replace("ṟ", "r").replace("ḻ", "zh")


W = {  # whole words
    "Malayalam": "ente ninte nin ninne enne enikku ninakku nan njan nyan allo ille illa ennum oru ivide avide entinu entu "
                 "vendum venam venda tannu tarum ceyyum ceyyam kanum kananam varum varu poyi vannu ninnu ennil ninnil "
                 "amme ammayude ammaye manassil manasse",
    "Tamil": "nan ni un en unnai ennai enakku unakku illai vendum vaa varay endru enna ellam ulagil ulakil ulagam "
             "kandu ammave unnidam engal ungal",
    "Kannada": "nanu ninna nanna ninage nanage illa ide bara baro nodu ninnanu yake hege",
    "Telugu": "nenu nivu ninnu nannu ledu emi ela ra rava ninne nannu nalo nilo",
    "Hindi": "hai hain hu hum ham mera meri mere tera teri tere kya ko se mein me main ka ki ke karo do aao jao "
             "hamare tumhare tum mujhe tujhe kaise koi nahi nahin",
    "Braj Bhasha": "mohe tohe kahe hamaro tiharo bhayo bhai mero tero sakhi kanha kanhaiya",
    "Marathi": "majha majhi majhe tujha tujhi ahe aahe kara mala tula",
    "Gujarati": "che chhe mara mari tame ame nathi",
    "Sanskrit": "namah namo namami vande namaste jaya bhaja tvam aham sada sri namostute pahi palaya mam",
}
SUFFIX = {  # verb / case endings that need at least 5 letters of word
    "Malayalam": r"(unnu|unnū|unna|ukayil|illa|anam|enam|unnoru|ude|inde|ninte)$",
    "Tamil": r"(ukku|ttai|kalai|vaai|vay|enen|inen|kirai|kiren|um)$",
    "Hindi": r"(iye|iyo|enge|ega|egi|ungi|unga|ta|ti)$",
    "Sanskrit": r"(aya|ayai|asi|ati|antu|ani|ena|ebhyo)$",
}
WS = {k: set(v.split()) for k, v in W.items()}


def score(text):
    words = re.findall(r"[a-z]+", fold(text))
    c = Counter()
    for w in words:
        for lg, s in WS.items():
            if w in s:
                c[lg] += 1
        for lg, rx in SUFFIX.items():
            if len(w) >= 5 and re.search(rx, w):
                c[lg] += 0.3
    n = max(len(words), 1)
    return {k: round(100 * v / n, 1) for k, v in c.most_common()}


def decide(sc):
    reg = {k: v for k, v in sc.items() if k != "Sanskrit"}
    if not reg or max(reg.values()) < 2.0:
        return "Sanskrit" if sc.get("Sanskrit", 0) > 0 else None
    return max(reg, key=reg.get)


def main():
    rows = json.loads((HERE / "rows.json").read_text())
    text = {}
    for r in rows:
        if r["field"] == "language" and r["lay"]:
            text[r["song"]] = " ".join(r["lay"][0]["lyrics"])
    tally = {t["song"]: t for t in json.loads((HERE / "ld_tally.json").read_text()) if t["field"] == "language"}
    out, agree, n = {}, 0, 0
    for song, t in text.items():
        sc = score(t)
        d = decide(sc)
        out[song] = {"scores": sc, "rule": d}
        tl = tally.get(song)
        if tl and tl["opus"] == tl["sonnet"]:
            n += 1
            agree += d in (tl["opus"], tl["opus2"], tl["sonnet2"])
    (HERE / "lang_markers.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    print(f"rule vs rater consensus (raters agree): {agree}/{n}")


if __name__ == "__main__":
    main()
