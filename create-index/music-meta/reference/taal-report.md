# Taal (beat-cycle) and tempo from audio: report (2026-11-07)

Output: `features/taal.json` (2,420 songs). Evaluation dump: `features/taal_eval.json`.
Code: `taal_extract.py` (audio → rhythm cache), `taal_features.py` (cache → feature vector), `taal_model.py` (`cv` | `final`).
This step does not map classes to taal names or bols; another step does that from `reference/taals.json`.

## Result in one paragraph
On held-out folders, the audio classifier gets the beat-cycle class right for **97.5%** of trusted sheet-music songs (593 recordings). At confidence ≥ 0.8 it is **99.1%** correct and covers 95% of songs. The weak spot is 6/8 versus 3/4: the 5-way meter accuracy is 94.1%, and 6/8 is recognised 84% of the time. This accuracy does **not** carry over to the Amma Bhajans 2020, 2021 and 2025 sets. Those sets hold 891 of the 1,324 songs that have no sheet music, and there the audio agrees with the (unverified) sheet meters only 52% of the time. Audio-only labels in those folders are therefore never marked high-confidence. Overall, 403 of 1,324 audio-only songs and 960 of 1,022 sheet+audio songs are high-confidence. Against the 81 noisy human labels, agreement is: final 63/71 (0.89), sheet alone 57/63 (0.90), audio alone 59/69 (0.86).

## Labels
- **Classes.** `beats_class` 8 covers 4/4 and 2/4 (keherwa/adi family). 6 covers 3/4 and 6/8 (dadra/rupakam). 7 covers 7/8 and 7/4. 5 covers 5/8 and 5/4. The model itself predicts the finer meter group {4, 3, 68, 7, 5}, so that it can tell 3/4 from 6/8, and sums the probabilities up to the class level.
- **Ground truth** is the sheet meter (`features/sheet_meter.json`).
  - Only sheets that `features/sheet_trust.json` marks `trusted` or `trusted-unique` are used for training and evaluation. Trusted means the sheet melody fits the song's own recording.
  - Songs whose meters span more than one class are excluded (47 songs, flagged `sheet_meter_changes_class`). A song that changes meter within one class, such as 4/4↔2/4 or 3/4↔6/8, keeps its dominant meter.
  - Each recording is counted once.
  - Recordings come from `box-matches-verified.json`.
- The trust filter matters a great deal. Before it, with 314 recordings that included links pointing at other songs' PDFs, out-of-fold accuracy was 85%. After it, accuracy is 96–97%. Most "errors" had been wrong labels.
- **Training set:** 593 recordings (4/4: 333, 3/4: 132, 6/8: 76, 7: 28, 5: 24).

## Features (all relative to the Beat This! beat period T)
`taal_extract.py` runs Beat This! (final0, MPS) on 22.05 kHz audio. It stores:
- frame beat and downbeat logits at 50 fps;
- "minimal" beats and downbeats;
- librosa onset strength at 86 fps, both mean-over-mel and median-over-mel (the median version favours percussive onsets);
- beat-synchronous chroma and MFCC.

`taal_features.py` computes 199 features:
- **Tempo:** bpm, IBI spread.
- **Beat This!'s own bar lengths:** the fraction of 2-, 3- and 4-beat bars. It is weak on its own, as expected.
- **Per-beat accent sequences** (downbeat activation, onset, percussive onset, beat activation): autocorrelation at lags of 1–16 beats, plus windowed "fold contrast" for cycles of 2–8 beats.
- **Harmonic and timbral repetition:** cosine similarity of beat-synchronous chroma and MFCC at lags of 1–16 beats.
- **Subdivision:** the mean onset profile inside 1, 2 and 3 beats, sampled at 1/4, 1/3, 1/2, 2/3 and 3/4 of the beat, from which triplet and duple scores are derived.
- **Windowed onset and downbeat-envelope autocorrelation** at T × {1/4, 1/3, 1/2, 2/3, 3/4, 1, 3/2, 2…8}.

The classifier averages HistGradientBoosting and an L2 logistic regression, both with balanced class weights. Gradient boosting alone, logistic regression alone, a version without tempo features and a version with the class prior corrected all scored within ±0.7 points of each other.

## Held-out accuracy (5-fold StratifiedGroupKFold, grouped by Box source folder, out-of-fold)
Beats class, accuracy 0.975:

| true \ pred | 8 | 6 | 7 | 5 | n | acc |
|---|---|---|---|---|---|---|
| 8 | 327 | 3 | 2 | 1 | 333 | 0.98 |
| 6 | 4 | 202 | 2 | 0 | 208 | 0.97 |
| 7 | 2 | 0 | 26 | 0 | 28 | 0.93 |
| 5 | 0 | 1 | 0 | 23 | 24 | 0.96 |

Meter group, accuracy 0.941. The main confusion is 3/4 ↔ 6/8:

| true \ pred | 4 | 3 | 68 | 7 | 5 | n | acc |
|---|---|---|---|---|---|---|---|
| 4/4 | 327 | 1 | 2 | 2 | 1 | 333 | 0.98 |
| 3/4 | 2 | 118 | 11 | 1 | 0 | 132 | 0.89 |
| 6/8 | 3 | 8 | 64 | 1 | 0 | 76 | 0.84 |
| 7 | 2 | 0 | 0 | 26 | 0 | 28 | 0.93 |
| 5 | 0 | 0 | 1 | 0 | 23 | 24 | 0.96 |

Confidence against coverage (out-of-fold, beats class):

| threshold | coverage | accuracy |
|---|---|---|
| ≥ 0.6 | 97% | 98.8% |
| ≥ 0.7 | 97% | 99.0% |
| ≥ 0.8 | 95% | 99.1% |
| ≥ 0.9 | 90% | 99.1% |

High-confidence is set at 0.8 for audio-only songs. The largest folder (Amma Bhajans 2024, n = 109, always held out as a block) scores 98.2%; all other folders score 97.3%.

### Domain shift: important
- Almost all trusted training songs come from Amma Bhajans 2024, Amritanjali, World Tours and devotee albums.
- The Amma Bhajans 2020, 2021 and 2025 sets have 6 trusted songs in total, and 4 of them are predicted correctly.
- The model was never trained on `unverified` sheets, so they serve as a second, noisy test set (366 songs):
  - Outside the 2020/2021/2025 sets, audio agrees with the unverified sheet 92% of the time. Most disagreements there involve PDFs shared with other songs.
  - Inside those sets, it agrees only 52% of the time (59 songs), and the disagreements are no more common on shared PDFs.
  - So the audio model is probably weaker on these newer recordings. A likely cause is a different production style, and the classes 5 and 7 are predicted twice as often there.
- What the output does about it, for songs in those folders:
  - The audio posterior is flattened (p^0.35) before it is combined with any sheet prior.
  - Audio-only labels are never `high_confidence`.
  - Every such song carries the flag `audio_model_unvalidated_for_this_folder` (960 songs).
- A few hundred trusted labels from those sets (sheet checks or human taps) would fix this.

## Agreement with the 81 human `taal_beats` labels (rubric.json; noisy; a hit = class in the human list)
- Final label: 63/71 = 0.89. Sheet meter alone: 57/63 = 0.90. Audio alone: 59/69 = 0.86. Audio on songs with no sheet: 5/8.
- The human labels contain no song from the 2020/2021/2025 sets.
- Disagreements, as human → audio: 8→6 (4 cases), 6→8 (3), 7→8, 8→7 and 7→6 (1 each).
- In several of those cases the audio agrees with a trusted sheet and the human label is the odd one out. For example, "avo mere nandalal" is 3/4 on a trusted sheet, the human says 8, and audio says 6. "dao dao dao more" is 4/4 on a trusted sheet, the human says 6, and audio says 8. So the human list is about as noisy as the sheets: the sheet agrees with it 90% of the time.

## Tempo and pulse (what a musician claps)
These figures were measured on trusted songs.
- **4/4:** Beat This! tracks the quarter note, with a median of 130 BPM and 10–90% between 100 and 158.
- **3/4:** also the quarter, median 125.
- **6/8:** it tracks the **eighth**, median 143 BPM. The beats group in threes and the profile inside each beat is duple.
- **7/8 and 5/8:** the eighth, around 165–190.

The `taal.json` fields follow from that:
- `bpm` + `pulse`:
  - 8: quarter BPM. If the tracker runs above 180 BPM, it is assumed to be on eighths and the value is halved (20 songs).
  - 6 in 3/4: quarter BPM.
  - **6 in 6/8: dotted-quarter BPM = tracked BPM / 3** (median 48 BPM; `tracked: "eighth"`). Only a tracker below 100 BPM is taken as already on the dotted quarter.
  - 7 and 5: eighth BPM, or quarter when the sheet says 7/4 or 5/4.
- `subdivision`: 3 for 6/8; 2 for 3/4, 7 and 5; for 4/4 it is 3 only when the in-beat triplet score is above 0.15. That applies to 112 songs and is unvalidated, since no labels exist for swung keherwa.
- `cycle_beat_bpm`: the rate of the counted beat in the beats_class cycle (quarter for 8 and for 3/4-6, eighth for 6/8-6, 7 and 5). The taal-mapping step can use it as the matra rate.
- `beat_tracker_bpm`, `tracked`: the raw tracker rate and the metric level it was judged to be on.
- Tempo has no ground truth. Octave errors (×2 or ÷2) are likely for a few percent of songs.

## How sheet and audio are combined (`features/taal.json`)
- The posterior over the five meter groups is the sheet prior × the audio probabilities.
  - The sheet prior puts 0.92 on the sheet meter(s) for `trusted` sheets and 0.6 for `unverified` ones.
  - A `mismatch` sheet is treated as no sheet at all.
  - For sheet songs, the audio probabilities are the out-of-fold ones (`audio_pred_is_held_out`), so a song never confirms its own label.
- `source` is `sheet+audio` (1,022 songs), `audio` (1,324) or `sheet` (74; these are sheet songs with no accepted recording, and they also carry `no_accepted_recording: true`).
- `high_confidence`:
  - sheet songs: combined confidence ≥ 0.9;
  - audio-only songs: audio confidence ≥ 0.8, and the song is outside the unvalidated folders.
- Flags:
  - `audio_disagrees_with_sheet_strongly` (49): the audio is ≥ 0.8 confident in another class. In total the final class follows the audio instead of the sheet for 6 trusted and 48 unverified sheet songs.
  - `audio_disagrees_with_sheet` (29): weaker disagreement.
  - `sheet_meter_changes_class` (47).
  - `audio_model_unvalidated_for_this_folder` (960).
- Other fields: `sheet_meter`, `sheet_trust`, `audio_pred` {beats_class, confidence, probs, meter_group}, `alternatives` (other classes with p ≥ 0.05) and `box_id`.
- Class totals: 8: 1,260; 6: 908; 5: 136; 7: 116. The 6 class splits into 569 at quarter pulse and 339 at dotted-quarter (6/8) pulse.

## Failure cases (held-out errors on trusted sheets; 15 of 593)
- **Confident errors (≥ 0.9). Either the sheet and recording disagree or the arrangement differs:**
  - "krsna krsna mukunda": 4/4 sheet, audio 6/8 at 0.99.
  - "saranam saranam bhagavane": 4/4 sheet, audio 3/4 at 0.99.
  - "amba paramesvari": 7/8 sheet, audio 4/4 at 0.98.
  - "anandamrta rupini amme": 3/4 sheet, audio 4/4 at 0.94, with the tracker at 200 BPM.
  - "palmanam maratta paital alle amme": 3/4 sheet, audio 7 at 0.94; this one is from the 2025 set.
  - These are worth a listen. Some are probably sheet errors.
- **Low-confidence errors (0.5–0.8):** mostly 6/8 ↔ 4/4 or 7, and 5/7 against 4/4 at fast tempos ("mohalu champpara", "ramacandra maha prabho", "chamundhaye kali ma").
- **Systematic weaknesses:**
  - 6/8 against 3/4: 16% of 6/8 is missed. A 6/8 tracked on eighths and a 3/4 tracked on quarters look alike, apart from tempo and the 6-beat repetition.
  - 7 and 5 rely partly on fast tracker tempos.
  - Recordings with long free-rhythm (alap-like) intros dilute the features.
  - Beat This! downbeats are not used directly. On a typical (median) song, only 39% of its bars in 4/4 songs are 4 beats long, and only 37% of its bars in 3/4 songs are 3 beats long.

## Re-running
```
.venv/bin/python taal_extract.py 3 mps   # new audio only; ~1.2-3 s/song with 3 workers
.venv/bin/python sheet_trust.py          # refresh sheet trust as audio features land
.venv/bin/python taal_model.py final     # CV report + features/taal.json + features/taal_eval.json
```
The feature table is cached in `features/taal_cache/_feats.pkl`, keyed by file mtime and feature version.
