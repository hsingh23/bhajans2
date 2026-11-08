"""Layamritam dump loading and vocabulary maps onto the app's labels.

Language and deity map onto the `lg` / `d` values in public/bhajan-index2.json; raga and
taal onto the ids in public/music-reference.json. Unmapped values are None (not compared).
"""
import json
import re
import unicodedata
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
DUMP = ROOT / "layamritam"


def fold(s):
    return "".join(c for c in unicodedata.normalize("NFKD", s or "") if not unicodedata.combining(c))


LANGUAGE_FIX = {
    "Samskritam": "Sanskrit", "Braj Bhasa": "Braj Bhasha", "Marwadi": "Marwari", "Konkini": "Konkani",
    "Farsi": "Persian", "Gaelic": "Irish", "Arabic-Egyptian": "Arabic", "Creole": "Kreole", "Kasmiri": "Kashmiri",
    "Fusion": None, "?": None, "": None,
}

DEITY = {
    "Ammā": "Amma", "Ayyappa": "Ayyappa", "Dēvi": "Devi", "Durga": "Devi", "Gaṇapati": "Ganesha",
    "Gautama Buddha": "Other", "Guru": "Guru", "Hanumān": "Hanuman", "Kāḷi": "Devi", "Kṛṣṇa": "Krishna",
    "Lakṣmi": "Devi", "Love": "Universal", "Muruga": "Murugan", "Narahari": "Vishnu", "Nature": "Universal",
    "Navagraha": "Other", "Peace": "Universal", "Radha": "Krishna", "Rāma": "Rama", "Saraswati": "Devi",
    "Śiva": "Shiva", "Sūrya": "Other", "Vēdāntic": "Universal", "Vēnkaṭaramaṇa": "Vishnu", "Viṣṇu": "Vishnu",
    "Viṭṭala": "Krishna",
}

# Layamritam raagam name -> music-reference.json raga ids (several for a combined label).
RAGA = {
    "Ābhēri": ["abheri"], "Ābhēri, Ānandabhairavi": ["abheri", "anandabhairavi"], "Abheri, Charukeshi": ["abheri", "charukesi"],
    "Ābhōgi": ["abhogi"], "Adana": ["atana"], "Ahirbhairav": ["chakravakam"], "Ānanda bhairavi": ["anandabhairavi"],
    "Bageshri": ["bageshri"], "Bageshri, Valachi": ["bageshri", "valaji"], "Begada": ["begada"], "Bhīmpalāsi": ["abheri"],
    "Bilahari": ["bilahari"], "Bowli": ["bowli"], "Brindavan Saranga": ["brindavanasaranga"], "Bṛndāvani": ["brindavanasaranga"],
    "Cakravākam": ["chakravakam"], "Chandrakauns": ["chandrakauns"], "Charukeshi": ["charukesi"],
    "Darbāri Kānaḍa": ["darbarikanada"], "Des": ["desh"], "Dhīra śankarābharaṇam": ["dheerasankarabharanam"],
    "Dwijavanthi": ["dwijavanthi"], "Gowri Manōhari": ["gourimanohari"], "Hamsadhwani": ["hamsadhwani"],
    "Hamsanadam": ["hamsanadam"], "Hari kāmbhōji": ["harikambhoji"], "Hemavathi": ["hemavati"], "Hindolam": ["hindolam"],
    "Jaijaiwanti": ["jaijaiwanti"], "Jog": ["jog"], "Jōnpuri": ["jaunpuri"], "Kaapi": ["kapi"],
    "Kalyāṇa Vasantam": ["kalyanavasantham"], "Kalyani": ["mechakalyani"], "Kambhoji": ["kambhoji"], "Kanada": ["kanada"],
    "Kedara Gowla": ["kedaragowla"], "Kharaharapriya": ["kharaharapriya"], "Kīravāṇi": ["keeravani"], "Lalitha": ["lalitha"],
    "Maand": ["maand"], "Madhuvanti": ["madhuvanti"], "Madhyamāvati": ["madhyamavati"], "Malayamarutam": ["malayamarutham"],
    "Maya Malava Goula": ["mayamalavagowla"], "Mechakalyani": ["mechakalyani"], "Miyān Ki Malahar": ["miyanmalhar"],
    "Mohanam": ["mohanam"], "Nalinakanthi": ["nalinakanti"], "Naṭabhairavi": ["natabhairavi"], "Nāṭakapriya": ["natakapriya"],
    "Neelambari": ["neelambari"], "Panthuvarali": ["kamavardhini"], "Panthuvarali, Vasantha": ["kamavardhini", "vasantha"],
    "Reetigowla": ["reethigowla"], "Revagupti": ["revagupti"], "Rēvati": ["revati"], "Sama": ["sama"],
    "Sarasangi": ["sarasangi"], "Shanmukhapriya": ["shanmukhapriya"], "Simhendra Madhyamam": ["simhendramadhyamam"],
    "Sindubhairavi": ["sindhubhairavi"], "Śivaranjani": ["shivaranjani"], "Sivaranjini": ["shivaranjani"], "Sree": ["sri"],
    "Sri Ranjani": ["sriranjani"], "Śubha Pantuvarāḷi": ["shubhapantuvarali"], "Suddha Dhanyasi": ["shuddhadhanyasi"],
    "Śuddha Sāvēri": ["shuddhasaveri"], "Tilang": ["tilang"], "Udaya Ravichandrika": ["shuddhadhanyasi"],
    "Vakulabharanam": ["vakulabharanam"], "Valachi": ["valaji"], "Vasanta": ["vasantha"], "Yadukulakambhoji": ["yadukulakambhoji"],
    "Yamunā Kaḷyāṇi": ["yamunakalyani"],
}
# Same scale under two names: treat as agreeing.
RAGA_SAME = [{"dwijavanthi", "jaijaiwanti"}, {"mechakalyani", "yamunakalyani"}, {"abheri", "kapi"},
             {"shuddhadhanyasi", "abhogi"}]

# Layamritam taalam -> (app taal id, beats per cycle). Taals with the same beats agree; jhaptal (10 = 2 x 5)
# is the app's 5-beat khanda chapu.
TAAL = {
    "Keherwa/Tīn tāḷ-8/16": ("keherwa", 8), "Dādra-6/12": ("dadra", 6), "Rūpak/Dīp chandī - 7/14": ("rupak", 7),
    "Jap tāḷ - 10": ("khandachapu", 5), "9 beats": (None, 9),
}
TAAL_BEATS = {"keherwa": 8, "adi": 8, "dadra": 6, "rupakam": 6, "rupak": 7, "mishrachapu": 7, "khandachapu": 5}


def same_raga(a, b):
    return a == b or any(a in s and b in s for s in RAGA_SAME)


def load_metadata():
    md = json.loads((DUMP / "metadata.json").read_text())
    return {
        "language": {x["languageId"]: x["languageName"] for x in md["language"]},
        "raagam": {x["raagamId"]: x["raagamName"] for x in md["raagam"]},
        "taalam": {x["taalamId"]: x["taalamName"] for x in md["taalam"]},
        "deity": {x["deityId"]: x["deityName"] for x in md["deity"]},
        "mood": {x["moodId"]: x["moodName"] for x in md["mood"]},
    }


def language(name):
    f = fold(name).strip()
    return LANGUAGE_FIX.get(f, f) if f in LANGUAGE_FIX else (f or None)


def load_songs():
    """[(catalog entry, sorted lyric parts)] for every song in the dump."""
    cat = json.loads((DUMP / "songs_catalog.json").read_text())
    out = []
    for s in cat:
        f = DUMP / "lyrics" / f"{s['songId']}.json"
        parts = (json.loads(f.read_text()).get("parts") or []) if f.exists() else []
        out.append((s, sorted(parts, key=lambda x: x["displayOrder"])))
    return out


def labels(s, meta):
    """The song's labels in the app's vocabulary, plus the raw Layamritam names."""
    lang_raw = meta["language"].get(s.get("languageId"), "")
    deities_raw = [meta["deity"].get(x["deityId"], "") for x in s.get("SongDeities", [])]
    ragas_raw = [(meta["raagam"].get(x["raagamId"], ""), x.get("source")) for x in s.get("SongRaagams", [])]
    taals_raw = [meta["taalam"].get(x["taalamId"], "") for x in s.get("SongTaalams", [])]
    moods_raw = [meta["mood"].get(x["moodId"], "") for x in s.get("SongMoods", [])]
    ragas = []
    for name, src in ragas_raw:
        for rid in RAGA.get(name, []):
            ragas.append({"id": rid, "src": src, "raw": name})
    taals = [TAAL[t] for t in taals_raw if t in TAAL]
    return {
        "lg": language(lang_raw),
        "d": list(dict.fromkeys(DEITY[d] for d in deities_raw if d in DEITY)),
        "ragas": ragas,
        "taals": taals,
        "raw": {"language": lang_raw, "deity": deities_raw, "raga": [r[0] for r in ragas_raw],
                "raga_source": [r[1] for r in ragas_raw], "taal": taals_raw, "mood": moods_raw,
                "speed": s.get("speed"), "difficulty": s.get("difficulty")},
    }


TITLE_NOISE = re.compile(r"\s*(\.\.\.|…)\s*$|\s*\(\d+\)\s*")


def clean_title(t):
    t = re.sub(r"\s+", " ", TITLE_NOISE.sub(" ", t or "")).strip()
    return t


LANGS = {"malayalam", "tamil", "telugu", "kannada", "hindi", "sanskrit", "samskritam", "bengali", "marathi", "gujarati",
         "gujrati", "tulu", "punjabi", "odia", "english", "french", "spanish", "german", "italian", "japanese", "dutch",
         "finnish", "portuguese", "hebrew", "chinese", "russian", "sindhi", "marwari", "polish", "turkish", "kashmiri"}


def strip_language(t):
    """Drop language tags ("- Telugu", "(kannaḍa)", "(Vintage)") - the heading names the language itself."""
    is_lang = lambda w: fold(w).lower().strip(" .") in LANGS  # noqa: E731
    if t.count("(") > t.count(")"):
        t = t[: t.rindex("(")]  # a truncated "(...": Layamritam cuts long titles
    t = re.sub(r"\s*-\s*([^\s()\-]+)(\s+version)?(?=\s*(\)|$|\())", lambda m: "" if is_lang(m.group(1)) else m.group(0), t, flags=re.I)
    t = re.sub(r"\(\s*([^()]+?)\s*\)", lambda m: " " if is_lang(m.group(1)) or re.fullmatch(
        r"vintage|chants|slow|[a-z]+ ?version", fold(m.group(1)).lower()) else m.group(0), t)
    return t


def display_title(title):
    """(title, alias) without Layamritam's tags: language ("- Telugu", "(kannaḍa)"), "(Vintage)",
    the key of a chant recording, a truncated "(...". A long title's trailing "(...)" becomes the alias."""
    t = strip_language(clean_title(title))
    t = re.sub(r"\s+[A-G](#|b)?(?=\s*(\(|$))", "", t)  # key of a chant recording
    t = re.sub(r"\(\s*\)", " ", re.sub(r"\s+\)", ")", t))
    alias = None
    m = re.search(r"\(([^)]{3,})\)\s*$", t)
    main = t
    if m and len(t) > 40:
        main, alias = t[: m.start()].strip(), m.group(1).strip()
    return re.sub(r"\s+", " ", main).strip(" -.,"), alias
