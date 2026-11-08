#!/usr/bin/env python3
"""Dump the text of every songbook page the index can point at.

Writes books.json: {book_id: {"pages": [page1_text, page2_text, ...]}} where
book_id is the index location prefix ("vol1", "2025", "2020supl2"). Printed page
N is list index N-1 (PDF page index N-1 for every book, verified by page labels).
Run: uv run --with pymupdf python extract_books.py
"""
import json
from pathlib import Path

import pymupdf

HERE = Path(__file__).parent
PDFS = HERE.parent.parent / "public" / "pdfs"


def main():
    out = {}
    for pdf in sorted(PDFS.glob("*.pdf")):
        doc = pymupdf.open(pdf)
        out[pdf.stem.lower()] = {"pages": [page.get_text() for page in doc]}
        print(pdf.stem, doc.page_count, "pages")
    (HERE / "books.json").write_text(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()
