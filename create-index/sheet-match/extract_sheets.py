#!/usr/bin/env python3
"""Pull the title, lyrics and footer references out of one PDF per sheet-music song.

Sheet files are named <Song><Key>.pdf; every key of a song carries the same text,
so one file per song stem is enough. Prefers a local copy, else downloads the
original from the public S3 bucket into pdf-cache/.

Writes sheets.json: {stem: {file, title, lyrics, footer, book_refs, lang}}.
Run: uv run --with pymupdf python extract_sheets.py
"""
import json
from collections import Counter
import re
import sys
import urllib.parse
import urllib.request
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import pymupdf

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
LIST = ROOT / "create-index" / "sheetmusiclist.txt"
LOCAL_DIRS = [ROOT.parent / "bhajans2-sheetmusic-transposed", ROOT / "create-index/music-meta/features/pdf-cache"]
CACHE = HERE / "pdf-cache"
S3 = "https://singwithamma.s3.amazonaws.com/sheetmusic/"
FILE_RE = re.compile(r"^(?P<song>.*?)(?P<root>[A-G])(?P<acc>sharp|#|b)?(?P<minor>m)?(?P<orig>o)?\.pdf$")
MUSIC_FONTS = ("Maestro", "Petrucci", "Jazz", "Engraver", "Opus", "Sonata", "Broadway", "Seville", "Tamburo", "Finale", "Wingding", "Symbol")
# Footer references like "Book I, p 165", "MAC-5", "WTR 2013-4", "Sup 2013", "Vol 3 p 12".
REF_RES = [
    re.compile(r"Book\s*(?P<book>[IVX]+|\d)\s*,?\s*p\.?\s*(?P<page>\d+)", re.I),
    re.compile(r"Vol\.?\s*(?P<book>[IVX]+|\d)\s*,?\s*p\.?\s*(?P<page>\d+)", re.I),
    re.compile(r"Sup(?:plement)?\.?\s*(?P<year>20\d\d)(?:\s*,?\s*p\.?\s*(?P<page>\d+))?", re.I),
    re.compile(r"(?P<year>20\d\d)\s*Sup(?:plement)?\.?(?:\s*,?\s*p\.?\s*(?P<page>\d+))?", re.I),
]
# Rehearsal marks and directions that Finale sets in the lyric font.
STRUCT_RE = re.compile(r"\b(Chorus|Verse|Leader|Group|Unison|Intro|Fine|Coda|D\.?C\.?|Repeat|Faster|Slowly|Bridge|Harmony|Main Voice|Instrumental|Interlude|Ending|Refrain|Response|Call|All|Solo|Men|Women|Tutti|Optional|cont)\b\.?|\(\s*\d+x\s*\)|\b\d+(\.|,\d+)*\b", re.I)
LANGS = ("Malayalam", "Hindi", "Sanskrit", "Tamil", "Telugu", "Kannada", "Bengali", "Marathi", "Gujarati", "Punjabi", "Oriya", "Odia",
         "Tulu", "English", "French", "German", "Spanish", "Italian", "Japanese", "Braj", "Assamese", "Nepali", "Konkani", "Rajasthani", "Bhojpuri", "Urdu")


def stems():
    out = {}
    for line in LIST.read_text().splitlines():
        m = FILE_RE.match(line.strip())
        if not m or not m.group("song"):
            continue
        out.setdefault(m.group("song"), []).append((not bool(m.group("orig")), line.strip()))
    # original upload ("o") first, then alphabetical
    return {k: [f for _, f in sorted(v)] for k, v in out.items()}


def locate(files):
    for f in files:
        for d in LOCAL_DIRS:
            if (d / f).exists():
                return d / f
    CACHE.mkdir(exist_ok=True)
    for f in files[:2]:
        p = CACHE / f
        if p.exists():
            return p
        try:
            urllib.request.urlretrieve(S3 + urllib.parse.quote(f), p)
            return p
        except Exception as e:  # noqa: BLE001
            print("download failed", f, e, file=sys.stderr)
            p.unlink(missing_ok=True)
    return None


def spans(doc):
    for pno, page in enumerate(doc):
        for b in page.get_text("dict")["blocks"]:
            for line in b.get("lines", []):
                for s in line["spans"]:
                    if any(m in s["font"] for m in MUSIC_FONTS):
                        continue
                    t = s["text"].replace("\xa0", " ")
                    if t.strip():
                        yield pno, s["font"], s["size"], s["bbox"], t


def rows(spans_, tol=2.5):
    """Group spans into text rows by baseline (Finale stacks verse 1/2/3 under each note,
    so span order is note by note; reading each row left to right restores the verses)."""
    spans_ = sorted(spans_, key=lambda s: (s[0], round(s[3][3] / tol), s[3][0]))
    out, cur, key = [], [], None
    for s in spans_:
        k = (s[0], round(s[3][3] / tol))
        if key is not None and k != key:
            out.append(cur)
            cur = []
        key = k
        cur.append(s)
    if cur:
        out.append(cur)
    return [" ".join(s[4] for s in r) for r in out]


def dehyphenate(words):
    """Lyric syllables come as 'A-bha - yam am -  mâ': glue pieces that end or start with '-'."""
    out = []
    for w in words:
        w = w.strip()
        if not w:
            continue
        if out and (out[-1].endswith("-") or w.startswith("-")):
            out[-1] = out[-1].rstrip("-") + w.lstrip("-")
        else:
            out.append(w)
    return [w.strip("-") for w in out if w.strip("-")]


def extract(item):
    stem, files = item
    path = locate(files)
    if not path:
        return stem, {"error": "no pdf", "files": files[:3]}
    try:
        doc = pymupdf.open(path)
        sp = list(spans(doc))
    except Exception as e:  # noqa: BLE001
        return stem, {"error": str(e), "file": path.name}
    if not sp:
        return stem, {"error": "no text (scanned?)", "file": path.name, "pages": doc.page_count}
    sizes = sorted({round(s[2]) for s in sp}, reverse=True)
    title_size = sizes[0]
    title = " ".join(t for pno, f, sz, bb, t in sp if round(sz) == title_size and pno == 0).strip()
    # Lyrics: the dominant mid-size font on the first page, usually 13pt regular.
    # Lyrics: the dominant regular (not bold/italic) text size between 10.5 and 16pt.
    regular = [s for s in sp if 10.5 <= s[2] <= 16 and round(s[2]) != title_size
               and "Bold" not in s[1] and "Italic" not in s[1]]
    sizes_c = Counter()
    for s in regular:  # count spans, not characters: lyrics are many short syllables, a note is a few long lines
        sizes_c[round(s[2] * 2) / 2] += 1
    lyric_size = sizes_c.most_common(1)[0][0] if sizes_c else 13
    body = [s for s in regular if abs(s[2] - lyric_size) <= 0.6]
    lines = [" ".join(dehyphenate(STRUCT_RE.sub(" ", r).split())) for r in rows(body)]
    lines = [l for l in lines if re.search(r"[A-Za-z\u00c0-\u024f]{2}", l)]
    lyric_words = " ".join(lines).split()
    small = " ".join(t for pno, f, sz, bb, t in sp if sz < 11.5)
    refs = []
    for rx in REF_RES:
        for m in rx.finditer(small):
            refs.append({k: v for k, v in m.groupdict().items() if v})
    langs = [l for l in LANGS if re.search(r"\b" + l + r"\b", small)]
    return stem, {
        "file": path.name,
        "pages": doc.page_count,
        "title": title,
        "lyrics": " ".join(lyric_words),
        "lines": lines,
        "footer": small[-400:],
        "refs": refs,
        "lang": langs,
    }


def main():
    items = sorted(stems().items())
    with ProcessPoolExecutor(8) as pool:
        res = dict(pool.map(extract, items, chunksize=8))
    (HERE / "sheets.json").write_text(json.dumps(res, ensure_ascii=False, indent=0))
    ok = [k for k, v in res.items() if "error" not in v]
    print(f"{len(ok)}/{len(res)} stems extracted")
    for k, v in res.items():
        if "error" in v:
            print("  ERR", k, v)
    print("with refs:", sum(1 for k in ok if res[k]["refs"]), "with title:", sum(1 for k in ok if res[k]["title"]))


if __name__ == "__main__":
    main()
