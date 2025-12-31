#!/usr/bin/env python3
"""
download_fonts.py
Downloads web-optimized fonts for PDF generation.
"""

import os
import urllib.request
from pathlib import Path

# Noto Serif - excellent Unicode coverage, works well in web PDFs
FONTS = {
    "NotoSerif-Regular.ttf": 
        "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSerif/NotoSerif-Regular.ttf",
    "NotoSerif-Bold.ttf": 
        "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSerif/NotoSerif-Bold.ttf",
    "NotoSerif-Italic.ttf": 
        "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSerif/NotoSerif-Italic.ttf",
    "NotoSerif-BoldItalic.ttf": 
        "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSerif/NotoSerif-BoldItalic.ttf",
}


def download_file(url: str, dest: str) -> bool:
    """Download a file from URL."""
    try:
        print(f"  Downloading {os.path.basename(dest)}...")
        urllib.request.urlretrieve(url, dest)
        return True
    except Exception as e:
        print(f"  ERROR: {e}")
        return False


def main():
    fonts_dir = Path("fonts")
    fonts_dir.mkdir(exist_ok=True)
    
    print("=" * 50)
    print("FONT DOWNLOADER")
    print("=" * 50)
    print(f"\nDownloading to: {fonts_dir.absolute()}\n")
    
    success = 0
    for filename, url in FONTS.items():
        dest = fonts_dir / filename
        if dest.exists():
            print(f"  {filename} already exists")
            success += 1
        elif download_file(url, str(dest)):
            success += 1
    
    print(f"\n{'=' * 50}")
    print(f"Downloaded {success}/{len(FONTS)} fonts")
    print(f"{'=' * 50}")
    
    if success == len(FONTS):
        print("\n✓ Ready to generate PDFs!")
        print("  Run: uv run songbook_generator.py /path/to/songs -o output")
    else:
        print("\n⚠ Some fonts failed to download. Check your internet connection.")


if __name__ == "__main__":
    main()