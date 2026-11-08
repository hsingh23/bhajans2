#!/usr/bin/env python3
"""Match every sheet-music song to the index songs whose printed lyrics it carries.

Evidence per (sheet, song) pair, strongest first:
  lyric  - containment of the sheet's lyric character 5-grams in the song's songbook
           text (all books with a PDF: vol1-7, 2025, 2018+ supplements); `first` is the
           same for the sheet's opening lines only, `cover` how much of the printed song
           the sheet accounts for
  ref    - the sheet footer's "Book N, p M" points at one of the song's locations
  title  - fuzzy ratio between the sheet title and the song's names
Both sides are decoded from their legacy transliteration fonts, folded to ASCII and
phonetically collapsed before comparison, so "Jagadîåvarî" ~ "jagadīśvarī" ~ "jagadisvari".

Writes matches.json ({stem: {decision, songs, rows}}), review.md (doubtful cases with the
texts side by side), checks golden.json and prints a comparison with the index's links.
Run: uv run --with rapidfuzz python match.py
"""
import json
import random
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

from rapidfuzz import fuzz

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
INDEX = ROOT / "public" / "bhajan-index2.json"
N = 5  # character n-gram size
MIN_GRAMS = 60  # below this a sheet is "degenerate" (a mantra repeated); lyrics can't decide
T_LYRIC = 0.55  # containment needed to accept on lyrics (null p99.9 is ~0.33)
T_FIRST = 0.60  # the sheet's opening lines must be on the page too
T_WEAK = 0.30  # below this lyrics say "not this song"
SEG_CAP = 3200  # normalised chars (about one printed page) a song may claim after its heading
LEGACY_BOOKS = {"vol1", "vol2", "vol3", "vol4", "vol5", "vol6", "vol7"}

# Provisional glyph maps, replaced by fontmaps.json when present.
PROVISIONAL = {
    "sheet": {"â": "ā", "ê": "ē", "î": "ī", "ô": "ō", "û": "ū", "ñ": "ṇ", "ö": "ḷ", "å": "ś", "ë": "ṛ", "æ": "ṣ",
              "ï": "ḥ", "è": "ḍ", "ç": "ṟ", "ø": "ṭ", "•": "ś", "¨": "", "õ": "ñ",
              "Â": "Ā", "Ê": "Ē", "Î": "Ī", "Ô": "Ō", "Û": "Ū", "Å": "Ś", "Æ": "Ṣ", "Ø": "Ṭ", "È": "Ḍ", "Ö": "Ḷ"},
    "songbook_legacy": {"à": "ā", "è": "ē", "ì": "ī", "ò": "ō", "ù": "ū", "û": "ū", "å": "ṇ", "î": "ḷ", "â": "ṭ", "é": "ś",
                        "ä": "ṛ", "ç": "ṣ", "ê": "ṅ", "ã": "ḥ", "á": "ḍ", "ë": "ṁ", "ø": "ē",
                        "À": "Ā", "È": "Ē", "Ì": "Ī", "Ò": "Ō", "Ù": "Ū", "Å": "Ṇ", "Î": "Ḷ", "Â": "Ṭ", "É": "Ś", "Ä": "Ṛ",
                        "Ç": "Ṣ", "Ê": "Ṅ", "Ã": "Ḥ", "Á": "Ḍ", "Ñ": "Ñ"},
}
FONTMAPS = json.loads((HERE / "fontmaps.json").read_text()) if (HERE / "fontmaps.json").exists() else PROVISIONAL

PHON = [
    ("ksh", "ks"), ("sh", "s"), ("ch", "c"), ("th", "t"), ("dh", "d"), ("bh", "b"), ("kh", "k"), ("gh", "g"),
    ("ph", "p"), ("jh", "j"), ("zh", "l"), ("w", "v"), ("y", "i"), ("h", ""), ("aa", "a"), ("ee", "i"),
    ("ii", "i"), ("oo", "u"), ("uu", "u"), ("g", "k"), ("d", "t"), ("b", "p"), ("j", "c"),
]


def decode(text, which):
    """Legacy font -> Unicode IAST (fontmaps.json: sequences, then chars, then context rules)."""
    if which == "sheet":
        for a, b in FONTMAPS.get("sheet_sequences", {}).items():
            text = text.replace(a, b)
    m = FONTMAPS.get(which, {})
    text = "".join(m.get(c, c) for c in text)
    if which == "sheet":
        for rx, rep in FONTMAPS.get("sheet_rules", []):
            text = re.sub(rx, rep, text)
    return text


def fold(s):
    s = unicodedata.normalize("NFKD", s)
    return "".join(c for c in s if not unicodedata.combining(c))


def norm(text, which=None):
    """Decoded, folded, lower-cased, phonetically collapsed letters with no spaces."""
    if which:
        text = decode(text, which)
    s = fold(text).lower()
    s = re.sub(r"[^a-z]", "", s)
    for a, b in PHON:
        s = s.replace(a, b)
    return re.sub(r"(.)\1+", r"\1", s)


def grams(s):
    return {s[i:i + N] for i in range(len(s) - N + 1)}


def strip_parens(name):
    return re.sub(r"\([^)]*\)", " ", name)


def split_camel(stem):
    return re.sub(r"([a-z])([A-Z0-9])", r"\1 \2", stem).replace("-", " ")


LANG_TAG_RE = r"\b(malayalam|hindi|sanskrit|tamil|telugu|kannada|bengali|marathi|gujarati|gujrati|punjabi|oriya|odiya|odia|tulu|english|french|german|spanish|italian|japanese|finnish|hebrew|assamese|nepali|konkani|rajasthani|bhojpuri|urdu|version|namavali|vintage)\b"
LOC_RE = re.compile(r"^([a-z]+\d*|\d{4}(?:supl\d?)?)-(\d+)$")
ROMAN = {"I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6, "VII": 7, "VIII": 8, "IX": 9, "X": 10, "XI": 11, "XII": 12, "XIII": 13, "XIV": 14}


def find_key(page, key, line_starts, heading_offs=frozenset()):
    """(offset, at_line_start, k) of a song key in the normalised page, or None: the full key first,
    then shorter prefixes. A hit on a printed title line (all caps) beats one at the start of any
    line, which beats one inside the lyrics; short keys (5-6 letters) count only whole, at a line start."""
    ks = [min(len(key), 24), min(len(key), 14), 10, 7] if len(key) >= 7 else [len(key)]
    for k in ks:
        if len(key) < k or k < 5:
            continue
        frag = key[:k]
        hits, i = [], page.find(frag)
        while i >= 0:
            hits.append(i)
            i = page.find(frag, i + 1)
        if hits:
            at_head = [h for h in hits if h in heading_offs]
            if at_head:
                return (at_head[0], True, k + 5)
            at_line = [h for h in hits if h in line_starts]
            if at_line:
                return (at_line[0], True, k)
            if k >= 10:
                return (hits[0], False, k)
    if len(key) >= 8:
        a = fuzz.partial_ratio_alignment(key[:20], page)
        if a and a.score >= 85:
            return (a.dest_start, a.dest_start in line_starts, 4)
    return None


def place_song(key, book, p, pages, starts, heads_at):
    """(page, offset) for a song the index puts on page p (index pages drift by a page or two).
    A hit at the start of a printed line always beats one inside lyrics; among those, a longer
    matched prefix wins, discounted by distance from p. With nothing near p, a whole-book scan
    accepts a unique title-line hit on the whole key (skipping the song index at the back)."""
    p = max(1, min(p, len(pages[book])))
    cands = []
    for q in range(max(1, p - 2), min(len(pages[book]), p + 5) + 1):
        if (book, q) in INDEX_PAGES:
            continue
        f = find_key(pages[book][q - 1], key, starts[book][q - 1], heads_at[book][q - 1])
        if not f:
            continue
        off, at_line, k = f
        if abs(q - p) > 1 and not (at_line and k >= min(10, len(key))):
            continue  # far from the index page only a title-line hit on most of the key counts
        cands.append((at_line, k - 2 * abs(q - p), -abs(q - p), q, off))
    if cands:
        best = max(cands)
        return (best[3], best[4])
    if len(key) >= 10:
        hits = []
        for q in range(1, len(pages[book]) + 1):
            if (book, q) in INDEX_PAGES:
                continue
            f = find_key(pages[book][q - 1], key, starts[book][q - 1], heads_at[book][q - 1])
            if f and f[1] and f[2] >= min(len(key), 14):
                hits.append((q, f[0]))
        if len(hits) == 1:
            return hits[0]
    return None


INDEX_PAGES = set()
HEAD_MAX_LEN = 70


def _norm_lines(raw, which):
    lines = [l.strip() for l in raw.split("\n")]
    return lines, [norm(l, which) for l in lines]


ENGLISH_RE = re.compile(r"\b(the|and|of|to|you|your|my|me|is|are|o|oh|thou|thy|thee|who|with|in|a|i|we|us|our|he|she|it|this|that|from|for|by|on|be|not|all|as|at|please|let|may|will|have|has|am)\b", re.I)
HEADER_RE = re.compile(r"^(\d+|devotional songs.*|bhajanamritam.*|supplement.*|volume.*|[a-z]+)$", re.I)


def english_like(line):
    return bool(ENGLISH_RE.search(line)) and len(ENGLISH_RE.findall(line)) >= 2 or line.rstrip().endswith((".", "!", "?", ")", ";", ":", "\u201d"))


def is_heading(lines, norms, i, which, prev_was_heading):
    """A printed song title we can trust without the index: an all-caps line (vol1-7 style).
    Title-case headings can't be told from a repeated refrain line by text alone, so those
    boundaries come from placing the index's songs by name instead."""
    raw = lines[i]
    letters = [c for c in raw if c.isalpha()]
    if len(letters) < 6 or len(raw) > HEAD_MAX_LEN:
        return False
    key = norm(strip_parens(raw), which) or norms[i]
    if len(key) < 5:
        return False
    upper = sum(1 for c in letters if c.isupper()) / len(letters)
    return upper >= 0.7


def book_pages(books):
    """Per book: normalised page texts, built line by line so heading offsets are exact,
    and the headings found on each page: [(page, offset, heading_norm, raw)]."""
    pages, heads, starts = {}, {}, {}
    for book, b in books.items():
        which = "songbook_legacy" if book in LEGACY_BOOKS else None
        pages[book], heads[book], starts[book] = [], [], []
        for pno, raw in enumerate(b["pages"], start=1):
            lines, norms = _norm_lines(raw, which)
            off, prev_head = 0, False
            page_heads, line_starts = [], set()
            for i, n in enumerate(norms):
                line_starts.add(off)
                if is_heading(lines, norms, i, which, prev_head):
                    hn = norm(strip_parens(lines[i]), which) or n
                    if prev_head and page_heads:  # consecutive title lines are one song under two names
                        page_heads[-1][2].append(hn)
                    else:
                        page_heads.append([pno, off, [hn], lines[i]])
                    prev_head = True
                elif n:
                    prev_head = False
                off += len(n)
            pages[book].append("".join(norms))
            heads[book].extend(page_heads)
            starts[book].append(line_starts)
            numbered = sum(1 for l in lines if re.search(r"\d+\s*$", l) and re.search(r"[A-Za-z]", l))
            if numbered >= 8 and numbered >= 0.4 * max(1, sum(1 for l in lines if l.strip())):
                INDEX_PAGES.add((book, pno))  # the song index at the back of the book
    return pages, heads, starts


def match_heading(key, cands):
    """Best heading for a song key among candidate headings: (score, heading) or None."""
    best = None
    for h in cands:
        for hn in h[2]:
            k = min(len(key), 14)
            if k >= 5 and (hn.startswith(key[:k]) or (len(hn) >= 5 and key.startswith(hn[:max(5, min(len(hn), 14))]))):
                sc = 100
            else:
                sc = fuzz.ratio(key, hn)
            if sc >= 80 and (best is None or sc > best[0]):
                best = (sc, h)
    return best


def song_segments(index, pages, heads, starts):
    """Per printed copy of a song: (song_i, book, page, placed, normalised text).

    Boundaries are every detected heading (indexed or not) plus every indexed song we can
    place by its name; a song's text runs from its boundary to the next one."""
    bounds = {book: defaultdict(list) for book in pages}  # book -> page -> [offset]
    heads_at = {book: [set() for _ in pages[book]] for book in pages}
    for book, hs in heads.items():
        for h in hs:
            bounds[book][h[0]].append(h[1])
            heads_at[book][h[0] - 1].add(h[1])
    placed = []  # (song_i, book, page, offset or None)
    for i, s in enumerate(index):
        key = norm(strip_parens(s["n"]))
        for l in s["l"]:
            m = LOC_RE.match(l.lower())
            if not m or m.group(1) not in pages:
                continue
            book, p = m.group(1), int(m.group(2))
            p = max(1, min(p, len(pages[book])))  # a page past the end: the index is off by one
            found = place_song(key, book, p, pages, starts, heads_at)
            if found:
                bounds[book][found[0]].append(found[1])
                placed.append((i, book, found[0], found[1]))
            else:
                placed.append((i, book, p, None))
    unplaced_pages = {(b, p) for _, b, p, off in placed if off is None}
    for book in bounds:
        for p in bounds[book]:
            bounds[book][p] = sorted(set(bounds[book][p]))

    segments = []
    for i, book, p, off in placed:
        if off is None:
            text = pages[book][p - 1]
            if p < len(pages[book]) and (book, p + 1) not in unplaced_pages:
                nb = bounds[book].get(p + 1, [])
                text += pages[book][p][:nb[0]] if nb else pages[book][p]
            segments.append((i, book, p, False, text[:SEG_CAP * 2]))
            continue
        limit = 12 if "omkara" in index[i]["n"] else 3
        start = off
        while True:  # walk back over boundaries within 60 chars (alias titles on the same line)
            earlier = [o for o in bounds[book][p] if start - 60 <= o < start]
            if not earlier:
                break
            start = min(earlier)
        end_from = off
        while True:  # and forward over the same cluster
            nxt = [o for o in bounds[book][p] if end_from < o <= end_from + 60]
            if not nxt:
                break
            end_from = max(nxt)
        off = start
        later = [o for o in bounds[book][p] if o > end_from]
        if later:
            text = pages[book][p - 1][off:later[0]]
        else:
            text = pages[book][p - 1][off:]
            q = p
            while q < len(pages[book]) and q < p + limit:
                q += 1
                nb = bounds[book].get(q, [])
                if nb:
                    text += pages[book][q - 1][:nb[0]]
                    break
                text += pages[book][q - 1]
        segments.append((i, book, p, True, text[:SEG_CAP if limit == 3 else SEG_CAP * 6]))
    return segments


def main():
    sheets = json.loads((HERE / "sheets.json").read_text())
    books = json.loads((HERE / "books.json").read_text())
    index = json.loads(INDEX.read_text())
    golden = json.loads((HERE / "golden.json").read_text()) if (HERE / "golden.json").exists() else {}
    overrides = json.loads((HERE / "overrides.json").read_text()) if (HERE / "overrides.json").exists() else {}
    pages, heads, starts = book_pages(books)
    print("headings found:", sum(len(h) for h in heads.values()), "index pages:", sorted(INDEX_PAGES)[:30])
    segments = song_segments(index, pages, heads, starts)
    print(f"{len(segments)} song copies in books, heading found for {sum(1 for s in segments if s[3])}")

    seg_grams = [grams(t) for *_, t in segments]
    inv = defaultdict(set)
    for si, g in enumerate(seg_grams):
        for x in g:
            inv[x].add(si)
    loc_songs = defaultdict(set)
    for i, s in enumerate(index):
        for l in s["l"]:
            m = LOC_RE.match(l.lower())
            if m:
                loc_songs[(m.group(1), int(m.group(2)))].add(i)
    def aliases(n):
        out = []
        for inner in re.findall(r"\(([^)]*)\)", n):
            inner = re.sub(LANG_TAG_RE, " ", inner).strip(" ,")
            if len(inner) >= 5 and re.search(r"[a-z]{3}", inner):
                out.append(norm(inner))
        return out

    names = [[norm(strip_parens(s["n"]))] + aliases(s["n"]) + [norm(c) for c in s.get("cn", [])] for s in index]
    tokens = [set(re.findall(r"[a-z]+", strip_parens(s["n"]))) for s in index]
    name_of = {s["n"]: i for i, s in enumerate(index)}

    rng = random.Random(1)
    null = []
    out = {}
    for stem, sh in sorted(sheets.items()):
        if "error" in sh:
            out[stem] = {"decision": "error", "songs": [], "why": sh["error"], "rows": []}
            continue
        lyr = norm(sh["lyrics"], "sheet")
        g = grams(lyr)
        line_grams = [grams(norm(l, "sheet")) for l in sh.get("lines", [])]
        line_grams = [lg for lg in line_grams if len(lg) >= 8]
        opening = [norm(l, "sheet") for l in sh.get("lines", [])[:3]]
        opening = [o for o in opening if len(o) >= 12]
        title = norm(sh["title"], "sheet") or norm(split_camel(stem))
        refs = set()
        for r in sh.get("refs", []):
            if "book" in r:
                n = ROMAN.get(r["book"], r["book"])
                refs |= loc_songs.get((f"vol{n}", int(r["page"])), set()) | loc_songs.get((f"voli{n}", int(r["page"])), set())
        hits = Counter()
        for x in g:
            for si in inv.get(x, ()):
                hits[si] += 1
        by_song = {}
        for si, h in hits.items():
            i = segments[si][0]
            c = h / len(g)
            if c > by_song.get(i, (0,))[0]:
                by_song[i] = (c, si)
        for si in rng.sample(range(len(segments)), 30):
            null.append(len(g & seg_grams[si]) / max(len(g), 1))
        tscores = {}
        for i, ns in enumerate(names):
            t = max(fuzz.ratio(title, n_) for n_ in ns)
            if t >= 80:
                tscores[i] = t
        cand = set(by_song) | refs | set(tscores)
        rows = []
        for i in cand:
            c, si = by_song.get(i, (0.0, None))
            t = tscores.get(i) or max(fuzz.ratio(title, n_) for n_ in names[i])
            first = cover = 0.0
            pos = None
            if si is not None:
                T = seg_grams[si]
                hit = [len(lg & T) / len(lg) for lg in line_grams]
                first = sum(1 for h in hit if h >= 0.7) / len(hit) if hit else 0.0  # share of sheet lines on the page
                cover = len(g & T) / max(len(T), 1)
                # where the sheet's opening lines sit in the song text (a neighbour song shows up late)
                seg_text = segments[si][4]
                for ln in opening:
                    a = fuzz.partial_ratio_alignment(ln, seg_text)
                    if a and a.score >= 80 and (pos is None or a.dest_start < pos):
                        pos = a.dest_start
                pos = None if pos is None else round(pos / max(len(seg_text), 1), 2)
            rows.append({
                "song": index[i]["n"], "i": i, "lyric": round(c, 3), "lines": round(first, 2), "cover": round(cover, 2),
                "title": round(t, 1), "ref": i in refs, "pos": pos,
                "copy": f"{segments[si][1]}-{segments[si][2]}" if si is not None else None,
                "placed": segments[si][3] if si is not None else None,
            })
        rows.sort(key=lambda r: (-r["lyric"], -r["title"]))
        degenerate = len(g) < MIN_GRAMS

        part = re.match(r"OmkaraDivyaPorule(\d+)", stem)

        def ok(r):
            if part:  # one of the 14 parts of the long poem: the part number decides
                m = re.search(r"porule (?:- )?([0-9ivx]+)$", r["song"])
                return bool(m) and int(ROMAN.get(m.group(1).upper(), m.group(1))) == int(part.group(1)) and r["lyric"] >= 0.1
            nm = names[r["i"]][0]
            prefix = len(title) >= 6 and len(nm) >= 6 and (nm.startswith(title) or title.startswith(nm))
            ttoks = set(re.findall(r"[a-z]+", fold(sh["title"]).lower() if sh.get("title") else split_camel(stem).lower()))
            by_name = r["title"] >= 85 or prefix or (len(ttoks) >= 2 and ttoks <= tokens[r["i"]])
            if (r["pos"] is None or r["pos"] > 0.2) and not by_name:
                return False  # the sheet's opening lines are not at the start of this song's text: a later, unlisted song
            if r["placed"] is False and not by_name:
                return False  # whole-page text, could be any song on the page
            corroborated = r["title"] >= 90 or r["ref"] or prefix or by_name
            if not corroborated:  # lyrics alone must be overwhelming and account for a real share of the page
                return r["lyric"] >= 0.75 and r["lines"] >= 0.8 and r["cover"] >= 0.15
            if r["ref"] or prefix:
                return (r["lyric"] >= T_LYRIC or (r["lines"] >= 0.6 and r["lyric"] >= 0.4)
                        or (r["title"] >= 95 and r["ref"] and r["lyric"] >= 0.3))
            if r["title"] < 90:  # only the title's words appear in the name: lyrics must agree strongly
                return r["lyric"] >= 0.6 and r["lines"] >= 0.6
            # title alone corroborates: another printing or version of the song; lyrics must still largely agree
            return r["lyric"] >= 0.6 or (r["lines"] >= 0.6 and r["lyric"] >= 0.45)

        strong = [r for r in rows if ok(r)]
        if not strong:
            unread = [r for r in rows if r["copy"] is None and r["title"] >= 95 and r["ref"]]
            if len(unread) == 1:
                strong = unread
        # Drop an unplaced copy that merely shares a page with a placed, stronger match.
        pages_hit = {r["copy"] for r in strong if r["placed"]}
        strong = [r for r in strong if r["placed"] or r["copy"] not in pages_hit]
        best = rows[0]["lyric"] if rows else 0.0
        if stem in overrides:
            decision, songs, why = "override", overrides[stem], "manual"
        elif len(g) < 8:  # no lyric text came out of the PDF
            tr = [r for r in rows if r["title"] >= 95 and r["ref"]]
            if len(tr) == 1:
                decision, songs, why = "accept", [tr[0]["song"]], "no lyric text in PDF; title+ref agree"
            else:
                decision, songs, why = "review", [], "no lyric text in PDF"
        elif degenerate:
            tr = [r for r in rows if (r["lyric"] >= 0.7 and r["title"] >= 95 and r["ref"])
                  or (r["lyric"] >= 0.8 and r["title"] == 100)
                  or (r["lyric"] >= 0.8 and r["ref"] and r["lines"] >= 0.8 and r["title"] >= 70)]
            if len(tr) == 1:
                decision, songs, why = "accept", [tr[0]["song"]], "degenerate lyrics; title+lyrics agree"
            elif any(r["title"] >= 90 for r in rows):
                decision, songs, why = "review", [], "degenerate lyrics"
            else:
                decision, songs, why = "none", [], "degenerate lyrics (a repeated mantra) and no song of that name"
        elif strong:
            decision, songs, why = "accept", [r["song"] for r in strong], "lyrics"
        elif best >= T_WEAK or any(r["title"] >= 92 and r["ref"] for r in rows):
            decision, songs, why = "review", [], "weak lyric match"
        else:
            decision, songs, why = "none", [], "no song in any book has these lyrics"
        out[stem] = {"decision": decision, "songs": songs, "why": why, "title": sh["title"], "grams": len(g),
                     "lang": sh.get("lang"), "refs": sh.get("refs"),
                     "rows": rows[:8] + [r for r in rows[8:] if r["song"] in songs]}

    null.sort()
    print(f"null containment: p99={null[int(len(null) * 0.99)]:.3f} p99.9={null[int(len(null) * 0.999)]:.3f}")
    (HERE / "matches.json").write_text(json.dumps(out, ensure_ascii=False, indent=0))
    dec = Counter(v["decision"] for v in out.values())
    print("decisions:", dict(dec))

    # ---- golden checks
    bad = 0
    for song, stem in golden.get("must_not", []):
        if song in out.get(stem, {}).get("songs", []):
            bad += 1
            print("GOLDEN must_not violated:", stem, "->", song)
    for song, stem in golden.get("must", []):
        if song not in out.get(stem, {}).get("songs", []):
            bad += 1
            print("GOLDEN must missing:", stem, "->", song, "| got", out.get(stem, {}).get("decision"), out.get(stem, {}).get("songs"))
    print(f"golden: {bad} failures of {len(golden.get('must_not', [])) + len(golden.get('must', []))}")

    # ---- compare with the links currently in the index
    FR = re.compile(r"^(.*?)([A-G])(sharp|#|b)?(m)?(o)?\.pdf$")
    old = defaultdict(set)
    for s in index:
        for f in s.get("sm", []):
            m = FR.match(f)
            old[m.group(1) if m else f].add(s["n"])
    new = {k: set(v["songs"]) for k, v in out.items()}
    added = sum(len(new[k] - old.get(k, set())) for k in new)
    removed = sum(len(old.get(k, set()) - new[k]) for k in new)
    same = sum(len(old.get(k, set()) & new[k]) for k in new)
    print(f"links: kept {same}, added {added}, removed {removed}; stems linked old {sum(1 for k in new if old.get(k))} new {sum(1 for k in new if new[k])}")

    # ---- review file
    lines = ["# Sheet-music matching review\n"]
    for k, v in out.items():
        if v["decision"] not in ("review", "none") and not (v["decision"] == "accept" and len(v["songs"]) > 1):
            continue
        sh = sheets[k]
        lines.append(f"\n## {k}  [{v['decision']}] {v.get('why', '')}\n")
        lines.append(f"title: {v.get('title')} | grams {v.get('grams')} | lang {v.get('lang')} | refs {v.get('refs')} | old: {sorted(old.get(k, []))[:6]}\n")
        for l in sh.get("lines", [])[:3]:
            lines.append(f"    sheet: {decode(l, 'sheet')}\n")
        for r in v["rows"][:4]:
            lines.append(f"- {r['song']!r} lyric={r['lyric']} pos={r['pos']} lines={r['lines']} cover={r['cover']} title={r['title']} ref={r['ref']} copy={r['copy']} placed={r['placed']}\n")
    (HERE / "review.md").write_text("".join(lines))


if __name__ == "__main__":
    main()
