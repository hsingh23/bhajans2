#!/usr/bin/env python3
"""Match each song in public/bhajan-index2.json to recordings in the Box inventory.

Writes box-matches.json: {song_name: [{id, name, folder, score}, ...]} best first.
Box titles are usually the first few words of the bhajan's first line, with
diacritics, track numbers and the odd suffix ("WM", "(Vintage)", "(bhagesri)").
"""
import json
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

from rapidfuzz import fuzz, process

HERE = Path(__file__).parent
INDEX = HERE.parent.parent / "public" / "bhajan-index2.json"
INVENTORY = HERE.parent / "box" / "box-inventory.json"
OUT = HERE / "box-matches.json"
OVERRIDES = HERE / "box-overrides.json"  # {song: {"add": [track names], "drop": [track names], "why": ...}}

AUDIO_EXT = {"mp3", "m4a", "wav", "aif"}
SKIP_FOLDERS = ("1 MP3/Talks", "1 MP3/Playlists", "1 MP3/Amma/For Mike")
# Higher = preferred recording of the same song (Amma's studio releases first).
FOLDER_RANK = [
    ("1 MP3/Amma/Amma Bhajans 2025 UPD", 9), ("1 MP3/Amma/Amma Bhajans 20", 8),
    ("1 MP3/Amma/Amritanjali", 7), ("1 MP3/Amma/World Tour Albums", 6),
    ("1 MP3/Amma/Languages", 5), ("1 MP3/Amma/", 4), ("1 MP3/Swami Bhajans", 2),
    ("1 MP3/Amma's Devotees/Instrumental", 0), ("1 MP3/", 1),
]


def folder_rank(folder):
    return next(r for p, r in FOLDER_RANK if folder.startswith(p))
LANG_WORDS = r"(malayalam|hindi|sanskrit|tamil|telugu|kannada|bengali|marathi|gujarati|punjabi|oriya|odia|tulu|english|french|german|spanish|italian|japanese|braj bhasha|version|kannada version|assamese|nepali|konkani|rajasthani|bhojpuri|kashmiri|sindhi|urdu|dogri|maithili|manipuri|kodava|tibetan|sinhala|prakrit|pali)"


NON_DECOMPOSABLE = str.maketrans({"ø": "o", "Ø": "O", "æ": "ae", "Æ": "AE", "œ": "oe", "Œ": "OE", "ß": "ss", "ł": "l", "Ł": "L", "đ": "d", "Đ": "D", "ð": "d", "þ": "th"})


def ascii_fold(s):
    s = unicodedata.normalize("NFKD", s.translate(NON_DECOMPOSABLE))
    return "".join(c for c in s if not unicodedata.combining(c))


sys.path.insert(0, str(HERE.parent))
from bkey import TAGS, bkey, oneWordKey  # noqa: E402  shared phonetic key (src/bkey-rules.json)


def phonetic(s):
    """The app's shared key (src/bkey-rules.json) as one word, collapsed a little further for
    Box track titles, which are typed by many hands: y/i, remaining vowel length, doubled letters."""
    k = oneWordKey(s)
    for a, b in [("y", "i"), ("aa", "a"), ("ee", "i"), ("oo", "u"), ("ii", "i"), ("uu", "u")]:
        k = k.replace(a, b)
    return re.sub(r"(.)\1+", r"\1", k)


def clean_index_name_raw(n):
    n = re.sub(r"\(" + LANG_WORDS + r"[^)]*\)", " ", n.lower())
    return re.sub(r"\b" + LANG_WORDS + r"\s*$", " ", n).replace("-", " ")


def edit_distance(a, b, max_d):
    """Damerau-Levenshtein (adjacent transposition counts one), capped at max_d + 1."""
    if abs(len(a) - len(b)) > max_d:
        return max_d + 1
    prev2, prev = None, list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            d = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb))
            if prev2 is not None and i > 1 and j > 1 and ca == b[j - 2] and a[i - 2] == cb:
                d = min(d, prev2[j - 2] + 1)
            cur.append(d)
        if min(cur) > max_d:
            return max_d + 1
        prev2, prev = prev, cur
    return prev[-1]


ARTICLES = {"the", "te", "a", "o", "oh", "sri"}  # as typed and as keyed; sri is an honorific prefix
VOICED = str.maketrans("gdbj", "ktpc")
VOWELS = re.compile(r"[aeiou]")
ASPIRATION = re.compile(r"(?<=[^aeiou])h")


def schwa(word):
    """Hindi drops a word-final schwa (Jaya/Jay, Rama/Ram, Mata/Mat): drop a final 'a' on a
    keyed word of four or more letters so both spellings agree."""
    return word[:-1] if len(word) >= 4 and word.endswith("a") else word


def skeleton(word, nasal=True):
    """The consonants of a keyed word, devoiced, without h and (unless nasal=False) without a
    final nasal (anusvara m/n): the part of a romanized Indian word that every spelling keeps
    (Amudam/Amutam, Satguru/Sadguru, tujhe/tuje, manasam/manasan)."""
    k = VOWELS.sub("", word).replace("h", "").translate(VOICED)
    if nasal and len(word) >= 3 and k[-1:] in ("m", "n"):
        k = k[:-1]
    return k


def word_match(x, y):
    """3 = the same word.
    2 = a spelling of the same word: the consonant skeleton agrees and, with h (aspiration)
        ignored, either the vowels are identical (voicing differs: Amudam/Amutam, tujhe/tuje),
        or the written consonants are identical and the words differ only in their final vowel
        run (namame/namamu, hare/hari, ammave/ammavai, vihara/vihari), by one vowel inserted
        inside the word (kisiki/kiski) or a y-glide in front (enne/yenne), or, on a word of
        seven or more letters, by one inner e/i or o/u (Karindra/Karendra). Any other inner
        vowel change is a different word (nalam/nalum, nisayute/nashayute, arivinte/aravinte),
        and so is a dropped final vowel on a short stem (hari/hara).
    1 = a long word (six or more consonants) one letter apart in a consonant
        (paurnamiravil/paunamiravil, Sharanathikalude/saranarthikalude).
    0 = different words (Skanda/Ananda, Raja/Rama, Karunalaye/Karunamayi, Narayana/Narajan)."""
    if x == y:
        return 3
    sx, sy = skeleton(x), skeleton(y)
    if sx == sy:
        x2, y2 = ASPIRATION.sub("", x), ASPIRATION.sub("", y)  # bh/dh/th/kh... lose the h; maha, hari keep it
        if VOWELS.findall(x2) == VOWELS.findall(y2):
            return 2
        if VOWELS.sub("", x2) == VOWELS.sub("", y2):
            tx, ty = x2.rstrip("aeiou"), y2.rstrip("aeiou")
            runs = len(x2) - len(tx), len(y2) - len(ty)
            if tx == ty and max(runs) <= 2 and (len(tx) >= 2 and min(runs) or len(tx) >= 4):  # vihara/vihari yes, hara/hari and ka/ke no
                return 2
            lo, hi = sorted((x2, y2), key=len)
            if len(hi) == len(lo) + 1:
                if len(hi) >= 5 and any(hi[:i] + hi[i + 1:] == lo for i in range(1, len(hi) - 1) if hi[i] in "aeiou"):
                    return 2
                if hi[0] == "i" and hi[1:] == lo:  # y-glide: yenne / enne
                    return 2
            if len(x2) == len(y2) >= 7:  # one inner vowel of a long word, within the pairs scripts confuse
                diff = [(cx, cy) for cx, cy in zip(x2, y2) if cx != cy]
                if len(diff) == 1 and set(diff[0]) in ({"e", "i"}, {"o", "u"}):
                    return 2
        return 0
    rx, ry = skeleton(x, nasal=False), skeleton(y, nasal=False)
    if max(len(rx), len(ry)) >= 6 and edit_distance(rx, ry, 1) <= 1 and edit_distance(x, y, 1) <= 1:
        return 1
    return 0


def split_match(parts, whole):
    """The song word `whole` is the pieces `parts` written apart, each piece a spelling of its
    part (word_match >= 2): 2 when every piece fits, else 0."""
    def go(k, pos):
        if k == len(parts):
            return pos == len(whole)
        for end in range(pos + 2, len(whole) + 1):
            if word_match(schwa(parts[k]), schwa(whole[pos:end])) >= 2 and go(k + 1, end):
                return True
        return False
    return 2 if len(whole) >= 6 and go(0, 0) else 0


def words_tier(t_words, s_words, full=False):
    """Align the track's words to the song's words in order (either may run out first; two
    adjacent words may merge into one of the other side: "japo nam" / "japonam"; the last word
    of the side that runs out may be a prefix of four or more letters of the other side's word:
    "Mahita Sneham" / mahita sneha maharnnavam, "Janamanaharini" / janamana). Returns the
    weakest word match used (3 exact, 2 spelling, 1 near, 0 no alignment), provided the aligned
    part is six letters or more and the exact-or-spelling words (or near words of eight or more
    letters) carry at least half of its words and letters, so "rama rama" is not "radha radha"
    and "Oru Nalamma" is not "oru nalum piriyatto"."""
    def go(i, j):
        """best (weakest match, good words, good letters, aligned letters, aligned words) from (i, j)"""
        if j == len(t_words) or i == len(s_words):
            return (3 if not full or (j == len(t_words) and i == len(s_words)) else 0, 0, 0, 0, 0)
        best = (0, 0, 0, 0, 0)
        options = [(t_words[j], s_words[i], i + 1, j + 1, False)]
        if j + 1 < len(t_words):
            options.append((t_words[j] + t_words[j + 1], s_words[i], i + 1, j + 2, True))
        if j + 2 < len(t_words):  # "Amme Yennu Loru" / ammayennulloru
            options.append((t_words[j] + t_words[j + 1] + t_words[j + 2], s_words[i], i + 1, j + 3, True))
        if i + 1 < len(s_words):
            options.append((t_words[j], s_words[i] + s_words[i + 1], i + 2, j + 1, True))
        if i + 2 < len(s_words):
            options.append((t_words[j], s_words[i] + s_words[i + 1] + s_words[i + 2], i + 3, j + 1, True))
        for raw_x, raw_y, ni, nj, merged in options:
            x, y = schwa(raw_x), schwa(raw_y)
            m = word_match(x, y)
            if m == 2 and merged:
                # the pieces lost their word-final schwa before the join: "Kalamurali" is kala murali
                pieces = t_words[j:nj] if nj - j >= 2 else s_words[i:ni]
                whole = y if nj - j >= 2 else x
                joins = {"".join(pieces[:q]) + "a" + "".join(pieces[q:]) for q in range(1, len(pieces))}
                if whole in joins or schwa(whole) in {schwa(v) for v in joins}:
                    m = 3
            if not m and merged and nj - j >= 2 and ni - i == 1:
                m = split_match(t_words[j:nj], raw_y)  # "Amme Yennu Loru" / ammayennulloru
            if not m and not merged and j >= 2 and 2 <= min(len(x), len(y)) and max(len(x), len(y)) <= 3 and (x.startswith(y) or y.startswith(x)):
                m = 2  # "kar le ma ka" / "Kar Le Ma Kar": a short particle with or without its last letter, after two aligned words
            if m == 1 and merged:
                m = 0  # a merged word may not also be a letter off
            if not m and not merged and (i or j) and min(len(raw_x), len(raw_y)) >= 5 and abs(len(raw_x) - len(raw_y)) <= 2 and (raw_x.startswith(raw_y) or raw_y.startswith(raw_x)):
                m = 2  # a grammatical ending on a word after the first (ariyunna / ariyunnar)
            if not m and not merged and min(len(x), len(y)) >= 4 and (nj == len(t_words) or ni == len(s_words)) and (i or j):  # never as the only unit: "Nityananda" is not nityanandattil
                # At the end of either title one word may be the first letters of the other's: a
                # title cut short ("Janamanaharini" / janamana, "Narajivitam" / narajivitamakum,
                # up to seven letters and not more than the word kept) or an ending kept on the last
                # word ("Mahita Sneham" / sneha maharnnavam, varnna / varnnan: two letters), but
                # not as the opening word ("Brahmarame" is not brahma murari, "Panchama" is not
                # panca-bhutamum, "Lalitamba" is not lalita lalita).
                short, long_ = sorted((x, y), key=len)
                ext = len(long_) - len(short)
                both_end = nj == len(t_words) and ni == len(s_words)
                ender_is_long = not both_end and ((nj == len(t_words) and long_ == x) or (ni == len(s_words) and long_ == y))
                if long_.startswith(short) and (ext <= 2 if ender_is_long else ext <= 7 and ext <= len(short)):
                    m = 2
            if not m:
                continue
            rest = go(ni, nj)
            if not rest[0]:
                continue
            good = m >= 2 or len(x) >= 8
            cand = (min(m, rest[0]), rest[1] + good, rest[2] + good * len(x), rest[3] + len(x), rest[4] + 1)
            if cand[0] > best[0] or (cand[0] == best[0] and cand[2] > best[2]):
                best = cand
        return best

    if not t_words or not s_words:
        return 0
    tier, good_words, good_letters, letters, words = go(0, 0)
    if not tier and not full:
        # a title that drops a repeated word ("Darshanam Sudarshanam" for darsanam darsanam
        # sudarsanam) still names the song when, with consecutive repeats collapsed on both
        # sides, every word of both titles aligns
        dt = [w for k, w in enumerate(t_words) if k == 0 or w != t_words[k - 1]]
        ds = [w for k, w in enumerate(s_words) if k == 0 or w != s_words[k - 1]]
        if (dt != list(t_words) or ds != list(s_words)) and len(dt) >= 2 and len(ds) >= 2:
            return min(2, words_tier(dt, ds, full=True))  # never outranks an entry with the repeat
    if not tier or letters < 6 or 2 * good_letters < letters or 2 * good_words < words:
        return 0
    return tier


def title_tier(track_key, song_key, track_words=(), song_words=(), full=False):
    """How well a Box track title names a song: 3 the same title (as one key, or word for word
    ignoring word breaks and a Hindi word-final schwa: "Jay Ma Jay Ma" / "jaya ma jaya ma");
    2 a spelling variant word for word (vowels, voicing, aspiration); 1 a near match on a long
    word; 0 not this song. A leading English article is ignored on either side."""
    if not track_key or not song_key:
        return 0
    if track_key == song_key:
        return 3
    tw, sw = list(track_words), list(song_words)
    if tw and tw[0] in ARTICLES and tw[0] != (sw[0] if sw else None):
        tw = tw[1:]
    if sw and sw[0] in ARTICLES and sw[0] != (tw[0] if tw else None):
        sw = sw[1:]
    if tw == sw and tw:
        return 3
    return words_tier(tw, sw, full)


TIER_NAME = {3: "same title", 2: "spelling variant (vowels, voicing or aspiration)", 1: "near match on a long word", 0: "different words"}


def clean_index_name(n):
    n = re.sub(r"\(" + LANG_WORDS + r"[^)]*\)", " ", n.lower())
    n = re.sub(r"\b" + LANG_WORDS + r"\s*$", " ", n)
    return phonetic(ascii_fold(n).replace("-", " "))


ROMAN = {"ii": 2, "iii": 3, "iv": 4, "v": 5, "vi": 6, "vii": 7, "viii": 8, "ix": 9, "x": 10, "xi": 11, "xii": 12, "xiii": 13, "xiv": 14, "xv": 15}


LANG_ALIASES = {"gujrati": "gujarati", "telagu": "telugu", "oriya": "odia", "odiya": "odia", "telegu": "telugu", "bangla": "bengali", "tamizh": "tamil", "francais": "french", "français": "french", "deutsch": "german", "espanol": "spanish", "español": "spanish", "portugues": "portuguese", "português": "portuguese", "farsi": "persian"}
FOREIGN = {"german", "french", "spanish", "japanese", "english", "hebrew", "danish", "finnish", "portuguese", "italian", "russian", "arabic", "dutch", "swedish", "chinese", "korean", "polish", "czech", "greek", "turkish", "swahili", "norwegian", "hungarian", "romanian", "slovak", "slovenian", "croatian", "ukrainian", "persian", "indonesian", "thai", "vietnamese", "latvian", "lithuanian", "estonian", "gaelic", "irish", "welsh", "scottish", "latin", "catalan", "basque", "tagalog", "malay", "afrikaans", "bulgarian", "serbian", "icelandic", "maori", "hawaiian"}


def album_language(folder):
    """A non-Indian language named by the album folder ("German/Dive Deep", "Bhajans Français
    Vol. 3", "Japanese Bhajan 2020"): such albums hold translations, so their recordings are not
    the Indian-language entry. Indian language names in album titles are not used: Sanskrit
    and Malayalam songs sit on "Hindi Bhajans" albums."""
    last = folder.lower().split("/")[-1]
    m = re.match(r"^([a-z]+) bhajans? 20\d\d", last)  # "Tamil Bhajan 2020": the year's songs in that language
    if m:
        w = LANG_ALIASES.get(m.group(1), m.group(1))
        if re.fullmatch(LANG_WORDS, w) or w in FOREIGN:
            return w
    for w in re.findall(r"[a-zà-ÿ]+", folder.lower()):
        w = LANG_ALIASES.get(w, w)
        if w in FOREIGN:
            return w
    return None


def language_of(text):
    """The language a parenthetical names ("(Gujarati)", "(kannada version)"), normalised, else None."""
    for p in re.findall(r"\(([^)]*)\)", text.lower()):
        w = p.strip().split()[0] if p.strip() else ""
        w = LANG_ALIASES.get(w, w)
        if re.fullmatch(LANG_WORDS, w) or w in LANG_ALIASES.values() or w in FOREIGN:
            return w
    return None


def part_number(title):
    """The part a title names, when it ends in one: "omkara divya porule - 7", "... viii",
    "bhagavad gita 15th chapter", "Omkara Divya Porule 55", "Chapter 8". Years (2025) and a
    lone "i" (Malayalam for "this") are not parts. None when the title names no part."""
    t = re.sub(r"\([^)]*\)", " ", title.lower()).strip()
    m = re.search(r"(?:^|[\s-])(\d{1,3})(?:st|nd|rd|th)?(?:\s+chapter)?\s*$", t) or re.search(r"\bchapter\s+(\d{1,3})\b", t)
    if m:
        return int(m.group(1))
    m = re.search(r"\b(" + "|".join(ROMAN) + r")\s*$", t)
    return ROMAN[m.group(1)] if m else None

LANG_TOKENS = {w for tok in LANG_WORDS.strip("()").split("|") for w in tok.split()} | set(LANG_ALIASES) | set(LANG_ALIASES.values()) | FOREIGN | {"version"}


def is_version(n):
    """Whether an entry calls itself a version of a song ("iniyoru janmam - kannada version"): a
    translation named after its original."""
    return "version" in re.split(r"[^a-z]+", ascii_fold(n).lower())


def name_tagged(n):
    """Whether an entry's own name names a language or calls itself a version ("cuttuniri (tamil)",
    "amma devi - kannada version", "karunamayi devi (kannada,telugu)"); the original entry of a song
    sung in several languages carries no such tag."""
    return any(w in LANG_TOKENS for w in re.split(r"[^a-z]+", ascii_fold(n).lower()))


def clean_box_name(n):
    n = ascii_fold(n).lower()
    n = re.sub(r"\.(mp3|m4a|wav|aif)$", "", n)
    n = re.sub(r"^\s*(\d+-)?\d+\s*[-.]?\s*", "", n)  # "01 ", "1-04 ", "12. "
    n = re.sub(r"\b(wm|44k16b\S*|\d{6})\b", " ", n)
    hint = re.findall(r"\(([^)]*)(?:\)|$)", n)  # a truncated file name may lose the closing bracket
    n = re.sub(r"\([^)]*\)?", " ", n).replace("-", " ").replace("_", " ")
    return phonetic(n), hint


def key_words(text):
    """Phonetic key of each word, for the word-by-word title rule (the schwa drop happens at
    comparison time so that merged words keep their inner vowel). Numbers and ordinals
    ("15th") are part numbers, handled by part_number, not words."""
    text = re.sub(r"\b\d+(st|nd|rd|th)?\b", " ", ascii_fold(text).lower())
    return [k for k in (phonetic(w) for w in re.findall(r"[a-z]+", text) if w not in TAGS) if k]


def song_words(n):
    return key_words(clean_index_name_raw(n))


def song_titles(n):
    """The song's name without parentheticals, plus each non-language parenthetical that is a
    title of its own ("atbhuta charitre (albhuta charitre)"), each as (key, words)."""
    base = re.sub(r"\([^)]*\)", " ", clean_index_name_raw(n))
    titles = [base] + [p for p in re.findall(r"\(([^)]*)\)", clean_index_name_raw(n)) if len(re.sub(r"[^a-z]", "", p)) >= 4]
    return [(phonetic(ascii_fold(t)), key_words(t)) for t in titles if phonetic(ascii_fold(t))]


def song_aliases(song):
    """The CD Baby track titles already linked to the song (`cn`, from cdbaby/mergelinks.js)
    that are a spelling of the song's whole name under the word rule (so "paravarshamannen
    hridayam" stands for paravasamanen hrdayam, but a CD Baby "Durge" or "Jai Jai Rama"
    fanned out onto a longer song does not). A Box title must equal one word for word."""
    out = []
    titles = song_titles(song["n"])
    for c in song.get("cn", []):
        k, w = phonetic(ascii_fold(c)), key_words(c)
        if k and any(title_tier(k, tk, w, tw, full=True) >= 1 for tk, tw in titles):
            out.append((k, w))
    return out


def song_tier(track_key, track_words, song, titles=None, aliases=None):
    """How well a Box track title names the song: its name and parenthetical titles at any
    tier, its CD Baby aliases only when the words are the same (tier 3)."""
    titles = song_titles(song["n"]) if titles is None else titles
    aliases = song_aliases(song) if aliases is None else aliases
    best = max((title_tier(track_key, k, track_words, w) for k, w in titles), default=0)
    if best < 3 and any(title_tier(track_key, k, track_words, w) == 3 for k, w in aliases):
        best = 3
    return best


def track_words(name):
    n = ascii_fold(name).lower()
    n = re.sub(r"\.(mp3|m4a|wav|aif)$", "", n)
    n = re.sub(r"^\s*(\d+-)?\d+\s*[-.]?\s*", "", n)
    n = re.sub(r"\b(wm|44k16b\S*|\d{6})\b", " ", n)
    n = re.sub(r"\([^)]*\)?", " ", n).replace("-", " ").replace("_", " ")
    return key_words(n)


def main():
    index = json.loads(INDEX.read_text())
    inv = json.loads(INVENTORY.read_text())
    files = [
        f for f in inv["files"]
        if f["ext"] in AUDIO_EXT and not f["folder"].startswith(SKIP_FOLDERS)
    ]
    box_keys, meta = [], []
    for f in files:
        key, hint = clean_box_name(f["name"])
        if len(key) < 3:  # a three-letter title ("Ē Amma!") only ever matches its exact song
            continue
        box_keys.append(key)
        meta.append({**f, "hint": hint, "words": track_words(f["name"]), "part": part_number(re.sub(r"\.(mp3|m4a|wav|aif)$", "", f["name"])), "lang": language_of(f["name"]), "album_lang": album_language(f["folder"])})

    out = {}
    overrides = json.loads(OVERRIDES.read_text()) if OVERRIDES.exists() else {}
    titles_for = {song["n"]: song_titles(song["n"]) for song in index}
    aliases_for = {song["n"]: song_aliases(song) for song in index}
    song_for = {song["n"]: song for song in index}
    part_for = {song["n"]: part_number(clean_index_name_raw(song["n"])) for song in index}
    lang_for = {song["n"]: language_of(song["n"]) or (song.get("lg") or "").lower() or None for song in index}
    tier_cache = {}

    ambiguous_cache = {}

    def ambiguous_word(w, song_name):
        """True when the track's single word is only the first word of this song and of at least
        one other song too (no song is named by that word alone)."""
        if w not in ambiguous_cache:
            def core(ws):  # the song's words without a leading article or Sri
                return ws[1:] if ws and ws[0] in ARTICLES and len(ws) > 1 else ws
            def glued(ws, k):
                return "".join(ws[:k])
            exact = [n for n in titles_for if any(any(glued(core(ws), k) == w and k == len(core(ws)) for k in range(1, len(core(ws)) + 1)) for _, ws in titles_for[n])]
            opens = [n for n in titles_for if any(any(glued(core(ws), k) == w and k < len(core(ws)) for k in range(1, len(core(ws)))) for _, ws in titles_for[n])]
            ambiguous_cache[w] = (set(exact), set(opens))
        exact, opens = ambiguous_cache[w]
        return song_name not in exact and len(opens) >= 2

    hint_owner_cache = {}

    main_full_cache = {}

    def main_title_is_an_entry(i):
        """the track's main title, before any parenthetical, is the whole name of some entry
        ("Chinna Kanna (Pyare Kanha)" is the Tamil entry chinna kanna; its parenthetical only
        says which Hindi song it is a version of)"""
        if i not in main_full_cache:
            main_full_cache[i] = any(
                title_tier(box_keys[i], k, meta[i]["words"], w, full=True) >= 2
                for n in titles_for for k, w in titles_for[n]
            )
        return main_full_cache[i]

    def hint_owners(i):
        """songs whose name is, word for word, a multi-word parenthetical of the track
        ("06 Amma Amma (Amme Amme Amritanandam...)" names amme amme amrtanandamayi): the
        recording is that song, not another song that merely shares its first words. Not
        used when the main title is itself an entry's whole name."""
        if i not in hint_owner_cache:
            owners = set()
            if main_title_is_an_entry(i):
                hint_owner_cache[i] = owners
                return owners
            for h in meta[i]["hint"]:
                hw = key_words(h)
                if len(hw) >= 2 and phonetic(h):
                    owners |= {n for n in titles_for if song_tier(phonetic(h), hw, song_for[n], titles_for[n], []) >= 2}
            hint_owner_cache[i] = owners
        return hint_owner_cache[i]

    def tier(i, song_name):
        """best tier of track i against the song's name and alias titles; a track numbered as one
        part of a hymn that the index splits into parts fits only that part ("Omkara Divya
        Porule 55" is not part viii; an unnumbered recording fits every part)"""
        if part_for[song_name] is not None and meta[i]["part"] is not None and meta[i]["part"] != part_for[song_name]:
            return 0
        owners = hint_owners(i)
        if owners and song_name not in owners:
            return 0
        if meta[i]["lang"] and lang_for[song_name] and meta[i]["lang"] != lang_for[song_name]:
            return 0  # "(Gujarati)" recording is not the Punjabi entry's; language versions are separate songs
        if not meta[i]["lang"] and meta[i]["album_lang"] and lang_for[song_name] and meta[i]["album_lang"] != lang_for[song_name]:
            return 0  # a track on a German album is the German translation ("02 Darshan" sings German); a track's own language tag wins over the album's
        if lang_for[song_name] in FOREIGN and not (meta[i]["lang"] == lang_for[song_name] or meta[i]["album_lang"] == lang_for[song_name]):
            # an entry in a non-Indian language (a translation, often named after its original) takes an
            # untagged recording only when the whole title matches and no Indian-language entry has the same title
            if not any(title_tier(box_keys[i], k, meta[i]["words"], w, full=True) == 3 for k, w in titles_for[song_name]):
                return 0  # "Ellam Ariyunna Amme" carries a Malayalam word beyond the English entry's name
            if any(n != song_name and lang_for[n] not in FOREIGN and any(title_tier(box_keys[i], k, meta[i]["words"], w, full=True) == 3 for k, w in titles_for[n]) for n in titles_for):
                return 0  # the Indian-language twin holds the untagged recording
        core = [w for k, w in enumerate(meta[i]["words"]) if not (k == 0 and w in ARTICLES)]
        if len(core) == 1 and ambiguous_word(core[0], song_name):
            return 0  # a one-word title that opens several songs ("Amriteshwari", "Sri Lalitambike") names none of them
        return song_tier(box_keys[i], meta[i]["words"], song_for[song_name], titles_for[song_name], aliases_for[song_name])

    def best_tier(i):
        """the best tier any song reaches for track i: the title goes to the best-fitting songs"""
        if i not in tier_cache:
            tier_cache[i] = max(tier(i, n) for n in titles_for)
        return tier_cache[i]

    short_unique = {}

    def short_title_fits(i, song_name):
        """A title under six letters ("Hana Mo") is accepted only when it is the first words of
        exactly one index song and the recording's language (its parenthetical or album
        folder) is that song's language."""
        key = box_keys[i]
        if len(key) >= 7 or len(meta[i]["words"]) < 2:  # six-letter keys can still align under six letters ("hana mo")
            return False
        if key not in short_unique:
            short_unique[key] = [n for n in titles_for if any(w[: len(meta[i]["words"])] == meta[i]["words"] for _, w in titles_for[n])]
        owners = short_unique[key]
        lang = meta[i]["lang"] or language_of("(" + meta[i]["folder"].split("/")[-1] + ")")
        return len(owners) == 1 and owners[0] == song_name and lang is not None and lang == lang_for[song_name]

    full_cache = {}

    full3_cache = {}

    def full3_entries(i):
        """the entries whose whole name is the whole track title (word for word) and whose language fits"""
        if i not in full3_cache:
            full3_cache[i] = [n for n in titles_for if tier(i, n) > 0 and any(title_tier(box_keys[i], k, meta[i]["words"], w, full=True) == 3 for k, w in titles_for[n])]
        return full3_cache[i]

    tier3_cache = {}

    def tier3_entries(i):
        """the entries track i names at tier 3 (same words, either side may run out first), once per track"""
        if i not in tier3_cache:
            tier3_cache[i] = [n for n in titles_for if tier(i, n) == 3]
        return tier3_cache[i]

    def other_language(i, song_name, pool):
        return [n for n in pool if n != song_name and lang_for[n] not in FOREIGN and lang_for[n] != lang_for[song_name]]

    def yields(i, song_name):
        """An entry that calls itself a version ("kalamurali - tamil version", "(kannada
        version)") is a translation named after its original: an untagged recording that names
        it and an untagged entry in another language equally goes to that original ("Kalamurali
        Rava" is kala murali; "Abhishta Varadayike" is the Malayalam entry, confirmed by the
        sung words)."""
        if meta[i]["lang"] or meta[i]["album_lang"] or not is_version(song_name):
            return False
        return any(not name_tagged(n) for n in other_language(i, song_name, tier3_entries(i)))

    def rivals_block(i, song_name):
        """An untagged recording whose whole title is the whole name of entries in two Indian
        languages: version entries yield to the untagged original (see yields); an entry with a
        plain language tag ("jaya jagadisvari (marathi)", "nandalala nandalala (sanskrit)",
        "krsna govinda gopala (hindi)") is often a different song sharing the title, and the
        sung words went against the untagged side in three of eighteen readable recordings, so
        neither side takes it; box-overrides.json records the decisions made from the audio."""
        if meta[i]["lang"] or meta[i]["album_lang"] or lang_for[song_name] in FOREIGN:
            return False  # a tagged recording is placed by its tag; translations into non-Indian languages by tier()
        if yields(i, song_name):
            return True
        full = full3_entries(i)
        if song_name not in full:
            return False  # a title that is the first words of several songs fans out as before
        rivals = other_language(i, song_name, full)
        if not rivals:
            return False
        return name_tagged(song_name) or not all(is_version(n) for n in rivals)

    def full_owner_exists(i):
        """some song's whole name is the whole track title and may take it or at least contest it:
        shorter entries that merely open with the title then yield to it; only whole-title owners
        that are versions yielding to an untagged original are discounted ("Apara Kripalo" with
        version-only owners would go to the original apara krpalo arikil)"""
        if i not in full_cache:
            full_cache[i] = any(not yields(i, n) for n in full3_entries(i))
        return full_cache[i]

    def accepts(i, song_name):
        t = tier(i, song_name)
        if t == 3 and not meta[i]["lang"] and not meta[i]["album_lang"] and rivals_block(i, song_name):
            return False
        if t > 0 and t == best_tier(i):
            if t == 3 and full_owner_exists(i) and not any(title_tier(box_keys[i], k, meta[i]["words"], w, full=True) == 3 for k, w in titles_for[song_name]):
                return False  # "Amritanandamayi Ma Tucch Ko" is that song, not the one-word entry amrtanandamayi
            return True
        return short_title_fits(i, song_name)

    owner_tracks = defaultdict(list)  # song -> tracks whose parenthetical names it
    for i in range(len(box_keys)):
        if meta[i]["hint"]:
            for n in hint_owners(i):
                owner_tracks[n].append(i)
    for song in index:
        keys = {clean_index_name(song["n"])} | {phonetic(ascii_fold(c)) for c in song.get("cn", [])}
        cands = defaultdict(float)
        for i in owner_tracks.get(song["n"], []):
            cands[i] = 100.0  # the recording names this song in its parenthetical
        for key in keys:
            if not key:
                continue
            for _, _, i in process.extract(key, box_keys, scorer=fuzz.WRatio, limit=40):
                b = box_keys[i]
                # Box titles are the first words of the song: score against the same-length
                # prefix of the song key (plus or minus a letter), not against an alignment, which
                # for a repeated title ("ni matram ni matram ...") lands on a later repetition.
                prefix = max(fuzz.ratio(b, key[:n]) for n in (len(b) - 1, len(b), len(b) + 1)) if len(b) <= len(key) + 2 else 0
                s = max(prefix, fuzz.ratio(b, key))
                cands[i] = max(cands[i], s)
        # Best text match first; among near-ties (within 3 points) prefer canonical albums.
        top = max(cands.values(), default=0)
        ranked = sorted(
            cands.items(),
            key=lambda kv: (-(kv[1] >= top - 3), -folder_rank(meta[kv[0]]["folder"]), -kv[1]),
        )
        rows = [
            {
                "id": meta[i]["id"],
                "name": meta[i]["name"],
                "folder": meta[i]["folder"],
                "size": meta[i]["size"],
                "hint": meta[i]["hint"],
                "score": round(s, 1),
                # accept only when the text score is high AND the title names this song (title_tier)
                "accept": s >= 80 and accepts(i, song["n"]),
                "tier": tier(i, song["n"]),
            }
            for i, s in ranked if s >= 70
        ]
        ov = overrides.get(song["n"], {})
        for name in ov.get("add", []):  # an added recording may not be among the candidates at all
            if not any(r["name"] == name for r in rows):
                for i, m in enumerate(meta):
                    if m["name"] == name:
                        rows.append({"id": m["id"], "name": m["name"], "folder": m["folder"], "size": m["size"], "hint": m["hint"], "score": 0.0, "accept": False, "tier": 0})
        for r in rows:  # decisions made from the recording's own words win over the title rule
            if r["name"] in ov.get("add", []):
                r["accept"], r["override"] = True, ov.get("why", "")
            if r["name"] in ov.get("drop", []):
                r["accept"], r["override"] = False, ov.get("why", "")
        # every accepted recording, then up to twelve rejected candidates for the record
        out[song["n"]] = [r for r in rows if r["accept"]] + [r for r in rows if not r["accept"]][:12]
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1))
    n = len(index)
    for t in (95, 90, 85, 80):
        hit = sum(1 for v in out.values() if v and v[0]["score"] >= t)
        print(f"best score >= {t}: {hit}/{n} ({hit / n:.0%})")


def check():
    """Pin the title rule on the hand-labelled pairs in title-fixtures.json."""
    fx = json.loads((HERE / "title-fixtures.json").read_text())
    index = {x["n"]: x for x in json.loads(INDEX.read_text())}
    bad = 0

    def got_for(track, song, with_aliases):
        key, hint = clean_box_name(track)
        song_d = index.get(song, {"n": song})
        tl, sl = language_of(track), language_of(song) or (song_d.get("lg") or "").lower() or None
        if tl and sl and tl != sl:
            return 0
        aliases = song_aliases(song_d) if with_aliases else []
        return song_tier(key, track_words(track), song_d, aliases=aliases)

    for track, song, want in fx["pairs"]:  # the title rule on the song's name alone
        got = got_for(track, song, False)
        if got != want:
            bad += 1
            print(f"title rule: {track!r} vs {song!r} gives {got}, expected {want}")
    for track, song, want in fx.get("alias_pairs", []):  # with the song's CD Baby aliases
        got = got_for(track, song, True)
        if got != want:
            bad += 1
            print(f"alias rule: {track!r} vs {song!r} gives {got}, expected {want}")
    n = len(fx["pairs"]) + len(fx.get("alias_pairs", []))
    print(f"title fixtures: {n - bad}/{n} ok")
    return bad


if __name__ == "__main__":
    if "--check" in sys.argv:
        sys.exit(1 if check() else 0)
    main()
