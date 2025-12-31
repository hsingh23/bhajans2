#!/usr/bin/env python3
"""
songbook_generator.py

Complete pipeline to convert PPTX song files to XML, PDF, and TOC.
Supports multiple year folders with robust error handling and detailed reporting.

Usage with uv:
    uv run songbook_generator.py /path/to/base/folder -o output
    
Output files are named after the year (e.g., 2025.pdf, 2025.xml)
"""

import os
import sys
import argparse
from pathlib import Path

# Import from modular components
from config import (
    YEAR_FOLDERS, CURRENT_YEAR, DEFAULT_OUTPUT_NAME,
    XML_EXTENSION, PDF_EXTENSION, TOC_EXTENSION,
    REPORT_EXTENSION, REPORT_JSON_EXTENSION,
)
from models import reset_report, get_report
from language import detect_language, normalize_language
from pptx_parser import (
    process_all_years, process_year_folder, process_pptx_file,
    extract_text_from_shape, get_shapes_by_position,
)
from output import (
    songs_to_xml, xml_to_songs, generate_pdf, generate_toc,
    generate_report, print_summary,
)


def determine_output_year(songs: list, years_processed: list[str] = None) -> str:
    """
    Determine the year to use for output filenames.
    
    Priority:
    1. Latest year from songs if available
    2. Latest year from years_processed
    3. CURRENT_YEAR fallback
    """
    if songs:
        years_in_songs = {s.year for s in songs if s.year}
        if years_in_songs:
            return max(years_in_songs)
    
    if years_processed:
        return max(years_processed)
    
    return CURRENT_YEAR


def run_pipeline(
    input_path: str,
    output_dir: str,
    output_name: str = None,
    years: list[str] = None,
    xml_only: bool = False,
    from_xml: str = None
):
    """Run the complete songbook generation pipeline."""
    reset_report()
    report = get_report()
    
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)
    
    report.input_path = os.path.abspath(input_path)
    report.output_path = str(out.absolute())
    
    print("=" * 60)
    print("SONGBOOK GENERATOR")
    print("=" * 60)
    
    years_processed = []
    
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
            # Find which years actually exist
            years_processed = [y for y in years if (base / y).exists()]
            songs = process_all_years(input_path, years)
        else:
            print(f"\n  Single folder mode (assuming year: {CURRENT_YEAR})")
            years_processed = [CURRENT_YEAR]
            songs = process_year_folder(input_path, CURRENT_YEAR)
        
        if not songs:
            print("\n✗ No songs extracted!")
            # Still generate report with current year
            final_year = determine_output_year([], years_processed)
            output_name = output_name or final_year
            report_file = out / f"{output_name}{REPORT_EXTENSION}"
            report_json = out / f"{output_name}{REPORT_JSON_EXTENSION}"
            generate_report(str(report_file), str(report_json))
            sys.exit(1)
    
    # Determine output name based on year
    final_year = determine_output_year(songs, years_processed)
    output_name = output_name or final_year  # Use year instead of "songbook"
    
    xml_file = out / f"{output_name}{XML_EXTENSION}"
    pdf_file = out / f"{output_name}{PDF_EXTENSION}"
    toc_file = out / f"{output_name}{TOC_EXTENSION}"
    report_file = out / f"{output_name}{REPORT_EXTENSION}"
    report_json = out / f"{output_name}{REPORT_JSON_EXTENSION}"
    
    if not from_xml:
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
    
    # === POST PROCESSING ===
    print(f"\n[{step+3}] Running Post-Processing Automation")
    run_post_processing(out, output_name, final_year, pdf_file, toc_file)


def run_post_processing(output_dir: Path, output_name: str, year: str, pdf_path: Path, toc_path: Path):
    """
    Automate post-generation steps:
    1. Copy PDF to public/pdfs/{year}.pdf
    2. Move TOC to create-index/{year}.txt
    3. Run create-index.py
    """
    import shutil
    import subprocess
    
    script_dir = Path(__file__).parent.resolve()
    project_root = script_dir.parent.parent
    public_pdfs = project_root / "public" / "pdfs"
    create_index_dir = project_root / "create-index"
    
    print(f"  Project root detected: {project_root}")
    
    # 1. Copy PDF
    if pdf_path.exists():
        target_pdf_name = f"{year}.pdf"
        target_pdf = public_pdfs / target_pdf_name
        
        # Ensure directory exists
        public_pdfs.mkdir(parents=True, exist_ok=True)
        
        try:
            shutil.copy2(pdf_path, target_pdf)
            print(f"  ✓ Copied PDF to: {target_pdf}")
        except Exception as e:
            print(f"  ✗ Failed to copy PDF: {e}")
    else:
        print(f"  ⚠ PDF not found, skipping copy")

    # 2. Move TOC to create-index/{year}.txt
    if toc_path.exists():
        # Clean up TOC content (remove byte order mark if present)
        try:
            content = toc_path.read_text(encoding='utf-8')
            # Filter out lines that don't match the expected format (just in case)
            lines = [l for l in content.splitlines() if "##" in l]
            
            target_toc_name = f"{year}.txt"
            target_toc = create_index_dir / target_toc_name
            
            target_toc.write_text('\n'.join(lines), encoding='utf-8')
            print(f"  ✓ Updated index source: {target_toc}")
        except Exception as e:
            print(f"  ✗ Failed to update index source: {e}")
    else:
        print(f"  ⚠ TOC not found, skipping index update")

    # 3. Run create-index.py
    print(f"  > Triggering index regeneration...")
    try:
        index_script = create_index_dir / "create-index.py"
        if index_script.exists():
            result = subprocess.run(
                ["python3", str(index_script)],
                cwd=create_index_dir,
                capture_output=True,
                text=True
            )
            if result.returncode == 0:
                print(f"  ✓ Index regenerated successfully")
                # print(result.stdout) # Optional: print output
            else:
                print(f"  ✗ Index generation failed")
                print(result.stderr)
        else:
             print(f"  ✗ create-index.py not found at {index_script}")
    except Exception as e:
        print(f"  ✗ Failed to run index script: {e}")


# =============================================================================
# TESTS & DEBUGGING
# =============================================================================

def test_language_detection():
    """Test suite for language detection logic."""
    print("\n" + "="*60)
    print("TESTING LANGUAGE DETECTION")
    print("="*60)
    
    test_cases = [
        ("2025 (Malayalam)", "Song.pptx", "Malayalam", "slide_parens"),
        ("Malayalam\n2025", "Song.pptx", "Malayalam", "slide_text"),
        ("2025\n(mal)", "Song.pptx", "Malayalam", "slide_parens"),
        ("", "Prema_Sagarame_Mal_2025.pptx", "Malayalam", "filename"),
        ("", "Tamil_Song.pptx", "Tamil", "filename"),
        ("2025 (Tamil)", "Malayalam_Song.pptx", "Tamil", "slide_parens"),
        ("Bhajan in Telugu", "Song.pptx", "Telugu", "slide_text"),
        ("New Song 2024 Kannada", "Song.pptx", "Kannada", "slide_text"),
        ("(Bengali) Title", "Song.pptx", "Bengali", "slide_parens"),
        ("", "Song (Mar).pptx", "Marathi", "filename"),
        ("(braj) Song", "Song.pptx", "Braj Bhasha", "slide_parens"),
        ("Song in Braja", "Song.pptx", "Braj Bhasha", "slide_text"),
        ("", "Song_mwr_2025.pptx", "Marwari", "filename"),
        ("Song (Marwadi)", "Song.pptx", "Marwari", "slide_parens"),
        ("Song (Odiya)", "Song.pptx", "Odia", "slide_parens"),
        ("Song in Dutch", "Song.pptx", "Dutch", "slide_text"),
        ("", "Dutch_Song_2025.pptx", "Dutch", "filename"),
        ("there's a way of life in this universe", "Song.pptx", "English", "heuristic"),
        ("The ocean is deep", "Song.pptx", "English", "heuristic"),
    ]
    
    passed = 0
    for slide, file, exp_lang, exp_src in test_cases:
        lang, src = detect_language(slide_text=slide, filename=file)
        
        status = "✓" if lang == exp_lang and src == exp_src else "✗"
        slide_display = slide.replace('\n', ' ')
        print(f"  {status} Input: slide='{slide_display}', file='{file}'")
        print(f"    Expected: {exp_lang} ({exp_src})")
        print(f"    Got:      {lang} ({src})")
        
        if status == "✓":
            passed += 1
    
    print(f"\nResult: {passed}/{len(test_cases)} passed")
    return passed == len(test_cases)


def test_line_break_preservation(sample_pptx_path: str):
    """Debug line break preservation for a specific file."""
    if not os.path.exists(sample_pptx_path):
        print(f"File not found: {sample_pptx_path}")
        return
    
    from pptx import Presentation
    
    print("\n" + "="*60)
    print(f"DEBUGGING TEXT EXTRACTION: {os.path.basename(sample_pptx_path)}")
    print("="*60)
    
    try:
        prs = Presentation(sample_pptx_path)
        for i, slide in enumerate(prs.slides):
            print(f"\n--- Slide {i+1} ---")
            shapes = get_shapes_by_position(slide)
            for s_idx, shape in enumerate(shapes):
                text = shape['text']
                visible_breaks = text.replace('\n', '[\\n]\n')
                print(f"  Shape {s_idx+1}:")
                print(f"  {visible_breaks}")
    except Exception as e:
        print(f"Error: {e}")


def main():
    parser = argparse.ArgumentParser(
        description='Convert PPTX songs to PDF songbook',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  uv run songbook_generator.py .                  # Process current dir, output as <year>.pdf
  uv run songbook_generator.py . -o output        # Output to 'output' directory
  uv run songbook_generator.py . -n custom        # Use custom name instead of year
  uv run songbook_generator.py --test             # Run language detection tests
        """
    )
    parser.add_argument('input_path', nargs='?', help='Directory with PPTX files or year folders')
    parser.add_argument('-o', '--output-dir', default='output', help='Output directory')
    parser.add_argument('-n', '--name', help='Output name (default: year, e.g., 2025)')
    parser.add_argument('--years', nargs='+', help='Specific years to process')
    parser.add_argument('--xml-only', action='store_true', help='Only generate XML, skip PDF')
    parser.add_argument('--from-xml', metavar='FILE', help='Generate PDF from existing XML')
    parser.add_argument('--test', action='store_true', help='Run language detection tests')
    parser.add_argument('--debug-file', metavar='FILE', help='Debug text extraction for a file')
    
    args = parser.parse_args()
    
    if args.test:
        test_language_detection()
        if not args.input_path:
            return

    if args.debug_file:
        test_line_break_preservation(args.debug_file)
        if not args.input_path:
            return
            
    if not args.input_path:
        parser.print_help()
        return

    run_pipeline(
        args.input_path,
        args.output_dir,
        args.name,
        args.years,
        args.xml_only,
        args.from_xml
    )


if __name__ == "__main__":
    main()