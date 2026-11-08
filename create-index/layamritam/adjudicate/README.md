# Adjudicating Layamritam disagreements

Produces `decisions.csv` (one row per `../metadata-review.csv` row: decision, P(right), band,
cause, evidence) for `../disagreement-report.md`. Run from the repo root, in order:

```bash
uv run --with rapidfuzz python create-index/layamritam/adjudicate/build_rows.py   # rows.json
python3 create-index/layamritam/adjudicate/make_packets.py                        # blind rater packets
# raters: one agent per packet and model, following packets/RUBRIC.md -> packets/out_<model>_<k>.jsonl
python3 create-index/layamritam/adjudicate/score_ld.py && python3 create-index/layamritam/adjudicate/tally_ld.py
create-index/music-meta/.venv/bin/python create-index/layamritam/adjudicate/taal_lay.py   # needs layamritam/audio
python3 create-index/layamritam/adjudicate/taal_lines.py
python3 create-index/layamritam/adjudicate/raga_fit.py && python3 create-index/layamritam/adjudicate/raga_calib.py
python3 create-index/layamritam/adjudicate/raga_verdict.py
python3 create-index/layamritam/adjudicate/dup_audio.py
python3 create-index/layamritam/adjudicate/adjudicate.py                          # decisions.csv
python3 create-index/layamritam/adjudicate/apply_decisions.py                     # apply the high-confidence rows
create-index/music-meta/.venv/bin/python create-index/music-meta/build_music_json.py --write
```

`apply_decisions.py` changes a label only where the decision's P(right) is at least 0.9, adds second
tags (`lg2`, `d2`) to mixed songs, applies the Amma rule, writes taal and raga changes to
`../music-overrides.json` (which `build_music_json.py` applies last) and marks merged duplicates
`"mergedInto"` in `../extra-manifest.json` (which `merge_metadata.py` honours). It is idempotent.

`lay_notes.json` (Layamritam's language notes) was built inline; see the report. The intermediate
`*.json` files are gitignored (some quote Layamritam's notes); `amma_named.json` is kept so
`apply_decisions.py` runs without the local dump. `work/` holds
transcoded Layamritam audio and beat caches (local only, large) and `human_taal_sheet.json`
(a copy of the user's "taal and bols" sheet). The scripts that run from this folder (`score_ld.py`, `tally_ld.py`,
`taal_lines.py`, `adjudicate.py`) expect it as the working directory.
