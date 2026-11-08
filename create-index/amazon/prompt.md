You are checking whether bhajans (devotional songs sung by Amma, Mata Amritanandamayi) can be bought on Amazon.com.

Tool: `python3 amz.py search "<words>"` searches Amazon Digital Music; add `--all` to search every department.
Each output line is `ASIN | title | by | artist | format | price`. `BLOCKED` means Amazon refused; `NO RESULTS` means nothing came back.
Run commands from this directory. Use only this tool for Amazon (no curl, no browser). Do not buy anything or sign in.

For EACH song below:
1. If `app_query` is not null, run `python3 amz.py search "<app_query>" --all` (this is exactly what the app's Amazon button searches). Note whether Amma's recording of this song shows in those results.
2. Search Digital Music with the song name without the language in brackets plus "amma", e.g. `python3 amz.py search "abhayam abhayam amma"`. If nothing fits, try one `cd_names` entry or a spelling variant (bhajan transliterations vary: v/w, sh/s, aa/a, ee/i, oo/u, zh/l). At most 4 searches per song.
3. A result counts as a match only if the title is the same song (spelling variations are fine) AND the artist is Amma, Mata Amritanandamayi, Amma's devotees, or Amritapuri/MA Center related. The same title by another singer (e.g. Bhanumathi Narasimhan, a film singer) is NOT a match: list it under `others`. Sharing a word or two is NOT enough: "Abhayam Tann Aruluka" is a different song from "Abhayam Abhayam Amma". The title must be the song's name or its opening words. A "(Vintage, Remastered Version)" or "Instrumental" version by Amma is a match; say so in `version`.

Then append ONE JSON line per song to the output file, using a heredoc so quotes survive:
```
cat >> OUTFILE <<'JSON'
{"i": 10, "n": "abhayattinayi (malayalam)", "status": "found", "matches": [{"asin": "B004G1T0UK", "title": "...", "artist": "Amma", "price": "$1.29", "version": "original"}], "app_button_ok": true, "others": [{"asin": "...", "title": "...", "artist": "..."}], "queries": ["abhayattinayi amma"], "confidence": "high", "note": ""}
JSON
```
Fields:
- `i`, `n`: copied from the input.
- `status`: "found" (at least one Amma match), "possible" (same title but the result shows no artist, so it may be Amma's: put it in `matches` with artist "not shown"), "not_found" (searched, no Amma match), or "blocked" (Amazon kept answering BLOCKED).
- `matches`: every Amma match seen (ASIN, title, artist, price, version: original/vintage/instrumental/live/other). Empty if none.
- `app_button_ok`: true if the app_query results include an Amma match of this song; false if they don't; null if app_query is null.
- `others`: up to 3 same-title recordings by other artists (helps us avoid wrong links). Empty if none.
- `queries`: the searches you ran.
- `confidence`: "high" (title clearly the same song, artist Amma), "medium" (likely, e.g. spelling differs a lot or artist unclear), "low" (guess).
- `note`: short, only if something is odd.

Never invent an ASIN: copy it from the tool output. Do every song in the list, one line each, then stop. Do not edit any other file.

Songs:
