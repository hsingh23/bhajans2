# Font maps: sheet-music font and songbook legacy font to Unicode IAST

Output: `fontmaps.json` with `apply_order`, `sheet`, `sheet_sequences`, `sheet_rules` (regex context rules), `songbook_legacy`, `notes` and `confidence`. The JSON is enough to decode on its own: apply the sequences, then the char map, then the rules.

## How the maps were derived

Scripts (all in this folder, re-runnable):

1. `fm_extract.py` dumps the text of every page of `public/pdfs/*.pdf` (pymupdf).
2. `fm_align.py` matches documents by shared 10-grams of an ASCII skeleton (lowercase a–z only, `ch`→`c`, and voicing folded g→k d→t b→p s→c w→v, because the Unicode books write ulagil / maganē where vol1–7 write ulakil / makanē), then character-aligns them with `difflib`. A substitution counts only when it sits between two exact runs of at least 3 chars, and an exact run counts only when it is at least 4 chars long (shorter ones are chance matches). Three passes:
   * legacy vol1–7 page vs Unicode page (2025 + 2018–2021 supplements): **23 page pairs only**.
   * sheet lyrics (Chorus/Verse labels, verse numbers, spaces and hyphens removed) vs Unicode page: **5 sheets only**.
   * sheet lyrics vs legacy vol page, starting from the footer ref (Book N p → volN p, p±1) and falling back to a search over all pages: **833 of 1076 sheets linked**.
3. `fm_words.py`: matches by word type. Each legacy word that has a non-ASCII letter is paired with the Unicode words (freq ≥ 2) of the same length whose ASCII letters agree at every position. The non-ASCII slots act as wildcards. Only words with exactly one candidate count: **3202 word types**. This gives most of the songbook→Unicode evidence.
4. `fm_build.py` holds the final maps. It tallies the evidence, decodes text with the maps and writes `fontmaps.json`. The sheet map is checked against the legacy text, decoded through the songbook map, and also directly against Unicode where possible.

**Surprise 1: the songs barely overlap.** No index entry has both a `vol1-7` location and a `2025` location. The two Unicode-font books share only about 20 songs with vol1–7, all of them in the 2020/2021 supplements, and 2025.pdf shares none. A text search confirms this: 2025.pdf's 'abhayam' and similar hits all belong to new songs. That is why the word-type pass (step 3) was needed. Sheet→Unicode is mostly proven by chaining through the songbook (sheet ↔ legacy, then legacy ↔ Unicode).

Validation: average page-level `difflib` ratio, raw vs decoded. Absolute values are low because pages also carry English and neighbouring songs.
* legacy page vs Unicode page: 0.249 → 0.326 (23 pairs)
* sheet vs legacy page (both decoded): 0.413 → 0.517 (120 random sheets)

## Songbook legacy font (vol1–vol7)

Columns: `word types` = unique-word matches agreeing / all unique-word matches for that char; `page` = page-alignment hits agreeing / total.

| char | → | word types | page | confidence | examples |
|---|---|---|---|---|---|
| à / À | ā / Ā | 1438/1619, 80/84 | 47/51 | high | anàtha = anātha, PARÀÉAKTÌ = parāśaktī |
| è / È | ē / Ē | 447/585, 20/23 | 20/20 | high | kaniyèåamè = kaniyēṇamē, KÈÉAVA = kēśava |
| ì / Ì | ī / Ī | 251/345, 11/17 | 7/8 | high / medium | lakçmì = lakṣmī, tàriåì = tāriṇī |
| ò / Ò | ō / Ō | 249/334, 12/14 | 11/11 | high / medium | kòpam = kōpam, mòkça = mōkṣa, KÒVILIL |
| ù / Ù | ū / Ū | 133/206, 1/1 | 4/6 | medium / low | rùpa = rūpa, mùnnu = mūnnu, UÅARÙ |
| û | ū | 5/6 | – | medium | mûrttè = mūrttē, uåarttû, anugrahikkû |
| å / Å | ṇ / Ṇ | 352/395, 16/16 | 8/8 | high / medium | guåam = guṇam, RÀMAKÄÇÅA = rāmakṛṣṇa |
| â / Â | ṭ / Ṭ | 200/325, 6/8 | 1/3 | medium (glyph is clearly ṭ) | kàââuvàn = kāṭṭuvān, kumbiâunnèn, KEÂÂI = keṭṭi |
| î / Î | ḷ / Ḷ | 251/284, 9/9 | 3/3 | high / medium | kàttukoîîaåam = kāttukoḷḷaṇam, MAKKAÎ |
| é / É | ś / Ś | 230/254, 34/35 | 11/11 | high | rājarājēśvari, DARÉAN = darśan |
| ä / Ä | ṛ / Ṛ | 87/133 (+40 ṙ), 5/7 | 1/1 | medium (high if ṙ≡ṛ) | hädi = hṛdi, amätànandam, aäivum = aṙivum |
| ñ / Ñ | ñ / Ñ | 108/114, 3/3 | 3/3 | high / medium | pañca, ajñàna, aÑjana |
| ç / Ç | ṣ / Ṣ | 88/109 (+14 ś), 1/1 | 2/3 | high / low | rakçaki = rakṣaki, lakçmì; kèçava = kēśava (ś) |
| ê / Ê | ṅ / Ṅ | 87/94, 1/1 | – | high / low | saêkaâa = saṅkaṭa, éaêkarì; GAÅAÊGAÎIN |
| á / Á | ḍ / Ḍ | 71/91, 5/5 | 3/3 | high / medium | akhilàåáèévari = akhilāṇḍēśvari, Áamaru = ḍamaru |
| ã / Ã | ḥ / Ḥ | 14/14, 1/1 | 2/2 | medium / low | namaã = namaḥ, duãkham = duḥkham, manaã |
| ë | ṁ | contexts only | – | low | oë = oṁ, éaraåaë = śaraṇaṁ, annaiyuë = annaiyum |
| ö, õ | ō | 2/2, 1/1 | – | low | möhana, varumö, asatö; jõ, hamkõ, ilaipõl |

The non-matching word counts for vowels (à→ē etc.) come from the wildcard method: a slot can hold any non-ASCII vowel, so spelling variants such as vocative -ā/-ē get counted against the map. The page alignments, which have no wildcards, agree 47/51, 20/20, 11/11.

## Sheet-music font (Finale "IndicTranslitAbc")

Column `vs legacy` = aligned occurrences whose legacy counterpart decodes to the target / all aligned occurrences of the char.

| char | → | vs legacy | confidence | examples (sheet ~ legacy) |
|---|---|---|---|---|
| â / Â | ā / Ā | 5503/5576, 42/42 | high | vâhinî ~ vàhinì; Âdiparâåhakti ~ àdiparàéakti |
| ê / Ê | ē / Ē | 1751/1833, 6/6 | high / medium | Ammê ~ ammè; Êkavirâ ~ èkavìrà |
| î / Î | ī / Ī | 1051/1103, 2/2 | high / low | simhavâhinî ~ simhavàhinì |
| ô / Ô | ō / Ō | 1095/1131, 6/6 | high / medium | nôkki ~ nòkki; Ôm namaï åhivâya |
| û / Û | ū / Ū | 555/588, 1/1 | high / low | tarû ~ tarù; Ûttam |
| ñ | ṇ (ñ next to c/j) | 1270/1384 | high | gañapati ~ gaåapati; prapañcham, jña stay ñ (164 of 7449 uses) |
| õ | ñ | 10/11 | medium | ariõchitê ~ ariñchitè, Hëdayâõjali ~ hädayàñjali |
| ö | ḷ | 854/982 (rest: legacy writes plain l) | high | aṅgaöil ~ aṅgaîil, kaöam ~ kaîàm |
| ø / Ø | ṭ / Ṭ | 611/639 | high | kûøøinum ~ kùââinum |
| è / È | ḍ / Ḍ | 229/296 (rest: legacy d/ṭ spelling) | high | vakratuñèu ~ vakratuåáu; Èamarû = Ḍamarū (title) |
| ë | ṛ, or r | 542/548 (ṛ or r) | high, with a context rule | Clean single-char edits split by context. Consonant_ë_consonant → ä/ṛ 246, ri 3 (kahëttil ~ kahättil, hëdayam ~ hädayam). Vowel_ë_consonant → r 36/36 (manujaëkku ~ manujarkku, kaëpagam ~ karpagam). Vowel_ë_vowel → ä 62, r 13 (maëannu ~ maäannu, Malayalam ṟ). So the rule is vowel+ë+consonant → r, else ṛ. |
| ï | ḥ | 43/58 | high | duïkha ~ duãkha, manaï ~ manaã |
| ç | z (always in çh = zh) | 392/395 | high | âçhtti ~ àzhtti, poçhiyi ~ pozhiyi |
| åh / Åh (also bare å) | ś / Ś | 671/693, 24/25 | high | åhilpi ~ éilpi, Åhakti ~ éakti |
| æh (also bare æ) / Æh | ṣ / Ṣ | 194/197 | high | lakæhmi ~ lakçmi, rakæhaki ~ rakçaki |
| ¨ | (drop) | 275/275 occurrences come right before u | high | nik-k¨u ~ enikku, uñ d¨u ~ uṇḍu: the Malayalam/Tamil half-u mark |

Apply `sheet_sequences` (`åh`, `Åh`, `æh`, `Æh`, `¨u`) first, then the single-char map, then the `sheet_rules` regexes (`ṇ`→`ñ` next to c/j, vowel+`ṛ`+consonant → `r`, upper- and lowercase vowels). `fm_build.dec_sheet()` does exactly that. Check: Saëv vâ → Sarv vā, Mûëttikaö → Mūrttikaḷ, pra pañ cham → pra pañ cham, këæh ña → kṛṣ ṇa, Åha ra ñam → Śa ra ṇam.

Sheet spelling habits that are *not* font chars, so fold them before comparing: `ny` = ñ (nyân = ñān), `d` for intervocalic Malayalam ṭ (kâttidu = kāṭṭiṭu), `kky` = kk, `w` = v (åhwari = śvari), `ng` = ṅg.

## Chars that remain uncertain

* **Sheet `ä` (5x), `¸` (2x), `¯` (1x)**: isolated typos with no consistent counterpart; left unmapped.
* **Sheet uppercase `Ñ Õ Ö Ø È Ë Ï Ç Æ`**: seen 0–8 times, only in titles or line starts, so mapped by analogy. `Æ` is once a typo for `Å` (“Ananta Æayana” = Śayana).
* **Sheet `ë` between vowels**: this is Malayalam ṟ. The map gives ṛ, which matches the songbook `ä`; 2025 writes it ṙ.
* **Songbook `ë` (ṁ), `ö`/`õ` (ō)**: rare (vol3/6/7), with only 2–4 confirming words each.
* **Songbook `ä`**: covers both Sanskrit ṛ and Malayalam ṟ (2025 writes ṟ as `ṙ`). Fold ṙ→ṛ before comparing.
* **Songbook `ê`**: the glyph is ṅ, but the songbook also spells Malayalam ññ as êê (teîiêêu = teḷiññu).
* **Songbook `â`** (ṭ) vs 2025 ḍ/ṫ in Malayalam (pàâum = pāḍum, kàââil = kāṫṫil), and `ç` (ṣ) vs ś (kèçava = kēśava): these are spelling differences between the books, not font ambiguity.

## Side-by-side proof (sheet decoded, songbook decoded, 2020 Unicode supplement)

There is no song shared by a sheet, vol1–7 and 2025.pdf, so the Unicode column comes from the 2020 supplement. Only two songs exist in all three sources; four of their lines are shown.

| # | sheet raw → decoded | songbook raw → decoded | Unicode (2020supl) |
|---|---|---|---|
| 1 | `A çhi yâ ta â nan dam ta ru vâö` → A zhi yā ta ā nan dam ta ru vāḷ (SitrinbamNatum) | `azhiyàta ànandam taruvàî` → azhiyāta ānandam taruvāḷ (vol7-265) | azhiyāda ānandam taruvāḷ (p176) |
| 2 | `Ni la yil lâ u la kil i run dâ lum` → Ni la yil lā u la kil i run dā lum | `nilayillà ulakil irundàlum` → nilayillā ulakil irundālum | nilayillā ulagil irundālum |
| 3 | `A ri virk ka ñi åhêr a ra nâr ma ka nê` → A ri virk ka ṇi śēr a ra nār ma ka nē (TanchamenaVantom) | `arivirkkaåiéèr aranàr makanè` → arivirkkaṇiśēr aranār makanē (vol7-280) | arivirkk-aṇisēr aranār maganē (p183) |
| 4 | `pi ra vip pi ñi tîr pi rai yôn ma ka nê` → pi ra vip pi ṇi tīr pi rai yōn ma ka nē | `piravippiåitìr piraiyòn makanè` → piravippiṇitīr piraiyōn makanē | piravi-piṇitīr piraiyōn maganē |

Two-way lines (sheet ↔ songbook) for the consonant chars:

* `lakæh mi kara vî ra vâ si ni` → lakṣ mi kara vī ra vā si ni ↔ vol6-8 `mahàlakçmi karavìravàsini` → mahālakṣmi karavīravāsini
* `te-öi-yu-ka këæh-ñâ` → te-ḷi-yu-ka kṛṣ-ṇā (AbhayamTanAruluka) ↔ vol2-7
* `duï khat tin a bha yam Ka øa lô öam ka ru ña` → duḥ khat tin a bha yam Ka ṭa lō ḷam ka ru ṇa (AkatarilOruNeram) ↔ vol7-10 duḥkhattin
* `pa-ra mêåh wa-ri-yê` → pa-ra mēś wa-ri-yē ↔ vol1-8 `paramèçvariyè` → paramēṣvariyē (that title spells ś as ç)

## Footer refs (sheets.json `refs`)

**Surprise 2: Book I and Book II refs use a different edition's page numbers.** Book I/II refs do not use vol1/vol2 page numbers. They use the newer edition's pages, which are the `voli1-*` / `voli2-*` locations in `bhajan-index2.json`. Examples:
* AbhayamAbhayamAmma "Book I p165" = voli1-165, which is vol1-6.
* AbhayamTanAruluka "Book II p1" = voli2-1, which is vol2-7.

156 Book I and 122 Book II sheets landed on a different vol page for this reason. Resolve them through the index: find the song with location `voli1-<p>`, then take its `vol1-*` location. Books III–VI refs do use vol3–6 page numbers.

Genuinely wrong refs found:
* **HariNarayana**: "Book VI p75", but the song is at vol6-79/80.
* **MaOMaPukaru**: "Book VI p131" points to a different song, "Mā O Mā (Gujarati)". The real match is vol6-187 ("mujkò śaraṇ…").
* **VedanaKondoru**: "Book V p213", but the song is in Book VI p213 (vol5-213 is an index page).
* **OmkaraDivyaPorule 10b–11c**: these multi-part sheets all cite the first page of the long song (vol3-151/161); the parts sit 2–8 pages later.

204 sheets with refs could not be linked by text at all. They are mostly English songs (which have no diacritic lines) or short Tamil/Hindi lyrics.


Note: `sheets.json` was regenerated by another process while this work ran. The tool overwrote it at 04:48, and other new files appeared alongside it: books.json, match.py, matches.json, etc. All counts above come from a rerun against the regenerated file.
