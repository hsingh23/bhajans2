#!/usr/bin/env python3
"""
language.py - Language detection logic for songbook generator.
"""

import re
from typing import Optional

from config import LANGUAGE_LOOKUP, FILENAME_LANGUAGE_PATTERNS


def normalize_language(text: str) -> Optional[str]:
    """
    Normalize a language string to its canonical form.
    
    Examples:
        "mal" -> "Malayalam"
        "Tam" -> "Tamil"
        "KANNADA" -> "Kannada"
    """
    if not text:
        return None
    
    clean = text.strip().lower()
    
    # Direct lookup
    if clean in LANGUAGE_LOOKUP:
        return LANGUAGE_LOOKUP[clean]
    
    # Try without common suffixes/prefixes
    for suffix in ['i', 'am', 'u']:
        if clean.endswith(suffix) and clean[:-len(suffix)] in LANGUAGE_LOOKUP:
            return LANGUAGE_LOOKUP[clean[:-len(suffix)]]
    
    return None


def detect_language_from_text(text: str) -> Optional[str]:
    """
    Detect language from arbitrary text (slide content, metadata, etc.)
    
    Handles formats like:
        - "Malayalam"
        - "(Malayalam)"
        - "2025 (Malayalam)"
        - "(mal)"
    """
    if not text:
        return None
    
    text = text.strip()
    
    # Check for language in parentheses first (highest priority)
    paren_matches = re.findall(r'\(([^)]+)\)', text)
    for match in paren_matches:
        lang = normalize_language(match.strip())
        if lang:
            return lang
    
    # Check for "in <language>" pattern
    in_match = re.search(r'\bin\s+([A-Za-z]+)', text, re.IGNORECASE)
    if in_match:
        lang = normalize_language(in_match.group(1))
        if lang and lang != "English":
            return lang
    
    # Check for language after year
    after_year = re.search(r'20\d{2}\s+([A-Za-z]+)', text)
    if after_year:
        lang = normalize_language(after_year.group(1))
        if lang:
            return lang
    
    # Check if entire text (cleaned) is a language
    clean_text = re.sub(r'[^A-Za-z]', '', text)
    if clean_text:
        lang = normalize_language(clean_text)
        if lang:
            return lang
    
    # Check each word
    words = re.findall(r'[A-Za-z]+', text)
    for word in words:
        lang = normalize_language(word)
        if lang:
            return lang
    
    return None


def detect_language_from_filename(filename: str) -> Optional[str]:
    """
    Extract language from filename.
    
    Handles patterns like:
        - "Prema Sagarame 2025 Mal in Eng.pptx" -> Malayalam
        - "Bhajan_Tamil_2024.pptx" -> Tamil
        - "Song (Malayalam) 2025.pptx" -> Malayalam
    """
    if not filename:
        return None
    
    # Remove extension
    name = filename.rsplit('.', 1)[0] if '.' in filename else filename
    
    # Try each pattern
    for pattern in FILENAME_LANGUAGE_PATTERNS:
        matches = re.findall(pattern, name, re.IGNORECASE)
        for match in matches:
            lang = normalize_language(match)
            if lang and lang != "English":
                return lang
    
    # Fallback: check all words in filename
    words = re.findall(r'[A-Za-z]+', name)
    skip_words = {
        'in', 'the', 'and', 'of', 'for', 'with', 'eng', 'english',
        'song', 'bhajan', 'kirtan', 'stotram', 'mantra', 'prayer',
        'devotional', 'spiritual', 'vol', 'volume', 'part', 'new',
        'pptx', 'ppt', 'pdf', 'mp3', 'mp4', 'lyrics', 'meaning',
        'translation', 'trans', 'final', 'draft', 'copy', 'old',
    }
    
    for word in words:
        if word.lower() in skip_words:
            continue
        lang = normalize_language(word)
        if lang and lang != "English":
            return lang
    
    return None


def looks_like_english(text: str) -> bool:
    """Heuristic to check if text is likely English."""
    if not text:
        return False
    
    eng_keywords = {
        'the', 'and', 'you', 'are', 'your', 'with', 'this', 'that', 'from',
        'have', 'will', 'shall', 'mother', 'divine', 'peace', 'love', 'heart',
        'soul', 'grace', 'light', 'pure', 'holy', 'prayer', 'sing', 'glory',
        'life', 'universe', 'leading', 'true', 'ocean', 'misty', 'mountains',
        'awake', 'outside', 'dark', 'boat', 'lost', 'sea'
    }
    
    words = re.findall(r'[A-Za-z]+', text.lower())
    match_count = sum(1 for w in words if w in eng_keywords)
    
    if match_count >= 2:
        return True
    if len(words) <= 10 and match_count >= 1:
        return True
    return False


def detect_language(
    slide_text: Optional[str] = None,
    filename: Optional[str] = None,
    all_slide_texts: Optional[list[str]] = None
) -> tuple[Optional[str], str]:
    """
    Detect language using multiple sources.
    
    Priority:
        1. Explicit language on title slide (in parentheses)
        2. Language in filename
        3. Language mentioned anywhere on title slide
        4. Heuristic check for English
    
    Returns:
        (language, source) where source is one of:
        "slide_parens", "slide_text", "filename", "heuristic", or ""
    """
    # 1. Check for language in parentheses on slide
    if slide_text:
        paren_matches = re.findall(r'\(([^)]+)\)', slide_text)
        for match in paren_matches:
            lang = normalize_language(match.strip())
            if lang:
                return lang, "slide_parens"
    
    # 2. Check all slide texts for parentheses
    if all_slide_texts:
        for text in all_slide_texts:
            paren_matches = re.findall(r'\(([^)]+)\)', text)
            for match in paren_matches:
                lang = normalize_language(match.strip())
                if lang:
                    return lang, "slide_parens"

    # 3. Check filename
    if filename:
        lang = detect_language_from_filename(filename)
        if lang:
            return lang, "filename"
    
    # 4. Check slide text more broadly
    if slide_text:
        lang = detect_language_from_text(slide_text)
        if lang:
            return lang, "slide_text"
    
    # 5. Check all slide texts more broadly
    if all_slide_texts:
        for text in all_slide_texts:
            lang = detect_language_from_text(text)
            if lang:
                return lang, "slide_text"
    
    # 6. Heuristic fallback for English
    if slide_text and looks_like_english(slide_text):
        return "English", "heuristic"
        
    if all_slide_texts:
        for text in all_slide_texts:
            if looks_like_english(text):
                return "English", "heuristic"
                
    if filename and looks_like_english(filename):
        return "English", "heuristic"
    
    return None, ""


def detect_year(text: str) -> Optional[str]:
    """Extract year (4 digits between 2000-2099) from text."""
    match = re.search(r'(20[0-9]{2})', text)
    return match.group(1) if match else None
