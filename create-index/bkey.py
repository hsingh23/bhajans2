#!/usr/bin/env python3
"""Python port of src/bkey.js: one phonetic key for romanized Indian song titles.

Reads the same rule table (src/bkey-rules.json) so the index tooling (CD Baby and Box
audio matchers) and the app's search agree on what counts as the same name.
Run this file to check the fixtures: python3 bkey.py
"""
import json
import re
import unicodedata
from pathlib import Path

TABLE = json.loads((Path(__file__).resolve().parent.parent / "src" / "bkey-rules.json").read_text())
RULES = [(re.compile(p), r.replace("$1", r"\1").replace("$2", r"\2")) for p, r, *_ in TABLE["rules"]]
TAGS = set(TABLE["tags"])


def fold(text):
    text = "".join(c for c in unicodedata.normalize("NFD", text) if not unicodedata.combining(c))
    text = re.sub(r"[’'`]", "", text)
    return re.sub(r"(?<=\w)-(?=\w)", "", text)


def split_camel(text):
    return re.sub(r"([0-9])([A-Z])", r"\1 \2", re.sub(r"([a-z])([A-Z0-9])", r"\1 \2", text))


def key_word(word):
    for rx, rep in RULES:
        word = rx.sub(rep, word)
    return word


def _words(text):
    return re.findall(r"[a-z]+", fold(text).lower())


def bkey(text, camel=False):
    """{'tokens', 'key', 'joined', 'aliases': [{'tokens','key','joined'}]} like the JS version."""
    s = split_camel(text) if camel else text
    aliases = []

    def take_alias(m):
        toks = [w for w in _words(m.group(1)) if w not in TAGS]
        if toks and len(" ".join(toks)) >= 4:
            aliases.append([k for k in map(key_word, toks) if k])
        return " "

    s = re.sub(r"\(([^)]*)\)", take_alias, s)
    ws = _words(s)
    tokens = [k for k in (key_word(w) for w in ws if w not in TAGS or len(ws) <= 1) if k]
    pack = lambda toks: {"tokens": toks, "key": " ".join(toks), "joined": "".join(toks)}  # noqa: E731
    return {**pack(tokens), "aliases": [pack(a) for a in aliases]}


def oneWordKey(text, camel=False):
    """Key of the whole name as one word (tags and parentheticals dropped)."""
    s = re.sub(r"\([^)]*\)", " ", split_camel(text) if camel else text)
    ws = _words(s)
    return key_word("".join(w for w in ws if w not in TAGS or len(ws) <= 1))


def devoice(key):
    return key.replace("g", "k").replace("d", "t").replace("b", "p").replace("j", "c")


def bengali(key):
    return key.replace("o", "a")


if __name__ == "__main__":
    bad = 0
    for a, b in TABLE["fixtures"]["collide"]:
        if bkey(a)["key"] != bkey(b)["key"]:
            bad += 1
            print("should collide:", a, bkey(a)["key"], "|", b, bkey(b)["key"])
    for a, b in TABLE["fixtures"]["distinct"]:
        if bkey(a)["key"] == bkey(b)["key"]:
            bad += 1
            print("should differ:", a, b, bkey(a)["key"])
    assert bkey("AmrteshvariJagadishvari", camel=True)["key"] == bkey("amrtesvari jagadisvari")["key"]
    print("bkey fixtures:", "ok" if not bad else f"{bad} failures")
