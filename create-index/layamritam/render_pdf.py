#!/usr/bin/env python3
"""Render the extra lyrics book public/pdfs/extra.pdf from extra-manifest.json.

Same page size and type hierarchy as Bhajanamritam Vol 6 (small-caps title with the
language, bold transliterated lines, indented English meaning), without header or
footer. Every song starts on a new page, so a song's first page never changes when
songs are appended: the manifest records each song's page, and a re-render that would
move an earlier song fails instead of silently breaking links.

Meanings come from Layamritam in lower case; meanings-cased.json holds the recased text
(only letter case may differ, checked here), with a rule-based recaser as fallback.

Run from the repo root: uv run --with pymupdf --with rapidfuzz --with fonttools python create-index/layamritam/render_pdf.py [--repage]
"""
import html
import json
import re
import sys
from pathlib import Path

import pymupdf

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / "sheet-match"))
import lmeta  # noqa: E402
from compact_pdf import compact  # noqa: E402
from match import english_like  # noqa: E402
from select_new import lyric_parts  # noqa: E402

MANIFEST = HERE / "extra-manifest.json"
CASED = HERE / "meanings-cased.json"
OUT = lmeta.ROOT / "public" / "pdfs" / "extra.pdf"
FONTS = HERE / "fonts"

PAGE = pymupdf.Rect(0, 0, 387.35, 612)  # Bhajanamritam 6 trim size
BODY = pymupdf.Rect(50, 46, 387.35 - 46, 612 - 40)

CSS = """
@font-face { font-family: G; src: url(EBGaramond-Regular.ttf); }
@font-face { font-family: G; font-weight: bold; src: url(EBGaramond-SemiBold.ttf); }
@font-face { font-family: G; font-style: italic; src: url(EBGaramond-Italic.ttf); }
body { font-family: G; font-size: 11pt; line-height: 1.22; color: #000; }
h1 { font-family: G; font-weight: normal; font-size: 14.5pt; letter-spacing: 0.4pt; line-height: 1.3;
     margin: 0 0 8pt 0; }
.alias { font-style: italic; font-size: 10.5pt; margin: -4pt 0 8pt 0; }
.v { margin: 0 0 7pt 0; }
.l { font-weight: bold; font-size: 11.5pt; margin: 0; }
.m { font-size: 10.5pt; margin: 1pt 0 0 14pt; text-align: justify; }
"""

def heading(title, lg):
    """Printed title, Vol 6 style (UPPER CASE, language in parentheses), and an optional alias line."""
    main, alias = lmeta.display_title(title)
    return f"{main.upper()} ({lg.upper()})" if lg else main.upper(), alias


def clean_lyrics(s):
    s = (s or "").replace("॥", "||").replace("।", "|")
    lines = [re.sub(r"\s+", " ", x).strip() for x in re.split(r"\$|\n", s)]
    return [x for x in lines if x]


def clean_meaning(s):
    s = re.sub(r"\s+", " ", s or "").strip()
    return "" if re.fullmatch(r"\(.*\)", s) else s


SMALL = {"a", "an", "the", "of", "and", "or", "to", "in", "on", "at", "by", "for", "with", "from", "as", "is", "are"}
DIVINE = {"you", "your", "yours", "yourself", "thou", "thee", "thy", "thine", "mother", "lord", "god", "goddess",
          "amma", "krishna", "rama", "shiva", "siva", "devi", "kali", "durga", "ganesha", "ganapati", "radha", "hari",
          "govinda", "gopala", "murari", "vrindavan", "yamuna", "ganga", "om", "vedas", "gopis", "gopi", "narayana",
          "bhavani", "parvati", "lakshmi", "saraswati", "hanuman", "murugan", "guru", "ayyappa", "vishnu", "sita"}


def rule_recase(s):
    """Fallback recaser: sentence starts, I, O, the Divine and words with diacritics."""
    def word(m):
        w = m.group(0)
        lw = w.lower()
        if lw in ("i", "i'm", "i've", "i'll", "i'd", "o") or lw in DIVINE or any(ord(c) > 127 for c in w):
            return w[:1].upper() + w[1:]
        return w
    s = re.sub(r"[^\W\d_]+(?:'[a-z]+)?", word, s)
    return re.sub(r"(^|[.!?]\s+)([a-z])", lambda m: m.group(1) + m.group(2).upper(), s)


def load_cased():
    cased = json.loads(CASED.read_text()) if CASED.exists() else {}
    return {k: v for k, v in cased.items() if isinstance(v, str)}


def meaning_text(part, cased):
    raw = clean_meaning(part.get("meaning"))
    if not raw:
        return ""
    c = cased.get(str(part["lyricPartId"]))
    if c and re.sub(r"\s+", " ", c).strip().lower() == raw.lower():
        return re.sub(r"\s+", " ", c).strip()
    if raw[:1].islower():
        return rule_recase(raw)
    return raw


# Songs in these languages are sung in a Latin-script language: their lyric lines may be prose.
LATIN_SUNG = {"English", "Spanish", "French", "German", "Italian", "Dutch", "Finnish", "Portuguese", "Polish",
              "Turkish", "Catalan", "Danish", "Swedish", "Basque", "Swahili", "Kreole", "Irish"}


def song_html(entry, parts, cased):
    head, alias = heading(entry["title"], entry["lg"])
    out = [f"<h1>{html.escape(head)}</h1>"]
    if alias:
        out.append(f'<p class="alias">({html.escape(alias)})</p>')
    for p in lyric_parts(parts, entry["title"]):
        lines = clean_lyrics(p.get("lyrics"))
        m = meaning_text(p, cased)
        if entry["lg"] not in LATIN_SUNG:
            # Layamritam sometimes stores the English meaning in the lyrics field.
            prose = [x for x in lines if english_like(x) and not any(ord(c) > 127 for c in x)]
            if prose and not m:
                lines = [x for x in lines if x not in prose]
                m = rule_recase(" ".join(prose)) if prose[0][:1].islower() else " ".join(prose)
        if not lines and not m:
            continue
        body = "".join(f'<p class="l">{html.escape(x)}</p>' for x in lines)
        if m:
            body += f'<p class="m">{html.escape(m)}</p>'
        out.append(f'<div class="v">{body}</div>')
    return "<body>" + "".join(out) + "</body>"


def render(repage=False):
    manifest = json.loads(MANIFEST.read_text())
    songs = {s["songId"]: (s, p) for s, p in lmeta.load_songs()}
    cased = load_cased()
    archive = pymupdf.Archive(str(FONTS))
    tmp = OUT.with_suffix(".tmp.pdf")
    writer = pymupdf.DocumentWriter(str(tmp))
    page_no, toc, moved = 0, [], []
    for e in manifest:
        start = page_no + 1
        if e.get("page") and e["page"] != start and not repage:
            moved.append((e["n"], e["page"], start))
        e["page"] = start
        story = pymupdf.Story(html=song_html(e, songs[e["songId"]][1], cased), user_css=CSS, archive=archive)
        more, used = 1, 0
        while more:
            dev = writer.begin_page(PAGE)
            more, _ = story.place(BODY)
            story.draw(dev)
            writer.end_page()
            page_no += 1
            used += 1
        while e.get("pages", 0) > used and not repage:  # a song that got shorter keeps its pages
            writer.begin_page(PAGE)
            writer.end_page()
            page_no += 1
            used += 1
        if used > e.get("pages", used) and not repage:
            moved.append((e["n"], "grew", used))
        e["pages"] = max(used, e.get("pages", 0))
        toc.append([1, heading(e["title"], e["lg"])[0], start])
    writer.close()
    if moved:
        tmp.unlink()
        sys.exit(f"pages would move for {len(moved)} songs (first: {moved[:3]}); rerun with --repage only if no links "
                 "are published yet, otherwise give the grown song new pages at the end")
    doc = pymupdf.open(str(tmp))
    doc.set_toc(toc)
    doc.set_metadata({"title": "Bhajans - additional lyrics", "creator": "create-index/layamritam/render_pdf.py",
                      "producer": "PyMuPDF", "author": "", "subject": "", "keywords": "", "creationDate": "", "modDate": ""})
    doc.subset_fonts()
    compact(doc, {f"EB Garamond {w}": FONTS / f"EBGaramond-{w}.ttf" for w in ("Regular", "SemiBold", "Italic")})
    doc.save(str(OUT), garbage=4, deflate=True, deflate_fonts=True, use_objstms=1, compression_effort=100, no_new_id=True)
    doc.close()
    tmp.unlink()
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n")
    print(f"{OUT.relative_to(lmeta.ROOT)}: {page_no} pages, {len(manifest)} songs, {OUT.stat().st_size // 1024} KB")


if __name__ == "__main__":
    render(repage="--repage" in sys.argv)
