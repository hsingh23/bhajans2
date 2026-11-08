# Layamritam songs: extra lyrics book and metadata

Brings the Layamritam app's song data into the app: songs whose lyrics are in no songbook
get pages in a new lyrics book, `public/pdfs/extra.pdf` (index locations `extra-<page>`,
shown as "Additional songs"), and Layamritam's language / deity / raga / taal labels fill
gaps in the app's data. Where Layamritam disagrees with the app nothing is changed; the
pair goes on `metadata-review.md` to double-check.

Input: the dump in `<repo>/layamritam/` (gitignored, local only; its README says how it
was fetched and how to refresh it with `fetch_all_lyrics.py`).

## Pipeline (run from the repo root)

```bash
uv run --with rapidfuzz python create-index/layamritam/match_index.py      # -> matches.json
uv run --with rapidfuzz python create-index/layamritam/select_new.py       # appends new songs to extra-manifest.json
uv run --with pymupdf --with rapidfuzz --with fonttools python create-index/layamritam/render_pdf.py   # -> public/pdfs/extra.pdf
uv run --with rapidfuzz python create-index/layamritam/merge_metadata.py   # index, categories, music, review list
```

1. **`match_index.py`** decides, for every Layamritam song, which index song it is. Its
   lyrics (IAST) are folded with the sheet-match normaliser and compared, as character
   5-grams, with each index song's printed text in the songbooks
   (`../sheet-match/match.py` segments). A match needs half of the Layamritam lyrics on
   the printed page; titles only decide when there is no printed text to compare. Language
   matters: a Telugu version of a Malayalam song shares names and refrains with it, so a
   weaker overlap in another language is a `version` (a different song), not a match.
   Decisions (Nov 2026, 3,262 songs): 2,666 `lyrics`, 12 `lyrics+title`, 66 `title`
   (no lyrics to compare), 235 `version`, 29 `doubt` (same name and language, different
   lyrics, e.g. Omkara Divya Porule 47-66), 254 `missing`.
2. **`select_new.py`** takes the `missing` / `version` / `doubt` songs that have lyrics,
   merges Layamritam's several recordings of one song (shared lyrics in one language, or
   the same title with 40%), and appends them to **`extra-manifest.json`**. The manifest is
   append-only: a song keeps its place, name (`n`, which favorites are keyed by) and page.
3. **`render_pdf.py`** prints each manifest song on its own pages, Vol 6 style (page size,
   upper-case title with the language, bold transliterated lines, indented English
   meaning) without header or footer, in EB Garamond (`fonts/`, SIL OFL) with MuPDF's
   HarfBuzz shaping so the Vedic accent marks of the suktams sit right. The PDF has a
   bookmark per song. It records each song's first page and page count in the manifest
   and **refuses to re-render if an earlier song would move**; a song that gets shorter
   keeps its blank pages. `--repage` renumbers everything (only before the pages are
   published, since index locations point at them).
   Layamritam's meanings are mostly all lower case: `meanings-cased.json` restores the
   case (sentence starts, I, O, the Divine, names); a line is used only if it differs from
   the original in letter case alone, otherwise a rule-based recaser in `render_pdf.py`
   is used. English sentences Layamritam stored in the lyrics field are printed as meaning.
4. **`merge_metadata.py`** appends the new songs to `public/bhajan-index2.json` (at the
   end: array position is the song id in viewer URLs) and `../bhajan-categories.json`, and
   fills raga and taal in `public/bhajan-music.json` where the app has none, marked
   `"src": "layamritam"` with confidence below the UI's "sure" thresholds (raga 0.8 for
   Layamritam's human labels, 0.6 for its machine labels; taal 0.75).
   `music-additions.json` keeps the fills; `../music-meta/build_music_json.py` re-applies
   them after a rebuild. Disagreements go to `metadata-review.md` / `.csv`.

## Adding more songs later

Refresh the dump, rerun the four steps. New songs go to the end of the manifest, get new
pages at the end of the book and new index entries at the end of the index; nothing
already published moves. A song can also be added by hand: append
`{"songId": <Layamritam id>, "same": [], "n": "<index name (language)>", "title": "...",
"lg": "...", "why": "manual", "versionOf": null}` to the manifest and run steps 3-4.

## Song samples from Layamritam recordings

Songs the app has no CD sample for (no `cs`) play a 75-second sample cut from
Layamritam's recording instead, and songs that have CD samples get Layamritam's other
versions (vintage, instrumental, other singers) as extra samples.

```bash
python3 <repo>/layamritam/fetch_audio.py <authToken> <songId>...       # mp3s -> layamritam/audio/
python3 create-index/layamritam/make_samples.py layamritam/sample-sources.json   # -> layamritam/samples/, samples.json
aws s3 sync layamritam/samples s3://singwithamma/samples-layamritam/ --acl public-read \
  --content-type audio/mpeg --cache-control "public, max-age=31536000, immutable"
python3 create-index/layamritam/link_samples.py --check-dups           # cs / cn in public/bhajan-index2.json
```

- Which recordings: every Layamritam song `matches.json` assigns to an index song
  (`lyrics`, `lyrics+title`, `title`) plus each extra-book song's `songId` and `same`.
- Samples copy the CD samples' shape, measured on the existing ones: the first 73 s
  with a 2 s fade-out, then 2 s of silence, 96 kb/s 44.1 kHz stereo MP3.
- `samples.json` maps an index name to its samples (`path`, label `song`, `songId`).
  `--check-dups` cross-correlates each sample with the song's CD samples and marks
  `dupOf` when it is the same recording (score >= 0.5; same recordings score 0.8-0.99,
  different ones under 0.1); those stay unlinked. `mergelinks.js` re-applies the mapping
  after it rebuilds `cs`.
- Tokens: every load of the Layamritam web app logs in again and voids older tokens, so
  take the token from the only open Layamritam tab (two tabs void each other's: 401
  "session expired").

## Vocabulary maps (`lmeta.py`)

Language and deity map onto the app's `lg` / `d` values (Vēdāntic, Love, Peace, Nature ->
Universal; Kāḷi, Durga, Lakṣmi, Saraswati -> Devi; Viṭṭala, Radha -> Krishna). Ragas map
onto `music-reference.json` ids (Panthuvarali is Kamavardhini, Kalyani is Mechakalyani);
names with no reference raga are skipped. Taals compare by beats per cycle (Keherwa/Tīn
tāḷ 8, Dādra 6, Rūpak 7, Jap tāḷ 10 = the app's 5-beat khanda chapu).

## Agreement with the app (Nov 2026)

Raga, over 2,700 matched pairs: 741 the same raga, 81 the same scale under another name,
713 one scale inside the other (a pentatonic raga inside a heptatonic one), 933 different.
Layamritam marks 96% of its raga labels `ai`; only 16 of the different ones are human
labels. The review list shows those and the ones where the app's label is confident
(c >= 0.85); the rest are in the CSV only.
