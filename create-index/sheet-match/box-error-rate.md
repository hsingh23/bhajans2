# Box matcher: measured error rate on random samples

Two random samples of 300 (seed 11) were judged by two independent reviewers each on the titles alone (song name, recording title, album folder): 300 accepted links out of 4079, and 300 rejected candidates out of the 4401 that scored 80 or more on fuzzy text similarity but failed the title rule (the near misses, where false negatives would hide). Every flag was then adjudicated here.

## Accepted links (false positives)

7 of 300 flagged; 4 were wrong, all of one of two kinds, and both kinds are now rejected by rule; 3 are the same song under a slipped spelling. Measured false-positive rate before the fix: 4 of 300 (1.3%); after the fix the same 300 contain no known wrong link.

| song | recording | adjudication | status |
|---|---|---|---|
| mata rani ne krpa basayi (punjabi) | 06 Mata Rani (Gujarati).mp3 | WRONG: recording is the Gujarati version | fixed: language-version rule |
| ame ma maiya (gujrati) | 09 Ame Ma Maya.mp3 | same song: maiya/maya is a spelling slip of the same Gujarati title; the keys are identical after y/i | kept |
| nilambuja nayane (gujrati version) | 02 Nilambhuja Nayane (Japanese).mp3 | WRONG: recording is the Japanese version | fixed: language-version rule |
| dip ka na | 05 Deepak Na (Instrumental).mp3 | same song: the printed title is 'Dip ka na janu bati na janu' (vol1, lamp and wick); 'Deepak na' is the same first words with the common deepak spelling; instrumental, no words to check | kept |
| amma amma ena unnai (tamil) | 06 Amma Amma (Amme Amme Amritanandam...).mp3 | WRONG: the parenthetical names the Malayalam song amme amme amrtanandamayi; only the first words match the Tamil entry | fixed: a parenthetical that names another index song sends the recording there and nowhere else (the truncated file name lacks its closing bracket; now read) |
| kaha ho kanha | 03 Kaha Ho Kahna.mp3 | same song: kahna is a transposition of kanha in a Hindi title | kept |
| oru nimisam orttu (malayalam) | Oru Nimisham (Tamil).mp3 | WRONG: recording is the Tamil version | fixed: language-version rule |

## Rejected near misses (false negatives)

42 of 300 flagged as "missed" by the reviewers. 33 of those recordings are linked to the index entry whose title they carry exactly (the reviewers counted a sibling entry with a repeated word, a vocative or a different language tag as the same song; the matcher gives the recording to the exact-title entry only, a deliberate policy, see the README). 4 are numbered verses of the Omkara Divya Porule hymn, which the index splits into parts without a verse map (deliberately unassigned). 5 are genuine misses:

| song | recording | why | status |
|---|---|---|---|
| ammayennulloru nama morttidave | 01 Amme Yennu Loru (Vintage).mp3 | three words glued and amme/amma inside the join | now accepted: a song word may be the track's words written apart, each piece a spelling of its part |
| kaitorunnen krsna | 2-07 Kaitozhunnen Krsna (kalyani).mp3 | zh written r in the index name | vol1-112 prints the heading KAITOZHUNNEN KRSNA: the entry is renamed kaitozhunnen krsna and the recording links by title |
| yatha yariyiykkan | 2-03 Vyathariyikkan (harikambhoji).mp3 | the recording uses the first line's 'Vyatha' | vol3-259 prints the heading 'Yatha yariyiykkan' and the first line 'Vyatha yariyiykkan vazhi'; the index follows the heading; still rejected (the one remaining miss of the five) |
| darsanam darsanam sudarsanam (telugu) | 01 Darshanam Sudarshanam.mp3 | repeated word dropped | now accepted (repeated-word rule, tier 2) |
| hana mo tori mo (japanese) | Hana Mo.mp3 | five-letter title, below the six-letter floor | now accepted: a short title is accepted when it opens exactly one index song and the recording's language (parenthetical or album folder, here 'Japanese Bhajan 2020') is that song's language |

Measured false-negative rate among near misses: 5 of 300 (1.7%) before the fixes; after the three rule changes and one print-backed rename, 1 of 300 remains (0.3%), a title that follows the song's first line where the index follows its printed heading.

## Fresh samples after the first round of rules

A second random draw of 300 accepted links (seed 23), taken after the rules above were applied, judged by two further independent reviewers on song name, language, recording title and album folder; every flag adjudicated here.

| song | recording | adjudication | status |
|---|---|---|---|
| sambho sankara samba sadasiva (sanskrit) | Śambho Śaṅkara.mp3 (Tamil Bhajan 2020) | WRONG: 2020supl3-84 prints these words under sambho sankara (tamil), and the transcription of the recording sings them | fixed: a language-specific "X Bhajan 20xx" album holds only that language's entries |
| jaya jaya sankara hara hara (tamil) | Jaya Jaya Śankara.mp3 (Kannada Bhajan 2020) | WRONG: the Kannada entry jaya jaya sankara (kannada) exists | fixed: same rule |
| bhavani bhagyavidhatri (sanskrit) | 03 Bhavani Bhagyavidatri.mp3 (Hindi Bhajans Vol.2) | same song: compilation albums carry Sanskrit songs; the title is exact | kept |
| nityanandattil (vidya, malayalam) | 08 Nityananda 2.mp3 | WRONG: a one-word title that is only the start of this longer word; the chant nityananda satchitananda holds it | fixed: a within-word prefix never stands as the only aligned unit |
| lalitambike amme (malayalam, pranav) | 01 Sri Lalitambike.mp3 | WRONG: after the leading Sri, a one-word title that opens several lalitambike entries | fixed: ambiguity is judged after dropping a leading Sri or article on both sides |
| kaha ho kanha | 04 Kaha Ho Kahna (Vintage).mp3 | same song: kahna is a transposition of kanha | kept |
| amrtanandamayi | 02 Amritanandamayi Ma Tucch Ko (Vint.mp3 | WRONG: the whole title is the entry amrtanandamayi ma tucch ko | fixed: a recording whose whole title is another entry's whole name goes there only |
| iswar tumhi dayakaro | 02 Ishwar Tuhi (Iswar Tumhi).mp3 (Sindhi & Punjabi Bhajans) | same song: the parenthetical names it; compilation album names are not used | kept |
| karunardra-manase hrdayesvari (malayalam) | Karuṇārdra-Mānasē.mp3 | WRONG: the entry karunardra manase (malayalam, chinmaya) is the whole title | fixed: whole-title rule |
| kalpantarangalkkum | 01 Kalpantarangalkum.mp3 (Tamil Bhajans Vol.3) | same song: exact title; compilation album | kept |
| mayilppili azhakettidum (malayalam) | Mayilppīli.mp3 | WRONG: the entry mayil pili (malayalam) is the whole title | fixed: whole-title rule |

11 of 300 flagged; 7 wrong (2.3%), of four kinds, each now closed by a rule; 4 judged the same song. Two transcription samples (`box-audio-sample.md`, `box-audio-sample-2.md`) found 3 more wrong links among 68 with usable audio, all three of kinds the title alone cannot show (a German translation; a Tamil-album recording on a Sanskrit entry; a recording whose words are another entry's), and all three kinds are now closed by rule. After the final rules every wrong link found in any sample is rejected; no sample has been drawn after the final rules, so the post-fix rate is "0 known wrong in 640 judged pairs", not a fresh measurement.

## Post-fix measurement (samples drawn from the final matcher output)

After every rule above was in place, fresh random samples were drawn from the final output (seeds 41, 47, 43) and judged the same way.

- 300 accepted links, two reviewers: 6 flagged, 1 wrong (0.3%): "Where Can I Go (Gaelic)" on the English entry, a translation whose language tag ("Gaelic") was not in the language list; the list is extended and the link is rejected. The other 5 flags are exact-title entries or unique openers judged ambiguous by the reviewer (adiparasakti, gajanana, omkaresvara (telugu) are the exact titles; "Maheshwari" opens only mahesvari raja rajesvari; "Etra Nalay Ende" extends the only etra nalayi entry).
- 300 rejected near misses, two reviewers: 2 missed (0.7%): "Kar Le Ma Kar" on kar le ma ka (the printed title ends in "ka"; a short particle with or without its last letter is now allowed after two aligned words) and "Nenchakam Ventitunnu" on the entry whose last character is a font-map artefact (now an override with the reason recorded; the entry is printed in no book we have).
- 40 recordings transcribed (`box-audio-sample-3.md`): 0 wrong among 30 with usable audio.

Across the three rounds: title samples 900 accepted / 600 rejected pairs, 108 recordings transcribed; the post-fix round measured 0.3% wrong and 0.7% missed, each of those three cases now closed by a rule or a documented override. No sample has been drawn after these last three closures.

## Fourth round: samples drawn after the last three closures

- 300 accepted links (seed 53), two reviewers: 13 flagged, 0 wrong. Eleven flags were one-word (or hyphenated two-word) recording titles that the reviewers called "could be several songs"; each was checked against the whole index and opens exactly one entry, which is the matcher's unique-opener policy (Pādapaṅgaḷe, Śrīgandhadantha, Vedambike, Valampurināthā, Sindūrapoṭṭāṇu, Kāladaḷaṅgaḷ, Śrīcakra-Vāsini, Manamayil, Dinkar, Kaṇpārammā; "Unarunaro" is a final-vowel spelling of the only unarunaru entry). One flag was a truncated parenthetical ("Ullakattin Na…" for ullakattin adhara) on an exactly matching English title. One flag was an English-tagged recording on the "Amma sings in farsi" album linked to the English entry: the recording's own tag is right; as a precaution the album rule now yields to a recording's own language tag and "farsi" is recognised.
- 300 rejected near misses (seed 59), first reviewer: 3 flagged as missed, 0 genuine. "Vrajavana Kunja Vihari" is the separate entry vrajavana kunjavihari (vraja is not vrnda); "02 Please Give Me Refuge (Devi Saran…" is the English entry please give me refuge, which holds it; "02 Radhe Shyam" on "Bhajans Français Vol. 2" was transcribed to settle it and sings French ("Tu es l'ami et le parent de l'opprimé"), so the album rule that rejected it from the Hindi entry is right.
- 300 rejected near misses, second reviewer: 0 missed. Fourth-round result on 600 title judgements drawn after every rule: 0 wrong accepted links, 0 genuine misses.
- 40 recordings transcribed (`box-audio-sample-4.md`): 21 confirmed, 12 consistent, 7 unintelligible, 0 wrong among 33 with usable audio.

Fourth-round totals, all drawn after the last rule change: 0 wrong in 300 accepted links, 0 genuine misses in 300 near misses, 0 wrong in 33 transcribed recordings. Across all rounds: 1200 accepted and 900 rejected pairs judged by title, 148 recordings read by their sung words.

## Fifth round: 600 accepted and 300 rejected, drawn from the final output

- 600 accepted links (seed 71), four reviewers: 5 flagged, 2 wrong (0.3%). "Iṣwar Tumhi Dayākarō (Kashmiri)" on the Hindi entry: the Kashmiri tag was not in the language list (now it is, with Sindhi, Urdu, Dogri, Maithili and others). "03 Ellam Ariyunna Amme" on the entry ellam ariyunna english, which is the English version named after its Malayalam original: an entry in a non-Indian language now takes an untagged recording only when the whole title matches and no Indian-language entry has the same title, so the Malayalam original holds it. The other three flags were the known kept cases (engopoyi through its CD Baby title; two exact or unique-opener titles).
- 300 rejected near misses (seed 73), two reviewers: 2 missed (0.7%). "Ānandamayī" is the entry ananda mayi written as one word, which the one-word ambiguity check did not count as exact (it now counts an entry whose words glue into the title). "Chinna Kanna (Pyare Kanha)" is the Tamil entry chinna kanna; its parenthetical only names the Hindi song it is a version of, and a parenthetical now decides only when the main title matches no entry in full.

All four are closed by rule and pinned as fixtures. Across the five rounds: 1800 accepted and 1200 rejected pairs judged by title, every flag adjudicated; the measured wrong rate fell from 1.3% and 2.3% in the first rounds to 0.3% in the last two, and each closure was of a kind the previous rules had not covered. The last four closures have not themselves been re-sampled.
- 40 recordings transcribed (`box-audio-sample-5.md`): 18 confirmed, 11 consistent, 8 unintelligible, 1 wrong (an identical title in two languages, now linked to neither without language evidence), 2 open.

Totals across five rounds: 1800 accepted and 1200 rejected pairs judged by title, 188 recordings read by their sung words. Every wrong link found is rejected by a rule or an override, every rule is pinned by fixtures, and the last five closures (Kashmiri tag, translation entries, glued one-word titles, a full main title over its parenthetical, twin titles across languages) have not been re-sampled.

Twin-title rule, measured after the fact (2026-11-08): its first form (an untagged recording whose whole title is the whole name of entries in two languages goes to neither) cost 173 links, 42 of them where the "twin" was an English or other translation entry and 42 where it was a "(kannada version)" entry of the same song. It now counts Indian-language entries only and sends the recording to the entry whose own name carries no language tag, the original; the one transcribed wrong link that motivated the rule (the Tamil entry of "Amma Amma Amma") stays unlinked because both entries there are untagged. 28 songs remain unlinked under it, each listed in `box-link-changes.md`. This narrowing has not been re-sampled.
