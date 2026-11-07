# Musician metadata pipeline

Builds `public/bhajan-music.json` and `public/music-reference.json` (shruti, raga,
taal, chords and a plain-English summary per song) for the app's musician mode.
Contract: `reference/music-data-spec.md`. Python 3.11 env:
`uv venv .venv && uv pip install --python .venv/bin/python essentia librosa soundfile rapidfuzz numpy beat-this`.

Data that is large or private stays out of git (see `.gitignore`): cached audio,
extracted features, model-rater outputs and the export of the shruti spreadsheet.

## Stages

| Stage | Script(s) | Output |
|---|---|---|
| Map Box | `../box/crawl_box.py` (needs `BOX_SHARED_NAME`) | `../box/box-inventory.json` |
| Match songs to recordings | `match_box.py`, then `rematch.py` / `build_verified.py` | `box-matches-verified.json` |
| Cache audio (24 kHz mono Opus) | `cache_audio.py` | `audio/` |
| Audio features (Melodia f0, tonic, beats) | `extract_audio.py` | `features/audio/` |
| Sheet music notes, keys, chords, meter | `sheet_features.py`, then `sheet_meter.py` (it reads `features/sheet.json`, so not in parallel) | `features/sheet*.json` |
| Is a sheet really this song? | `sheet_trust.py` | `features/sheet_trust.json` |
| Where Sa sits in a sheet | `sheet_sa.py`, `tonic_sheet_sa.py` | `features/tonic_sheet_sa.json` |
| Shruti model | `tonic_*.py` (see `reference/tonic-report.md`) | `features/tonic.json` |
| Taal model | `taal_*.py` (see `reference/taal-report.md`) | `features/taal.json` |
| Raga evidence + model labelling | `raga_candidates.py`, `raga_llm.py packs --hinted`, Opus raters | `work/raga/full/out_*.jsonl` |
| Scoring against the answer key | `build_rubric.py`, `build_raga_gold.py`, `score_raga.py` | stats |
| Assemble the app files | `build_music_json.py --write --out ../../public` | `public/*.json` |

## Measured accuracy (held out)

- Shruti: 92.9% overall, 96.4% on the 86% marked high confidence (Essentia alone 77.7%).
- Taal beat cycle (8/6/7/5): 97.5% overall, 99.1% on the 95% marked high confidence;
  weaker on the 2020/2021/2025 albums, which are never marked high confidence from audio alone.
- Raga: names agree 96% (scale 100%) with a blind second rater on high-confidence answers,
  about 70% on medium. The app states a raga plainly only at confidence >= 0.85 and shows
  "≈ / close to" otherwise.
