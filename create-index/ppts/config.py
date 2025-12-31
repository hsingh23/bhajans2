#!/usr/bin/env python3
"""
config.py - Configuration constants for songbook generator.
"""

from reportlab.lib.units import inch
from reportlab.lib import colors


# =============================================================================
# YEAR FOLDERS
# =============================================================================
YEAR_FOLDERS = ["2021", "2022", "2023", "2024", "2025"]
CURRENT_YEAR = "2025"
DEFAULT_LANGUAGE = None  # Set to e.g., "Unknown" to have a fallback

# =============================================================================
# FONT CONFIGURATION
# =============================================================================
FONT_REGULAR_PATH = None
FONT_BOLD_PATH = None
FONT_ITALIC_PATH = None
FONT_BOLD_ITALIC_PATH = None
FONT_FAMILY = "SongFont"

# =============================================================================
# PDF PAGE SETTINGS
# =============================================================================
PAGE_WIDTH = 6.5 * inch
# Maintain aspect ratio of 390:788
PAGE_HEIGHT = PAGE_WIDTH * (788 / 390)
MARGIN_LEFT = 0.3 * inch
MARGIN_RIGHT = 0.3 * inch
MARGIN_TOP = 0.7 * inch
MARGIN_BOTTOM = 0.6 * inch

# =============================================================================
# PDF HEADER SETTINGS
# =============================================================================
HEADER_TEXT = "Devotional Songs of Sri Mata Amritanandamayi"
HEADER_FONT_SIZE = 9
HEADER_Y_POSITION = 0.4 * inch
HEADER_LINE_ENABLED = True
HEADER_LINE_Y_POSITION = 0.55 * inch
HEADER_LINE_THICKNESS = 0.5

# =============================================================================
# PDF PAGE NUMBER
# =============================================================================
PAGE_NUMBER_FONT_SIZE = 10
PAGE_NUMBER_Y_POSITION = 0.35 * inch

# =============================================================================
# PDF TYPOGRAPHY - TITLE
# =============================================================================
TITLE_FONT_SIZE = 22
TITLE_LINE_HEIGHT = 26
TITLE_SPACE_BEFORE = 0
TITLE_SPACE_AFTER = 2
TITLE_UNDERLINE_ENABLED = True
TITLE_UNDERLINE_THICKNESS = 0.5
TITLE_UNDERLINE_COLOR = colors.black

# =============================================================================
# PDF TYPOGRAPHY - LANGUAGE SUBTITLE
# =============================================================================
LANGUAGE_SUBTITLE_FONT_SIZE = 10
LANGUAGE_SUBTITLE_LINE_HEIGHT = 12
LANGUAGE_SUBTITLE_SPACE_BEFORE = 2
LANGUAGE_SUBTITLE_SPACE_AFTER = 4
LANGUAGE_SUBTITLE_COLOR = colors.Color(0.4, 0.4, 0.4)

# =============================================================================
# PDF TYPOGRAPHY - SEARCHABLE TITLE
# =============================================================================
SEARCHABLE_TITLE_ENABLED = True
SEARCHABLE_TITLE_FONT_SIZE = 1
SEARCHABLE_TITLE_LINE_HEIGHT = 1
SEARCHABLE_TITLE_SPACE_AFTER = 2
SEARCHABLE_TITLE_COLOR = colors.Color(1, 1, 1, alpha=0)

# =============================================================================
# PDF TYPOGRAPHY - LYRICS
# =============================================================================
LYRICS_FONT_SIZE = 15
LYRICS_LINE_HEIGHT = 20
LYRICS_SPACE_BEFORE = 16
LYRICS_SPACE_AFTER = 6

# =============================================================================
# PDF TYPOGRAPHY - MEANING
# =============================================================================
MEANING_FONT_SIZE = 11
MEANING_LINE_HEIGHT = 14
MEANING_SPACE_BEFORE = 4
MEANING_SPACE_AFTER = 0
MEANING_INDENT = 0.25 * inch

# =============================================================================
# STANZA SPACING
# =============================================================================
STANZA_SEPARATOR_HEIGHT = 8

# =============================================================================
# TOC SETTINGS
# =============================================================================
TOC_FORMAT = "{title} ({language}) ## {year}-{page}"
TOC_FORMAT_NO_LANGUAGE = "{title} ## {year}-{page}"
TOC_SORT_ALPHABETICALLY = True

# =============================================================================
# REPORT SETTINGS
# =============================================================================
REPORT_EXTENSION = "_report.txt"
REPORT_JSON_EXTENSION = "_report.json"

# =============================================================================
# XML SETTINGS
# =============================================================================
XML_INDENT = "  "
XML_INCLUDE_SOURCE = True

# =============================================================================
# FILE NAMING
# =============================================================================
DEFAULT_OUTPUT_NAME = "songbook"
XML_EXTENSION = ".xml"
PDF_EXTENSION = ".pdf"
TOC_EXTENSION = "_toc.txt"

# =============================================================================
# KNOWN LANGUAGES AND DETECTION
# =============================================================================
LANGUAGE_MAP = {
    # Indian Languages
    "Malayalam": [
        "malayalam", "mal", "mlm", "malyalam", "malaylam", "malay",
        "ml", "മലയാളം"
    ],
    "Tamil": [
        "tamil", "tam", "tml", "tamizh", "thamil", "ta", "தமிழ்"
    ],
    "Telugu": [
        "telugu", "tel", "tlg", "telegu", "te", "తెలుగు"
    ],
    "Kannada": [
        "kannada", "kan", "knd", "kannad", "karnataka", "kn", "ಕನ್ನಡ"
    ],
    "Hindi": [
        "hindi", "hin", "hnd", "hdi", "hi", "हिंदी", "हिन्दी"
    ],
    "Sanskrit": [
        "sanskrit", "san", "skt", "samskrit", "samskritam", "sa", "संस्कृत"
    ],
    "Bengali": [
        "bengali", "ben", "bng", "bangla", "bangali", "bn", "বাংলা"
    ],
    "Marathi": [
        "marathi", "mar", "mrt", "marati", "mr", "मराठी"
    ],
    "Gujarati": [
        "gujarati", "guj", "gujrati", "gujarathi", "gu", "ગુજરાતી"
    ],
    "Punjabi": [
        "punjabi", "pun", "pnj", "panjabi", "pa", "ਪੰਜਾਬੀ", "پنجابی"
    ],
    "Odia": [
        "odia", "odi", "oriya", "orya", "odiya", "odhiya", "or", "ଓଡ଼ିଆ"
    ],
    "Braj Bhasha": [
        "braj bhasha", "braj", "braja", "brajabhasha", "brj"
    ],
    "Marwari": [
        "marwari", "marwadi", "mwr", "marvadi"
    ],
    "Assamese": [
        "assamese", "asm", "assam", "asamiya", "as", "অসমীয়া"
    ],
    "Konkani": [
        "konkani", "kon", "knk", "kk", "कोंकणी"
    ],
    "Kashmiri": [
        "kashmiri", "kas", "kash", "ks", "कॉशुर"
    ],
    "Nepali": [
        "nepali", "nep", "npl", "ne", "नेपाली"
    ],
    "Sindhi": [
        "sindhi", "snd", "sind", "sd", "سنڌي"
    ],
    "Maithili": [
        "maithili", "mai", "mth", "मैथिली"
    ],
    "Dogri": [
        "dogri", "doi", "dgr", "डोगरी"
    ],
    "Manipuri": [
        "manipuri", "mni", "mnp", "meitei", "মৈতৈলোন্"
    ],
    "Bodo": [
        "bodo", "bod", "brx", "बड़ो"
    ],
    "Santali": [
        "santali", "sat", "snt", "ᱥᱟᱱᱛᱟᱲᱤ"
    ],
    "Urdu": [
        "urdu", "urd", "ur", "اردو"
    ],
    "Tulu": [
        "tulu", "tcy", "ತುಳು"
    ],
    "Bhojpuri": [
        "bhojpuri", "bho", "bhoj", "भोजपुरी"
    ],
    "Rajasthani": [
        "rajasthani", "raj", "rjs", "राजस्थानी"
    ],
    "Chhattisgarhi": [
        "chhattisgarhi", "chg", "छत्तीसगढ़ी"
    ],
    "Haryanvi": [
        "haryanvi", "har", "hry", "हरियाणवी"
    ],
    "Magahi": [
        "magahi", "mag", "मगही"
    ],
    "Awadhi": [
        "awadhi", "awa", "अवधी"
    ],
    
    # Other Languages
    "English": [
        "english", "eng", "en"
    ],
    "Spanish": [
        "spanish", "spa", "español", "espanol", "es"
    ],
    "French": [
        "french", "fra", "fre", "français", "francais", "fr"
    ],
    "Dutch": [
        "dutch", "dut", "nld", "nl", "nederlands"
    ],
    "German": [
        "german", "ger", "deu", "deutsch", "de"
    ],
    "Portuguese": [
        "portuguese", "por", "português", "pt"
    ],
    "Italian": [
        "italian", "ita", "italiano", "it"
    ],
    "Russian": [
        "russian", "rus", "ru", "русский"
    ],
    "Japanese": [
        "japanese", "jpn", "ja", "日本語"
    ],
    "Chinese": [
        "chinese", "chi", "zho", "zh", "中文", "mandarin"
    ],
    "Korean": [
        "korean", "kor", "ko", "한국어"
    ],
    "Arabic": [
        "arabic", "ara", "ar", "العربية"
    ],
    "Persian": [
        "persian", "fas", "farsi", "fa", "فارسی"
    ],
    "Turkish": [
        "turkish", "tur", "tr", "türkçe"
    ],
    "Thai": [
        "thai", "tha", "th", "ไทย"
    ],
    "Vietnamese": [
        "vietnamese", "vie", "vi", "tiếng việt"
    ],
    "Indonesian": [
        "indonesian", "ind", "id", "bahasa"
    ],
    "Malay": [
        "malay", "msa", "ms", "melayu"
    ],
    "Swahili": [
        "swahili", "swa", "sw", "kiswahili"
    ],
    "Hebrew": [
        "hebrew", "heb", "he", "עברית"
    ],
}

# Build reverse lookup: variation -> canonical name
LANGUAGE_LOOKUP: dict[str, str] = {}
for canonical, variations in LANGUAGE_MAP.items():
    LANGUAGE_LOOKUP[canonical.lower()] = canonical
    for var in variations:
        LANGUAGE_LOOKUP[var.lower()] = canonical

# Common patterns in filenames that indicate language
FILENAME_LANGUAGE_PATTERNS = [
    r'\b([A-Za-z]{2,})\s+in\s+[Ee]ng(?:lish)?\b',
    r'\bin\s+([A-Za-z]{2,})\b',
    r'\b([A-Za-z]{3,})\b',
    r'\(([A-Za-z]{2,})\)',
    r'20\d{2}[\s_\-]+([A-Za-z]{2,})',
    r'([A-Za-z]{3,})[\s_\-]+20\d{2}',
    r'_([A-Za-z]{3,})_',
    r'-([A-Za-z]{3,})-',
]
