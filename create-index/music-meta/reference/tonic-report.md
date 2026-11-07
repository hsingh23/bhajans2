# Shruti (tonic, Sa) labels: method and evaluation

Output: `features/tonic.json` (2,434 songs; 2,346 Box recordings + 2,104 CD samples). Models:
`features/tonic_model_nohpcp.json` (Box) and `features/tonic_model_cd.json` (CD). The variants
`tonic_model.json` and `tonic_model_cd_nohpcp.json` are kept for the ablation. Scripts: `tonic_feats.py`, `tonic_cache.py`, `tonic_extract.py`, `tonic_lib.py`,
`tonic_task1.py`, `tonic_train.py`, `tonic_sheet_sa.py`, `tonic_build.py`, `tonic_validate.py`.
Evaluation files: `features/tonic_task1.json`, `tonic_eval*.json`, `tonic_validation.json`, `tonic_sheet_sa.json`.

## 1. Human labels vs recordings (task 1)

Question: when the template tonic (sheet histogram rotated against the audio) disagrees with the human
shruti label, which hypothesis holds? (a) the labels describe the CD recordings and Box is in other keys,
(b) the kattai-to-note table is off by a constant, (c) the labels are unreliable.

Data: sheet songs whose sheet really is this song (`sheet_trust` trusted / trusted-unique), whose Sa position
is high confidence (`sheet_sa`), and which have a human label, an accepted Box recording and CD samples
(220 songs). "Confident" means Box template corr >= 0.90 and margin >= 0.20, or CD sample corr >= 0.85 and
margin >= 0.15 (the CD truth thresholds; the 1-minute samples correlate less). Differences are in semitones,
taken to the nearest listed human value.

| comparison | n | exact | within ±1 | notable |
|---|---|---|---|---|
| CD sample tonic − human | 97 | 49% | 74% | +1: 17, −1: 7, ±5 (4th/5th): 5 |
| Box tonic − human | 158 | 47% | 70% | +1: 20, −1: 15, ±5: 13 |
| CD sample − Box (both confident) | 77 | 70% | 84% | |
| chained CD tonic (Box tonic − measured CD/Box shift) − human | 81 | 48% | 73% | |

Sheet-free direct test: rotate each CD sample's pitch-class histogram against its Box recording's
(all songs, no sheet needed; corr >= 0.9, margin >= 0.15; 716 of 1,525 pairs). Rotation 0 (same key) in
641/716 (90%). By Box folder:

| Box folder | n | same key as the CD sample |
|---|---|---|
| Amma Bhajans 2020 | 148 | 99% |
| Amma Bhajans 2021 | 99 | 100% |
| other albums (World Tour, Amritanjali, ...) | 425 | 90% |
| Amma Bhajans 2024 | 43 | **30%** (−1: 12, −2: 6, +1: 5) |
| Amma Bhajans 2025 UPD | 1 | (almost no CD samples) |

Independent referee: on every disagreement, Essentia's drone-based tonic (counted as Sa or as Pa, its usual
error) supports the template in 73 Box and 44 CD cases and the human label in 1 Box and 0 CD cases
(both: 9, neither: 5).

Verdict:

- **(b) is rejected.** 45 of 47 labels that give both a kattai number and a note agree with the table ("5 (G)",
  "5/G", "6 (A)", "5.5 G#", "C (1)"; the 2 exceptions are "F 4.5" and "7 A"). No constant shift fits:
  shift 0 is the mode of every table above.
- **(a) holds only for the 2024 folder.** The 2020/2021 Box files are the CD recordings (99–100% same key),
  and other albums match 90%. The 2024 folder contains new renditions, and 70% of them are in a different key
  from the CD sample, mostly 1–2 semitones lower. For those songs the Box recording is not what the app plays,
  so `tonic.json` labels Box and CD separately.
- **(c) explains the rest: the labels are unreliable at the semitone level.** Even where Box and CD are the
  same key, and even against the CD sample itself (the app's recording), only about half the labels are exact,
  about 74% are within a semitone, and about 5% are a 4th/5th off. The drone referee sides with the audio in
  117 of 118 one-sided cases. Errors lean upward (the recording is a semitone above the label 17 times vs 7
  below on CD). The main tab's `shrutiLive` column (30 rows, usually higher than `shrutiRecording`) shows the
  labelers knew that renditions differ, so some labels may describe another performance.
- Agreement depends on the folder. High-confidence audio labels of Box files match the human label exactly in
  75% of the 2020/21 files and 57% of other albums, but only 33–49% in the 2024 folder.
- The starting observation ("the human label disagreed with the template in 10 of 11 confident songs") came
  from the 2024 folder, because those recordings were the first to be extracted. It is mostly that folder's
  rendition effect. It is not the general disagreement rate, which is about 50%.
- Use the human labels as a weak prior. Do not use them as truth. The truth set below comes from sheet music.

## 2. Tonic estimator for recordings without sheet music (task 2)

### Truth set

- A Box recording of a sheet song counts as truth when:
  - its template match is confident: corr >= 0.90 and margin >= 0.20 (CD samples: 0.85 / 0.15);
  - `sheet_trust` is trusted or trusted-unique (the PDF really is this song);
  - `sheet_sa` confidence is high.
- Audio Sa = (template key-root pc + `sheet_sa.sa_offset`) mod 12. The offset handles pentatonic songs notated
  from another degree.
- A recording linked to several song names counts once.
- Result: 422 Box recordings (of 1,026 sheet-song recordings) and 212 CD samples (of 936).

Why these thresholds: `tonic_train.py --sanity` reports, by template confidence bin, the share of the 1,026
Box sheet-song recordings where independent cues point at the template Sa:

| template bin | n | Essentia = Sa, Pa or Ma | longest held note = Sa or Pa |
|---|---|---|---|
| corr < 0.80 | 258 | 71% | 60% |
| corr 0.80–0.85 | 115 | 90% | 79% |
| corr 0.85–0.90 | 189 | 97% | 84% |
| corr 0.90–0.95, margin < 0.20 | 18 | 83% | 67% |
| corr 0.90–0.95, margin >= 0.20 | 282 | 98% | 85% |
| corr >= 0.95, margin >= 0.20 | 162 | 97% | 83% |

The cues plateau from corr 0.85, and a small margin is a warning sign even at high corr, so the truth set uses
0.90 / 0.20. The band just below it (corr >= 0.80, margin >= 0.10, not in truth) is kept as an untrained
"harder band" test.

Sanity checks that need no ear, in the truth bins:

- H[Pa] > H[Ma] in 80% of songs.
- The sheet's last melody note is Sa in 73–80%.
- The audio's own last held note matches the sheet's last note in only 50–56%. Fade-outs and codas make the
  "song-final" cue weak, so it is a feature, not a rule.

### Features (12 candidate tonics, ranked)

For a candidate Sa k, each 12-bin profile is rotated so bin 0 = k, and the profiles are concatenated:

- H: tuning-corrected pitch-class histogram of the Melodia f0.
- L: notes held >= 0.35 s, duration-weighted.
- F: notes before pauses >= 0.5 s (phrase-final).
- E: phrase-final notes in the last 15% of the song.
- LAST: the last held note.
- LOW: the lowest sustained pitch (4th percentile).
- LOWH: a histogram of the low register.
- ESS: one-hot of Essentia's TonicIndianArtMusic.
- Two scale fits at that rotation: best of the 72 melakartas, and best of 118 janya/Hindustani scales from
  `reference/ragas.json` plus common pentatonics.
- Drone evidence (HPCP of the full band, the 40–260 Hz band, and the frames where the melody is silent) is
  computed in `tonic_cache.py` and tested as the D, P and U profiles.

Model: a conditional logit (softmax over the 12 candidates, linear score, L2), with lambda picked by CV.
Confidence = top probability after temperature scaling fitted on the out-of-fold scores.

### Held-out evaluation

5-fold StratifiedGroupKFold:

- strata = source-folder group (World Tour Albums, Amritanjali, Amma Bhajans 2024, M.A. Center, ...);
- groups = recording (Box) or the song's sample set (CD), so duplicates never straddle folds.

Leave-one-folder-out runs (train on the other folders) are reported as well.

| model (Box, 422 truth) | accuracy |
|---|---|
| Essentia TonicIndianArtMusic alone | 77.7% (83 of 94 errors are Pa-as-Sa) |
| HPCP low-band peak ("drone") alone | 34.8% |
| ranker, H only | 83.6% |
| ranker, H + Essentia | 87.9% |
| ranker, melody cues, no Essentia | 88.4% |
| **ranker, melody cues + Essentia (final Box model)** | **92.9%** |
| ranker, all cues incl. HPCP drone profiles | 92.7% |

High confidence = top probability >= 0.80. The threshold is the lowest one at which held-out accuracy is
>= 95% on truth and >= 90% on the harder band. It is chosen on the same OOF scores it is reported on, and
the truth set is the clean end of the data, so the 95% aim leaves headroom for harder songs.

- Box, all truth: 92.9% accuracy at 100% coverage. High confidence: **96.4% accuracy at 86% coverage**
  (13 errors in 364: 5 Ma-as-Sa, 4 Pa-as-Sa, 2 at −3, 1 at +3, 1 at +2). Below the threshold: 41 of 58
  correct.
- Box, harder band (n=165, corr 0.80–0.90, never trained on): 90.9% overall, **94.6% at high confidence
  with 89% coverage**.
- Leave-folder-out at high confidence:

  | held-out folder | n | coverage | accuracy |
  |---|---|---|---|
  | Amma Bhajans 2024 | 86 | 87% | 94.7% (86.0% overall) |
  | World Tour Albums | 155 | 85% | 96.2% |
  | Amritanjali | 100 | 86% | 97.7% |

- CD samples (212 truth, model with HPCP, threshold 0.90): 88.2% overall; high confidence **95.0% at 57%
  coverage** (6 errors in 121: 5 Ma-as-Sa, 1 Pa-as-Sa). Harder band (n=168): 87.5% overall, 93.7% at
  high confidence with 66% coverage.
- Choosing between the true Sa and Sa+d on held-out songs (the decision `sheet_sa` has to make):

  | d | ranker | Essentia vote |
  |---|---|---|
  | +7 (Pa) | 96.7% | 79.0% |
  | +5 (Ma) | 96.9% | 88.2% |
  | +3, +9, +10, +2 | 99.5% | 88.6–88.9% |

Error types: most errors are Pa-as-Sa or Ma-as-Sa. For a sampurna raga, the scale seen from Pa is another valid
melakarta, so only emphasis, phrase endings and the drone separate them. The ±2/±3 errors are mostly
pentatonic rotations (e.g. Mohanam vs Madhyamavati), plus a few cases where the truth itself is doubtful.
There are almost no semitone errors: the tuning correction works.

Ablations, same truth set (`tonic_eval*.json`):

- **Essentia's vote is the most valuable single cue** (+4 points over the melody alone): its Pa/Sa confusion is
  complementary to the melody's.
- **Drone / HPCP gives no measurable gain.**
  - Box: on the same 422 songs, the model without HPCP scores 92.9% and the one with HPCP 92.7%, so Box uses
    the model without HPCP. The HPCP pass for non-sheet Box files was stopped; 675 of 1,839 were done.
  - CD samples: HPCP adds 2.4 points at fixed lambda=10 (86.7% → 89.1%), but the tuned models are equal
    (88.2% with HPCP vs 88.6% without).
  - CD still uses the HPCP model because it reaches the 95% level at 57% coverage, against 43% without.
  - Profiling the frames where the melody is silent (U) helped slightly more than the low band, but nothing
    is significant at this n.

Pitch tracker: **not tested.** The truth-set errors are Pa/Ma ambiguities in songs where Melodia's histogram
already matches the sheet at r >= 0.9, so a better tracker would not fix them. A Demucs + RMVPE/CREPE pass over
2,000+ files was not feasible at the load during this run (load average 100–270 on 16 cores). The open question
is whether a vocal-only tracker raises template correlation for the ~40% of sheet songs below 0.85. Test that
on those songs first.

## 3. Output and coverage (task 3)

`features/tonic.json`: {song: {recordings: [...], human: [{raw}, {notes, pcs}]}}. Each recording is
{source, tonic_pc, note, kattai, confidence, method, alternatives, high_confidence, model, tuning_cents},
plus the following extras:

- Box recordings: `box_name` and `box_folder`.
- Method "sheet-template": `sheet_corr`, `sheet_margin`, `sheet_sa_offset`, `sheet_sa_confidence`,
  `audio_model_agrees`.
- Audio-model recordings of sheet songs: `sheet_template_top`.

CD samples are listed in the same `recordings` list, keyed by `source: "cd:<url>"`. Task 1 shows they matter:
in the 2024 folder the CD sample and the Box recording differ in key 70% of the time, and the CD sample is the
recording the app plays.

- **method "sheet-template"** applies when the sheet is not a `sheet_trust` mismatch, the template match is
  confident, and the Sa position is not low confidence:
  - confidence 0.90–0.99, scaled by corr and margin. This value is a heuristic, not a calibrated
    probability, so do not compare it directly with audio-model confidences, which are temperature-calibrated
    on held-out scores;
  - 0.75 when `sheet_sa` is only medium; such a recording counts as high confidence only if the audio model
    agrees.
  - The Sa position comes from `features/tonic_sheet_sa.json`. That file keeps the `sheet_sa.py` decision
    when it is high confidence. Otherwise the audio model chooses among `sa_candidates` on the Box recording
    when it gives one of them >= 75% of the pair's probability. The ranker beats the Essentia tie-break,
    see the table above.
- **method "audio-model"** applies to everything else: confidence = calibrated top probability, alternatives =
  the next three candidates with probabilities.

Coverage (all 2,346 accepted Box recordings from `box-matches-verified.json` have features; none missing):

| source | recordings | sheet-template | high confidence |
|---|---|---|---|
| Box | 2,346 | 453 | 2,073 (88%) |
| CD samples | 2,104 | 276 | 1,278 (61%) |

Two CD samples have too little voiced pitch and get method "none".

Box high-confidence share by folder: World Tour 90%, 2020 86%, **2025 UPD 87%** (346 recordings, only 2 with
a usable sheet), Amritanjali 90%, 2021 84%, 2024 92%.

`tonic_validate.py` reports the harder band again: n=168, 90.5% overall, 94.0% at high confidence. That is
3 more songs than the training script's n=165, because it does not merge recordings shared by several song
names.

Consistency check on songs without sheet music (`tonic_validate.py`):

- Where a CD sample's histogram matches its Box recording at a confident rotation r, the two independent
  audio-model predictions differ by exactly r in 86% of 363 pairs.
- When both are high confidence: **99.0% of 194 pairs**.
- Errors on one song are correlated (the same Pa/Sa trap), so this is an upper bound on accuracy, but it
  covers the no-sheet population the model is meant for.

Human agreement of the final output (`tonic_validate.py`), exact / within ±1:

| source | method | confidence | n | exact | within ±1 |
|---|---|---|---|---|---|
| Box | audio-model | high | 494 | 61% | 79% |
| Box | sheet-template | high | 198 | 44% | 65% |
| CD | audio-model | high | 390 | 55% | 75% |
| CD | sheet-template | high | 133 | 49% | 72% |

Low-confidence output agrees 40% exact, and 18–27% of it is a 4th/5th off, so the confidence flag separates
the two groups. The sheet-template rows agree less mainly because sheet songs are newer: the 2024 folder has
a label match of only 33%. See section 1.

Possible next step, not done: when a CD sample and its Box recording are in a confidently known relative key,
multiply their candidate probabilities into one joint estimate.

## 4. Known failure cases

- **Pa-as-Sa / Ma-as-Sa** in sampurna ragas with weak phrase endings, about 2–3% of high-confidence output.
  Examples from the held-out set: "jis hal me" (E, predicted A), "kanna karimukil varnna" (F, predicted C),
  "nila nila megha varnna" (F#, predicted B).
- **Pentatonic rotations** (Mohanam / Madhyamavati / Shuddha Saveri / Hindolam, Shivaranjani / Revati). The
  same scale set serves several Sa. The adjudication notes (`reference/raga-adjudication.md`) say the final note
  and the drone decide these. The model has those cues but can still be confidently wrong
  (e.g. "murali krsna mukunda", +3).
- **CD samples** are about 60 s, often cut mid-phrase, so the ending cues are missing. Coverage is lower (61%)
  for that reason.
- **Medleys / ragamalika and songs that modulate:** one tonic per recording is assumed.
- **Truth bias:** truth songs are clean template matches. The harder band (94.6% at high confidence) is the
  better guide for songs without sheet music. The 2025 UPD folder (346 recordings, the largest Box folder)
  has almost no sheet music or CD samples, so it has no direct check. Its leave-folder-out number is
  inferred from the other folders (94.7–97.7%).
- **Sheets:** sheets linked to the wrong song (`sheet_trust` mismatch) are ignored. "Unverified" sheets are
  used only when the template match itself is confident, which effectively verifies them.

## Reproduce

```
python tonic_cache.py cd 6                     # CD-sample features (download, analyse, delete audio)
python tonic_extract.py <ids> 6 --no-hpcp      # any accepted Box ids still lacking features/audio
python sheet_trust.py; python sheet_sa.py      # sheet checks (other workers' scripts; need the audio features)
python tonic_train.py --nohpcp                 # Box model  -> features/tonic_model_nohpcp.json, tonic_eval_nohpcp.json
python tonic_train.py --cd                     # CD model   -> features/tonic_model_cd.json, tonic_eval_cd.json
python tonic_sheet_sa.py                       # model tie-break of the sheet Sa position
python tonic_task1.py                          # task 1 tables -> features/tonic_task1.json
python tonic_build.py                          # -> features/tonic.json
python tonic_validate.py                       # -> features/tonic_validation.json
```
