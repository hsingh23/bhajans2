# Transliteration-invariant search for bhajan titles

Research and design note, 2026-11-07. Covers the app search box (`makeSearchable` in `src/Search.jsx`) and sheet-music file-name matching (`makeSearchable` in `create-index/cdbaby/mergelinks.js`, and the matchers in this folder).

**Results, measured against `public/bhajan-index2.json` (2,767 entries):**

| | found | top-1 | top-3 | MRR |
|---|---|---|---|---|
| current `makeSearchable` + substring filter, results in index order | 19/40 | 17/40 | 19/40 | 0.450 |
| proposed key + tiered ranking | 40/40 | 38/40 | 39/40 | 0.966 |
| + Tamil alternate key + popularity tie-break | 40/40 | **39/40** | 39/40 | **0.981** |

The 40 test queries are in section 5. Measured in the prototype: the key, tiers T1–T7 with *unweighted* edit distance, the Tamil alternate key and the popularity proxy. Proposed but not yet measured: the weighted substitution costs, alias keys and the Bengali alternate key. The prototype harness was run in a scratch directory and is not part of the repo. It is about 150 lines of Python (`key2.py`, `eval2.py`); section 6 gives the rule table you need to rebuild it.

---

## 1. Why the same title is spelled many ways

Indic scripts have about 50 phonemic letters, and the Latin keyboard has 26. Every romanization has to pick some of four tools to make up the difference: diacritics, digraphs, capital letters, or simply dropping the distinction. Each published standard picks differently, and casual writers mix all of them.

- **IAST / ISO 15919** use diacritics: ā ī ū, ṛ, ś ṣ, ṭ ḍ ṇ, ṅ ñ, ṃ/ṁ, ḥ. ISO 15919 adds ē/ō for the Dravidian long vowels, ḻ for Tamil/Malayalam ழ/ഴ, and ṟ/ṉ. It lets anusvara be written either as ṁ or as the nasal of the following consonant's class ([ISO 15919](https://en.wikipedia.org/wiki/ISO_15919)). The index uses these spellings with the diacritics stripped (`amrtesvari`, `krsna`, `ganesa`), so ś, ṣ and s all collapse to `s`. A few entries still carry `ṙ` (ṟ), `ṫ` (ṯ) and `ḥ`; 28 names contain non-ASCII letters.
- **Hunterian**, India's de facto national system, writes long vowels with macrons, or more often with no mark at all. It writes both श and ष as `sh`, ऋ as `ri`, and च/छ as `ch`/`chh`. Retroflex and dental letters get the same Latin letter. Anusvara is `n` or `m`, aspiration is a following `h`, and व is `v` or `w` ([Hunterian](https://en.wikipedia.org/wiki/Hunterian_transliteration)). Most people search in Hunterian-style spelling: `krishna`, `shiva`, `chandra`.
- **ITRANS / Harvard-Kyoto / Velthuis / SLP1 / WX** are ASCII schemes that use capitals and doubled letters (`aa`, `RRi`, `Sh`, `~N`). Users never type them, but they explain spellings like `aa`, `ee` and `oo`. The `indic_transliteration` package implements all of them. Its OPTITRANS scheme has a `to_lay_indian` helper that turns `kRShNa` into `krishna`, which amounts to a formal statement of the popular style ([indic_transliteration](https://github.com/indic-transliteration/indic_transliteration_py)). Aksharamukha likewise offers "Roman (Readable)" and "Roman (Colloquial)" targets alongside IAST, ISO, HK, ITRANS and Velthuis ([Aksharamukha](https://pypi.org/project/aksharamukha/)).
- **Colloquial spelling** has no standard at all. The Dakshina paper (Google Research) says there are "no standard romanization systems in common use" for these languages, and its romanization lexicons show a single word with many attested spellings ([Roark et al. 2020](https://arxiv.org/pdf/2007.01176)). FIRE's transliterated-search track gives *dhanyavad / dhanyavaad / dhanyvad / danyavad / dhanyabad* as its motivating example ([FIRE MSIR overview](https://www.microsoft.com/en-us/research/publication/overview-mixed-script-information-retrieval-msir/)).

The variance is systematic. Each source below gives one rule that can be applied identically to the index side and the query side. The **K** column says where the rule belongs: in the canonical key, where it must be high confidence because the key merges strings outright, or in the fuzzy layer as a cheap edit, because it would merge distinct songs if put in the key.

| # | Source of variance | Examples (user ↔ index) | Collapse rule | K |
|---|---|---|---|---|
| 1 | Vowel length (ā/aa/a, ī/ee/i, ū/oo/u) | jagadeeshwari ↔ jagadisvari, maa ↔ ma | `aa+→a`, `ee/ii/ie→i`, `oo/uu→u` | key |
| 2 | ś / ṣ / s, written sh or s | shivaya ↔ sivaya, ganesha ↔ ganesa | drop `h` after a consonant (so `sh→s`) | key |
| 3 | Aspirates (bh dh th kh gh jh ph) | bhagavathi ↔ bhagavati, aindezhuthu ↔ …ttu | drop `h` after a consonant **except after `n`** (see §4) | key |
| 4 | Vocalic ṛ: r / ri / ru / rī | krishna, krushna, krsna; amrita, amruta, amrta; srushti ↔ srsti | `C r [iu] C → C r C` | key |
| 5 | c / ch / chh | chidananda ↔ cidananda, chandra ↔ candra | `chh|ch→c` | key |
| 6 | v / w (and Bengali b for v) | eshwari ↔ esvari, swami ↔ svami | `w→v`; b/v only in fuzzy | key / fuzzy |
| 7 | Retroflex vs dental (ṭ/t, ḍ/d, ṇ/n, ḷ/l) | stripped diacritics already merge them | nothing extra; also strip ṟ ṯ via NFD | key |
| 8 | ḻ (Tamil/Malayalam zha) written zh, l, r | azhagu ↔ alagu, aintezhuttu | `zh→l` before any other rule | key |
| 9 | ñ / ṅ / ṇ / n / ng; Malayalam ñ- written nj or ny | njan ariyunnu ↔ nan ariyunnu, gnana ↔ jnana | word-initial `nj|ny→n`; `jn|gy|dny→gn` | key |
| 10 | Anusvara as m or n | shamkara, sankara, shankar | `m` before a consonant other than y/v/r/l → `n` | key |
| 11 | Post-nasal voicing (Dravidian sandhi, Hindi pronunciation) | aindezhuthu ↔ aintezhuttu, enkirundu ↔ enkiruntu | `nt→nd`, `nk→ng`, `mp→mb`, `nc→nj` | key |
| 12 | Other Tamil voicing (k/g, t/d, p/b, c/j) | azhagu ↔ azhaku, kanna ↔ ganna | an **alternate key** for Tamil entries, devoiced (§3a) | alt key |
| 13 | Visarga ḥ | namah ↔ nama, namaḥ | drop word-final `h` | key |
| 14 | Final schwa (Hindi/Marathi/Punjabi: rāma → rām) | shambhu mahadev ↔ sambho mahadeva, narayan ↔ narayana | drop a final `a` when at least three letters remain | key |
| 15 | Medial schwa deletion | jagdish ↔ jagadisa, ramcandra | not in the key: an insertion or deletion of `a` costs 0.5 in the fuzzy layer | fuzzy |
| 16 | Gemination | amma ↔ ama, kannu turakkule ↔ turakule | collapse doubled letters (after all other rules) | key |
| 17 | y / i glides | srishtiyum ↔ srstyum, mayi ↔ mayee | `iy→y` | key |
| 18 | e/ē, o/ō, ai/e, o/u | eswari ↔ isvari, sambho ↔ shambhu | only `esv→isv` (the -īśvara- morpheme) in the key; e↔i and o↔u cost 0.5 in the fuzzy layer | fuzzy |
| 19 | au / ou / ow | gourango ↔ gauranga | `ou|ow→au` | key |
| 20 | Bengali inherent o for a | gourango ↔ gauranga, bhobo ↔ bhava | an alternate key (`o→a`) for `lg=Bengali` entries only | alt key |
| 21 | kṣ as ksh / ks / x / ksh | laxmi, lakshmi, laksmi | `ksh|x→ks` | key |
| 22 | jai / jaya / jay | jai jagadambe ↔ jaya jagadambe | `ai$→ay`, then final schwa | key |
| 23 | Word boundaries and sandhi (compounds, hyphens, CamelCase file names) | OmNamahSivaya, aksara-rupini, muralivale ↔ murali vale | split CamelCase **before** lowercasing; join hyphenated words; compare space-free keys | ranking |
| 24 | Marathi / Gujarati specifics (ळ, retained final -a, Gujarati ja/za, -bhai/-ben) | vithala ↔ vithal, tujhyata | final schwa (14) plus `z→j` | key |

---

## 2. Existing algorithms and what ports

| Approach | What it does | What ports to a small JS normalizer |
|---|---|---|
| **American Soundex** | first letter plus 3 consonant-class digits | Too lossy for Indic text: one study of custom Soundex matched only 34% of Hindi pairs and 14% of Marathi pairs (cited in DiPersio 2021) |
| **IndicSOUNDEX** (DiPersio, Amazon Alexa AI, 2021) | maps each of 8 Indic scripts and Latin onto a modified ISO 15919 form, then onto 15 codes. Aspirated and unaspirated merge, all nasals merge, vowels are dropped, fricatives stay distinct | The *class design*: merge aspiration and nasals, keep sibilants. On Indic-script/Latin word pairs it scored 88–94% (Hindi 93.8%, Marathi 92.6%, Punjabi 88.0%, Telugu 94.4%; Table 7). Cross-Indic pairs ranged from 46% to 100%, and pairs involving Tamil were the weakest (Bengali/Tamil 45.8%, Hindi/Tamil 60.1%), consistent with Tamil voicing needing special handling. It drops vowels, which is too reductive for short song titles (it would merge `devi daya kari ma` with `devi daya karo ma`), so this proposal keeps vowels but collapses their length ([paper](https://cdn.amazon.science/86/4e/ebc49f01492d89307dbb45d0faf2/indicsoundex-algorithm-for-text-matching.pdf)) |
| **Q-gram / Indic-Phonetic** (Chaware & Rao) | n-gram and phonetic-rule matching | Q-grams matched 68% of Hindi pairs against 34% for Soundex, so a trigram fallback layer is worth having |
| **Double Metaphone** (Philips, C/C++ Users Journal, June 2000) | emits a primary and an alternate code, and two strings match if any pair of their codes is equal ([Metaphone](https://en.wikipedia.org/wiki/Metaphone)) | The *primary + alternate key* idea. Here the index already knows each song's language (`lg`), so alternate keys are emitted only where a risky collapse is right: Tamil voicing, Bengali o/a |
| **Beider–Morse** | detects the language, then applies that language's rules | The same idea, made cheap because the index stores `lg` |
| **indic_transliteration / Aksharamukha** | deterministic scheme-to-scheme conversion | Useful offline, to generate test variants: render a song's IAST as HK, ITRANS, OPTITRANS-lay and Aksharamukha "Readable", then check that all of them hit the same key. Too large to ship in the PWA |
| **Google Transliterate / Dakshina / Aksharantar (IndicXlit)** | learned romanized→native models trained on attested spellings | The *data* is what matters: Dakshina's romanization lexicons (12 languages) are a source of realistic query spellings for the test set ([Dakshina](https://arxiv.org/pdf/2007.01176), [Aksharantar](https://arxiv.org/abs/2205.03018v2)). The models are too heavy for the client |
| **FIRE 2013–16 Transliterated Search / MSIR** | ad hoc retrieval of Hindi song lyrics from Roman or Devanagari queries, scored by NDCG@k, MAP and MRR | In FIRE-2015 the best runs were BIT-M (NDCG@1 0.757, MRR 0.589), which used LCS similarity to resolve ambiguous transliterations, a bigram index and query expansion around high-idf terms, and Watchdogs-3 (NDCG@10 0.716), which **dropped all vowel signs and spaces and indexed character 2–6-grams**. DCU used rule-based normalization plus fuzzy queries. The lessons that port: normalize, then compare **space-free strings** (word joining and splitting was one of the named difficulty classes), then fall back to n-grams and edit distance ([FIRE-2015 overview, CEUR Vol-1587](https://ceur-ws.org/Vol-1587/T2-1.pdf), [MSIR 2013–16 report](https://riunet.upv.es/bitstream/10251/176432/7/BanerjeeChoudhuryChakma%20-%20MSIRFIRE%20A%20Comprehensive%20Report%20from%202013%20to%202016.pdf)) |

The design has two layers. The **key** collapses only high-confidence equivalences, those that essentially never separate two real titles (vowel length, h-drop, v/w, ś/ṣ/s, ṛ, c/ch, anusvara, visarga, gemination, final schwa, zh). Low-confidence confusions (e/i, o/u, b/v, voicing outside Tamil, medial schwa) stay out of the key. They are handled as cheap substitutions in a bounded weighted edit distance, so they can only promote a candidate, never merge two.

---

## 3. Proposal

### 3a. Canonical key, `bkey(text)`

The algorithm uses only lowercase `[a-z]`, character classes, groups, `^`/`$` anchors and `$1` backreferences. It uses **no lookbehind or lookahead**: lookbehind did not parse in Safari before 16.4, and an older iOS PWA would throw at load time. Python uses the same table with `$1` rewritten as `\1`.

1. **Fold.** NFD-normalize, drop combining marks (ā→a, ṙ→r, ṫ→t, ḥ→h), map ’ and - between letters to nothing. For **file names**, split CamelCase first (`OmNamahSivaya` → `Om Namah Sivaya`) and only then lowercase. Without the split, `OmNamahSivaya` produces `onamahsivay`.
2. **Split titles.** Strip known tags in `(…)` (language names, `namavali`, `version`, singer names) and keep any other parenthetical as an **alias** (§3b). 159 of 1,721 parentheticals are not pure tags, for example `devi mukambike (amme amrtesvari)`, `radhe syam bolo (karala mala)` and `you are creation (srishtiyum niye) english`.
3. **Tokenize** into `[a-z]+` words and run the ordered rules of §6 on each word. The key is the words joined by a space; the **joined key** is the same with the spaces removed. A query typed with no spaces (`jagadishvaridayakaro`) does not exactly equal the joined key wherever an inner word lost a final schwa (`…daykaro`), so it falls through to T6, where inserting `a` costs only 0.5.
4. **Alternate key** (index side only). For `lg == "Tamil"`, also store `devoice(key)` (g→k, d→t, b→p, j→c). For `lg == "Bengali"`, also store the key with `o→a`. The query computes both its key and `devoice(key)`; a query alternate key may only match an entry's alternate key.

Sample outputs: `amriteshwari` and `amrtesvari` → `amrtisvari`; `jagadeeshwari daya karo` → `jagadisvari day karo`; `om namah shivaya` → `om nam sivay`; `krishna`/`krushna`/`krsna` → `krsn`; `aindezhuthu`/`aintezhuttu` → `aindelutu`; `srushtiyum neeye` → `srstyum nye`; `shamkara`/`sankara`/`shankar` → `sangar`; `laxmi`/`lakshmi` → `laksmi`; `gyan`/`jnana`/`gnana` → `gnan`; `njan` → `nan`; `devi daya kari ma` ≠ `devi daya karo ma`.

### 3b. Ranking

The key layer finds a candidate cheaply; the score below orders the candidates. Let `qk` be the query key, `qj` the joined query key, and, for each entry, `k` and `nj` its keys and `nts` its key tokens. The score is the best of the tiers below, computed over the entry's primary key, its alternate key (minus 5) and its alias keys (minus 150):

| Tier | Condition | Score |
|---|---|---|
| T1 exact | `qj == nj` | 1000 |
| T2 prefix | `nj.startsWith(qj)` and `len(qj) ≥ 3` | 800 |
| T3 word-start substring | `len(qj) ≥ 3` and `" "+k` contains `" "+qk` | 700 |
| T4 substring | `len(qj) ≥ 3` and `nj` contains `qj` | 600 |
| T5 token bag | for each query token, the best name token: exact 1.0, prefix 0.8, edit distance `e ≤ max(1, len/4)` gives `0.7−0.1e`. Coverage `cov` = mean of those. If `cov ≥ 0.6` | `300 + 200·cov + 30·inOrder + 20·firstTokenAnchored` |
| T6 fuzzy substring | `sublev(qj, nj) ≤ max(1, len(qj)/5)` (Sellers' approximate-substring edit distance, weighted: e↔i, o↔u, b↔v, k↔g, t↔d, p↔b and inserting or deleting `a` cost 0.5) | `300 − 20e` |
| T7 trigram | Dice coefficient on padded trigrams of `qj` and `nj` is > 0.35 | `200·dice` |

`inOrder` is the fraction of consecutive matched query tokens that appear in increasing position in the name. With it, `krishna manamohana` still finds `manamohana krsna`, while `kanha kaha ho` prefers `kanha kahan ho` over `kaha ho kanha`. Typing only some of the words lands in T3–T5. Typing them in another order lands in T5, at a small penalty.

**Tie-breakers**, applied within a tier: popularity, then title length. Popularity is `3 × min(5, len(l) + has(cs) + has(sm))`, so at most 15 points: the number of volumes plus whether audio and sheet music exist. Title length costs 0.5 per key character. Ranking by shortest title alone surfaced `sivke` for `shiva` and `amma ni` for `amma`; adding popularity moved `amriteshwari`'s expected song from 8th to 4th. If usage data is ever logged (clicks per song), it should replace this proxy.

**Things to keep that the key must not swallow:**
- **Location and tag search.** The app currently keys on `n + l.join('') + t`, so `vol5-74` finds a song. Keep that as a separate exact-substring path; the phonetic key would mangle `vol5`.
- **Highlighting.** `Highlight` splits the display text on the raw query words, so `krishna` does not mark `krsna`. Keep, for each name word, a map from its key token to its original span, and highlight the original words whose key tokens matched.
- **Performance.** Precompute the keys, alternate keys and trigram sets once, alongside `window.searchableBhajans`. T1–T4 are string operations over about 2.8k entries. Run T5–T7 only when T1–T4 return fewer than about 20 hits; `sublev` is O(|q|·|n|) per entry (not yet timed in a browser).

### 3c. Test set and metric for hill-climbing

- **Format**: `query<TAB>expected1<TAB>expected2…` (the prototype's `tests_set.tsv`). The expected names are exact `n` values. When two real songs both legitimately answer a query, list both, so that tuning does not overfit to one arbitrary choice (`kahan ho kanha` → `kaha ho kanha` | `kanha kahan ho (hindi)`).
- **Metrics**: top-1 accuracy, top-3 accuracy, and MRR (mean of 1/rank of the first acceptable answer, 0 if absent), as in FIRE MSIR. Also track **collisions**: the number of key groups holding more than one distinct title, split into "same song, spelling drift" and "distinct songs merged". A rule change is accepted only if MRR does not drop and no new distinct-song merge appears.
- **Growing the set**:
  1. Log zero-result and abandoned queries from the app; GA4 already records events.
  2. For each of the top 200 songs (by `cs`/`sm`/volume count), generate variants with `indic_transliteration` (IAST→HK, ITRANS, OPTITRANS `to_lay_indian`) and Aksharamukha Roman (Readable/Colloquial), plus hand-written Hunterian forms.
  3. Mine the sheet-music file names in this folder as free real-world variants (`Jagadishvari`, `AmrteshvariJagadishvari`).
  4. Keep 20% of the set held out and never look at it while tuning.
- **Unit tests**: each rule-table row gets a pair of strings that must collide and a pair that must not. Run the same JSON fixture in Vitest and in a Python test, so the JS and Python ports cannot drift.

---

## 4. Pitfalls: over-collapse, with real index examples

Applying the proposed key to the index gives 2,710 distinct keys and 24 groups covering 49 titles. The current `makeSearchable` gives 8 groups with 16 titles, but only because it fails to merge most real variants. The groups fall into two classes.

**Same song, spelling drift.** These merges are the point of the key, and they also expose index duplicates worth cleaning up: `jai jagadisvari` / `jaya jagadisvari`, `murali vale` / `muralivale`, `radhe syam radhe syam` / `radhesyam radhesyam (hindi)`, `chen mile` / `cenmile`, `innallo karthika nalu` / `…kartika…`, `paurnami ravil` / `paurnnamiravil`, `amme kannu turakkule` / `…turakule`, `samkara siva samkara` / `sankara siva sankara`, `svami saranam ayappa` / `…ayyappa`.

**Distinct songs merged.** These are unavoidable on title alone, so show all of them and let the language chip and volume tell them apart:
- `jai jai ram` (Sanskrit, vol5-74) vs `jai jai rama (kannada)` (vol7-112): merged by the final-schwa rule.
- `tanana tanana` (Hindi) vs `tannana tannana (english)` vs `tannanna tannanna (malayalam)`: three songs merged by gemination.
- `krsna kannaya` (Hindi, 3 volumes) vs `krsna kanaiyya (malayalam)`: merged by gemination and `iy→y`.
- `nandalal nandalal` vs `nandalala nandalala`; `ma jai jai ma` vs `ma jay jay ma`.

**Rules that over-collapse:**
- **Dropping every `h`.** The current code does this, and so did prototype v1: `kanha`, `kana` and `kanna` all became `kan`, and so did `kahan`. The query `kanha` then returned `kana kana (marathi)` first. Fix: keep `h` after `n` (`kanha` → `kanh`) and between vowels (`kahan`, `mahadev`). After the fix, `krsna kanhaiya` stops merging with `krsna kannaya`.
- **Keeping `mh` as well** made `tumhe` → `tunhe` and `mhara` → `nhara`, because the anusvara rule then turned `m` into `n`. Keep only `nh`.
- **Anusvara `m→n` before `r`** turned `amrta` into `anrta`; `r`, `l`, `y`, `v` and `m` are excluded.
- **Final-schwa drop on short words** turned `amma` into `am`, which made `amrta…` a prefix match for the query `amma`. The rule needs at least 3 letters left (`^(.{2,}[^aeiou])a$`).
- **Dropping vowels**, as in IndicSOUNDEX and Watchdogs-3, would merge `devi daya kari ma` with `devi daya karo ma`, `nanda nandana hare` with `…hari`, `hrdaya puspame` with `…puspave`, and `irul mari teliyanay` with `…teliyanayi`. Neither of these pairs collides under the proposed key, but each is at edit distance 1, which is why T6 scores below T1–T4. There are 30 such distance-1 pairs among titles of 6+ characters. Others: `ananda mayi` / `ananta mami`, `sitrinbam nadum` / `…natum`, `sri rama namame (tamil)` / `sri rama namamu`, `vithal smaran kara` / `vilhal smaran kara`.
- **Global k/g, t/d voicing.** The current code maps `[tdl]→T`, which merges *tala/dala/lala*. Applied to Tamil entries only, as an alternate key, voicing merges exactly 4 more groups, all of them genuine variants (`enkirundu`/`enkiruntu vandom`, `tanjamena vandom`/`tancamena vantom`, …). It also fixed `azhagu azhagu` → `azhaku azhaku (tamil)`.
- **`amma amma amma en amma` vs `amma amma ena unnai`** give `ama ama ama en ama` and `ama ama en unay`. They stay distinct, but a query of `amma amma` is a prefix of both and of 5 others, so popularity has to decide.
- **Word-final nasal (Hindi chandrabindu/anusvara).** `kahan` vs `kaha`. A rule dropping a final `n` would merge Malayalam `nan` with `na`, so leave it to the fuzzy layer and word-order scoring.
- **Parentheticals are mixed data.** `(malayalam, krishna)` names a singer, so indexing it as title text makes `krishna` match unrelated songs. Index parentheticals as an alias key with a 150-point penalty, and keep a stoplist of known singer names.
- **Existing bug.** `[^A-z0-9]` in both copies of `makeSearchable` uses the range `A-z`, which also contains `[ \ ] ^ _` and the backtick. Use `[^a-z0-9]` after lowercasing.

---

## 5. The 40 test queries

Every expected name below was checked to exist verbatim as `n` in `public/bhajan-index2.json`. **Old** is the rank under the current filter, with results in index order (– means not found); **New** is the rank under the proposed key with alternate keys and popularity.

| # | Query (as a user types it) | Expected `n` | Old | New |
|---|---|---|---|---|
| 1 | amriteshwari | amrtesvari jagadisvari \| amrtesvari jagadisvari he matrrupa | – | 4 |
| 2 | jagadeeshwari daya karo | jagadisvari daya karo | – | 1 |
| 3 | om namah shivaya | om namo namah sivaya | – | 1 |
| 4 | kanna vaa vaa vaa | kanna va va va | – | 1 |
| 5 | amme amritanandamayi devi | amme amrtanandamayi devi | 1 | 1 |
| 6 | aindezhuthu | aintezhuttu (tamil) | 2 | 1 |
| 7 | srushtiyum neeye | srstiyum niye | – | 1 |
| 8 | hare krishna krishna | hare krsna krsna | 1 | 1 |
| 9 | kahan ho kanha | kaha ho kanha \| kanha kahan ho (hindi) | – | 1 |
| 10 | kanha kaha ho | kanha kahan ho (hindi) | – | 1 |
| 11 | ganesha namah om | ganesa namah om | 1 | 1 |
| 12 | gajaanana | gajanana | 1 | 1 |
| 13 | ganapathi bappa morya | ganapati bappa moraya (marathi) | – | 1 |
| 14 | shree rama jaya rama | sri rama jaya rama | – | 1 |
| 15 | radhe shyam radhe shyam | radhe syam radhe syam | 1 | 1 |
| 16 | panduranga vittala | panduranga vithala | 1 | 1 |
| 17 | vitthal hari vitthal | vithal hari vithal nam gajari (marathi) \| vithala hari vithala | 1 | 1 |
| 18 | velmuruga | velmuruga velmuruga (tamil) | 2 | 1 |
| 19 | saraswati saraswati | sarasvati sarasvati sarasija | – | 1 |
| 20 | namo namaste mata saraswati | namo namaste matah sarasvati | – | 1 |
| 21 | hara hara mahadeva shambho | hara hara mahadeva sambho | 1 | 1 |
| 22 | shambhu mahadev | sambho mahadeva | – | 1 |
| 23 | gopala govinda krishna | gopala govinda krsna | 1 | 1 |
| 24 | daya karo hari narayan | daya karo hari narayana | 1 | 1 |
| 25 | hari om namo narayanaya | hari om namo narayanaya | 1 | 1 |
| 26 | satyam gnanam anantam | satyam jnanam anantam (sanskrit) | – | 1 |
| 27 | laxmi narasimha | he laksmi nrsimha (hindi) | – | 1 |
| 28 | azhagu azhagu | azhaku azhaku (tamil) | – | 1 |
| 29 | devi sharanam durge sharanam | devi saranam durge saranam | 1 | 1 |
| 30 | jai jagadambe durge maa | jai jagadambe durge ma | 1 | 1 |
| 31 | krishna manamohana | manamohana krsna | – | 1 |
| 32 | shyama sundara madana mohana | syama sundara madana mohana | 1 | 1 |
| 33 | amme bhagavathi kaali maheshwari | amme bhagavati kali mahesvari (malayalam) | – | 1 |
| 34 | cidananda govind mukund | chidananda govinda mukunda | – | 1 |
| 35 | njan ariyunnu | nan aṙiyunnu (malayalam, nandana) | – | 1 |
| 36 | amrithanandamayi sadguru | amrtanandamayi sadguru | 1 | 1 |
| 37 | ambike jagadeeswari | ambike jagadisvari | – | 1 |
| 38 | kaali durge namo namah | kali durge namo nama | 1 | 1 |
| 39 | amma amma ennum | amma amma enum (tamil) | – | 1 |
| 40 | durge dukha nivarini | durge duhkha-nivarini bhavatarini amrtesvari (malayalam) | 1 | 1 |

The only remaining miss is #1. A one-word query that is a prefix of 46 titles can only be ordered by popularity, and the volume count says `amrtesvari susmita` and `amrtesvari vandanam` are as common as the expected song. Click data would settle it.

---

## 6. Rule table, as portable JSON

The rules are applied in order to each lowercase word that has already been folded, CamelCase-split and tokenized. In JS each entry runs as `w = w.replace(new RegExp(p, 'g'), r)`. In Python it is `re.sub(p, r.replace('$1', r'\1').replace('$2', r'\2'), w)`.

```json
[
  ["zh", "l", "R1  zha: azhagu = alagu"],
  ["ksh|x", "ks", "R2  ksa: lakshmi = laxmi = laksmi"],
  ["^(jn|gn|gy|jny|dny)", "gn", "R3  jna, word-initial"],
  ["(jn|gy|jny|dny)", "gn", "R3b jna, medial"],
  ["^(nj|ny)", "n", "R4  Malayalam ña-: njan = nan"],
  ["chh|ch", "c", "R5  c/ch"],
  ["([^aeioun])h", "$1", "R6a aspirates and sh, but keep nh (kanha != kana)"],
  ["([a-z])h$", "$1", "R6b visarga: namah = nama"],
  ["w", "v", "R7"],
  ["f", "p", "R7"],
  ["q", "k", "R7"],
  ["z", "j", "R7"],
  ["ee|ii|ie", "i", "R8  vowel length"],
  ["oo|uu", "u", "R8  vowel length"],
  ["aa+", "a", "R8  vowel length"],
  ["ou|ow", "au", "R9  gourango = gaurango"],
  ["esv", "isv", "R10 -isvara- morpheme: eshwari = ishvari"],
  ["([^aeiou])r[iu]([^aeiouy])", "$1r$2", "R11 vocalic r: krishna = krushna = krsna"],
  ["iy", "y", "R12 glide"],
  ["m([^aeiouymvrl])", "n$1", "R13 anusvara: shamkara = sankara"],
  ["nt", "nd", "R14 post-nasal voicing"],
  ["nk", "ng", "R14 post-nasal voicing"],
  ["mp", "mb", "R14 post-nasal voicing"],
  ["nc", "nj", "R14 post-nasal voicing"],
  ["([a-z])\\1+", "$1", "R15 gemination: amma = ama"],
  ["ai$", "ay", "R16 jai = jay"],
  ["^(.{2,}[^aeiou])a$", "$1", "R17 final schwa, stem of 3 or more letters: rama = ram"]
]
```

Each entry is `[pattern, replacement, comment]`, and both ports read only `[0]` and `[1]`. Keep the table in one shared JSON file and load it from both `src/` and `create-index/`.

Alternate keys, index side, chosen by `lg`: Tamil uses `g→k, d→t, b→p, j→c`; Bengali uses `o→a`.

Fuzzy-layer substitution costs (0.5 instead of 1): e↔i, o↔u, b↔v, k↔g, t↔d, p↔b, c↔j, s↔c, and inserting or deleting `a`.

**Rule order matters**: R1 must run before R7 (`z→j`), R5 before R6, R8 before R17 (`raamaa` → `rama` → `ram`), R11 before R15, and R15 before R17.
