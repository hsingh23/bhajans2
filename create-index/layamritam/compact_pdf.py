"""Shrink a MuPDF-written text PDF: one byte per glyph instead of two.

MuPDF writes every font as Type0 / Identity-H, so each glyph in a content stream is a
2-byte glyph id (4 hex digits). Each of our fonts uses fewer than 256 glyphs, so we give
every font an embedded CMap with 1-byte codes (code -> the same CID, so the glyph widths
and the font program stay as they are) and a matching ToUnicode map (text selection and
search keep working), and rewrite the strings in the content streams as 1-byte literal
strings. The Vol 6 book is compact for the same reason: 8-bit fonts.

Pages render identically (checked with MuPDF and Poppler); 1.17 MB -> 0.78 MB for the
first 642 pages. Replacing justified word gaps with Tw was tried and made it bigger.
"""
import re
from collections import defaultdict

import pymupdf

TOKEN = re.compile(rb"/([A-Za-z0-9_.+-]+)\s+([\d.]+)\s+Tf|<([0-9a-fA-F]*)>")
ARRAY = re.compile(rb"/([A-Za-z0-9_.+-]+)\s+([\d.]+)\s+Tf|\[([^\]]*)\]\s*TJ")
SPACE = 32


def _hexstr(h):
    """A ToUnicode destination: UTF-16BE, or (as MuPDF writes code points above U+FFFF) the bare code point."""
    return bytes.fromhex(h).decode("utf-16-be") if len(h) % 4 == 0 else chr(int(h, 16))


def _parse_tounicode(data):
    """{cid: unicode string} from a ToUnicode CMap (bfchar and bfrange)."""
    out = {}
    text = data.decode("latin-1")
    for block in re.findall(r"beginbfchar(.*?)endbfchar", text, re.S):
        for src, dst in re.findall(r"<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>", block):
            out[int(src, 16)] = _hexstr(dst)
    for block in re.findall(r"beginbfrange(.*?)endbfrange", text, re.S):
        for lo, hi, dst in re.findall(r"<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(<[0-9a-fA-F]*>|\[[^\]]*\])", block):
            lo, hi = int(lo, 16), int(hi, 16)
            if dst.startswith("["):
                for k, d in enumerate(re.findall(r"<([0-9a-fA-F]*)>", dst)):
                    out[lo + k] = _hexstr(d)
            else:
                start = _hexstr(dst[1:-1])
                for k in range(hi - lo + 1):
                    out[lo + k] = start[:-1] + chr(ord(start[-1]) + k)
    return out


def _cmap(name, pairs, kind):
    """An embedded CMap: kind "cid" (code -> CID) or "bf" (code -> Unicode)."""
    lines = ["/CIDInit /ProcSet findresource begin", "12 dict begin", "begincmap",
             "/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def" if kind == "bf" else
             "/CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> def",
             f"/CMapName /{name} def", f"/CMapType {2 if kind == 'bf' else 1} def",
             "1 begincodespacerange", "<00> <FF>", "endcodespacerange"]
    for i in range(0, len(pairs), 100):
        chunk = pairs[i:i + 100]
        lines.append(f"{len(chunk)} begin{kind}char")
        lines += [f"<{c:02X}> {v}" for c, v in chunk]
        lines.append(f"end{kind}char")
    lines += ["endcmap", "CMapName currentdict /CMap defineresource pop", "end", "end"]
    return "\n".join(lines).encode()


def _literal(b):
    return b"(" + b.replace(b"\\", b"\\\\").replace(b"(", b"\\(").replace(b")", b"\\)").replace(b"\r", b"\\r") + b")"


def _array(body, codes):
    """One TJ array with its glyph strings in 1-byte codes; kerning numbers stay as they are."""
    def string(m):
        h = m.group(1)
        return _literal(bytes(codes[int(h[i:i + 4], 16)] for i in range(0, len(h), 4)))
    return b"[" + re.sub(rb"<([0-9a-fA-F]*)>", string, body) + b"]TJ"


def compact(doc, font_files=None):
    """Rewrite doc in place. Returns {font xref: glyphs used}; raises if a font needs > 255 codes.

    font_files ({font name without subset tag: path to the font file}) lets glyphs MuPDF left
    without a Unicode value (ligatures such as f_i, numerators) get one from their glyph names,
    so copying text and pdf.js text extraction read "fi" instead of a stray character."""
    # Which font xref each page's resource name points at.
    page_fonts = [{f[4]: f[0] for f in page.get_fonts() if f[2] == "Type0" and f[5] == "Identity-H"} for page in doc]
    used = defaultdict(set)
    streams = []
    for page, fonts in zip(doc, page_fonts):
        for xref in page.get_contents():
            data = doc.xref_stream(xref)
            streams.append((xref, fonts, data))
            font = None
            for m in TOKEN.finditer(data):
                if m.group(1):
                    font = fonts.get(m.group(1).decode())
                elif m.group(3) is not None and font:
                    h = m.group(3)
                    used[font].update(int(h[i:i + 4], 16) for i in range(0, len(h), 4))
    code_of = {}
    for font, cids in used.items():
        if len(cids) > 255:
            raise ValueError(f"font {font} uses {len(cids)} glyphs, more than one byte can address")
        old_tu = doc.xref_get_key(font, "ToUnicode")
        uni = _parse_tounicode(doc.xref_stream(int(old_tu[1].split()[0]))) if old_tu[0] == "xref" else {}
        base = doc.xref_get_key(font, "BaseFont")[1].lstrip("/").split("+")[-1].replace("#20", " ")
        if (font_files or {}).get(base) and cids - set(uni):
            from fontTools.agl import toUnicode
            from fontTools.ttLib import TTFont
            tt = TTFont(str(font_files[base]))
            for cid in cids - set(uni):
                u = toUnicode(tt.getGlyphName(cid))
                if u:
                    uni[cid] = u
        # Codes in glyph-id order, skipping 32: with space on 32, pdf.js reads a justified word gap
        # (a TJ number after it) as a second space when extracting text.
        codes = iter(c for c in range(256) if c != SPACE)
        code_of[font] = {cid: next(codes) for cid in sorted(cids)}
        enc = doc.get_new_xref()
        doc.update_object(enc, "<< /Type /CMap /CMapName /Compact%d /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) "
                               "/Supplement 0 >> >>" % font)
        doc.update_stream(enc, _cmap(f"Compact{font}", [(c, cid) for cid, c in code_of[font].items()], "cid"))
        tu = doc.get_new_xref()
        doc.update_object(tu, "<<>>")
        doc.update_stream(tu, _cmap(f"CompactU{font}", [(c, "<" + uni[cid].encode("utf-16-be").hex().upper() + ">")
                                                       for cid, c in code_of[font].items() if cid in uni], "bf"))
        doc.xref_set_key(font, "Encoding", f"{enc} 0 R")
        doc.xref_set_key(font, "ToUnicode", f"{tu} 0 R")

    for xref, fonts, data in streams:
        font = None
        out, last = [], 0
        for m in ARRAY.finditer(data):
            if m.group(1):
                font = fonts.get(m.group(1).decode())
                continue
            if font not in code_of:
                continue
            out.append(data[last:m.start()])
            out.append(_array(m.group(3), code_of[font]))
            last = m.end()
        out.append(data[last:])
        doc.update_stream(xref, b"".join(out))
    return {f: len(c) for f, c in used.items()}


if __name__ == "__main__":
    import sys
    d = pymupdf.open(sys.argv[1])
    print(compact(d))
    d.save(sys.argv[2], garbage=4, deflate=True, use_objstms=1, compression_effort=100)
