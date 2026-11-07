#!/usr/bin/env python3
"""
Song start positions

For every bhajan location that points into a lyrics book in public/pdfs/,
find where on that PDF page the song's title sits and record it as a
fraction of the page height (0 = top). The viewer scrolls there when the
song is opened, so a song that starts two thirds of the way down a page
isn't hidden below the end of the previous one.

Each book sets its titles in one large bold style, so the title is the
line in that style whose text is closest to the index name (the books
spell names with their own diacritics, which translation.csv maps back).
Songs that share a page are matched best fit first, so one title line is
only taken by two songs when both fit it closely or are two spellings of
the same name (one song indexed twice). When no title-styled line is
close enough, the first line anywhere on the page whose words are the
song's words is used instead, then the first line that begins with the
song's name (mantras are indexed by their first words and have no title).

Writes bhajan-starts.json ({name: {location: fraction}}), which
create-index.py merges into bhajan-index2.json as "lo";
bhajan-starts-review.txt lists every match with its score and method, and
bhajan-starts-unmatched.txt the songs that got no entry (= top of page).
"""

import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from difflib import SequenceMatcher
from pathlib import Path

import pymupdf

SCRIPT_DIR = Path(__file__).parent.resolve()
PDF_DIR = SCRIPT_DIR.parent / "public" / "pdfs"
INDEX_FILE = SCRIPT_DIR.parent / "public" / "bhajan-index2.json"
OUT_FILE = SCRIPT_DIR / "bhajan-starts.json"
REVIEW_FILE = SCRIPT_DIR / "bhajan-starts-review.txt"
UNMATCHED_FILE = SCRIPT_DIR / "bhajan-starts-unmatched.txt"
# Below this the title is at the top of the page anyway; don't store it.
MIN_FRACTION = 0.03
# How alike (0-1) a title-styled line must be to the song's name.
MIN_TITLE_SCORE = 0.65
# A title line two index entries may share (one song, two spellings).
SHARED_TITLE_SCORE = 0.85
# ...or two index names alike enough to be the same song.
SAME_SONG_SCORE = 0.7
# Titles a point smaller than the book's usual size still count as titles.
TITLE_SIZE_TOLERANCE = 1.0
# How alike a word of a title must be to the name's word in that position.
WORD_SCORE = 0.8
# How alike the start of a line must be to the name for the line to begin with it.
PREFIX_SCORE = 0.85


def load_translation(path=SCRIPT_DIR / "translation.csv"):
    """The same searchable<-original character map the index build uses."""
    pairs = []
    for line in path.read_text().splitlines():
        if "," in line:
            searchable, original = line.split(",", 1)
            if original.strip():
                pairs.append((original.strip(), searchable))
    return pairs


TRANSLATION = load_translation()


def normalize(text):
    text = text.replace("\xa0", " ").lower()
    for original, searchable in TRANSLATION:
        text = re.sub(original, searchable, text)
    # Anything the map didn't cover: drop the diacritic, keep the base letter.
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = re.sub(r"\(.*?\)", " ", text)
    text = re.sub(r"[^a-z0-9 ]+", " ", text)
    return " ".join(text.split())


def title_variants(name):
    """The index name, plus its parenthetical parts, each normalized."""
    base = normalize(name)
    variants = [base] if base else []
    for inner in re.findall(r"\((.*?)\)", name):
        inner = normalize(inner)
        if inner and inner not in variants:
            variants.append(inner)
    return variants


def words_match(block, variants):
    """The block's words are the song's words and cover at least half of them."""
    tokens = block.split()
    if not tokens or len(block) > 80:
        return False
    for variant in variants:
        vtokens = variant.split()
        if vtokens and set(tokens) <= set(vtokens) and len(tokens) >= len(vtokens) / 2:
            return True
    return False


def words_fit(block, variants):
    """
    Each word of the line is (nearly) the name's word in that position and
    the line covers at least half of the name: "dhanya dhanye" for
    "dhanye dhanye janani".
    """
    tokens = block.split()
    if not tokens or len(block) > 80:
        return False
    for variant in variants:
        vtokens = variant.split()
        if len(tokens) > len(vtokens) or len(tokens) < len(vtokens) / 2:
            continue
        if all(SequenceMatcher(None, t, v).ratio() >= WORD_SCORE for t, v in zip(tokens, vtokens)):
            return True
    return False


def starts_with_name(block, variants):
    """
    The line begins with the song's name, give or take a letter, after a
    leading "om": mantras are indexed by their first words and have no title.
    """
    tokens = block.split()
    if tokens and tokens[0] in ("om", "o", "oe", "aum"):
        tokens = tokens[1:]
    squashed = "".join(tokens)
    for variant in variants:
        vsquashed = variant.replace(" ", "")
        n = len(vsquashed)
        if n >= 8 and len(squashed) >= n and SequenceMatcher(None, squashed[:n], vsquashed).ratio() >= PREFIX_SCORE:
            return True
    return False


def similarity(block, variants):
    """0-1: how alike the line and the song's name are, ignoring spaces."""
    if not block:
        return 0.0
    squashed = block.replace(" ", "")
    best = 1.0 if words_match(block, variants) else 0.9 if words_fit(block, variants) else 0.0
    for variant in variants:
        vsquashed = variant.replace(" ", "")
        if not vsquashed:
            continue
        best = max(best, SequenceMatcher(None, squashed, vsquashed).ratio())
        # A name cut short in the index, e.g. "adi divya jyoti maha".
        n = min(len(squashed), len(vsquashed))
        if n >= 8 and squashed[:n] == vsquashed[:n]:
            best = max(best, 0.9)
    return best


def page_lines(page):
    """Text lines on the page, top to bottom: (y0, text, font, size)."""
    lines = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            text = "".join(span["text"] for span in line["spans"])
            if text.strip():
                span = line["spans"][0]
                lines.append((line["bbox"][1], text, span["font"], round(span["size"], 1)))
    lines.sort(key=lambda l: l[0])
    return lines


class Book:
    def __init__(self, path):
        self.doc = pymupdf.open(path)
        self.title_size = None

    def page(self, number):
        return self.doc[number - 1] if 1 <= number <= len(self.doc) else None

    def learn_title_style(self, locations):
        """The font size titles use: the size of the lines that match by words."""
        sizes = Counter()
        for name, page_no in locations:
            page = self.page(page_no)
            if page is None:
                continue
            variants = title_variants(name)
            for y0, text, font, size in page_lines(page):
                if words_match(normalize(text), variants):
                    sizes[size] += 1
                    break
        if sizes:
            self.title_size = sizes.most_common(1)[0][0]

    def title_candidates(self, page):
        """
        (y0, texts, alternative) of each title-styled line, with a wrapped
        second line joined on. A line in parentheses under a title is an
        alternative name for the song above, not a language tag, so it only
        counts against a song's full name.
        """
        if not self.title_size:
            return []
        lines = [l for l in page_lines(page) if l[3] >= self.title_size - TITLE_SIZE_TOLERANCE]
        candidates = []
        for i, (y0, text, font, size) in enumerate(lines):
            alternative = re.fullmatch(r"\s*\((.*)\)\s*", text)
            if alternative:
                # A second name under the title, "(DEVI DEVI DEVI AMRITESVARI)":
                # that song starts at the title above it.
                start = candidates[-1][0] if candidates and y0 - candidates[-1][0] < 2 * size else y0
                candidates.append((start, [alternative.group(1)], True))
                continue
            texts = [text]
            if i + 1 < len(lines) and lines[i + 1][0] - y0 < 2 * size:
                texts.append(text + " " + lines[i + 1][1])
            candidates.append((y0, texts, False))
        return candidates

    def find_starts(self, page, names):
        """
        {name: (fraction, score, method, text)} for the songs on this page.
        Title lines go to the song they fit best, so two songs never share one.
        """
        candidates = self.title_candidates(page)
        variants = {name: title_variants(name) for name in names}
        scores = []
        for name in names:
            for c, (y0, texts, alternative) in enumerate(candidates):
                against = variants[name][:1] if alternative else variants[name]
                score = max(similarity(normalize(t), against) for t in texts)
                if score >= MIN_TITLE_SCORE:
                    scores.append((score, -y0, name, c))
        found = {}
        taken = {}
        for score, _, name, c in sorted(scores, reverse=True):
            # A title line already claimed by another song can only be shared
            # by a song that fits it closely or whose name is a spelling of
            # the other's: the same song indexed twice.
            if name in found:
                continue
            if c in taken and score < SHARED_TITLE_SCORE and not self.same_song(name, taken[c]):
                continue
            y0, texts, _ = candidates[c]
            found[name] = (y0 / page.rect.height, score, "title", texts[0])
            taken.setdefault(c, name)
        for name in names:
            if name in found:
                continue
            for y0, text, font, size in page_lines(page):
                if words_match(normalize(text), variants[name]):
                    found[name] = (y0 / page.rect.height, 1.0, "words", text)
                    break
        for name in names:
            if name in found:
                continue
            for y0, text, font, size in page_lines(page):
                if starts_with_name(normalize(text), variants[name]):
                    found[name] = (y0 / page.rect.height, PREFIX_SCORE, "prefix", text)
                    break
        return found

    @staticmethod
    def same_song(name, other):
        return similarity(normalize(name), title_variants(other)) >= SAME_SONG_SCORE


def parse_location(location):
    if "-" not in location:
        return None
    book, page_no = location.rsplit("-", 1)
    if not page_no.isdigit() or not (PDF_DIR / f"{book}.pdf").exists():
        return None
    return book, int(page_no)


def main():
    bhajans = json.loads(INDEX_FILE.read_text())
    by_book = defaultdict(list)
    for bhajan in bhajans:
        for location in bhajan.get("l", []):
            parsed = parse_location(location)
            if parsed:
                by_book[parsed[0]].append((bhajan["n"], parsed[1], location))

    starts = defaultdict(dict)
    review = []
    unmatched = []
    stats = Counter()
    for book_name in sorted(by_book):
        book = Book(PDF_DIR / f"{book_name}.pdf")
        book.learn_title_style([(n, p) for n, p, _ in by_book[book_name]])
        by_page = defaultdict(list)
        for name, page_no, location in by_book[book_name]:
            by_page[page_no].append((name, location))
        for page_no, songs in sorted(by_page.items()):
            page = book.page(page_no)
            names = list(dict.fromkeys(name for name, _ in songs))
            found = book.find_starts(page, names) if page is not None else {}
            for name, location in songs:
                if name not in found:
                    stats[book_name, "unmatched"] += 1
                    unmatched.append(f"{name} ## {location}")
                    continue
                fraction, score, method, text = found[name]
                stats[book_name, method] += 1
                review.append(f"{location:14} {fraction:.3f} {score:.2f} {method:6} {name!r} <- {text.strip()!r}")
                if fraction >= MIN_FRACTION:
                    starts[name][location] = round(fraction, 3)

    OUT_FILE.write_text(json.dumps(dict(sorted(starts.items())), indent=0, ensure_ascii=False) + "\n")
    REVIEW_FILE.write_text("\n".join(review) + "\n")
    UNMATCHED_FILE.write_text("\n".join(unmatched) + ("\n" if unmatched else ""))
    methods = ("title", "words", "prefix", "unmatched")
    print(f"{'book':12} {'title':>6} {'words':>6} {'prefix':>6} {'none':>6}")
    for book_name in sorted(by_book):
        print(f"{book_name:12} " + " ".join(f"{stats[book_name, k]:6}" for k in methods))
    print(f"{'total':12} " + " ".join(f"{sum(v for (_, k2), v in stats.items() if k2 == k):6}" for k in methods))
    print(f"wrote {OUT_FILE.name} ({sum(len(v) for v in starts.values())} offsets), {REVIEW_FILE.name}, {UNMATCHED_FILE.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
