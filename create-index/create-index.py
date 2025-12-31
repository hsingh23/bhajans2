#!/usr/bin/env python3
"""
Bhajan Index Generator

This script generates the bhajan search index by:
1. Auto-discovering supplement/volume text files
2. Applying translation mappings for searchable text
3. Merging all bhajans into a unified index
4. Outputting JSON files for the web app

To add new supplement files:
- Simply add .txt files matching the patterns below to this directory
- Run the script again
"""

from subprocess import Popen
from pathlib import Path
import re
import json
import glob

# ============================================================================
# CONFIGURATION - Edit these patterns as needed
# ============================================================================

# Patterns for auto-discovering supplement files (relative to script directory)
SUPPLEMENT_PATTERNS = [
    "*Supplement*.txt",  # e.g., 2021Supplement.txt
    "20??.txt",          # e.g., 2025.txt (year-based files)
    "Vol?.txt",          # e.g., Vol3.txt, Vol7.txt
]

# Core index files that are always included (order matters for priority)
CORE_INDEX_FILES = [
    "bhajanmritam.txt",  # Main bhajan mritam index (no translation needed)
]

# Files that need translation mapping applied
TRANSLATION_MAPPING_FILE = "translation.csv"

# Output paths (relative to this script's directory)
OUTPUT_DIR = Path(__file__).parent
PUBLIC_DIR = OUTPUT_DIR.parent / "public"

# ============================================================================
# SCRIPT LOGIC
# ============================================================================

def get_script_dir():
    """Get the directory containing this script."""
    return Path(__file__).parent.resolve()

def discover_supplement_files(script_dir):
    """Auto-discover supplement files matching configured patterns."""
    supplements = set()
    for pattern in SUPPLEMENT_PATTERNS:
        matches = glob.glob(str(script_dir / pattern))
        for match in matches:
            filename = Path(match).name
            # Skip already-processed .changed.txt files
            if '.changed.txt' not in filename:
                supplements.add(filename)
    
    # Sort for consistent ordering (newer years/supplements first)
    return sorted(supplements, key=lambda x: (
        # Extract year if present, otherwise use filename
        -int(re.search(r"(\d{4})", x).group(1)) if re.search(r"(\d{4})", x) else 0,
        x
    ))

def load_translation_mapping(script_dir):
    """Load the translation mapping CSV file."""
    mapping = []
    mapping_file = script_dir / TRANSLATION_MAPPING_FILE
    if mapping_file.exists():
        with open(mapping_file, 'r') as f:
            mapping = f.readlines()
    return mapping

def apply_translations(script_dir, supplements, translation_mapping):
    """Apply translation substitutions to supplement files."""
    for filename in supplements:
        filepath = script_dir / filename
        if not filepath.exists():
            print(f"Warning: {filename} not found, skipping")
            continue
            
        with open(filepath, 'r') as f:
            content = f.read().lower()
            for line in translation_mapping:
                if ',' in line:
                    (searchable, original) = line.split(',', 1)
                    original = original.strip()
                    content = re.sub(original, searchable, content)
        
        # Write substituted content
        output_file = script_dir / (filename + ".changed.txt")
        with open(output_file, 'w+') as f:
            f.write(content)
    
    print(f"Applied translations to {len(supplements)} files")

def merge_bhajan_indices(script_dir, supplements):
    """Merge all bhajan indices into a unified dictionary."""
    bhajans = {}
    
    # Build list of files to process
    # Core files first (no .changed suffix), then supplements with .changed suffix
    files_to_process = []
    
    # Add core files
    for core_file in CORE_INDEX_FILES:
        if (script_dir / core_file).exists():
            files_to_process.append(core_file)
    
    # Add supplement files (use .changed.txt versions or original if no translation needed)
    for supplement in supplements:
        changed_file = supplement + ".changed.txt"
        if (script_dir / changed_file).exists():
            files_to_process.append(changed_file)
        elif (script_dir / supplement).exists():
            files_to_process.append(supplement)
    
    # Also check for Vol3.txt.changed.txt specifically (legacy handling)
    if (script_dir / "Vol3.txt.changed.txt").exists() and "Vol3.txt.changed.txt" not in files_to_process:
        files_to_process.append("Vol3.txt.changed.txt")
    
    print(f"Processing {len(files_to_process)} index files: {files_to_process}")
    
    # Merge all files
    for filename in files_to_process:
        filepath = script_dir / filename
        if not filepath.exists():
            continue
            
        with open(filepath, 'r') as f:
            for line in f.read().lower().split('\n'):
                try:
                    if len(line.strip()) > 0 and '##' in line:
                        (bhajan_name, location) = line.strip().split('##', 1)
                        bhajan_name = bhajan_name.strip()
                        location = re.split(r' *[/,] *', location.strip())
                        
                        if bhajan_name in bhajans:
                            bhajans[bhajan_name] = bhajans[bhajan_name] + location
                        else:
                            bhajans[bhajan_name] = location
                except Exception as e:
                    print(f"Error processing line in {filename}: {line[:50]}...")
    
    return bhajans

def write_outputs(script_dir, bhajans):
    """Write all output files."""
    # Create sorted list
    final_sorted = [bhajan + ' ## ' + ','.join(info) 
                   for (bhajan, info) in sorted(bhajans.items())]
    
    # Create structured dict for JSON2
    bhajans2 = {}
    for bhajan, location in bhajans.items():
        bhajans2[bhajan] = {"l": location, 'n': bhajan}
    
    # Write outputs
    with open(script_dir / 'bhajan-index.txt', 'w+') as f:
        f.write('\n'.join(final_sorted))
    
    with open(script_dir / 'bhajan-index.json', 'w+') as f:
        f.write(json.dumps(final_sorted))
    
    with open(PUBLIC_DIR / 'bhajan-index.json', 'w+') as f:
        f.write(json.dumps(final_sorted))
    
    with open(PUBLIC_DIR / 'bhajan-index2.json', 'w+') as f:
        f.write(json.dumps([v for (k, v) in sorted(bhajans2.items())]))
    
    print(f"Generated index with {len(bhajans)} bhajans")
    print(f"Output files written to {script_dir} and {PUBLIC_DIR}")

def run_merge_links():
    """Run the mergelinks.js script to add CD/sample links."""
    script_dir = get_script_dir()
    Popen(["bun", str(script_dir / "cdbaby" / "mergelinks.js")], cwd=script_dir)

def main():
    script_dir = get_script_dir()
    
    print("=" * 60)
    print("Bhajan Index Generator")
    print("=" * 60)
    
    # Step 1: Discover supplement files
    supplements = discover_supplement_files(script_dir)
    print(f"\nDiscovered {len(supplements)} supplement files: {supplements}")
    
    # Step 2: Load translation mapping
    translation_mapping = load_translation_mapping(script_dir)
    print(f"Loaded {len(translation_mapping)} translation mappings")
    
    # Step 3: Apply translations
    apply_translations(script_dir, supplements, translation_mapping)
    
    # Step 4: Merge indices
    bhajans = merge_bhajan_indices(script_dir, supplements)
    
    # Step 5: Write outputs
    write_outputs(script_dir, bhajans)
    
    # Step 6: Run mergelinks to add CD/sample data
    print("\nRunning mergelinks.js to add sample links...")
    run_merge_links()
    
    print("\nDone!")

if __name__ == "__main__":
    main()
