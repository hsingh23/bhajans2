#!/usr/bin/env python3
"""Losslessly shrink the lyrics books in public/pdfs.

The books came out of InDesign, PDFium, macOS Preview, iLovePDF and ReportLab with full or
duplicated fonts, uncompressed object dictionaries and default compression. This keeps
every page as it is and only re-packs the file:
  - subset the embedded fonts to the glyphs the book uses (fontTools, via PyMuPDF)
  - merge duplicate objects and pack the small ones into compressed object streams
  - recompress every stream at maximum effort

A book is replaced only if it got at least 2% smaller AND every page renders pixel-identical to the
original (MuPDF, 60 dpi) with the same text and bookmarks; otherwise it is left alone.
Nov 2026: 20 books 11.5 MB -> 8.9 MB. Page numbers never change, so index locations and
`lo` start fractions stay valid. Any change gives a book a new content fingerprint
(vite.config.js), so the app downloads it again once.

extra.pdf is skipped: create-index/layamritam/render_pdf.py already writes it compact.

Sheet music (S3 bucket singwithamma/sheetmusic, PDF-XChange output) shrinks about 66% the
same way (120-file sample: 21.5 MB -> 7.3 MB, every page identical in MuPDF and pdf.js).
`--src DIR --out DIR` writes verified compressed copies of every PDF in DIR (originals
untouched; a file that fails the check is copied as is), ready for
`aws s3 sync OUT s3://singwithamma/sheetmusic/ --content-type application/pdf`.

Checking with pdf.js: render each page twice and compare the second renders, one page
at a time. pdf.js 2.1 renders a page differently while its fonts are still loading, so
parallel first renders differ even between two copies of the same file.

Run from the repo root:
  uv run --with pymupdf --with fonttools --with numpy python create-index/compress_pdfs.py [--dry-run] [book.pdf ...]
  uv run --with pymupdf --with fonttools --with numpy python create-index/compress_pdfs.py --src DIR --out DIR
"""
import os
import shutil
import sys
import tempfile
from pathlib import Path

import numpy as np
import pymupdf

PDFS = Path(__file__).resolve().parent.parent / "public" / "pdfs"
SKIP = {"extra.pdf"}
MIN_SAVING = 0.02


def same_pages(a, b):
    """None if b shows the same pages as a, else the first difference."""
    if a.page_count != b.page_count:
        return f"page count {a.page_count} -> {b.page_count}"
    if a.get_toc() != b.get_toc():
        return "bookmarks differ"
    for i in range(a.page_count):
        if a[i].get_text() != b[i].get_text():
            return f"text differs on page {i + 1}"
        x = np.frombuffer(a[i].get_pixmap(dpi=60).samples, np.uint8)
        y = np.frombuffer(b[i].get_pixmap(dpi=60).samples, np.uint8)
        if x.shape != y.shape or (x != y).any():
            return f"pixels differ on page {i + 1}"
    return None


def compress(path, dry=False, dest=None):
    """Compress path in place (or into dest). Returns (bytes before, bytes after, what happened)."""
    before = path.stat().st_size
    doc = pymupdf.open(path)
    doc.subset_fonts()
    with tempfile.NamedTemporaryFile(suffix=".pdf", dir=(dest or path).parent, delete=False) as tmp:
        out = Path(tmp.name)
    try:
        doc.save(out, garbage=4, deflate=True, deflate_fonts=True, use_objstms=1, compression_effort=100)
        doc.close()
        after = out.stat().st_size
        if after > before * (1 - MIN_SAVING):  # a few bytes would only make every user download it again
            if dest:
                shutil.copyfile(path, dest)
            return before, before, "already compact, kept"
        problem = same_pages(pymupdf.open(path), pymupdf.open(out))
        if problem:
            if dest:
                shutil.copyfile(path, dest)
            return before, before, f"kept: {problem}"
        if not dry:
            os.replace(out, dest or path)
        return before, after, "replaced" if not dry else "would replace"
    finally:
        out.unlink(missing_ok=True)


def main():
    dry = "--dry-run" in sys.argv
    if "--src" in sys.argv:
        src = Path(sys.argv[sys.argv.index("--src") + 1])
        out = Path(sys.argv[sys.argv.index("--out") + 1])
        out.mkdir(parents=True, exist_ok=True)
        total, kept = [0, 0], []
        files = sorted(src.glob("*.pdf"))
        for k, p in enumerate(files, 1):
            if (out / p.name).exists():
                continue  # resumable
            b, a, what = compress(p, dest=out / p.name)
            total[0] += b
            total[1] += a
            if not what.startswith("replaced"):
                kept.append((p.name, what))
            if k % 200 == 0:
                print(f"{k}/{len(files)}  {total[0] // 1048576} MB -> {total[1] // 1048576} MB", flush=True)
        print(f"{len(files)} files: {total[0] // 1048576} MB -> {total[1] // 1048576} MB; copied unchanged: {kept[:20]}")
        return
    names = [a for a in sys.argv[1:] if a.endswith(".pdf")]
    books = [PDFS / n for n in names] if names else sorted(p for p in PDFS.glob("*.pdf") if p.name not in SKIP)
    total = [0, 0]
    for p in books:
        b, a, what = compress(p, dry)
        total[0] += b
        total[1] += a
        print(f"{p.name:15} {b // 1024:5} KB -> {a // 1024:5} KB  {what}")
    print(f"total {total[0] // 1024} KB -> {total[1] // 1024} KB")


if __name__ == "__main__":
    main()
