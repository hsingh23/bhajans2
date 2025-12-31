#!/usr/bin/env python3
"""
songbook_generator.py

Complete pipeline to convert PPTX song files to XML, PDF, and TOC.
Supports multiple year folders with robust error handling and detailed reporting.

Usage with uv:
    uv run songbook_generator.py /path/to/base/folder -o output
"""

import os
import sys
import re
import argparse
import unicodedata
import xml.etree.ElementTree as ET
from xml.dom import minidom
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime
from enum import Enum, auto
import json
import traceback

from pptx import Presentation
from reportlab.lib.units import inch
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak,
    Flowable, KeepTogether
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont


# =============================================================================
# CONFIGURATION CONSTANTS
# =============================================================================

# ------------------------------------------------------------------------------
# YEAR FOLDERS
# ------------------------------------------------------------------------------
YEAR_FOLDERS = ["2021", "2022", "2023", "2024", "2025"]
CURRENT_YEAR = "2025"
DEFAULT_LANGUAGE = None  # Set to e.g., "Unknown" to have a fallback

# ------------------------------------------------------------------------------
# FONT CONFIGURATION
# ------------------------------------------------------------------------------
# For web PDFs with Unicode, we must embed fonts. 
# Uses font subsetting to minimize file size.
FONT_REGULAR_PATH = None
FONT_BOLD_PATH = None
FONT_ITALIC_PATH = None
FONT_BOLD_ITALIC_PATH = None
FONT_FAMILY = "SongFont"

# ------------------------------------------------------------------------------
# PDF PAGE SETTINGS
# ------------------------------------------------------------------------------
PAGE_WIDTH = 5.5 * inch
PAGE_HEIGHT = 8.5 * inch
MARGIN_LEFT = 0.5 * inch
MARGIN_RIGHT = 0.5 * inch
MARGIN_TOP = 0.7 * inch
MARGIN_BOTTOM = 0.6 * inch

# ------------------------------------------------------------------------------
# PDF HEADER SETTINGS
# ------------------------------------------------------------------------------
HEADER_TEXT = "Devotional Songs of Sri Mata Amritanandamayi"
HEADER_FONT_SIZE = 9
HEADER_Y_POSITION = 0.4 * inch
HEADER_LINE_ENABLED = True
HEADER_LINE_Y_POSITION = 0.55 * inch
HEADER_LINE_THICKNESS = 0.5

# ------------------------------------------------------------------------------
# PDF PAGE NUMBER
# ------------------------------------------------------------------------------
PAGE_NUMBER_FONT_SIZE = 10
PAGE_NUMBER_Y_POSITION = 0.35 * inch

# ------------------------------------------------------------------------------
# PDF TYPOGRAPHY - TITLE
# ------------------------------------------------------------------------------
TITLE_FONT_SIZE = 22
TITLE_LINE_HEIGHT = 26
TITLE_SPACE_BEFORE = 0
TITLE_SPACE_AFTER = 2
TITLE_UNDERLINE_ENABLED = True
TITLE_UNDERLINE_THICKNESS = 0.5
TITLE_UNDERLINE_COLOR = colors.black

# ------------------------------------------------------------------------------
# PDF TYPOGRAPHY - LYRICS
# ------------------------------------------------------------------------------
LYRICS_FONT_SIZE = 13
LYRICS_LINE_HEIGHT = 18
LYRICS_SPACE_BEFORE = 16
LYRICS_SPACE_AFTER = 6

# ------------------------------------------------------------------------------
# PDF TYPOGRAPHY - MEANING
# ------------------------------------------------------------------------------
MEANING_FONT_SIZE = 11
MEANING_LINE_HEIGHT = 14
MEANING_SPACE_BEFORE = 4
MEANING_SPACE_AFTER = 24

# ------------------------------------------------------------------------------
# STANZA SPACING
# ------------------------------------------------------------------------------
STANZA_SEPARATOR_HEIGHT = 12

# ------------------------------------------------------------------------------
# TOC SETTINGS
# ------------------------------------------------------------------------------
TOC_FORMAT = "{title} ({language}) ## {year}-{page}"
TOC_FORMAT_NO_LANGUAGE = "{title} ## {year}-{page}"
TOC_SORT_ALPHABETICALLY = True

# ------------------------------------------------------------------------------
# REPORT SETTINGS
# ------------------------------------------------------------------------------
REPORT_EXTENSION = "_report.txt"
REPORT_JSON_EXTENSION = "_report.json"

# ------------------------------------------------------------------------------
# XML SETTINGS
# ------------------------------------------------------------------------------
XML_INDENT = "  "
XML_INCLUDE_SOURCE = True

# ------------------------------------------------------------------------------
# FILE NAMING
# ------------------------------------------------------------------------------
DEFAULT_OUTPUT_NAME = "songbook"
XML_EXTENSION = ".xml"
PDF_EXTENSION = ".pdf"
TOC_EXTENSION = "_toc.txt"

# ------------------------------------------------------------------------------
# KNOWN LANGUAGES (for detection)
# ------------------------------------------------------------------------------
KNOWN_LANGUAGES = [
    "Malayalam", "Tamil", "Telugu", "Kannada", "Hindi", "Sanskrit",
    "Marathi", "Gujarati", "Bengali", "Punjabi", "Odia", "Assamese",
    "English", "Spanish", "French", "German",
    # Add more as needed
]

# Case-insensitive lookup
KNOWN_LANGUAGES_LOWER = {lang.lower(): lang for lang in KNOWN_LANGUAGES}


# =============================================================================
# DATA CLASSES
# =============================================================================

class IssueType(Enum):
    """Types of issues during processing."""
    MISSING_TITLE = auto()
    MISSING_YEAR = auto()
    MISSING_LANGUAGE = auto()
    MISSING_MEANING = auto()
    EMPTY_STANZA = auto()
    NO_STANZAS = auto()
    PARSE_ERROR = auto()
    FILE_ERROR = auto()
    SLIDE_ERROR = auto()


@dataclass
class Issue:
    """Detailed issue record."""
    issue_type: IssueType
    source_file: str
    full_path: str = ""
    song_title: Optional[str] = None
    slide_number: Optional[int] = None
    stanza_number: Optional[int] = None
    details: str = ""
    raw_text: Optional[str] = None  # For debugging
    
    def to_dict(self) -> dict:
        return {
            'type': self.issue_type.name,
            'source_file': self.source_file,
            'full_path': self.full_path,
            'song_title': self.song_title,
            'slide_number': self.slide_number,
            'stanza_number': self.stanza_number,
            'details': self.details,
            'raw_text': self.raw_text,
        }


@dataclass
class Stanza:
    """A stanza with lyrics and optional meaning."""
    lyrics: str
    meaning: Optional[str] = None
    slide_number: int = 0
    has_meaning: bool = True


@dataclass 
class Song:
    """A complete song."""
    title: str
    year: Optional[str] = None
    language: Optional[str] = None
    source_file: Optional[str] = None
    full_path: Optional[str] = None
    stanzas: list[Stanza] = field(default_factory=list)
    page_number: int = 1
    
    # Issue tracking
    year_source: str = ""  # "slide", "folder", "default"
    has_year: bool = True
    has_language: bool = True
    missing_meaning_slides: list[int] = field(default_factory=list)


@dataclass
class ProcessingReport:
    """Comprehensive processing report."""
    timestamp: str = ""
    input_path: str = ""
    output_path: str = ""
    
    # Counts
    total_files_found: int = 0
    total_files_processed: int = 0
    total_songs_extracted: int = 0
    total_stanzas: int = 0
    total_slides_processed: int = 0
    
    # By year
    songs_by_year: dict = field(default_factory=dict)
    files_by_year: dict = field(default_factory=dict)
    
    # Issues
    issues: list[Issue] = field(default_factory=list)
    
    # Aggregated counts
    songs_missing_year: list[str] = field(default_factory=list)
    songs_missing_language: list[str] = field(default_factory=list)
    songs_with_missing_meanings: dict = field(default_factory=dict)  # song -> list of slides
    files_with_errors: list[str] = field(default_factory=list)
    skipped_files: list[str] = field(default_factory=list)
    
    def add_issue(self, issue: Issue):
        self.issues.append(issue)
        
        key = f"{issue.source_file}"
        if issue.song_title:
            key = f"{issue.song_title} ({issue.source_file})"
        
        if issue.issue_type == IssueType.MISSING_YEAR:
            if key not in self.songs_missing_year:
                self.songs_missing_year.append(key)
        elif issue.issue_type == IssueType.MISSING_LANGUAGE:
            if key not in self.songs_missing_language:
                self.songs_missing_language.append(key)
        elif issue.issue_type == IssueType.MISSING_MEANING:
            if key not in self.songs_with_missing_meanings:
                self.songs_with_missing_meanings[key] = []
            if issue.slide_number:
                self.songs_with_missing_meanings[key].append(issue.slide_number)
        elif issue.issue_type in (IssueType.PARSE_ERROR, IssueType.FILE_ERROR, IssueType.SLIDE_ERROR):
            if issue.full_path not in self.files_with_errors:
                self.files_with_errors.append(issue.full_path or issue.source_file)


# Global report
_report: Optional[ProcessingReport] = None


def get_report() -> ProcessingReport:
    global _report
    if _report is None:
        _report = ProcessingReport()
    return _report


def reset_report():
    global _report
    _report = ProcessingReport()
    _report.timestamp = datetime.now().isoformat()


# =============================================================================
# FONT REGISTRATION
# =============================================================================

def find_system_fonts() -> dict[str, Optional[str]]:
    """Find Unicode fonts on the system."""
    font_paths = {'regular': None, 'bold': None, 'italic': None, 'bold_italic': None}
    
    # Check custom paths first
    if FONT_REGULAR_PATH and os.path.exists(FONT_REGULAR_PATH):
        font_paths['regular'] = FONT_REGULAR_PATH
        font_paths['bold'] = FONT_BOLD_PATH if FONT_BOLD_PATH and os.path.exists(FONT_BOLD_PATH) else FONT_REGULAR_PATH
        font_paths['italic'] = FONT_ITALIC_PATH if FONT_ITALIC_PATH and os.path.exists(FONT_ITALIC_PATH) else FONT_REGULAR_PATH
        font_paths['bold_italic'] = FONT_BOLD_ITALIC_PATH if FONT_BOLD_ITALIC_PATH and os.path.exists(FONT_BOLD_ITALIC_PATH) else font_paths['bold']
        return font_paths
    
    # Font families to search
    search_patterns = [
        # Noto Serif
        ("NotoSerif", [
            "fonts/NotoSerif-{}.ttf",
            "/usr/share/fonts/truetype/noto/NotoSerif-{}.ttf",
            "/usr/share/fonts/noto/NotoSerif-{}.ttf",
            "C:/Windows/Fonts/NotoSerif-{}.ttf",
            "/Library/Fonts/NotoSerif-{}.ttf",
            os.path.expanduser("~/.local/share/fonts/NotoSerif-{}.ttf"),
        ], ["Regular", "Bold", "Italic", "BoldItalic"]),
        
        # DejaVu Serif  
        ("DejaVuSerif", [
            "fonts/DejaVuSerif{}.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSerif{}.ttf",
            "/usr/share/fonts/dejavu/DejaVuSerif{}.ttf",
        ], ["", "-Bold", "-Italic", "-BoldItalic"]),
        
        # Liberation Serif
        ("LiberationSerif", [
            "fonts/LiberationSerif-{}.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSerif-{}.ttf",
        ], ["Regular", "Bold", "Italic", "BoldItalic"]),
        
        # FreeSerif
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
# TEXT EXTRACTION
# =============================================================================

def extract_text_from_shape(shape) -> str:
    """Extract text from shape, preserving line breaks."""
    if not shape.has_text_frame:
        return ""
    
    paragraphs = []
    for paragraph in shape.text_frame.paragraphs:
        text = "".join(run.text for run in paragraph.runs)
        paragraphs.append(text)
    
    result = "\n".join(paragraphs)
    
    # Clean up leading/trailing empty lines
    lines = result.split('\n')
    while lines and not lines[0].strip():
        lines.pop(0)
    while lines and not lines[-1].strip():
        lines.pop()
    
    return '\n'.join(lines)


def get_shapes_by_position(slide) -> list[dict]:
    """Get text shapes sorted by vertical then horizontal position."""
    shapes = []
    
    for shape in slide.shapes:
        if shape.has_text_frame:
            text = extract_text_from_shape(shape)
            if text.strip():
                shapes.append({
                    'top': shape.top or 0,
                    'left': shape.left or 0,
                    'text': text,
                    'raw': text,  # Keep original for debugging
                })
    
    shapes.sort(key=lambda x: (x['top'], x['left']))
    return shapes


# =============================================================================
# LANGUAGE DETECTION
# =============================================================================

def detect_language(text: str) -> Optional[str]:
    """
    Detect language from text.
    Handles formats like:
      - "Malayalam"
      - "(Malayalam)"
      - "2025 (Malayalam)"
      - "2025 Malayalam"
      - "(malayalam)"  -> "Malayalam"
    """
    if not text:
        return None
    
    text = text.strip()
    
    # Check for language in parentheses: "(Malayalam)" or "2025 (Malayalam)"
    paren_match = re.search(r'$([^)]+)$', text)
    if paren_match:
        potential = paren_match.group(1).strip()
        # Check if it's a known language
        if potential.lower() in KNOWN_LANGUAGES_LOWER:
            return KNOWN_LANGUAGES_LOWER[potential.lower()]
        # If it looks like a language name (single word, alphabetic)
        if potential.replace(' ', '').isalpha() and len(potential) < 30:
            return potential.title()
    
    # Check for language after year: "2025 Malayalam"
    after_year = re.search(r'\d{4}\s+([A-Za-z]+)', text)
    if after_year:
        potential = after_year.group(1).strip()
        if potential.lower() in KNOWN_LANGUAGES_LOWER:
            return KNOWN_LANGUAGES_LOWER[potential.lower()]
    
    # Check if the entire text is a language name
    clean_text = text.strip('() \t\n')
    if clean_text.lower() in KNOWN_LANGUAGES_LOWER:
        return KNOWN_LANGUAGES_LOWER[clean_text.lower()]
    
    # Check if text contains a known language anywhere
    text_lower = text.lower()
    for lang_lower, lang_proper in KNOWN_LANGUAGES_LOWER.items():
        if lang_lower in text_lower:
            return lang_proper
    
    return None


def detect_year(text: str) -> Optional[str]:
    """Extract year (4 digits between 2000-2099) from text."""
    match = re.search(r'(20[0-9]{2})', text)
    return match.group(1) if match else None


# =============================================================================
# PPTX PARSING
# =============================================================================

def parse_title_slide(
    slide, 
    source_file: str, 
    full_path: str,
    folder_year: Optional[str] = None
) -> tuple[Optional[str], Optional[str], Optional[str], str]:
    """
    Parse title slide for title, year, and language.
    
    Returns:
        (title, year, language, year_source)
        year_source is one of: "slide", "folder", "default"
    """
    report = get_report()
    shapes = get_shapes_by_position(slide)
    
    if not shapes:
        report.add_issue(Issue(
            issue_type=IssueType.MISSING_TITLE,
            source_file=source_file,
            full_path=full_path,
            slide_number=1,
            details="No text found on title slide (slide 1)",
        ))
        return None, None, None, ""
    
    # Collect all text for debugging
    all_text = "\n---\n".join([s['text'] for s in shapes])
    
    # First shape is the title
    title_text = shapes[0]['text'].strip()
    
    # Handle multi-line titles
    if '\n' in title_text:
        lines = [l.strip() for l in title_text.split('\n') if l.strip()]
        title = lines[0] if lines else ""
    else:
        title = title_text
    
    if not title:
        report.add_issue(Issue(
            issue_type=IssueType.MISSING_TITLE,
            source_file=source_file,
            full_path=full_path,
            slide_number=1,
            details="Title text box is empty",
            raw_text=all_text[:500],
        ))
        return None, None, None, ""
    
    # Look for year and language in all shapes
    year = None
    language = None
    
    # Search all shapes (including title shape for multi-line cases)
    for shape in shapes:
        text = shape['text']
        
        # Look for year
        if not year:
            year = detect_year(text)
        
        # Look for language
        if not language:
            language = detect_language(text)
    
    # Also check individual lines in case year/language are on separate lines
    for shape in shapes:
        for line in shape['text'].split('\n'):
            line = line.strip()
            if not line:
                continue
            
            if not year:
                year = detect_year(line)
            
            if not language:
                language = detect_language(line)
    
    # Determine year source and apply fallbacks
    year_source = "slide" if year else ""
    
    if not year:
        if folder_year:
            year = folder_year
            year_source = "folder"
            report.add_issue(Issue(
                issue_type=IssueType.MISSING_YEAR,
                source_file=source_file,
                full_path=full_path,
                song_title=title,
                slide_number=1,
                details=f"Year not found on slide, using folder year: {folder_year}",
                raw_text=all_text[:300],
            ))
        else:
            year = CURRENT_YEAR
            year_source = "default"
            report.add_issue(Issue(
                issue_type=IssueType.MISSING_YEAR,
                source_file=source_file,
                full_path=full_path,
                song_title=title,
                slide_number=1,
                details=f"Year not found, using default: {CURRENT_YEAR}",
                raw_text=all_text[:300],
            ))
    
    if not language:
        report.add_issue(Issue(
            issue_type=IssueType.MISSING_LANGUAGE,
            source_file=source_file,
            full_path=full_path,
            song_title=title,
            slide_number=1,
            details="Language not found on title slide. Expected format: '2025 (Malayalam)' or '2025\\n(Malayalam)'",
            raw_text=all_text[:300],
        ))
    
    return title, year, language, year_source


def parse_lyric_slide(
    slide,
    slide_number: int,
    source_file: str,
    full_path: str,
    song_title: str
) -> tuple[Optional[str], Optional[str], bool]:
    """
    Parse lyric slide.
    
    Returns:
        (lyrics, meaning, had_error)
    """
    report = get_report()
    
    try:
        shapes = get_shapes_by_position(slide)
    except Exception as e:
        report.add_issue(Issue(
            issue_type=IssueType.SLIDE_ERROR,
            source_file=source_file,
            full_path=full_path,
            song_title=song_title,
            slide_number=slide_number,
            details=f"Error reading slide: {str(e)}",
        ))
        return None, None, True
    
    if not shapes:
        report.add_issue(Issue(
            issue_type=IssueType.EMPTY_STANZA,
            source_file=source_file,
            full_path=full_path,
            song_title=song_title,
            slide_number=slide_number,
            details=f"Slide {slide_number} has no text content",
        ))
        return None, None, False
    
    if len(shapes) == 1:
        # Only lyrics, no meaning
        lyrics = shapes[0]['text']
        report.add_issue(Issue(
            issue_type=IssueType.MISSING_MEANING,
            source_file=source_file,
            full_path=full_path,
            song_title=song_title,
            slide_number=slide_number,
            details=f"Slide {slide_number} has lyrics but no English meaning (only 1 text box found)",
            raw_text=lyrics[:200] if lyrics else None,
        ))
        return lyrics, None, False
    
    # First shape = lyrics, last shape = meaning
    lyrics = shapes[0]['text']
    meaning = shapes[-1]['text']
    
    # Sanity check: if meaning looks like more lyrics (no English), flag it
    # This is a heuristic - you can adjust or remove
    if meaning and not any(c.isascii() and c.isalpha() for c in meaning[:50]):
        report.add_issue(Issue(
            issue_type=IssueType.MISSING_MEANING,
            source_file=source_file,
            full_path=full_path,
            song_title=song_title,
            slide_number=slide_number,
            details=f"Slide {slide_number}: Bottom text doesn't appear to be English translation",
            raw_text=f"Top: {lyrics[:100]}...\nBottom: {meaning[:100]}...",
        ))
        # Still return it - let user decide
    
    return lyrics, meaning, False


def process_pptx_file(
    filepath: str, 
    folder_year: Optional[str] = None
) -> Optional[Song]:
    """
    Process a single PPTX file.
    
    Args:
        filepath: Full path to PPTX file
        folder_year: Year from folder name (e.g., "2025" if in 2025/ folder)
    """
    report = get_report()
    source_file = os.path.basename(filepath)
    full_path = os.path.abspath(filepath)
    
    # Try to open file
    try:
        prs = Presentation(filepath)
    except Exception as e:
        report.add_issue(Issue(
            issue_type=IssueType.FILE_ERROR,
            source_file=source_file,
            full_path=full_path,
            details=f"Cannot open file: {str(e)}\n{traceback.format_exc()}",
        ))
        return None
    
    slides = list(prs.slides)
    if not slides:
        report.add_issue(Issue(
            issue_type=IssueType.PARSE_ERROR,
            source_file=source_file,
            full_path=full_path,
            details="File contains no slides",
        ))
        return None
    
    report.total_slides_processed += len(slides)
    
    # Parse title slide
    title, year, language, year_source = parse_title_slide(
        slides[0], source_file, full_path, folder_year
    )
    
    if not title:
        return None
    
    # Parse lyric slides
    stanzas = []
    missing_meaning_slides = []
    
    for idx, slide in enumerate(slides[1:], start=2):  # Slide numbers are 1-indexed
        lyrics, meaning, had_error = parse_lyric_slide(
            slide, idx, source_file, full_path, title
        )
        
        if had_error:
            continue
        
        if not lyrics:
            continue
        
        has_meaning = meaning is not None and meaning.strip() != ""
        
        if not has_meaning:
            missing_meaning_slides.append(idx)
        
        stanzas.append(Stanza(
            lyrics=lyrics,
            meaning=meaning if has_meaning else None,
            slide_number=idx,
            has_meaning=has_meaning,
        ))
    
    if not stanzas:
        report.add_issue(Issue(
            issue_type=IssueType.NO_STANZAS,
            source_file=source_file,
            full_path=full_path,
            song_title=title,
            details=f"No valid lyric slides found. File has {len(slides)} slides total.",
        ))
    
    return Song(
        title=title,
        year=year,
        language=language,
        source_file=source_file,
        full_path=full_path,
        stanzas=stanzas,
        year_source=year_source,
        has_year=(year_source == "slide"),
        has_language=(language is not None),
        missing_meaning_slides=missing_meaning_slides,
    )


def process_year_folder(folder_path: str, year: str) -> list[Song]:
    """Process all PPTX in a year folder."""
    report = get_report()
    songs = []
    folder = Path(folder_path)
    
    if not folder.exists():
        print(f"  ⚠ Folder not found: {folder_path}")
        return songs
    
    # Find PPTX files (exclude temp files starting with ~$)
    pptx_files = [f for f in sorted(folder.glob("*.pptx")) if not f.name.startswith("~$")]
    
    if not pptx_files:
        print(f"  ⚠ No .pptx files in {folder_path}")
        return songs
    
    report.total_files_found += len(pptx_files)
    report.files_by_year[year] = len(pptx_files)
    
    print(f"  Found {len(pptx_files)} files")
    
    for filepath in pptx_files:
        song = process_pptx_file(str(filepath), folder_year=year)
        
        if song:
            songs.append(song)
            report.total_files_processed += 1
            report.total_songs_extracted += 1
            report.total_stanzas += len(song.stanzas)
            
            y = song.year or "Unknown"
            report.songs_by_year[y] = report.songs_by_year.get(y, 0) + 1
            
            # Status display
            warnings = []
            if not song.has_language:
                warnings.append("no language")
            if song.missing_meaning_slides:
                warnings.append(f"missing meaning on slides {song.missing_meaning_slides}")
            if song.year_source != "slide":
                warnings.append(f"year from {song.year_source}")
            
            if warnings:
                print(f"    ⚠ {song.title}")
                for w in warnings:
                    print(f"      - {w}")
            else:
                print(f"    ✓ {song.title}")
        else:
            report.skipped_files.append(str(filepath))
            print(f"    ✗ {filepath.name} (skipped - see report)")
    
    return songs


def process_all_years(base_path: str, years: list[str] = None) -> list[Song]:
    """Process all year folders."""
    if years is None:
        years = YEAR_FOLDERS
    
    all_songs = []
    base = Path(base_path)
    
    for year in years:
        year_folder = base / year
        print(f"\n{'─' * 50}")
        print(f"Processing {year}/")
        print(f"{'─' * 50}")
        
        songs = process_year_folder(str(year_folder), year)
        all_songs.extend(songs)
        
        print(f"  → {len(songs)} songs from {year}")
    
    return all_songs


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
        
        # Metadata
        meta = ET.SubElement(song_elem, 'metadata')
        meta.set('has_year_on_slide', str(song.has_year).lower())
        meta.set('has_language', str(song.has_language).lower())
        meta.set('year_source', song.year_source)
        if song.missing_meaning_slides:
            meta.set('missing_meaning_slides', ','.join(map(str, song.missing_meaning_slides)))
        
        # Stanzas
        if song.stanzas:
            stanzas_elem = ET.SubElement(song_elem, 'stanzas')
            for stanza in song.stanzas:
                stanza_elem = ET.SubElement(stanzas_elem, 'stanza')
                stanza_elem.set('slide', str(stanza.slide_number))
                stanza_elem.set('has_meaning', str(stanza.has_meaning).lower())
                
                ET.SubElement(stanza_elem, 'lyrics').text = stanza.lyrics
                
                if stanza.meaning:
                    ET.SubElement(stanza_elem, 'meaning').text = stanza.meaning
    
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
# PDF GENERATION
# =============================================================================

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
    """Create PDF styles."""
    regular, bold, italic, bold_italic = fonts
    
    return {
        'title': ParagraphStyle('Title', fontSize=TITLE_FONT_SIZE, fontName=bold,
                               leading=TITLE_LINE_HEIGHT, spaceBefore=TITLE_SPACE_BEFORE,
                               spaceAfter=TITLE_SPACE_AFTER),
        'lyrics': ParagraphStyle('Lyrics', fontSize=LYRICS_FONT_SIZE, fontName=regular,
                                leading=LYRICS_LINE_HEIGHT, spaceBefore=LYRICS_SPACE_BEFORE,
                                spaceAfter=LYRICS_SPACE_AFTER),
        'meaning': ParagraphStyle('Meaning', fontSize=MEANING_FONT_SIZE, fontName=bold_italic,
                                 leading=MEANING_LINE_HEIGHT, spaceBefore=MEANING_SPACE_BEFORE,
                                 spaceAfter=MEANING_SPACE_AFTER),
    }


def draw_page(canvas, doc, fonts):
    """Draw header and page number."""
    regular, bold, italic, bold_italic = fonts
    canvas.saveState()
    
    # Header
    canvas.setFont(italic, HEADER_FONT_SIZE)
    canvas.drawCentredString(PAGE_WIDTH / 2, PAGE_HEIGHT - HEADER_Y_POSITION, HEADER_TEXT)
    
    if HEADER_LINE_ENABLED:
        canvas.setStrokeColor(colors.black)
        canvas.setLineWidth(HEADER_LINE_THICKNESS)
        canvas.line(MARGIN_LEFT, PAGE_HEIGHT - HEADER_LINE_Y_POSITION,
                   PAGE_WIDTH - MARGIN_RIGHT, PAGE_HEIGHT - HEADER_LINE_Y_POSITION)
    
    # Page number
    canvas.setFont(regular, PAGE_NUMBER_FONT_SIZE)
    canvas.drawCentredString(PAGE_WIDTH / 2, PAGE_NUMBER_Y_POSITION, str(canvas.getPageNumber()))
    
    canvas.restoreState()


def escape_xml(text: str) -> str:
    """Escape XML special characters."""
    return text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def text_to_html(text: str) -> str:
    """Convert text to HTML, preserving line breaks."""
    return escape_xml(text).replace('\n', '<br/>')


def generate_pdf(songs: list[Song], output_path: str) -> list[Song]:
    """Generate PDF."""
    print("  Registering fonts...")
    fonts = register_fonts()
    
    PageTracker.reset()
    styles = create_styles(fonts)
    content_width = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT
    
    story = []
    
    for idx, song in enumerate(songs):
        story.append(PageTracker(f"song_{idx}"))
        
        # Title
        title = escape_xml(song.title)
        if song.language:
            title += f" ({escape_xml(song.language)})"
        story.append(Paragraph(title, styles['title']))
        
        if TITLE_UNDERLINE_ENABLED:
            story.append(HorizontalRule(content_width))
        story.append(Spacer(1, 8))
        
        # Stanzas
        for si, stanza in enumerate(song.stanzas):
            parts = []
            
            if stanza.lyrics:
                parts.append(Paragraph(text_to_html(stanza.lyrics), styles['lyrics']))
            
            if stanza.meaning:
                parts.append(Paragraph(text_to_html(stanza.meaning), styles['meaning']))
            
            if len(parts) > 1:
                story.append(KeepTogether(parts))
            elif parts:
                story.extend(parts)
            
            if si < len(song.stanzas) - 1:
                story.append(Spacer(1, STANZA_SEPARATOR_HEIGHT))
        
        if idx < len(songs) - 1:
            story.append(PageBreak())
    
    doc = SimpleDocTemplate(output_path, pagesize=(PAGE_WIDTH, PAGE_HEIGHT),
                           leftMargin=MARGIN_LEFT, rightMargin=MARGIN_RIGHT,
                           topMargin=MARGIN_TOP, bottomMargin=MARGIN_BOTTOM)
    
    doc.build(story, onFirstPage=lambda c, d: draw_page(c, d, fonts),
             onLaterPages=lambda c, d: draw_page(c, d, fonts))
    
    for idx, song in enumerate(songs):
        song.page_number = PageTracker.get_page(f"song_{idx}") or (idx + 1)
    
    print(f"PDF saved: {output_path}")
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
# DETAILED REPORT
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
    
    # Songs by year
    lines.extend([
        "─" * 80,
        "SONGS BY YEAR",
        "─" * 80,
    ])
    for year in sorted(report.songs_by_year.keys()):
        files_count = report.files_by_year.get(year, "?")
        lines.append(f"  {year}: {report.songs_by_year[year]} songs (from {files_count} files)")
    lines.append("")
    
    # Issue summary
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
    
    # Detailed: Missing Year
    if report.songs_missing_year:
        lines.extend([
            "─" * 80,
            "SONGS WITH YEAR NOT FOUND ON SLIDE",
            "(year was inferred from folder name or default)",
            "─" * 80,
        ])
        for item in report.songs_missing_year:
            lines.append(f"  • {item}")
        lines.append("")
    
    # Detailed: Missing Language
    if report.songs_missing_language:
        lines.extend([
            "─" * 80,
            "SONGS MISSING LANGUAGE",
            "─" * 80,
        ])
        for item in report.songs_missing_language:
            lines.append(f"  • {item}")
        lines.append("")
    
    # Detailed: Missing Meanings
    if report.songs_with_missing_meanings:
        lines.extend([
            "─" * 80,
            "SONGS WITH MISSING ENGLISH MEANINGS",
            "(lists which slide numbers are missing translations)",
            "─" * 80,
        ])
        for song, slides in sorted(report.songs_with_missing_meanings.items()):
            lines.append(f"  • {song}")
            lines.append(f"      Missing on slides: {slides}")
        lines.append("")
    
    # Files with errors
    if report.files_with_errors:
        lines.extend([
            "─" * 80,
            "FILES WITH ERRORS",
            "─" * 80,
        ])
        for f in report.files_with_errors:
            lines.append(f"  • {f}")
        lines.append("")
    
    # Skipped files
    if report.skipped_files:
        lines.extend([
            "─" * 80,
            "SKIPPED FILES (no valid content extracted)",
            "─" * 80,
        ])
        for f in report.skipped_files:
            lines.append(f"  • {f}")
        lines.append("")
    
    # Full issue log
    lines.extend([
        "─" * 80,
        "DETAILED ISSUE LOG",
        "─" * 80,
        "",
    ])
    
    # Group by type
    by_type: dict[str, list[Issue]] = {}
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
    
    # JSON report
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


# =============================================================================
# MAIN
# =============================================================================

def run_pipeline(input_path: str, output_dir: str, output_name: str = None,
                years: list[str] = None, xml_only: bool = False, from_xml: str = None):
    """Run pipeline."""
    reset_report()
    report = get_report()
    
    output_name = output_name or DEFAULT_OUTPUT_NAME
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)
    
    xml_file = out / f"{output_name}{XML_EXTENSION}"
    pdf_file = out / f"{output_name}{PDF_EXTENSION}"
    toc_file = out / f"{output_name}{TOC_EXTENSION}"
    report_file = out / f"{output_name}{REPORT_EXTENSION}"
    report_json = out / f"{output_name}{REPORT_JSON_EXTENSION}"
    
    report.input_path = os.path.abspath(input_path)
    report.output_path = str(out.absolute())
    
    print("=" * 60)
    print("SONGBOOK GENERATOR")
    print("=" * 60)
    
    if from_xml:
        print(f"\n[1] Loading from XML: {from_xml}")
        songs = xml_to_songs(from_xml)
        print(f"  Loaded {len(songs)} songs")
    else:
        print(f"\n[1] Extracting from PPTX files")
        print(f"  Input: {input_path}")
        
        base = Path(input_path)
        years = years or YEAR_FOLDERS
        
        has_year_folders = any((base / y).exists() for y in years)
        
        if has_year_folders:
            songs = process_all_years(input_path, years)
        else:
            print(f"\n  Single folder mode (assuming year: {CURRENT_YEAR})")
            songs = process_year_folder(input_path, CURRENT_YEAR)
        
        if not songs:
            print("\n✗ No songs extracted!")
            generate_report(str(report_file), str(report_json))
            sys.exit(1)
        
        print(f"\n[2] Saving XML")
        songs_to_xml(songs, str(xml_file))
    
    if xml_only:
        print_summary()
        generate_report(str(report_file), str(report_json))
        print(f"\n{'=' * 60}")
        print("Done (XML only)")
        return
    
    step = 3 if not from_xml else 2
    print(f"\n[{step}] Generating PDF")
    songs = generate_pdf(songs, str(pdf_file))
    
    print(f"\n[{step+1}] Generating TOC")
    generate_toc(songs, str(toc_file))
    
    print(f"\n[{step+2}] Generating Report")
    generate_report(str(report_file), str(report_json))
    
    print_summary()
    
    print(f"\n{'=' * 60}")
    print("COMPLETE")
    print(f"{'=' * 60}")
    print(f"  XML:    {xml_file}")
    print(f"  PDF:    {pdf_file}")
    print(f"  TOC:    {toc_file}")
    print(f"  Report: {report_file}")


def main():
    parser = argparse.ArgumentParser(description='Convert PPTX songs to PDF songbook')
    parser.add_argument('input_path', help='Directory with PPTX files or year folders')
    parser.add_argument('-o', '--output-dir', default='output')
    parser.add_argument('-n', '--name', default=DEFAULT_OUTPUT_NAME)
    parser.add_argument('--years', nargs='+')
    parser.add_argument('--xml-only', action='store_true')
    parser.add_argument('--from-xml', metavar='FILE')
    
    args = parser.parse_args()
    run_pipeline(args.input_path, args.output_dir, args.name, args.years, args.xml_only, args.from_xml)


if __name__ == "__main__":
    main()