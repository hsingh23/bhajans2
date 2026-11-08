# Amazon buy-link check

Which index songs are on Amazon.com as Amma's recordings, and the track to link to.

1. `make_batches.py` splits `public/bhajan-index2.json` into 10 batches (`batches/`).
2. `run_worker.sh NN` feeds a batch to `pi` (zai/glm-5.3-flash) 8 songs at a time with `prompt.md`;
   results go to `out/out_NN.jsonl` (rerun-safe). `BATCHES=batches2 OUTDIR=out2` for a top-up pass.
   `status.sh` shows progress.
3. `recheck.py` re-searches songs marked not_found and keeps Amma tracks whose title has the same
   phonetic key (`../bkey.py`). The GLM workers missed about 1 in 6 songs that are on Amazon.
4. `verify_albums.py` looks up each matched track's album and its artist (`amz.py album`):
   the track page only names its album; searching the album ASIN shows the artist.
5. `combine.py` writes `amazon-buy.json` (song name -> status, matches, album, app_button_ok).

`amz.py` fetches Amazon search pages with a browser user agent, waits and retries on a CAPTCHA,
and never solves one. Amazon product pages for MP3s are JavaScript-only, so everything comes
from search results.
