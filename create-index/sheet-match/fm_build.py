"""Build fontmaps.json from the evidence of fm_align.py / fm_words.py, decode, and validate.
Run: python3 fm_build.py pages.json align.json words_legacy.json"""
import json, re, sys, collections, difflib, unicodedata
from pathlib import Path
HERE = Path(__file__).parent
pages = json.load(open(sys.argv[1])); A = json.load(open(sys.argv[2])); WL = json.load(open(sys.argv[3]))
sheets = json.load(open(HERE / "sheets.json"))

def both(m):  # add uppercase entries
    out = {}
    for k, v in m.items():
        out[k] = v
        if k.upper() != k and len(k) == 1: out[k.upper()] = v.upper()
    return out

SONGBOOK = both({"à": "ā", "è": "ē", "ì": "ī", "ò": "ō", "ù": "ū", "û": "ū", "å": "ṇ", "â": "ṭ", "î": "ḷ",
                 "é": "ś", "ä": "ṛ", "ñ": "ñ", "ç": "ṣ", "ê": "ṅ", "á": "ḍ", "ã": "ḥ", "ë": "ṁ", "ö": "ō", "õ": "ō"})
SHEET = both({"â": "ā", "ê": "ē", "î": "ī", "ô": "ō", "û": "ū", "ñ": "ṇ", "õ": "ñ", "ö": "ḷ", "ø": "ṭ",
              "è": "ḍ", "ë": "ṛ", "ï": "ḥ", "ç": "z", "å": "ś", "æ": "ṣ", "¨": ""})
SHEET_SEQ = {"åh": "ś", "Åh": "Ś", "æh": "ṣ", "Æh": "Ṣ", "¨u": "u"}
V = "aeiouāēīōūAEIOUĀĒĪŌŪ"

def dec_legacy(t): return "".join(SONGBOOK.get(c, c) for c in t)
# context rules applied (in order, as Python regexes) after the single-char map
SHEET_RULES = [
    [r"ṇ(?=[\s-]*[cjCJ])|(?<=[jJ])ṇ", "ñ"],                                              # ñc, ñj, jñ are palatal ñ
    [r"(?<=[aeiouāēīōūAEIOUĀĒĪŌŪ])ṛ(?=[\s-]*[bcdghjklmnpqstvwyzḍḷṇṣśṭ])", "r"],           # vowel + ë + consonant = r
    [r"(?<=[AEIOUĀĒĪŌŪaeiouāēīōū])Ṛ(?=[\s-]*[bcdghjklmnpqstvwyzḍḷṇṣśṭ])", "R"],
]
def dec_sheet(t):
    for k, v in SHEET_SEQ.items(): t = t.replace(k, v)
    t = "".join(SHEET.get(c, c) for c in t)
    for pat, rep in SHEET_RULES: t = re.sub(pat, rep, t)
    return t

# ---------- evidence ----------
def tally(pairs_lists, src_char, expect, decode_tgt):
    hit = tot = 0
    for plist in pairs_lists:
        for s, t, n in plist:
            if src_char in s:
                tot += n
                if expect.lower() in decode_tgt(t).lower() or (expect == "" and True): hit += n if expect else 0
    return hit, tot

ev = {"songbook_legacy": {}, "sheet": {}}
for k, v in SONGBOOK.items():
    w = sum(n for s, t, n in WL["pairs"] if s == k and t == v.lower())
    wt = sum(n for s, t, n in WL["pairs"] if s == k)
    a = sum(n for s, t, n in A["legacy_uni"]["pairs"] if s == k and t == v.lower())
    at = sum(n for s, t, n in A["legacy_uni"]["pairs"] if s == k)
    ex = (WL["ex"].get(f"{k}\t{v.lower()}") or [])[:3] + (A["legacy_uni"]["ex"].get(f"{k}\t{v.lower()}") or [])[:2]
    ev["songbook_legacy"][k] = {"word_types": [w, wt], "page_align": [a, at], "examples": ex}
for k, v in SHEET.items():
    hit = tot = 0; exs = []
    for s, t, n in A["sheet_legacy"]["pairs"]:
        if k not in s: continue
        tot += n
        dt = dec_legacy(t).lower()
        ok = (v.lower() in dt) if v else True
        if k in "ëË": ok = ("ṛ" in dt or "r" in dt)
        if k in "ñÑ": ok = ("ṇ" in dt or "ñ" in dt)
        if ok:
            hit += n
            if len(exs) < 3: exs += (A["sheet_legacy"]["ex"].get(f"{s}\t{t}") or [])[:3 - len(exs)]
    u = sum(n for s, t, n in A["sheet_uni"]["pairs"] if k in s and v and v.lower() in t)
    ev["sheet"][k] = {"vs_legacy": [hit, tot], "vs_unicode": u, "examples": exs}

def conf(h, t):
    if t == 0: return "unseen in aligned text (by analogy with lowercase)"
    r = h / t
    return "high" if h >= 20 and r >= .7 else "medium" if h >= 3 and r >= .5 else "low"

# ---------- validation: similarity before/after decoding ----------
def lyr(t):
    return "".join(re.sub(r"[^\w]", "", ln) for ln in t.split("\n") if any(ord(c) > 127 and c.isalpha() for c in ln))
def sheet_txt(s):
    t = re.sub(r"\b(Chorus|Verse|Coda|Bridge|Intro|Refrain|Ending|Fine)\b", " ", s); t = re.sub(r"\d+\.", " ", t)
    return t
def flat(s): return re.sub(r"[^\w]", "", s).lower()
def pg(ref):
    b, p = ref.rsplit("-", 1); p = int(p); L = pages[b]
    return L[p - 1] + "\n" + (L[p] if p < len(L) else "")
def ratio(a, b): return difflib.SequenceMatcher(None, a, b, autojunk=False).ratio()
val = {"legacy_uni": [], "sheet_legacy": []}
for l in A["legacy_uni"]["links"]:
    if not l[1]: continue
    b, p = eval(l[0]); raw = lyr(pages[b][p - 1]).lower(); U = lyr(pg(l[1])).lower()
    val["legacy_uni"].append((ratio(raw, U), ratio(dec_legacy(raw), U)))
import random; random.seed(1)
sl = [l for l in A["sheet_legacy"]["links"] if l[1]]
for l in random.sample(sl, 120):
    raw = flat(sheet_txt(sheets[l[0]]["lyrics"])); Lg = lyr(pg(l[1]))
    val["sheet_legacy"].append((ratio(raw, Lg.lower()), ratio(flat(dec_sheet(sheet_txt(sheets[l[0]]["lyrics"]))), flat(dec_legacy(Lg)))))
summ = {k: [round(sum(x[0] for x in v) / len(v), 3), round(sum(x[1] for x in v) / len(v), 3), len(v)] for k, v in val.items()}

# ---------- footer-ref sanity ----------
ROMAN = {"I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6, "6": 6}
link = {l[0]: l for l in A["sheet_legacy"]["links"]}
off = []
for st, s in sheets.items():
    refs = [r for r in s.get("refs") or [] if r.get("book") and r.get("page")]
    if not refs: continue
    l = link.get(st)
    want = {(f"vol{ROMAN.get(r['book'].upper())}", int(r["page"])) for r in refs}
    if not l or not l[1]: off.append((st, sorted(want), None)); continue
    b, p = l[1].rsplit("-", 1); p = int(p)
    if not any(b == wb and abs(p - wp) <= 1 for wb, wp in want): off.append((st, sorted(want), l[1]))

# ---------- three-way examples ----------
lu = {l[0]: l[1] for l in A["legacy_uni"]["links"] if l[1]}
triples = []
for l in sl:
    b, p = l[1].rsplit("-", 1)
    for dp in (0, 1, -1):
        k = str((b, int(p) + dp))
        if k in lu: triples.append((l[0], f"{b}-{int(p)+dp}", lu[k])); break
slk = {l[0]: l[1] for l in sl}
for l in A["sheet_uni"]["links"]:  # sheets found directly in a Unicode book
    if l[1] and l[0] in slk and not any(t[0] == l[0] for t in triples): triples.append((l[0], slk[l[0]], l[1]))
def lines_of(t): return [ln.strip() for ln in t.split("\n") if any(ord(c) > 127 and c.isalpha() for c in ln) and len(ln.strip()) > 15]
examples = []
for st, lg, un in triples:
    b, p = lg.rsplit("-", 1); Lls = lines_of(pages[b][int(p) - 1] + "\n" + pages[b][int(p)]); Uls = lines_of(pg(un))
    raw = sheet_txt(sheets[st]["lyrics"])
    toks = [m for m in re.finditer(r"\S+", raw)]  # syllables
    got = 0
    for ln in Lls:
        d = dec_legacy(ln); df = flat(d)
        if len(df) < 15: continue
        bu = max(Uls, key=lambda u: ratio(df, flat(u)), default=None)
        if not bu or ratio(df, flat(bu)) < .72: continue
        best = (0, 0, 0)
        for i in range(len(toks)):
            acc = ""
            for j in range(i, min(len(toks), i + 40)):
                acc = flat(dec_sheet(raw[toks[i].start():toks[j].end()]))
                if len(acc) >= len(df) - 2:
                    r = ratio(df, acc)
                    if r > best[0]: best = (r, i, j)
                if len(acc) > len(df) + 2: break
        if best[0] < .6: continue
        seg = raw[toks[best[1]].start():toks[best[2]].end()]
        examples.append({"sheet": st, "legacy": lg, "unicode": un, "sheet_raw": seg, "sheet_decoded": dec_sheet(seg),
                         "legacy_raw": ln, "legacy_decoded": d, "unicode_line": bu,
                         "r_legacy_uni": round(ratio(df, flat(bu)), 2), "r_sheet_legacy": round(best[0], 2)})
        got += 1
        if got >= 2: break
examples.sort(key=lambda e: -(e["r_legacy_uni"] + e["r_sheet_legacy"]))
json.dump({"ev": ev, "val": summ, "off": off, "examples": examples, "triples": triples}, open(sys.argv[4], "w"), ensure_ascii=False, indent=1)

notes = {
 "sheet:ë": "Vocalic ṛ after a consonant (këæhña = kṛṣṇa). After a vowel and before a consonant it is plain r (saëvva = sarvva, mûëtti = mūrtti); between vowels it is Malayalam ṟ, which 2025 writes ṙ (maëannu = maṙannu). dec rule: vowel+ë+consonant -> r, else ṛ.",
 "sheet:ñ": "ṇ in ~97% of uses; next to c/j (ñc, ñj, jñ) it is the palatal ñ. dec rule handles that.",
 "sheet:å / æ": "Written as the digraphs åh / æh (Åha = Śa, lakæhmi = lakṣmi); the h is part of the letter and must be dropped. A bare å/æ (without h) also means ś/ṣ.",
 "sheet:ç": "Only occurs in çh = zh (Malayalam/Tamil ḻ); maps to plain z so çh -> zh, matching both songbooks' zh spelling.",
 "sheet:¨": "Precedes u (275/275) in word-final Malayalam/Tamil -kku, -ttu, -ṇḍu: the half-u (samvruthokaram) mark. Both songbooks write plain u, so it is dropped.",
 "sheet:ø vs d": "ø is ṭ; but the sheets often spell intervocalic Malayalam ṭ as d (kâttidu = kāṭṭiṭu), a spelling choice not a font char.",
 "sheet:ä, ¸, ¯, ’": "ä (5x), ¸ (2x), ¯ (1x) are isolated typos with no consistent counterpart; left unmapped. ’ is punctuation.",
 "sheet:Æ": "5x; Æh = Ṣ (Æhañmukhâ), but once 'Ananta Æayana' = Śayana (typo for Å).",
 "sheet:Ø, Ö, È, Û": "Uppercase forms seen 1-9x only; mapped by analogy with the lowercase (ØhOkar = Ṭhokar, Èamarû = Ḍamarū).",
 "songbook_legacy:ä": "ṛ in Sanskrit words (amätam = amṛtam); also Malayalam ṟ, which 2025 writes ṙ (aäivu = aṙivu). Map ä -> ṛ; normalise ṙ -> ṛ on the Unicode side to compare.",
 "songbook_legacy:ê": "ṅ (saêkaâa = saṅkaṭa); the songbooks also spell Malayalam ññ as êê (teîiêêu = teḷiññu), so ṅṅ vs ññ must be treated as equal.",
 "songbook_legacy:â": "ṭ; 2025 often writes intervocalic Malayalam ṭ as ḍ (pàâum = pāḍum) and ṟṟ as ṫṫ (kàââil = kāṫṫil). Spelling, not font.",
 "songbook_legacy:ç": "ṣ; some words use ç where 2025 has ś (kèçava = kēśava, darçan = darśan) — the songbook's own spelling.",
 "songbook_legacy:ë": "Rare (vol3/6/7): anusvara ṁ (oë = oṁ, éaraåaë = śaraṇaṁ, annaiyuë = annaiyum).",
 "songbook_legacy:ö, õ": "Rare stray variants of ō (möhana, varumö, asatö; jõ, hamkõ, ilaipõl).",
 "songbook_legacy:û": "Variant of ù = ū (mûrttè = mūrttē, anugrahikkû).",
 "compare": "Before comparing, also fold ṙ->ṛ, ṫ->ṭ, ḍ<->ṭ (Malayalam), ṅṅ<->ññ, c<->ch, ny<->ñ, ṁ->m, and drop hyphens/spaces.",
}
out = {"apply_order": {"sheet": "1) replace each sheet_sequences key (literal strings); 2) map each char via sheet; 3) apply each sheet_rules [regex, replacement] in order with Python re.sub",
                       "songbook_legacy": "map each char via songbook_legacy (pure 1:1)"},
       "sheet": SHEET, "sheet_sequences": SHEET_SEQ, "sheet_rules": SHEET_RULES, "songbook_legacy": SONGBOOK, "notes": notes,
       "confidence": {"sheet": {k: conf(*ev["sheet"][k]["vs_legacy"]) for k in SHEET},
                      "songbook_legacy": {k: conf(ev["songbook_legacy"][k]["word_types"][0] + ev["songbook_legacy"][k]["page_align"][0],
                                                  ev["songbook_legacy"][k]["word_types"][1] + ev["songbook_legacy"][k]["page_align"][1]) for k in SONGBOOK}}}
out["confidence"]["sheet"]["¨"] = "high (275/275 occurrences precede u; songbooks write plain u)"
json.dump(out, open(HERE / "fontmaps.json", "w"), ensure_ascii=False, indent=1)
print(summ); print("footer refs off/unlinked:", len(off)); print("triples", len(triples), "examples", len(examples))
for e in examples[:5]: print(e)
