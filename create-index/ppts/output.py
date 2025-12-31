#!/usr/bin/env python3
"""
output.py - Output generation (XML, PDF, TOC, Report) for songbook generator.
"""

import os
import re
import sys
import json
import unicodedata
import xml.etree.ElementTree as ET
from xml.dom import minidom
from datetime import datetime
from typing import Optional

from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak,
    Flowable, KeepTogether
)
from reportlab.lib.enums import TA_CENTER
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

from config import (
    CURRENT_YEAR, FONT_FAMILY, FONT_REGULAR_PATH, FONT_BOLD_PATH,
    FONT_ITALIC_PATH, FONT_BOLD_ITALIC_PATH,
    PAGE_WIDTH, PAGE_HEIGHT, MARGIN_LEFT, MARGIN_RIGHT, MARGIN_TOP, MARGIN_BOTTOM,
    HEADER_TEXT, HEADER_FONT_SIZE, HEADER_Y_POSITION,
    HEADER_LINE_ENABLED, HEADER_LINE_Y_POSITION, HEADER_LINE_THICKNESS,
    PAGE_NUMBER_FONT_SIZE, PAGE_NUMBER_Y_POSITION,
    TITLE_FONT_SIZE, TITLE_LINE_HEIGHT, TITLE_SPACE_BEFORE,
    TITLE_UNDERLINE_ENABLED, TITLE_UNDERLINE_THICKNESS, TITLE_UNDERLINE_COLOR,
    LANGUAGE_SUBTITLE_FONT_SIZE, LANGUAGE_SUBTITLE_LINE_HEIGHT,
    LANGUAGE_SUBTITLE_SPACE_BEFORE, LANGUAGE_SUBTITLE_SPACE_AFTER, LANGUAGE_SUBTITLE_COLOR,
    SEARCHABLE_TITLE_FONT_SIZE, SEARCHABLE_TITLE_SPACE_AFTER, SEARCHABLE_TITLE_COLOR,
    LYRICS_FONT_SIZE, LYRICS_LINE_HEIGHT, LYRICS_SPACE_BEFORE, LYRICS_SPACE_AFTER,
    MEANING_FONT_SIZE, MEANING_LINE_HEIGHT, MEANING_SPACE_BEFORE, MEANING_SPACE_AFTER,
    MEANING_INDENT,
    STANZA_SEPARATOR_HEIGHT,
    TOC_FORMAT, TOC_FORMAT_NO_LANGUAGE, TOC_SORT_ALPHABETICALLY,
    XML_INDENT,
)
from models import Song, Stanza, get_report


# =============================================================================
# FONT REGISTRATION
# =============================================================================

def find_system_fonts() -> dict[str, Optional[str]]:
    """Find Unicode fonts on the system."""
    font_paths = {'regular': None, 'bold': None, 'italic': None, 'bold_italic': None}
    
    if FONT_REGULAR_PATH and os.path.exists(FONT_REGULAR_PATH):
        font_paths['regular'] = FONT_REGULAR_PATH
        font_paths['bold'] = FONT_BOLD_PATH if FONT_BOLD_PATH and os.path.exists(FONT_BOLD_PATH) else FONT_REGULAR_PATH
        font_paths['italic'] = FONT_ITALIC_PATH if FONT_ITALIC_PATH and os.path.exists(FONT_ITALIC_PATH) else FONT_REGULAR_PATH
        font_paths['bold_italic'] = FONT_BOLD_ITALIC_PATH if FONT_BOLD_ITALIC_PATH and os.path.exists(FONT_BOLD_ITALIC_PATH) else font_paths['bold']
        return font_paths
    
    search_patterns = [
        ("NotoSerif", [
            "fonts/NotoSerif-{}.ttf",
            "/usr/share/fonts/truetype/noto/NotoSerif-{}.ttf",
            "/usr/share/fonts/noto/NotoSerif-{}.ttf",
            "C:/Windows/Fonts/NotoSerif-{}.ttf",
            "/Library/Fonts/NotoSerif-{}.ttf",
            os.path.expanduser("~/.local/share/fonts/NotoSerif-{}.ttf"),
        ], ["Regular", "Bold", "Italic", "BoldItalic"]),
        
        ("DejaVuSerif", [
            "fonts/DejaVuSerif{}.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSerif{}.ttf",
            "/usr/share/fonts/dejavu/DejaVuSerif{}.ttf",
        ], ["", "-Bold", "-Italic", "-BoldItalic"]),
        
        ("LiberationSerif", [
            "fonts/LiberationSerif-{}.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSerif-{}.ttf",
        ], ["Regular", "Bold", "Italic", "BoldItalic"]),
        
        ("FreeSerif", [
            "fonts/FreeSerif{}.ttf",
            "/usr/share/fonts/truetype/freefont/FreeSerif{}.ttf",
        ], ["", "Bold", "Italic", "BoldItalic"]),
    ]
    
    for family_name, path_patterns, suffixes in search_patterns:
        for pattern in path_patterns:
            regular_path = pattern.format(suffixes[0])
            if os.path.exists(regular_path):
                font_paths['regular'] = regular_path
                
                bold_path = pattern.format(suffixes[1])
                font_paths['bold'] = bold_path if os.path.exists(bold_path) else regular_path
                
                italic_path = pattern.format(suffixes[2])
                font_paths['italic'] = italic_path if os.path.exists(italic_path) else regular_path
                
                bold_italic_path = pattern.format(suffixes[3])
                font_paths['bold_italic'] = bold_italic_path if os.path.exists(bold_italic_path) else font_paths['bold']
                
                print(f"  Found font: {family_name}")
                return font_paths
    
    return font_paths


def register_fonts() -> tuple[str, str, str, str]:
    """Register fonts with ReportLab."""
    font_paths = find_system_fonts()
    
    if not font_paths['regular']:
        print("\n" + "!" * 60)
        print("WARNING: No Unicode fonts found!")
        print("!" * 60)
        print("Run: uv run download_fonts.py")
        print("!" * 60 + "\n")
        return ("Times-Roman", "Times-Bold", "Times-Italic", "Times-BoldItalic")
    
    try:
        font_regular = f"{FONT_FAMILY}-Regular"
        font_bold = f"{FONT_FAMILY}-Bold"
        font_italic = f"{FONT_FAMILY}-Italic"
        font_bold_italic = f"{FONT_FAMILY}-BoldItalic"
        
        pdfmetrics.registerFont(TTFont(font_regular, font_paths['regular']))
        pdfmetrics.registerFont(TTFont(font_bold, font_paths['bold']))
        pdfmetrics.registerFont(TTFont(font_italic, font_paths['italic']))
        pdfmetrics.registerFont(TTFont(font_bold_italic, font_paths['bold_italic']))
        
        from reportlab.pdfbase.pdfmetrics import registerFontFamily
        registerFontFamily(FONT_FAMILY, normal=font_regular, bold=font_bold, 
                          italic=font_italic, boldItalic=font_bold_italic)
        
        return (font_regular, font_bold, font_italic, font_bold_italic)
    except Exception as e:
        print(f"  Font registration error: {e}")
        return ("Times-Roman", "Times-Bold", "Times-Italic", "Times-BoldItalic")


# =============================================================================
# PDF HELPERS
# =============================================================================

def normalize_for_search(text: str) -> str:
    """Normalize text to ASCII for searchability."""
    if not text:
        return ""
    
    decomposed = unicodedata.normalize('NFD', text)
    
    ascii_chars = []
    for char in decomposed:
        if unicodedata.category(char) == 'Mn':
            continue
        if char == 'ś' or char == 'ṣ':
            ascii_chars.append('s')
        elif char == 'ṇ' or char == 'ñ':
            ascii_chars.append('n')
        elif char == 'ṁ' or char == 'ṃ':
            ascii_chars.append('m')
        elif char == 'ṛ' or char == 'ṝ':
            ascii_chars.append('r')
        elif char == 'ḷ' or char == 'ḹ':
            ascii_chars.append('l')
        elif char == 'ṭ' or char == 'ṭh':
            ascii_chars.append('t')
        elif char == 'ḍ' or char == 'ḍh':
            ascii_chars.append('d')
        else:
            ascii_chars.append(char)
    
    result = ''.join(ascii_chars)
    result = re.sub(r'\s+', ' ', result).strip()
    
    return result


class PageTracker(Flowable):
    """Track page numbers for TOC."""
    _registry: dict[str, int] = {}
    
    def __init__(self, key: str):
        Flowable.__init__(self)
        self.key = key
        self.width = 0
        self.height = 0
    
    def draw(self):
        PageTracker._registry[self.key] = self.canv.getPageNumber()
    
    @classmethod
    def get_page(cls, key: str) -> Optional[int]:
        return cls._registry.get(key)
    
    @classmethod
    def reset(cls):
        cls._registry = {}


class HorizontalRule(Flowable):
    """Horizontal line."""
    def __init__(self, width: float):
        Flowable.__init__(self)
        self.line_width = width
        self.height = TITLE_UNDERLINE_THICKNESS + 4
    
    def draw(self):
        self.canv.setStrokeColor(TITLE_UNDERLINE_COLOR)
        self.canv.setLineWidth(TITLE_UNDERLINE_THICKNESS)
        self.canv.line(0, 2, self.line_width, 2)


def create_styles(fonts: tuple[str, str, str, str]) -> dict:
    """Create PDF styles including language subtitle."""
    regular, bold, italic, bold_italic = fonts
    
    return {
        'title': ParagraphStyle(
            'Title',
            fontSize=TITLE_FONT_SIZE,
            fontName=bold,
            leading=TITLE_LINE_HEIGHT,
            spaceBefore=TITLE_SPACE_BEFORE,
            spaceAfter=0,
        ),
        'language_subtitle': ParagraphStyle(
            'LanguageSubtitle',
            fontSize=LANGUAGE_SUBTITLE_FONT_SIZE,
            fontName=italic,
            leading=LANGUAGE_SUBTITLE_LINE_HEIGHT,
            spaceBefore=LANGUAGE_SUBTITLE_SPACE_BEFORE,
            spaceAfter=LANGUAGE_SUBTITLE_SPACE_AFTER,
            textColor=LANGUAGE_SUBTITLE_COLOR,
        ),
        'searchable_title': ParagraphStyle(
            'SearchableTitle',
            fontSize=SEARCHABLE_TITLE_FONT_SIZE,
            fontName=regular,
            leading=SEARCHABLE_TITLE_FONT_SIZE,
            spaceBefore=0,
            spaceAfter=SEARCHABLE_TITLE_SPACE_AFTER,
            textColor=SEARCHABLE_TITLE_COLOR,
        ),
        'lyrics': ParagraphStyle(
            'Lyrics',
            fontSize=LYRICS_FONT_SIZE,
            fontName=bold,
            leading=LYRICS_LINE_HEIGHT,
            spaceBefore=LYRICS_SPACE_BEFORE,
            spaceAfter=LYRICS_SPACE_AFTER,
        ),
        'meaning': ParagraphStyle(
            'Meaning',
            fontSize=MEANING_FONT_SIZE,
            fontName=italic,
            leading=MEANING_LINE_HEIGHT,
            spaceBefore=MEANING_SPACE_BEFORE,
            spaceAfter=MEANING_SPACE_AFTER,
            leftIndent=MEANING_INDENT,
        ),
    }


def draw_page(canvas, doc, fonts):
    """Draw header and page number."""
    regular, bold, italic, bold_italic = fonts
    canvas.saveState()
    
    canvas.setFont(italic, HEADER_FONT_SIZE)
    canvas.drawCentredString(PAGE_WIDTH / 2, PAGE_HEIGHT - HEADER_Y_POSITION, HEADER_TEXT)
    
    if HEADER_LINE_ENABLED:
        canvas.setStrokeColor(colors.black)
        canvas.setLineWidth(HEADER_LINE_THICKNESS)
        canvas.line(MARGIN_LEFT, PAGE_HEIGHT - HEADER_LINE_Y_POSITION,
                   PAGE_WIDTH - MARGIN_RIGHT, PAGE_HEIGHT - HEADER_LINE_Y_POSITION)
    
    canvas.setFont(regular, PAGE_NUMBER_FONT_SIZE)
    canvas.drawCentredString(PAGE_WIDTH / 2, PAGE_NUMBER_Y_POSITION, str(canvas.getPageNumber()))
    
    canvas.restoreState()


def escape_xml(text: str) -> str:
    """Escape XML special characters."""
    return text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def text_to_html(text: str) -> str:
    """Convert text to HTML, preserving line breaks."""
    return escape_xml(text).replace('\n', '<br/>')


# =============================================================================
# PDF GENERATION
# =============================================================================

def generate_pdf(songs: list[Song], output_path: str) -> list[Song]:
    """
    Generate PDF with:
    - Preserved line breaks in lyrics
    - Capitalized titles
    - Language as smaller subtitle
    - Searchable ASCII titles
    """
    print("  Registering fonts...")
    fonts = register_fonts()
    
    PageTracker.reset()
    styles = create_styles(fonts)
    content_width = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT
    
    story = []
    
    for idx, song in enumerate(songs):
        # === PAGE TRACKING ===
        story.append(PageTracker(f"song_{idx}"))
        
        # === TITLE (capitalized, without language) ===
        title_display = escape_xml(song.title.title())
        story.append(Paragraph(title_display, styles['title']))
        
        # === LANGUAGE SUBTITLE (smaller, gray, italic) ===
        if song.language:
            story.append(Paragraph(escape_xml(song.language), styles['language_subtitle']))
        
        # === SEARCHABLE TITLE (invisible) ===
        ascii_title = normalize_for_search(song.title)
        if song.language:
            ascii_title += f" {normalize_for_search(song.language)}"
        story.append(Paragraph(ascii_title, styles['searchable_title']))
        
        # === TITLE UNDERLINE ===
        if TITLE_UNDERLINE_ENABLED:
            story.append(HorizontalRule(content_width))
        
        story.append(Spacer(1, 8))
        
        # === STANZAS ===
        for stanza_idx, stanza in enumerate(song.stanzas):
            stanza_parts = []
            
            # --- LYRICS (with preserved line breaks) ---
            if stanza.lyrics:
                lyrics_html = text_to_html(stanza.lyrics)
                stanza_parts.append(Paragraph(lyrics_html, styles['lyrics']))
            
            # --- MEANING ---
            if stanza.meaning and song.language != "English":
                meaning_html = text_to_html(stanza.meaning)
                stanza_parts.append(Paragraph(meaning_html, styles['meaning']))
            
            if len(stanza_parts) > 1:
                story.append(KeepTogether(stanza_parts))
            elif stanza_parts:
                story.extend(stanza_parts)
            
            if stanza_idx < len(song.stanzas) - 1:
                story.append(Spacer(1, STANZA_SEPARATOR_HEIGHT))
        
        # === PAGE BREAK ===
        if idx < len(songs) - 1:
            story.append(PageBreak())
    
    # === BUILD DOCUMENT ===
    doc = SimpleDocTemplate(
        output_path,
        pagesize=(PAGE_WIDTH, PAGE_HEIGHT),
        leftMargin=MARGIN_LEFT,
        rightMargin=MARGIN_RIGHT,
        topMargin=MARGIN_TOP,
        bottomMargin=MARGIN_BOTTOM,
    )
    
    def page_handler(canvas, doc):
        draw_page(canvas, doc, fonts)
    
    doc.build(story, onFirstPage=page_handler, onLaterPages=page_handler)
    
    # Update page numbers for TOC
    for idx, song in enumerate(songs):
        song.page_number = PageTracker.get_page(f"song_{idx}") or (idx + 1)
    
    print(f"PDF saved: {output_path}")
    print(f"  - {len(songs)} songs")
    print(f"  - Titles capitalized, language as subtitle")
    print(f"  - Line breaks preserved in lyrics")
    
    return songs


# =============================================================================
# XML GENERATION
# =============================================================================

def songs_to_xml(songs: list[Song], output_path: str) -> None:
    """Create XML from songs."""
    root = ET.Element('songbook')
    root.set('generated', datetime.now().isoformat())
    root.set('total_songs', str(len(songs)))
    
    for song in songs:
        song_elem = ET.SubElement(root, 'song')
        
        ET.SubElement(song_elem, 'title').text = song.title
        
        if song.year:
            year_elem = ET.SubElement(song_elem, 'year')
            year_elem.text = song.year
            year_elem.set('source', song.year_source)
        
        if song.language:
            ET.SubElement(song_elem, 'language').text = song.language
        
        if song.source_file:
            ET.SubElement(song_elem, 'source').text = song.source_file
        
        if song.full_path:
            ET.SubElement(song_elem, 'full_path').text = song.full_path
        
        meta = ET.SubElement(song_elem, 'metadata')
        meta.set('has_year_on_slide', str(song.has_year).lower())
        meta.set('has_language', str(song.has_language).lower())
        meta.set('year_source', song.year_source)
        if song.missing_meaning_slides:
            meta.set('missing_meaning_slides', ','.join(map(str, song.missing_meaning_slides)))
        
        if song.stanzas:
            stanzas_elem = ET.SubElement(song_elem, 'stanzas')
            for stanza in song.stanzas:
                stanza_elem = ET.SubElement(stanzas_elem, 'stanza')
                stanza_elem.set('slide', str(stanza.slide_number))
                stanza_elem.set('has_meaning', str(stanza.has_meaning).lower())
                
                ET.SubElement(stanza_elem, 'lyrics').text = stanza.lyrics
                
                if stanza.meaning:
                    ET.SubElement(stanza_elem, 'meaning').text = stanza.meaning
    
    if sys.version_info >= (3, 9):
        ET.indent(root, space=XML_INDENT)
        xml_str = ET.tostring(root, encoding='unicode')
    else:
        xml_str = minidom.parseString(ET.tostring(root, encoding='unicode')).toprettyxml(indent=XML_INDENT)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(xml_str)
    
    print(f"XML saved: {output_path}")


def xml_to_songs(xml_path: str) -> list[Song]:
    """Load songs from XML."""
    tree = ET.parse(xml_path)
    root = tree.getroot()
    songs = []
    
    for song_elem in root.findall('song'):
        stanzas = []
        stanzas_elem = song_elem.find('stanzas')
        
        if stanzas_elem is not None:
            for stanza_elem in stanzas_elem.findall('stanza'):
                stanzas.append(Stanza(
                    lyrics=stanza_elem.findtext('lyrics', ''),
                    meaning=stanza_elem.findtext('meaning'),
                    slide_number=int(stanza_elem.get('slide', 0)),
                    has_meaning=stanza_elem.get('has_meaning', 'true').lower() == 'true',
                ))
        
        meta = song_elem.find('metadata')
        year_elem = song_elem.find('year')
        
        missing_slides = []
        if meta is not None and meta.get('missing_meaning_slides'):
            missing_slides = [int(x) for x in meta.get('missing_meaning_slides').split(',')]
        
        songs.append(Song(
            title=song_elem.findtext('title', ''),
            year=song_elem.findtext('year'),
            language=song_elem.findtext('language'),
            source_file=song_elem.findtext('source'),
            full_path=song_elem.findtext('full_path'),
            stanzas=stanzas,
            year_source=year_elem.get('source', '') if year_elem is not None else '',
            has_year=meta.get('has_year_on_slide', 'true').lower() == 'true' if meta is not None else True,
            has_language=meta.get('has_language', 'true').lower() == 'true' if meta is not None else True,
            missing_meaning_slides=missing_slides,
        ))
    
    return songs


# =============================================================================
# TOC GENERATION
# =============================================================================

def normalize_toc(text: str) -> str:
    """Normalize to ASCII."""
    decomposed = unicodedata.normalize('NFD', text)
    ascii_chars = [c for c in decomposed if unicodedata.category(c) != 'Mn']
    result = re.sub(r'[^A-Za-z0-9 \-\(\)]', '', ''.join(ascii_chars))
    return re.sub(r'\s+', ' ', result).strip()


def generate_toc(songs: list[Song], output_path: str):
    """Generate TOC file."""
    entries = []
    
    for song in songs:
        title = normalize_toc(song.title)
        lang = (song.language or '').lower()
        year = song.year or CURRENT_YEAR
        
        if lang:
            entry = TOC_FORMAT.format(title=title, language=lang, year=year, page=song.page_number)
        else:
            entry = TOC_FORMAT_NO_LANGUAGE.format(title=title, year=year, page=song.page_number)
        entries.append(entry)
    
    if TOC_SORT_ALPHABETICALLY:
        entries.sort(key=str.lower)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(entries))
    
    print(f"TOC saved: {output_path}")


# =============================================================================
# REPORT GENERATION
# =============================================================================

def generate_report(output_path: str, json_path: str):
    """Generate detailed report."""
    report = get_report()
    
    lines = [
        "=" * 80,
        "SONGBOOK PROCESSING REPORT",
        "=" * 80,
        f"Generated: {report.timestamp}",
        f"Input:     {report.input_path}",
        f"Output:    {report.output_path}",
        "",
        "─" * 80,
        "SUMMARY",
        "─" * 80,
        f"  Files found:              {report.total_files_found}",
        f"  Files processed:          {report.total_files_processed}",
        f"  Files skipped/errored:    {len(report.skipped_files) + len(report.files_with_errors)}",
        f"  Songs extracted:          {report.total_songs_extracted}",
        f"  Total stanzas:            {report.total_stanzas}",
        f"  Total slides processed:   {report.total_slides_processed}",
        "",
    ]
    
    lines.extend([
        "─" * 80,
        "SONGS BY YEAR",
        "─" * 80,
    ])
    for year in sorted(report.songs_by_year.keys()):
        files_count = report.files_by_year.get(year, "?")
        lines.append(f"  {year}: {report.songs_by_year[year]} songs (from {files_count} files)")
    lines.append("")
    
    lines.extend([
        "─" * 80,
        "LANGUAGE DETECTION SUMMARY",
        "─" * 80,
    ])
    ls = report.language_sources
    lines.append(f"  Languages detected from slide (parentheses): {ls.get('slide_parens', 0)}")
    lines.append(f"  Languages detected from slide (text):        {ls.get('slide_text', 0)}")
    lines.append(f"  Languages detected from filename:            {ls.get('filename', 0)}")
    lines.append(f"  Languages not detected:                      {ls.get('not_found', 0)}")
    lines.append("")
    
    lines.extend([
        "─" * 80,
        "ISSUE SUMMARY",
        "─" * 80,
        f"  Songs with year not on slide:    {len(report.songs_missing_year)}",
        f"  Songs missing language:          {len(report.songs_missing_language)}",
        f"  Songs with missing meanings:     {len(report.songs_with_missing_meanings)}",
        f"  Total stanzas missing meaning:   {sum(len(v) for v in report.songs_with_missing_meanings.values())}",
        f"  Files with errors:               {len(report.files_with_errors)}",
        "",
    ])
    
    if report.songs_missing_year:
        lines.extend([
            "─" * 80,
            "SONGS WITH YEAR NOT FOUND ON SLIDE",
            "─" * 80,
        ])
        for item in report.songs_missing_year:
            lines.append(f"  • {item}")
        lines.append("")
    
    if report.songs_missing_language:
        lines.extend([
            "─" * 80,
            "SONGS MISSING LANGUAGE",
            "─" * 80,
        ])
        for item in report.songs_missing_language:
            lines.append(f"  • {item}")
        lines.append("")
    
    if report.songs_with_missing_meanings:
        lines.extend([
            "─" * 80,
            "SONGS WITH MISSING ENGLISH MEANINGS",
            "─" * 80,
        ])
        for song, slides in sorted(report.songs_with_missing_meanings.items()):
            lines.append(f"  • {song}")
            lines.append(f"      Missing on slides: {slides}")
        lines.append("")
    
    if report.files_with_errors:
        lines.extend([
            "─" * 80,
            "FILES WITH ERRORS",
            "─" * 80,
        ])
        for f in report.files_with_errors:
            lines.append(f"  • {f}")
        lines.append("")
    
    if report.skipped_files:
        lines.extend([
            "─" * 80,
            "SKIPPED FILES",
            "─" * 80,
        ])
        for f in report.skipped_files:
            lines.append(f"  • {f}")
        lines.append("")
    
    lines.extend([
        "─" * 80,
        "DETAILED ISSUE LOG",
        "─" * 80,
        "",
    ])
    
    by_type: dict[str, list] = {}
    for issue in report.issues:
        t = issue.issue_type.name
        if t not in by_type:
            by_type[t] = []
        by_type[t].append(issue)
    
    for issue_type in sorted(by_type.keys()):
        issues = by_type[issue_type]
        lines.append(f"### {issue_type.replace('_', ' ')} ({len(issues)} occurrences)")
        lines.append("")
        
        for issue in issues:
            lines.append(f"  File: {issue.source_file}")
            if issue.full_path:
                lines.append(f"  Path: {issue.full_path}")
            if issue.song_title:
                lines.append(f"  Song: {issue.song_title}")
            if issue.slide_number:
                lines.append(f"  Slide: {issue.slide_number}")
            if issue.details:
                lines.append(f"  Details: {issue.details}")
            if issue.raw_text:
                lines.append(f"  Raw text sample:")
                for raw_line in issue.raw_text.split('\n')[:5]:
                    lines.append(f"    | {raw_line}")
            lines.append("")
    
    lines.extend([
        "=" * 80,
        "END OF REPORT",
        "=" * 80,
    ])
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    print(f"Report saved: {output_path}")
    
    json_data = {
        'timestamp': report.timestamp,
        'input_path': report.input_path,
        'output_path': report.output_path,
        'summary': {
            'total_files_found': report.total_files_found,
            'total_files_processed': report.total_files_processed,
            'total_songs_extracted': report.total_songs_extracted,
            'total_stanzas': report.total_stanzas,
        },
        'songs_by_year': report.songs_by_year,
        'songs_missing_year': report.songs_missing_year,
        'songs_missing_language': report.songs_missing_language,
        'songs_with_missing_meanings': report.songs_with_missing_meanings,
        'files_with_errors': report.files_with_errors,
        'skipped_files': report.skipped_files,
        'issues': [issue.to_dict() for issue in report.issues],
    }
    
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(json_data, f, indent=2, ensure_ascii=False)
    print(f"JSON report saved: {json_path}")


def print_summary():
    """Print summary to console."""
    report = get_report()
    
    print(f"\n{'─' * 50}")
    print("SUMMARY")
    print(f"{'─' * 50}")
    print(f"  Files processed:    {report.total_files_processed}/{report.total_files_found}")
    print(f"  Songs extracted:    {report.total_songs_extracted}")
    print(f"  Total stanzas:      {report.total_stanzas}")
    
    if report.songs_missing_year:
        print(f"  ⚠ Year not on slide: {len(report.songs_missing_year)} songs")
    if report.songs_missing_language:
        print(f"  ⚠ Missing language:   {len(report.songs_missing_language)} songs")
    if report.songs_with_missing_meanings:
        total = sum(len(v) for v in report.songs_with_missing_meanings.values())
        print(f"  ⚠ Missing meanings:   {total} stanzas in {len(report.songs_with_missing_meanings)} songs")
    if report.files_with_errors:
        print(f"  ✗ Files with errors:  {len(report.files_with_errors)}")
    
    print(f"{'─' * 50}")
    print("  See report file for full details")
