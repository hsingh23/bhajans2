# Bhajan shruti / raga / taal extraction: what exists (verified 2026-11-07)

Platform checks (Python 3.11, arm64, `pip --dry-run`): `essentia` and `essentia-tensorflow` 2.1b6.dev1389 have cp311 macOS-15 arm64 wheels. `compiam` 0.4.1 (Nov 2024, py3.9–3.11), `beat-this` 1.1.0, `demucs` 4.1.0, `audio-separator` 0.48.0, `torchcrepe` 0.0.24, `penn`, `pesto-pitch`, `librosa` 0.11, `mirdata` 1.0.0 and `BeatNet` all resolve. **`madmom` 0.16.1 fails to build on py3.11**, so it needs `pip install git+https://github.com/CPJKU/madmom`, and BeatNet depends on it. Use `torchcrepe`: the `crepe` dry run resolved to a placeholder 0.0.0 wheel. facebookresearch/demucs is archived; adefossez/demucs is still maintained.

## 1. Tonic (Sa)
| Tool | Install | Accuracy | Pitfalls |
|---|---|---|---|
| Essentia `TonicIndianArtMusic` (Salamon/Gulati multipitch + decision tree) | `pip install essentia` | ISMIR 2012 paper (364 excerpts, 3 min each): **93% overall** (Hindustani 98%, Carnatic 90%, male 95%, female 88%), counting the correct octave | Relies on the **drone's** Sa/Pa peaks. Its most common errors are picking upper Pa/Ma (male singers) or lower Pa/Ma (female). The Carnatic drop is blamed on a weak tanpura. Default range is 100–375 Hz. Throws if no peak falls in range. |
| compiam wrapper of the same | `pip install compiam` | same | — |
| SPD_KNN tonic model (Narasinh & Raja, AIMC 2023) | Google-Drive weights, py3.7 | none reported | The README itself says "the tonic detection model is not so great" |

- Gulati et al. 2014 (JNMR) reports about 90% on average across 6 datasets. That figure comes from the abstract; I could not open the full text.
- I found no newer deep-learning tonic model with downloadable weights.
- My inference, not tested: bhajans backed by harmonium or keyboard with no tanpura lose the drone cue, so expect more Pa/Ma errors. The octave doesn't matter for our use, because shruti only needs the pitch class.
- Sources: https://archives.ismir.net/ismir2012/paper/000499.pdf, https://essentia.upf.edu/reference/std_TonicIndianArtMusic.html, https://compmusic.upf.edu/node/323, https://github.com/VishwaasHegde/SPD_KNN

## 2. Vocal pitch tracking
| Tool | Install | Accuracy |
|---|---|---|
| **RMVPE** (Wei et al., Interspeech 2023) | git only: https://github.com/Dream-High/RMVPE | Raw pitch accuracy on polyphonic music: 95.4 (MIR-1K), 89.3 (MIR_ST500), 83.6 (Cmedia). The baselines were run as "Spleeter, then tracker": CREPE scored 91.1 / 81.6 / 74.6 and pYIN 77.3 / 63.9 / 59.7 |
| **FTA-Net Carnatic** (compiam `melody:ftanet-carnatic`, weights on Zenodo) | `pip install compiam` | On SCMS test: RPA 90.2 / OA 91.0, against Melodia at 77.5 / 77.1 |
| Melodia | essentia `PredominantPitchMelodia` | baseline above |
| torchcrepe / pYIN | `torchcrepe`, `librosa` | need clean vocals |

Does separating vocals first help? The evidence is partial. In the RMVPE paper, Spleeter-then-CREPE still loses to a model trained on mixtures. The FTA-Net paper says Spleeter alone is "not sufficient." Practical points:
- Run Demucs `htdemucs` (or `audio-separator` with a RoFormer model) before CREPE or pYIN.
- **Run tonic detection on the full mix or the accompaniment stem, never on separated vocals**, because separation removes the drone the tonic method depends on.
- Sources: https://arxiv.org/abs/2306.15412, https://transactions.ismir.net/articles/10.5334/tismir.137

## 3. Raga
| Method | Accuracy (classical benchmarks) | Usable? |
|---|---|---|
| TDMS (Gulati 2016), kNN on time-delayed pitch surfaces | 98% (Hindustani, 30 ragas), 87% (Carnatic, 40 ragas), per the CompMusic companion page | Recipe only; easy to reimplement |
| DeepSRGM (LSTM) | 88.1% (40 ragas), 97% (10 ragas) | compiam `melody:deepsrgm`, but the checkpoint covers **only 10 ragas**, of which only Mohanam overlaps our top labels. The tutorial pins `torch==1.8.0`, which is a dependency hazard. |
| SPD-KNN (AIMC 2023) | 99% Hindustani / 88.1% Carnatic (from a search snippet) | Weights on Google Drive, py3.7 |
| Singh & Arora 2024/25 (CNN-LSTM, 191 h, 12 ragas) | F1 0.89 | no code |
| ChordNatic (iOS/Mac app) | none published | GUI only |

- No study measures raga accuracy on light, devotional or film music. The closest proxy is pitch-class-distribution work (Chordia & Rae), which drops from 99% on studio recordings to 78% on live ones; that comes from a secondary survey.
- No published tool segments a ragamalika or a song that changes raga.
- LLM-in-the-loop (pitch-class histogram plus a swara sequence in text, and the model names the raga): I found no paper on this. The nearest items:
  - a June 2026 text-only theory benchmark where Gemini 2.5 Pro scored about 91% (https://arxiv.org/html/2606.05522v1);
  - RagaLakshanaLLM (Llama-3.2-3B trained on 35 instruction pairs, no evaluation).
  - So the approach is novel and needs to be checked against our own labels.
- Sources: https://compmusic.upf.edu/node/300, https://arxiv.org/abs/2402.10168, https://mtg.github.io/IAM-tutorial-ismir22/melodic_analysis/raga-recognition.html, https://arxiv.org/abs/2406.02443

## 4. Taal, tempo and sam
- Srinivasamurthy et al., ISMIR 2017, using a Bayesian bar-pointer model with a particle filter:
  - Taal recognition from audio alone: **68%** on Carnatic (4 talas), **63%** on Hindustani medium/fast tempo, **27%** on vilambit.
  - Sam (cycle start) F-measure is **0.51** with no prior information, rising to 0.82 when the tempo and one sam are given. Ballroom 3/4 vs 4/4 reaches 89%.
  - Code is MATLAB, available on request.
- Beat This! (ISMIR 2024, `pip install beat-this`, MIT, CPU OK). On Carnatic (CMRf, arXiv 2509.11241):
  - off the shelf, beat F 71.3 and sam F **27.6**;
  - **fine-tuned, 90.3 / 66.8**.
  - The fine-tuned model ships as compiam `rhythm:beat-this-carnatic` with weights on Zenodo, but only on **GitHub master (Oct 2026)**, not in PyPI 0.4.1. Install with `pip install git+https://github.com/MTG/compIAM`.
  - Per-tala sam F for the fine-tuned model: adi 49.3, rupakam 81.6, misra chapu 72.8, khanda chapu 61.1.
- Keherwa vs dadra: **no published numbers**. The rhythm datasets cover teental, ektal, jhaptaal and rupak only. The papers I found that classify tabla taals (IJRITCC; Kodag & Arora 2025) give no per-taal figures.
- Pitfall: Western-trained trackers put a "bar" every 4 beats, so one keherwa cycle (8 beats) shows up as 2 bars, and dadra (6) shows up as two 3/4 bars. This doubling is my own reasoning, not something the sources measure. Theka bols are not extractable reliably; take them from a lookup table once the taal is known.
- Sources: https://archives.ismir.net/ismir2017/paper/000093.pdf, https://arxiv.org/html/2509.11241, https://github.com/CPJKU/beat_this

## 5. Ready-made tools
- **Offline in Python on Apple Silicon:** essentia, compiam, beat-this, demucs/audio-separator, torchcrepe, librosa, and mirdata (which has loaders for Saraga and the CompMusic datasets).
- **madmom/BeatNet:** install from git.
- **"Raga Tantra" / "Swaraag":** I could not find either.
- **Apps** (no API, no published accuracy): Soham Raag Identifier, ChordNatic, Riyaz, and iTabla/tanpura apps, which are practice tools.

## 6. Test anchors
- **Saraga Carnatic** (249 tracks) and **Saraga Hindustani** (108): freely downloadable via mirdata, with tonic, raga, tala and sam annotations (CC BY-NC-SA). https://mtg.github.io/saraga
- CompMusic Indian Tonic (2,150 tracks), Raga (780), and Carnatic/Hindustani Rhythm (176/151): audio on request; annotations for Tonic and Raga are free.
- I found no public bhajan dataset.

## Recommended pipeline
1. **Measure Essentia tonic against our 828 shruti labels first.** It is the cheapest and most useful experiment. Score by pitch class and log Pa/Ma confusions; this calibrates everything that follows.
2. Separate with htdemucs, then track the vocal stem with RMVPE (or FTA-Net Carnatic), then convert to cents relative to the tonic.
3. Raga:
   - compute a 12-tone (or 120-bin) histogram per song and per 20–30 s window;
   - match it with kNN/TDMS against our own 285 raga labels plus Saraga, with a lookup table for aroha/avaroha and Western scale;
   - flag windows whose histograms differ for ragamalika review;
   - optionally pass the histogram and the top-3 kNN candidates to an LLM as a tie-breaker, and measure whether that helps.
4. Taal:
   - run Beat This! for beats and downbeats; use the Carnatic fine-tune for Carnatic songs;
   - get BPM from the median inter-beat interval;
   - infer the cycle length from autocorrelation of the onset envelope at the beat level (8 / 6 / 7 / 5 / 10 / 16), resolving the doubling with our 81 taal labels;
   - send low-confidence songs to a human.

## Ground truth for Amma's bhajans
- **The local data is the best source:**
  - `/Users/hisingh1/projects/bhajans2/create-index/music-meta/rubric.json`: 885 songs, of which 828 have shruti, 285 have a raga and 81 have a taal beat count (8: 53, 6: 27, 7: 6, 5: 1).
  - It is built from `/Users/hisingh1/projects/bhajans2/create-index/music-meta/sheet/golden.csv` and `/Users/hisingh1/projects/bhajans2/create-index/music-meta/sheet/main.csv` (columns `Raaga`, `Recording Shruti`, `Live Shruti`, `Taal (5,6,7,8)`).
  - The raga labels need normalising first: `natabhairaviwithni`, `dha`, `shpavarali`, `mayamalawagowla` vs `mayamalavagowla`.
- **Online I found no per-song raga or taal lists** on amritapuri.org, amma.org, rasikas.org, YouTube, or in the Bhajanamritam catalogue records (titles only).
- The only lead is an Amrita Virtual Academy harmonium course snippet pairing Mohanam with "Amritanandamayi Jai Jai" and Yaman Kalyani with "Arati". It is unverified because the page returned HTTP 500: https://amritavirtualacademysite.azurewebsites.net/?p=28415
- Amritapuri notes that some newer bhajans are tuned in a Western style, not on a raga (https://www.amritapuri.org/on/bhajan), so "no raga" has to be an allowed label.

## Not verified against primary sources
- Gulati 2014's 90% (abstract only).
- TDMS and SPD numbers (companion page or search snippet).
- Singh & Arora F1 (abstract).
- Chordia & Rae 99%→78% (secondary survey).
- Beat This! Western F1 scores (Papers-with-Code mirror).
