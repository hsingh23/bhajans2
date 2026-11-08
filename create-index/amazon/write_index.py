#!/usr/bin/env python3
"""Patch Amazon track links into public/bhajan-index2.json as `az` (the track ASIN), keyed by song name.

Only tracks whose album page names Amma (or her devotees) as the artist are linked, and only when the
track title clearly is this song: same-sounding title (bkey score >= 0.85), or a high-confidence worker
match scoring >= 0.7, or a title checked by hand (ALLOW). DENY lists hand-checked wrong matches.
Patches the committed index in place (a full create-index rebuild reorders keys), and drops stale `az`."""
import json, os
here = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(here, "../../public/bhajan-index2.json")

# Translated or retitled songs whose Amazon title is the original name: checked by hand.
ALLOW = {
    "a fragrance in the dark (irul tingi) english", "bless me with your darshan ma (de darshan ma) (english)",
    "blissful knower of truth (anandamayi brahmamayi) (english)", "he gananayaka siddivinayaka (marathi)",
    "light of truth (bandham illa)", "mother can you hear me (amma nin rupam) english",
    "mother of love (anpiyannamba) english", "narayana hare (kalina kanan en kanna)",
    "oh my divine mother (amme yi jivende) english", "ajivanantam bhajincenu (ajivanantam) (telugu)",
    "amba tojale (amba paluku) (tulu)", "donde puedo ir (where can i go) (spanish)",
    "que tout etre en ce monde (everyone in the world) (french)",
}
# Hand-checked: the Amazon track is a different song.
DENY = {
    "kalamam cudalayil (malayalam)", "kalindi tirattu ninnum", "adisakti (marathi)", "isvari jagadisvari (kannada)",
    "jagadisvari ma (malayalam amrita)", "rama rama jaya rama", "sri rama jaya rama dasarathe", "mata mahesvari",
    "nilavanil ni nirannu (malayalam)", "govinda gopala madhava (tamil)",
}

buy = json.load(open(os.path.join(here, "amazon-buy.json")))

def link(name):
    e = buy.get(name)
    if not e or e["status"] != "verified" or name in DENY:
        return None
    m = next((m for m in e["matches"] if m["verified"]), None)
    if not m:
        return None
    ok = m["title_score"] >= 0.85 or (e.get("confidence") == "high" and m["title_score"] >= 0.7) or name in ALLOW
    return m["asin"] if ok else None

with open(INDEX) as f:
    idx = json.load(f)
n = 0
for b in idx:
    b.pop("az", None)
    a = link(b["n"])
    if a:
        b["az"] = a; n += 1
with open(INDEX, "w") as f:
    json.dump(idx, f, ensure_ascii=False, separators=(",", ":"))
print(f"linked {n} of {len(idx)} songs")
