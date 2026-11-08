# Where Layamritam disagrees with us: why, and which side is right

November 2026. This report covers the 1,637 rows in `metadata-review.csv`. The decision for each row,
with its probability and evidence, is in `adjudicate/decisions.csv`; `adjudicate/README.md` explains how to rebuild it.
Nothing has been applied to the app yet.

**Reading the numbers.** `p` is the estimated probability that a row's decision is right. Bands:
high ≥ 0.9, medium 0.7–0.9, low < 0.7. Shares in brackets are Wilson 95% intervals.
"App" means our data; "Layamritam" means their catalog.

## Summary

| class | rows | our label right | Layamritam right | other outcome | main reason they disagree |
|---|---|---|---|---|---|
| Language | 94 | 43 | 49 | 2 neither | 37 songs really are mixed (Sanskrit words, regional grammar) |
| Deity | 79 | 48 | 25 | 6 neither | Universal vs a named god; Layamritam over-tags Krishna |
| Taal | 68 | 22 | 4 | 8 both right (different recordings), 34 unresolved | same recording, labelled 8 by us and 6 by them |
| Raga (conflicts) | 76 | 39 | 8 | 29 unresolved | Layamritam's machine labels; it over-uses Jog and Hamsadhwani |
| Raga (both unsure) | 680 | 483 | 54 | 143 unresolved | as above; mostly audio-only, so weaker evidence |
| Possible duplicates | 41 | — | — | 24 really new, 8 translations, 6 duplicates, 3 unresolved | matcher bugs (see below) |
| Amma / Devi calls | 599 | — | — | policy question | different tagging rules, not errors |

On taal both sources are about 97% accurate (measured; see "Measured priors"), so the 68 taal conflicts
are the hard few percent. Layamritam's language and deity accuracy can't be measured directly (its
96.6% note agreement is self-consistency), but on the conflicts language splits almost evenly and deity
leans our way.

## Evidence used, and how far each source can be trusted

| source | what it decides | measured accuracy |
|---|---|---|
| Blind raters: 4 Opus + 4 Sonnet agents read the lyrics and meanings with both labels hidden; 40 songs where both sides agree were mixed in unmarked as controls | language, deity | 40/40 on the controls for both models and both fields [0.91–1.00]. The two models agree on 92% of language conflicts and 89% of deity conflicts |
| **Layamritam's own note** at the start of its meaning text, e.g. "(punjabi 2018)", "2025 (malayalam)" (1,887 songs have one) | language | matches Layamritam's own catalog 1,822/1,887 times (96.6%); the 65 mismatches pile up in our conflict rows |
| **Same-recording test**: correlates the onset envelopes of the two recordings | is Layamritam's recording ours? | the scores split into two groups: 0.93–0.99 for the same recording, < 0.45 for a different one, plus one borderline at 0.61 |
| Our taal model run on **Layamritam's recordings** (105 newly downloaded, 1.7 GB) | taal: was it a rendition difference? | same model as the app (97.5% held out) |
| **Lyric-line test**: beats between Layamritam's own lyric-line timestamps | taal: 3-beat bars vs 2/4-beat bars | agrees with the trusted sheet meter in all 11 clear cases [0.74–1.00]. It cannot tell 6/8 felt in two from 4/4 |
| Trusted sheet-music meter | taal | the label the taal model was trained on |
| The user's "taal and bols" Google Sheet (80 human labels) | taal | only 4 overlap the conflicts; all 4 agree with the final verdict |
| **Scale head-to-head** on sheet music: which raga's scale leaves less of the written melody outside it | raga | measured on the 88-song answer key: 97% when one raga wins by a clear margin, 87% at a medium margin, 62% when close |
| The same head-to-head on our audio | raga | 87% / 74% / 52% by margin. Partly circular: our raga labels came from this same audio |
| Audio identity against the index song's existing samples | duplicates | the score is 0.996, 0.82 and 0.72 for the three duplicates it found, and under 0.12 for every other song |

### Measured priors (overall accuracy of each side)

- **Taal.** Layamritam matches trusted sheet meters 794/817 times = 97.2% [0.96–0.98]. Our taal labels
  agree with Layamritam on 96.6% of matched songs when our confidence is high and 95.1% when it is low,
  which implies our accuracy is about 0.99 and 0.975. This also corrects the taal report: on the
  2020/2021/2025 albums our audio labels agree with Layamritam 95% of the time. The "52%" there came from
  comparing against unverified sheets; it is not an audio failure.
- **Raga.** 96% of Layamritam's labels are marked `ai`. Their label counts are lopsided: Des 239, Jog 151,
  Shyama 118. Jog is rare in Amma's bhajans. Where the sheet music decides, the sheet sides with Layamritam
  on only 7 of 17 Jog calls [0.22–0.64], on 1 of 17 Hamsadhwani calls and on 1 of 12 Yamuna Kalyani calls.

## Language (94): 43 ours, 49 Layamritam's, 46 genuinely mixed

Why they disagree:
1. **Mixed-language songs (37 rows where the raters' first and second languages cover both labels; 9 more
   where a rater heard a third language).** The lyrics use Sanskrit nouns and epithets with Malayalam or Hindi
   grammar: Counting all 46 rows with a second language: Malayalam/Sanskrit 18, Hindi/Sanskrit 20, Sanskrit/Tamil 3. Layamritam labels these by the
   regional grammar; our Sonnet labels sometimes went by the vocabulary. The raters, who judge by grammar,
   side with Layamritam in 31 of those 46. Both labels are partly right.
   **Recommendation:** add a secondary language (`lg2`) so the language filter matches either one. The
   raters' second language is in the `second` column.
2. **Layamritam's catalog contradicts its own note (22 rows), so ours is right.** Examples: "amba sambhavi"
   is catalogued Kannada but noted "(sanskrit – 2014)"; "amrtanandamayi amma" is catalogued Malayalam but
   noted "(tamil) amritanjali vol 27", and its lyrics are plainly Tamil. Several 2025 songs carry a
   "(malayalam)" note but a Tamil catalog entry.
3. **The index title tag is wrong, or the song was paired with a translation (10 rows).** Examples: the
   lyrics of "ichamayi (english)", "kannande dvaraka tedi (english)" and "puvali pasuvundu (english)" are
   Malayalam. "nin mizhittumbil (kannada)" is Malayalam. Layamritam's match for "sivoham jyotiraham" is a
   French version, and for "krnvanto…" an English one. Our rule that a title tag overrides the model
   caused the wrong labels here.
4. **Plain mistakes:** 8 by our labels (e.g. "chintakal kantyam" tagged Hindi but clearly Malayalam;
   "adi sakti maha layamkari" is Malayalam), 8 by Layamritam's.

Confidence: 49 high, 33 medium, 12 low. The low rows are mostly mixed songs where the two models split.

Why our labels slipped: the language labeller read PDF pages, and a song that starts low on a page shares
that page with the previous song. Where the song starts below the middle of the page, our label disagrees
with Layamritam 7.0% of the time, against 4.2–4.8% for songs higher up. That effect is real but small.
The main causes are 1 and 3 above.

## Deity (79): 48 ours [0.54–0.76], 25 Layamritam's, 6 neither

- **Universal vs Krishna (16).** Our label wins 12. Layamritam tags Krishna on songs about the mind, life or
  God in general.
- **"Other" vs Universal (5).** Layamritam wins all 5; our "Other" is a weak label.
- **Universal vs Shiva/Rama (6).** About half each. These songs name the deity once, in passing.
- **Neither side (6).** For example, "kanivotakaṫṫuka" addresses Amma (both sides said Universal/Guru),
  and "mulu mulugi" is a Vishnu song.

Confidence: 30 high, 24 medium, 25 low. The low rows are songs where two deities are equally central.
Proposed fix: a secondary deity (`d2`), as with language.

## Amma vs Devi (599 judgment rows): a policy decision, not a factual one

In 475 rows we say Devi and Layamritam says Amma. Only 18 of those lyrics name Amma by name
(Amṛtānandamayī, Amṛtēśvarī, Amṛtapurī) [0.02–0.06 of the rows]. 165 use Devi names (Kāḷī, Durgā, Ambā…),
and 292 address "Ammē" with no other name. Layamritam is a devotee-run catalog, and it reads "Ammē" as Amma.
Our rule tags Amma only when she is named.

**Recommendation:** keep our Devi label and add `d2: Amma` on the 457 rows without an explicit name. A
search for Amma then also finds the songs devotees sing to her, and no row claims more than the lyrics
say. This is your call.

## Taal (68): mostly the same recording, labelled differently

- In 59 rows Layamritam has the **same recording** we use (match score ≥ 0.93), so the two labels describe
  identical audio. In 8 songs the recordings differ, and our model on Layamritam's recording gives
  **Layamritam's label**. Those are different renditions, and both labels are right for their recording.
- Resolved for us: 22 [0.66–0.94 of resolved rows], mostly a trusted sheet plus a high-confidence model.
  Examples: "bhaktige sopana" is 5/8 on the sheet, "birha ki in" 7/4, "bandamuntu sontamuntu" 3/4.
- Resolved for Layamritam: 4. These are "ame ma maiya" (the sheet is 3/4 → 4/4, and the lyric lines fall
  in 3-beat bars), "gala gala" (our model's confidence was 0.5), "devi mahesvariye" (the human taal sheet
  says 6) and "karunya-varidhi".
- **Unresolved (34):** almost all are 8 (ours, audio only, low confidence) against 6 (Layamritam's,
  human), on the same recording with no sheet. Both sides' priors are about 0.97, so nothing breaks the tie.
  The only question is whether the beat subdivides in 2 or in 3. The lyric-line test can't answer that,
  and neither can a direct, calibrated test on the model's own triplet-subdivision feature (`trip_op`):
  its distributions for trusted 4/4 and 6/8 recordings overlap almost completely (medians −0.13 vs −0.15).
  Likelihood ratios came out at 0.5–1.6 (`adjudicate/taal_trip.json`), which confirms these rows can't be
  settled from this audio.

## Raga (76 conflicts + 680 weak)

- **Conflicts:** ours 39 [0.70–0.91], Layamritam's 8, unresolved 29. Using sheet music alone (less circular
  than audio, though the answer key was itself adjudicated from these sheets): ours 36, Layamritam's 10; with a clear margin only, ours 22, theirs 6 [0.60–0.90 for ours].
- **Layamritam's human raga labels (11 rows):** ours is right 3 times, theirs once ("saranagat ko apnavo
  ma": the sheet says Kapi, not Dwijavanthi), and 7 are unresolved. These deserve a careful look, because a
  human label is a real third opinion.
- **Layamritam is right in 8 rows, and each points at a fix in our labels.** The pattern is that we said
  "hindolam" where the sheet shows Shuddha Dhanyasi or Jog: "callaga cudu", "nila nila megha varnna", "jai
  ganesa jai ekadanta". These differ by only one or two notes, so our audio labeller seems to confuse those
  ragas. Worth a check across the whole index.
- **Weak rows (680):** ours 483, Layamritam's 54, unresolved 143. 519 of them have no sheet music, so most
  verdicts rest on the partly circular audio test (medium band). The sheet alone gives ours 121 and
  Layamritam's 40 [0.68–0.81].

## Possible duplicates (41)

Two matcher bugs explain most of these:
1. The index entry **"omkara divya porule - 14" covers 9,852 characters** of text. That one span covers
   many Omkara Divya Porule parts and contains about 25% of almost any song's word-chunks, so 25% is the
   noise floor. Omkara 47–66 sit at the floor; they are **really new songs** (13 rows, medium).
2. For "doubt" rows, the "app" column named the wrong index song. The real match is often an entry in the
   other language that the matcher rejected because the languages differ.

Decisions:
- **Merge (6).** Three are the same recording as the index song's sample (prem jo diyo, mere hrdaya, nandalala).
  Two share 70% of their lyrics with an entry in the other language: barse badariya (braj) matches
  barse badariya (hindi), and sakhi re (braj) matches sakhi ri laj (hindi). The sixth, nirmala snehame,
  matches nira kanti tingi, but those two share a page and the text may bleed across, so it is low.
  Catch for "mere hrdaya (gujrati)": the recording is the Hindi lyrics. Either the index song's language
  is wrong or its sample is wrong.
- **Keep as other-language versions, cross-linked (8, medium).**
- **Unresolved (3):** gopiye cintinccu, maunaghanamrta, skanda muruga varuvaye. They count as "versions" only
  because the two sides' language labels differ, and those labels (Sanskrit or Tamil vs Malayalam) are the
  least reliable.
- **Really new (24).**

## What is still low confidence, and how to raise it

| what | rows | best next step |
|---|---|---|
| Taal: 8 vs 6 on the same recording, audio only | 34 | 15 minutes of listening: one beat-cycle clip each, tapped along to. Or train a dedicated 2-vs-3 subdivision detector from the 76 trusted 6/8 and 333 trusted 4/4 recordings |
| Raga: no sheet, both sides unsure | ~140 + 29 | extract melody from Layamritam's own recordings (a second, independent performance) and rerun the head-to-head; take a human ear to the 11 human-labelled conflicts |
| Mixed-language songs | 37 (+9) | done: `lg2` added (see Changes applied) |
| Amma / Devi | 599 | done for Devi→Amma rows (`d2`); the other 124 pairs are left |
| Deity with two central gods | 25 | done: `d2` added where P ≥ 0.7 |
| 3 duplicate calls that depend on a language label | 3 | read the two texts side by side |

## Ideas tried that didn't work

- **The `locked` flag on Layamritam's script translations.** It is almost always set on the Malayalam script
  (their team's working script), so it says nothing about the source language.
- **A rule-based language detector built from marker words.** It matched the rater consensus on only 50/82
  songs. It confuses Tamil with Malayalam and Sanskrit with Hindi, so it was not used.
- **`lyricSourceSongId`, Layamritam's "version of" link.** It is empty for all 41 possible duplicates.
- **The audio pitch histogram as a pass/fail raga test.** Even confident labels leave a median of 11% of
  the melody outside their scale, so only the head-to-head comparison is usable.

## Changes applied (2026-11-08)

Applied by `adjudicate/apply_decisions.py` (idempotent; rerun after `adjudicate.py`). A label changes only
where the decision is in the high band (P ≥ 0.9).

| change | rows |
|---|---|
| Language replaced by the decided label | 20 |
| Deity replaced by the decided label | 12 |
| Second language tag (`lg2`) on mixed songs, P ≥ 0.7 | 36 |
| Second deity tag (`d2`) on songs with two central deities, P ≥ 0.7 | 14 |
| Amma rule: Devi songs whose lyrics name Amma (Amṛtānandamayī, Amṛtēśvarī, Amṛtapurī) become Amma, `d2` Devi | 13 |
| Amma rule: other Devi songs Layamritam tags Amma get `d2` Amma | 477 |
| Raga replaced (4 conflicts, 16 weak), in `music-overrides.json` | 20 |
| Taal replaced: ame ma maiya, 8 → 6 beats | 1 |
| Duplicates merged: prem jo diyo (sindhi) → prem jo diyo, mere hrdaya sri ram base (hindi) → mere hrdaya (gujrati); the extra.pdf page becomes the index song's second page | 2 |
| Merge targets' language: prem jo diyo → Sindhi, mere hrdaya (gujrati) → Hindi (their printed pages are those lyrics) | 2 |

The search filters, counts and song cards match either tag (`src/categoryTags.js`).

**Not applied, for a later pass:**
- Medium-band label changes (language 23, deity 7, raga 4 + 36, taal 3: devi mahesvariye, gala gala,
  karunya-varidhi). Their decisions are more likely right than ours, but not at the 0.9 bar.
- Two raga decisions that name two ragas (e.g. kapi/abhogi), which are not a single label.
- Merges at P 0.8 (barse badariya, sakhi re) and 0.55 (nirmala snehame). nandalala nandalala is the
  same recording as nanda lala nanda lala's sample, but its lyrics differ from our printed page,
  so it is not merged: either that sample is a different nandalala, or Amma sang both in one recording.
- The 34 unresolved taal rows, the 172 unresolved raga rows, the 8 rendition pairs and the
  "omkara divya porule - 14" text-span split.
- Our hindolam labels where the sheet shows Shuddha Dhanyasi or Jog: 4 were high-band and are changed
  (callaga cudu, nila nila megha varnna, jai ganesa jai ekadanta, andela ravali); the rest need a recheck.
