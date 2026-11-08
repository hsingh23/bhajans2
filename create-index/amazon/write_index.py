#!/usr/bin/env python3
"""Patch Amazon track links into public/bhajan-index2.json as `az` (the track ASIN), keyed by song name.

Only tracks whose album page names Amma (or her devotees) as the artist are linked, and only when the
track title clearly is this song: same-sounding title (bkey score >= 0.85), or a high-confidence worker
match scoring >= 0.7, or a title checked by hand (ALLOW). DENY lists hand-checked wrong matches.
Language versions, translations and the Omkara Divya Porule series get no link (Amazon only has another
rendition), and a track shared by several songs stays only on the songs whose own name matches it.
Patches the committed index in place (a full create-index rebuild reorders keys), and drops stale `az`."""
import json, os, re
here = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(here, "../../public/bhajan-index2.json")

# Retitled songs whose Amazon title is another name of the same recording: checked by hand.
ALLOW = {"he gananayaka siddivinayaka (marathi)", "narayana hare (kalina kanan en kanna)"}
# Songs whose own title is English, where Amazon has that English recording.
ENGLISH_OK = {"amma you are everything (english)", "queen of my heart (english)", "underneath a kalpataru (english)"}
# Language versions and translations: Amazon only has the original-language recording, which is not this song.
VERSION = re.compile(r"\bversion\b|english|spanish|french|german|italian|portuguese|finnish|russian|japanese|dutch|swedish|hebrew|chinese|polish|czech|\(tulu\)|bhajincenu", re.I)
# Amazon numbers Omkara Divya Porule as "VIII pt.N", which does not line up with the index's verse numbers.
SERIES = re.compile(r"omkara divya porule", re.I)
# Hand-checked: the Amazon track is a different song.
DENY = {
    "kalamam cudalayil (malayalam)", "kalindi tirattu ninnum", "adisakti (marathi)", "isvari jagadisvari (kannada)",
    "jagadisvari ma (malayalam amrita)", "rama rama jaya rama", "sri rama jaya rama dasarathe", "mata mahesvari",
    "nilavanil ni nirannu (malayalam)", "govinda gopala madhava (tamil)",
}

buy = json.load(open(os.path.join(here, "amazon-buy.json")))

def link(name):
    e = buy.get(name)
    if not e or e["status"] != "verified" or name in DENY or SERIES.search(name):
        return None
    if VERSION.search(name) and name not in ENGLISH_OK:
        return None
    m = next((m for m in e["matches"] if m["verified"]), None)
    if not m:
        return None
    ok = m["title_score"] >= 0.85 or (e.get("confidence") == "high" and m["title_score"] >= 0.7) or name in ALLOW
    return m["asin"] if ok else None

with open(INDEX) as f:
    idx = json.load(f)
links = {b["n"]: link(b["n"]) for b in idx}
TAGGED = re.compile(r"\((?:[a-z]+, )?(hindi|tamil|telugu|telagu|kannada|malayalam|marathi|gujarati|gujrati|bengali|odiya|punjabi|konkani|sanskrit|marwari|tulu)\b", re.I)
# One recording, several index songs: the same song spelled two ways (keep both), or different songs that
# share a short title like "Amba Bhavani" (keep only the best-matching title, and only if it matches well).
import difflib, sys
sys.path.insert(0, os.path.join(here, ".."))
from bkey import oneWordKey
strip = lambda t: re.sub(r"\(.*?\)|\[.*?\]|\b(vintage|remastered|version|namavali)\b", " ", t, flags=re.I)
def score(name):
    """How well the song's own name (not its CD names, which twins share) matches the track title."""
    title = next(m["title"] for m in buy[name]["matches"] if m["verified"])
    return difflib.SequenceMatcher(None, oneWordKey(strip(name)), oneWordKey(strip(title))).ratio()
holders = {}
for name, a in links.items():
    if a: holders.setdefault(a, []).append(name)
for a, names in holders.items():
    if len(names) < 2: continue
    best = max(score(n) for n in names)
    for n in names:
        if score(n) < best - 0.02 or score(n) < 0.8:
            links[n] = None
    # A plain-named song and its language-tagged twin ("kalam kanalu" / "kalam kanalu (kannada)"): the track is
    # the original, so the tagged version loses the link.
    kept = [n for n in names if links[n]]
    plain = [n for n in kept if not TAGGED.search(n)]
    if plain and len(plain) < len(kept):
        for n in kept:
            if n not in plain: links[n] = None
n = 0
for b in idx:
    b.pop("az", None)
    if links.get(b["n"]):
        b["az"] = links[b["n"]]; n += 1
with open(INDEX, "w") as f:
    json.dump(idx, f, ensure_ascii=False, separators=(",", ":"))
print(f"linked {n} of {len(idx)} songs")
