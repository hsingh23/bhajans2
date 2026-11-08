"""Dump the text of every songbook PDF page to a cache JSON: {book: [page_text, ...]}.
Run: uv run --with pymupdf python fm_extract.py OUT.json"""
import json, sys
from pathlib import Path
import pymupdf
PDFS = Path(__file__).resolve().parents[2] / "public" / "pdfs"
out = {}
for p in sorted(PDFS.glob("*.pdf")):
    d = pymupdf.open(p)
    out[p.stem] = [pg.get_text() for pg in d]
json.dump(out, open(sys.argv[1], "w"), ensure_ascii=False)
print({k: len(v) for k, v in out.items()})
