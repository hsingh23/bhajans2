#!/usr/bin/env python3
"""Amazon lookup helper for the bhajan buy-link check.

  amz.py album <track ASIN>         JSON: the album a track is on, with its title and artist
  amz.py search "<words>" [--all]   up to 10 results: ASIN | title | by | formats/prices
                                    (default searches Digital Music; --all searches every department)

Prints compact text. Never solves CAPTCHAs: when Amazon asks for one it waits and retries,
then prints BLOCKED so the caller can move on and come back later.
"""
import html, re, sys, time, random, urllib.parse, urllib.request, gzip

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"


def fetch(url):
    for attempt in range(4):
        time.sleep(random.uniform(1.0, 2.5) + attempt * 20)
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9",
                                                   "Accept": "text/html", "Accept-Encoding": "gzip"})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                body = r.read()
                if r.headers.get("Content-Encoding") == "gzip":
                    body = gzip.decompress(body)
                text = body.decode("utf-8", "ignore")
        except Exception as e:  # 503 etc.
            text = f"ERROR {e}"
        if "captcha" in text.lower()[:20000] or text.startswith("ERROR"):
            continue
        return text
    return None


def clean(seg):
    seg = re.sub(r"<script.*?</script>|<style.*?</style>", "", seg, flags=re.S)
    seg = re.sub(r"<[^>]+>", "|", seg)
    seg = html.unescape(re.sub(r"\s+", " ", seg))
    return re.sub(r"(\s*\|\s*)+", " | ", seg).strip(" |")


def search(words, all_depts=False):
    q = urllib.parse.quote_plus(words)
    url = f"https://www.amazon.com/s?k={q}" + ("" if all_depts else "&i=digital-music")
    h = fetch(url)
    if h is None:
        print("BLOCKED"); return
    starts = [m.start() for m in re.finditer(r'<div[^>]*data-asin="[A-Z0-9]{10}"[^>]*data-component-type="s-search-result"', h)]
    if not starts:
        print("NO RESULTS"); return
    starts.append(len(h))
    for a, b in list(zip(starts, starts[1:]))[:10]:
        seg = h[a:b]
        asin = re.search(r'data-asin="([A-Z0-9]{10})"', seg).group(1)
        t = clean(seg)
        t = re.sub(r" \| (Listen with Amazon Music|Amazon Music Unlimited|Prime Video|FREE delivery.*?)(?= \||$)", "", t)
        print(f"{asin} | {t[:200]}")


def album_of(asin):
    """Track ASIN -> {album, title, artist}; the track page only names its album, the album search names the artist."""
    h = fetch(f"https://www.amazon.com/dp/{asin}")
    if h is None:
        return {"asin": asin, "error": "blocked"}
    m = re.search(r'music/player/albums/([A-Z0-9]{10})', h)
    if not m:
        return {"asin": asin, "error": "no album"}
    alb = m.group(1)
    for url in (f"https://www.amazon.com/s?k={alb}&i=digital-music", f"https://www.amazon.com/s?k={alb}"):
        s = fetch(url)
        if s is None:
            return {"asin": asin, "album": alb, "error": "blocked"}
        i = s.find(f'data-asin="{alb}"')
        if i >= 0:
            break
    if i < 0:
        return {"asin": asin, "album": alb, "error": "album not listed"}
    parts = clean(s[i:i + 8000]).split(" | ")
    title = parts[1] if len(parts) > 1 else None
    artist = parts[parts.index("by") + 1] if "by" in parts[:6] else None
    return {"asin": asin, "album": alb, "album_title": title, "artist": artist}


if __name__ == "__main__":
    if len(sys.argv) >= 3 and sys.argv[1] == "search":
        search(sys.argv[2], "--all" in sys.argv)
    elif len(sys.argv) == 3 and sys.argv[1] == "album":
        import json
        print(json.dumps(album_of(sys.argv[2]), ensure_ascii=False))
    else:
        print(__doc__)
