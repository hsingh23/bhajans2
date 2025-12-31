#!/usr/bin/env python3
"""
models.py - Data classes for songbook generator.
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum, auto
from typing import Optional


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
    raw_text: Optional[str] = None
    
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
    
    # Source tracking
    year_source: str = ""      # "slide", "folder", "filename", "default"
    language_source: str = ""  # "slide_parens", "slide_text", "filename", ""
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
    
    # Language detection
    language_sources: dict[str, int] = field(default_factory=lambda: {
        "slide_parens": 0, "slide_text": 0, "filename": 0, "not_found": 0
    })
    
    # Aggregated counts
    songs_missing_year: list[str] = field(default_factory=list)
    songs_missing_language: list[str] = field(default_factory=list)
    songs_with_missing_meanings: dict = field(default_factory=dict)
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


# Global report singleton
_report: Optional[ProcessingReport] = None


def get_report() -> ProcessingReport:
    """Get the global processing report."""
    global _report
    if _report is None:
        _report = ProcessingReport()
    return _report


def reset_report():
    """Reset the global processing report."""
    global _report
    _report = ProcessingReport()
    _report.timestamp = datetime.now().isoformat()
