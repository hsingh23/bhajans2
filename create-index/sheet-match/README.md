# Sheet-music matching

Links every sheet-music PDF (`create-index/sheetmusiclist.txt`, served from the
`singwithamma` S3 bucket) to the songs in `public/bhajan-index2.json` by comparing the
**lyrics printed in the PDF** with the **lyrics printed in the songbooks**
(`public/pdfs/vol1-7.pdf`, `2025.pdf`, the 2018-2021 supplements). Names are only
corroboration. This replaced the name-only matcher in `cdbaby/mergelinks.js`, which
linked the English "Amme" sheet to 70 Malayalam songs and left 795 PDFs unlinked.

## Pipeline

```bash
cd create-index/sheet-match
uv run --with pymupdf  python extract_sheets.py   # one PDF per song stem -> sheets.json (title, lyric lines, footer refs)
uv run --with pymupdf  python extract_books.py    # every songbook page -> books.json
uv run --with rapidfuzz python match.py            # -> matches.json, review.md, golden check, old/new comparison
(cd ../music-meta && uv run --with rapidfuzz python match_box.py --check && uv run --with rapidfuzz python match_box.py && uv run --with rapidfuzz python box_report.py)  # Box recordings: fixtures, matches, evidence tables
python3 write_index.py [--check]                   # writes `sm` into public/bhajan-index2.json
```

`match.py` decodes both legacy transliteration fonts with `fontmaps.json` (derived from
aligned text, see `fontmaps_report.md`), folds everything to a phonetic ASCII skeleton,
and scores each (sheet, song) pair by:

- `lyric`: containment of the sheet's character 5-grams in the song's printed text
- `lines`: share of the sheet's lyric lines found on the page
- `pos`: where the sheet's opening lines sit in the song's text (late = a neighbouring,
  unlisted song)
- `title`, `ref`: fuzzy title match (aliases in parentheses count) and whether the PDF
  footer's "Book N, p M" points at one of the song's locations

A song's printed text runs from its title (found by name on the index page or the pages
around it, since index pages drift by one or two) to the next song's title. Songs whose
title line cannot be found get the whole page plus the next one and need a matching name.

`golden.json` holds the user-reported wrong links (from the issues spreadsheet) and known
good ones; `match.py` fails loudly if any regresses. `overrides.json` records the few
manual decisions made after reading the lyrics (closing prayers, mantra-only sheets,
English translations of Indian songs that are not in the index).

Side outputs: `index-page-drift.json` lists index locations whose printed page differs
from the index (`printed: null` = title line not found at all).

## Results (Nov 2026)

1080 sheet stems: 1030 linked by lyrics, 13 by hand (`overrides.json`), 37 with no song in
any songbook. Against the previous index: 999 links kept, 70 added, 473 removed.
`golden.json` (61 cases, every wrong link users reported plus known-good ones) passes.

Evidence files, one row per item:

- `verify_links.json` / `verify_links.py`: an independent page scan (it ignores the
  matcher's segments) finds the sheet's lyric lines on the song's own pages for **1069 of
  1069** links.
- `verify_exclusive.json` / `verify_exclusive.py`: for every link, the linked song's own
  printed text holds more of the sheet's lines than any other song's text (1062 of 1069);
  the seven exceptions were read and are refrain overlaps or a reprint of the same song
  that the index does not list on that page (e.g. Siva Sankara inside the Book II pages of
  Sambho Sankara Umapathe); the links stand.
- `unlinked-phrase-check.md`: two literal five-word phrases from each unlinked sheet
  searched in every page; every phrase is printed nowhere except mantra refrains.
- `unlinked-sheets.md`: for each of the 37 unlinked sheets, the best page anywhere in the
  books with its scores, the songs on that page and the closest index title; none reaches
  the match bar, or it is a bare mantra that recurs as a refrain in unrelated songs.
- `fn_removed.txt` / `removed.txt`: every removed link whose old title still matched
  strongly, with the page the sheet's lyrics really sit on (one restoration resulted).
- `index-page-drift.json`: 49 index locations corrected to the printed page; the closing
  mantras moved from the song-index pages to vol1-259/260; one stray duplicate removed;
  seven mis-transcribed names fixed (`renamed-songs.json`); two reported songs added.
- `missing-bhajan-report.md`: every "Missing Bhajan" report with its nearest index name,
  best page and the text around it.
- `gold-sample.md`: 50 links drawn at random, each read against the printed page by hand
  (50 of 50 correct; `gold-sample-dump.txt` holds the text that was read).
- `gold-sample-200.md`: 150 further random links read by three independent reviewers
  against the printed page, with the page scan beside each verdict: 0 wrong links in the
  200 sampled (the two flags were reviewer misses, re-read and confirmed).
- `gold-sample-all.md`: the remaining 865 links read the same way by twenty reviewers, so
  every one of the 1065 distinct sheet links has now been read against the printed page:
  811 confirmed by reading, 1 flagged and confirmed on re-read (Omkara part IV verses on
  vol1-187), 53 undecidable from the excerpt (blank old Book 3 scans, or songs running past
  it); those, with the 24 from the 150-sample, were re-read against the text edition
  (`gold-sample-undecided.md`). 0 wrong links found in 1065.
- `mantra-sheets.md`, `overrides-evidence.md`: the mantra-only sheets and the 13 hand
  overrides, each with the printed text that decides it.
- `audio-link-changes.json` / `audio-losses.md`: CD Baby audio links, every changed song.
- `gold-sample-second-read.md`: 100 random links read again by a different model as an
  independent second reader: agreement with the first read 100 of 100 on the links (the
  second reader's flags were all traced to the dump showing a neighbouring page).
- `gold-sample-undecided.md`: the 77 links the full read could not decide from the index
  page (blank old Book 3 scans), re-read against the text-edition page: 72 confirmed, the
  rest resolved (two Omkara parts printed on later pages, three documented overrides).
- `box-error-rate.md`: the Box matcher's measured error rate on two random samples of 300
  (accepted links; rejected near misses), every flag adjudicated: 4 wrong accepted links
  found (two language versions, one parenthetical naming another song), now rejected by
  rule; 5 genuine misses among 300 near misses, four now closed by rule or print-backed
  rename, one left (a title that follows the first line where the index follows the heading).
- `box-audio-sample.md`: 40 accepted links drawn at random among songs in languages Whisper
  transcribes, the recordings transcribed and read against the song's printed lines (a check
  on the sung words, not the title): 12 confirmed, 14 consistent, 12 unintelligible, 1 wrong
  (a German translation titled "Darshan" on a German album, a kind the title can never show)
  and now rejected by rule, 1 open (an entry that exists only as its English version).
- `box-audio-sample-2.md`: a second disjoint draw of 40, taken after those rules: 22
  confirmed by the sung words, 6 consistent, 10 unintelligible, 2 wrong, both caught only by
  the words (a Sanskrit entry given a recording from the "Tamil Bhajan 2020" album whose
  words the Tamil entry prints; a one-word-shorter entry given a recording whose whole title
  is another entry's name) and both now rejected by rule.
- `box-audio-sample-3.md`: a third draw of 40 after the earlier rules: 0 wrong among 30
  with usable audio. `box-error-rate.md` carries the post-fix title samples as well: 1 wrong
  in 300 accepted (a Gaelic translation, now rejected) and 2 missed in 300 near misses (both
  now linked), each closed after measurement.
- `box-audio-sample-4.md` and the fourth round in `box-error-rate.md`: samples drawn after
  the last rule change, 300 accepted links (0 wrong), 300 rejected near misses (0 genuine
  misses; the one disputed rejection, "Radhe Shyam" on a French album, was transcribed and
  sings French) and 40 recordings (0 wrong among 33 with usable audio). Across all rounds:
  1200 accepted and 900 rejected pairs judged by title, 148 recordings read by their sung
  words.
- `box-audio-sample-5.md` and the fifth round in `box-error-rate.md`: 600 accepted and 300
  rejected pairs judged, 40 recordings transcribed; 2 wrong links and 2 misses found by
  title, 1 by the sung words (an identical title in two languages), each now closed by rule.
- `box-link-changes.md`: every song whose Box recordings changed, with a verdict per track;
  `box-spelling-variants.md`: every accepted Box link that is not a same-words match (91,
  all within the 163 of the earlier, looser rule, which were reviewed pair by pair in four
  independent passes).
  The twelve pairs judged different songs are fixtures and rejected; the borderline ones
  are settled ("Paravarshamannen" and "Engu Poyi" are the song's own CD Baby titles) or kept
  as fixtures with the judgement recorded ("Pyare Khana" on a Bengali bhajan album, "Kisiki
  Khoj").

## Shared phonetic key (search and audio)

`src/bkey-rules.json` holds one ordered rule table that turns any romanization of a title
into a phonetic key (`amriteshwari`, `amrtesvari`, `Amrteshvari` all give `amrtisvari`).
`src/bkey.js` and `create-index/bkey.py` are the two ports; `src/bkey.test.js` and
`python3 create-index/bkey.py` run the same fixture pairs so they cannot drift.

- `src/searchRank.js` ranks the in-app search with it (exact key > prefix > word start >
  substring > token bag > fuzzy substring > trigrams; ties by popularity then length).
  `src/searchRank.test.js` measures top-1 and MRR on 42 typed queries from the research
  doc (currently 42/42 first, MRR 1.00, about 20 ms per query).
- `cdbaby/mergelinks.js` links CD Baby samples by the same key: exact title, Tamil
  spelling, whole-word prefix or space-free prefix, at most four songs per sample, exact
  titles only when a short title opens more (the old matcher put the "Amma" sample on 71
  songs and "Amme" on 38). Audio links went from 2104 on 1570 songs to 2632 on 1834 songs;
  `audio-link-changes.json` lists every song whose links changed (the 31 non-fan-out
  losses are misspelt track names such as "Bhaktavalsale", "Kahna", "Brahmarame").
- `music-meta/match_box.py` links Box recordings by title, word for word on the key: the
  same words (word breaks and a Hindi final schwa ignored), a spelling of the same words
  (same consonant skeleton; only vowel endings, voicing, aspiration, an inner schwa or an
  inner e/i, o/u on a long word may differ), or a long word one letter off; one title may be
  the first words of the other; a title that drops a repeated word still counts, below an
  exact match; a title also counts when it equals, word for word, a CD Baby title already
  linked to the song whose own words spell the song's name (`cn`); a title goes only to the
  song(s) it fits best; numbered hymn parts must agree; a recording whose parenthetical
  names a language goes only to an entry of that language, and a recording on an album
  named for a non-Indian language (German, French, Japanese, Portuguese ...) is that
  translation, not the Indian-language entry, and a language-specific album of the
  "Tamil Bhajan 2020" kind holds only that language's entries; a parenthetical that names
  another index song
  sends the recording there and nowhere else; a one-word title that opens several songs
  ("Amriteshwari", "Sri Lalitambike") names none of them; a recording whose whole title is
  another entry's whole name goes to that entry, not to a shorter entry it merely opens;
  when the whole title is the whole name of entries in two Indian languages ("Amma Amma
  Amma", Hindi and Tamil) an untagged recording goes to the entry whose own name carries no
  language tag (the original; "(kannada version)" entries were added for the others) and to
  none when there is no such entry or there are such entries in several languages;
  and `box-overrides.json`
  holds the decisions made from the recording's own sung words. A fuzzy score alone had
  linked different songs one letter apart (Skanda / Ananda Janani, Raja / Rama, Karunalaye /
  Karunamayi Devi). 2250 songs now have an accepted recording against 2294 before (3453
  accepted links; 3095 distinct song/title pairs: 2999 same words, 23 of them through a CD
  Baby alias, 81 spelling, 4 near, 11 from the sung words, a documented override or a unique
  short title): the count is lower than before because the old matcher fanned recordings out
  onto sibling entries that merely open with the same words and onto both language twins of
  a title. 118 songs lose every old
  recording, each with its verdict in `box-link-changes.md` (the earlier losses also have
  their printed-title check in `box-losses-lyrics-check.md`): 28 whose untagged recording's
  title is the whole name of entries in two Indian languages, 18 whose recording's whole
  title is another entry's whole name, 16 translation entries whose untagged recording the
  Indian original holds, 13 on albums named for another language (translations), 8 whose
  title belongs exactly to another entry, 5 one-word titles that open several songs, 5
  language versions, 2 one-word titles too short to tell apart, 7 renames. Ten mis-transcribed names
  were corrected to the printed title (`renamed-songs.json`; the last six: `ennute jivita`,
  `vithal smaran kara`, `jamuna ke tat par`, `hamsa vahina devi`, `nilanjana mizhi`,
  `kaitozhunnen krsna`). `music-meta/title-fixtures.json` pins 127 labelled title pairs,
  name-only and with aliases (`python match_box.py --check`); `box-audio-check.md` records
  what Whisper heard in the doubtful recordings, compared with the sheet's lyric lines; eight
  recordings were linked from their sung words, one ("Nenchakam Ventitunnu") stays unlinked
  because its entry is printed in no book we have and the audio was unintelligible;
  `box-error-rate.md` gives the measured error rate on random samples.

Research behind it: `research-transliteration-search.md`.
