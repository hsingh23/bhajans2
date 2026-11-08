"""Melody facts from each song's sheet music, in semitones from Sa: the vocal
range, the first note sung, and the key root the arrangement is written in.

    python3 vocal_range.py                # writes features/vocal_range.json
    python3 vocal_range.py --check-audio  # compares recording-based ranges with the sheets

Only sheets trusted for the song (sheet_trust.json) with a confident Sa
(tonic_sheet_sa.json) are used. sheet.json keeps notes relative to the PDF's
key root; Sa sits sa_offset semitones above it. Sa's octave is the one that best fits the melody
in the usual bhajan span, lower Pa to upper Sa (median between lower and middle
Dha breaks ties).

Recordings were tried and rejected (Nov 2026). Essentia's predominant melody
(features/audio/*.npz) also follows harmonium and flute lines, so on 676
songs with both, the recording's range matched the sheet's within 2
semitones at both ends for only ~29%, whatever the percentile or note-share
threshold. That also rules out measuring an alap
(the free-time opening before the tabla) from these pitch tracks; it needs
the voice separated from the instruments first. --check-audio reproduces this.
"""
import json
import math
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).parent
FEAT = HERE / "features"
MEDIAN_WINDOW = (-3, 9)
TYPICAL = (-5, 12)  # lower Pa .. upper Sa
TRUSTED = ("trusted", "trusted-unique")
SURE_SA = ("high", "high-model", "medium")


def sa_ref(midi, sa_pc):
    """MIDI note of the Sa whose octave puts the melody's median in MEDIAN_WINDOW."""
    med = float(np.median(midi))
    base = sa_pc + 12 * math.floor((med - sa_pc) / 12)
    while med - base >= MEDIAN_WINDOW[1]:
        base += 12
    while med - base < MEDIAN_WINDOW[0]:
        base -= 12
    return base


def sheet_facts(s, sa_offset=0):
    """{range: [lowest, highest], start, key: {o, m}} in semitones from Sa, or None for a thin sheet.

    start is the first written note; key.o is the key root (0-11 above Sa) and
    key.m whether the sheet is in a minor key.

    sheet.json stores notes relative to the PDF's key root (MIDI minus its pitch
    class), so in note space the key root is pitch class 0 and Sa is sa_offset.
    """
    notes = s.get("notes") or []
    if len(notes) < 20:
        return None
    lo, hi = min(notes), max(notes)
    ref = sa_ref(np.asarray(notes, float), sa_offset % 12)
    # Of the Sa octaves near the median, take the one that best fits the range in
    # the usual bhajan span (lower Pa .. upper Sa); ties keep the median's choice.
    ref = min((ref, ref + 12, ref - 12), key=lambda r: max(0, TYPICAL[0] - (lo - r)) + max(0, (hi - r) - TYPICAL[1]))
    return {
        "range": [int(lo - ref), int(hi - ref)],
        "start": int(notes[0] - ref),
        "key": {"o": (-sa_offset) % 12, "m": bool(s.get("minor"))},
    }


def sheet_ranges():
    sheet = json.loads((FEAT / "sheet.json").read_text())
    sa_over = json.loads((FEAT / "tonic_sheet_sa.json").read_text())
    trust = json.loads((FEAT / "sheet_trust.json").read_text())
    out = {}
    for name, s in sheet.items():
        sa = sa_over.get(name) or {}
        if "error" in s or trust.get(name, {}).get("trust") not in TRUSTED or sa.get("confidence") not in SURE_SA:
            continue
        facts = sheet_facts(s, sa.get("sa_offset", 0))
        if facts:
            out[name] = facts
    return out


def check_audio(ranges):
    """How far a recording's melody range is from the sheet's (see the module notes)."""
    tonic = json.loads((FEAT / "tonic.json").read_text())
    lo, hi = [], []
    for name, facts in ranges.items():
        rng = facts["range"]
        rec = next((r for r in (tonic.get(name) or {}).get("recordings", [])
                    if r["source"].startswith("box:") and r.get("tonic_pc") is not None), None)
        npz = rec and FEAT / "audio" / f"{rec['source'][4:]}.npz"
        if not npz or not npz.exists():
            continue
        f0 = np.load(npz)["f0"].astype(float)
        midi = 69 + 12 * np.log2(f0[f0 > 0] / 440.0)
        rel = np.round(midi - sa_ref(midi, rec["tonic_pc"])).astype(int)
        vals, counts = np.unique(rel, return_counts=True)
        kept = vals[counts / len(rel) >= 0.02]
        lo.append(kept.min() - rng[0])
        hi.append(kept.max() - rng[1])
    lo, hi = np.array(lo), np.array(hi)
    both = np.mean((abs(lo) <= 2) & (abs(hi) <= 2))
    print(f"recording vs sheet on {len(lo)} songs: both ends within 2 semitones {both:.0%}")


def main():
    ranges = sheet_ranges()
    spans = [f["range"][1] - f["range"][0] for f in ranges.values()]
    print(f"{len(ranges)} sheet ranges; span 10/50/90th percentile {np.percentile(spans, [10, 50, 90]).tolist()}")
    if "--check-audio" in sys.argv:
        check_audio(ranges)
        return
    (FEAT / "vocal_range.json").write_text(json.dumps(ranges, indent=0))
    print("wrote features/vocal_range.json")


if __name__ == "__main__":
    main()
