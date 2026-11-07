# Musician metadata: data contract for the app

Two static files, fetched only when musician mode is on (regular users download nothing extra).

## `public/bhajan-music.json` — per song, keyed by the index song name (`n` in bhajan-index2.json)

```json
{
  "abhayam abhayam amma": {
    "sh": { "pc": 7, "k": "5", "alt": [8], "c": 0.92, "src": "box" },
    "r":  [ { "id": "mohanam", "sec": "all", "c": 0.9 } ],
    "t":  { "id": "keherwa", "alt": "adi", "b": 8, "ts": "4/4", "bpm": 96, "pulse": "quarter", "sub": 2, "c": 0.85 },
    "ch": ["I", "IV", "V", "vi"],
    "en": "Sing in G (5 kattai). Major-pentatonic tune: G A B D E, no C or F#. 8-beat keherwa: count 1-2-3-4 at about 96 BPM.",
    "c":  0.88
  }
}
```

| key | meaning |
|---|---|
| `sh.pc` | shruti / Sa as pitch class 0-11 (0 = C) of the recording the app plays |
| `sh.k` | kattai name ("1"=C, "1.5"=C#, "2"=D, "2.5"=D#, "3"=E, "4"=F, "4.5"=F#, "5"=G, "5.5"=G#, "6"=A, "6.5"=A#, "7"=B) |
| `sh.alt` | other plausible Sa pitch classes (e.g. another recording) |
| `sh.c` | confidence 0-1; `sh.src`: "box" (full recording), "cd" (sample), "sheet" |
| `r` | ragas in order; `id` keys into music-reference.json `ragas`; `sec` "all" or a short label ("verse", "charanam 2"); empty list + `"rn": "none"` = no raga (Western/light tune) |
| `t` | taal: `id` / `alt` key into `taals`; `b` beats per cycle; `ts` Western time signature; `bpm` pulse tempo; `pulse` "quarter" / "dotted-quarter"; `sub` 2 or 3 (beat subdivision) |
| `ch` | main chord progression as Roman numerals relative to Sa (only when sheet music exists) |
| `en` | one or two plain-English sentences for a non-Indian musician |
| `c` | overall confidence; the UI shows a subtle "approximate" marker below 0.7 |

Any field may be missing (no recording, no sheet music, low confidence).

## `public/music-reference.json` — shared tables, small

```json
{
  "ragas": { "mohanam": { "name": "Mohanam", "hi": "Bhupali", "aroha": ["S","R2","G3","P","D2","S"], "avaroha": ["S","D2","P","G3","R2","S"], "pcs": [0,2,4,7,9], "western": "major pentatonic", "mood": "joyful" } },
  "taals": { "keherwa": { "name": "Keherwa", "system": "hindustani", "beats": 8, "vibhag": [4,4], "bols": ["dha","ge","na","ti","na","ka","dhi","na"], "clap": "X 0", "western": "4/4", "feel": "the common bhajan groove" } }
}
```

Swara tokens: S r1 R2 g2 G3 M1 M2 P d1 D2 n2 N3 = semitones 0..11 above Sa.
The UI computes concrete note names by adding `sh.pc` to each swara's semitone, so the
scale is always shown in the song's actual key (e.g. Mohanam on G → G A B D E).
