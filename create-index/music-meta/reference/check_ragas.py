#!/usr/bin/env python3
"""Validate ragas.json (stdlib only).

Checks
  * every token in aroha/avaroha is one of the 12 semitone tokens
  * pcs == sorted set of semitones used in aroha + avaroha
  * aroha_traditional/avaroha_traditional (when present) map to the same semitones
  * melakarta numbers are 1..72, unique, all present; each mela has exactly 7
    notes with the structure implied by its number (recomputed here,
    independently of the generator), plus literal spot checks of well-known melas
  * janyas: parent_mela exists, and every note outside the parent mela is
    declared in anya_swaras
  * extra_pcs / anya_swaras are well-formed
  * aliases (normalised: lowercase, alphanumerics only) never resolve to two ragas
  * every raga on the required list resolves by name or alias

usage: python3 check_ragas.py [path/to/ragas.json]
Exit status 1 if any error is found.
"""
import json
import os
import re
import sys

TOKENS = ["S", "r1", "R2", "g2", "G3", "M1", "M2", "P", "d1", "D2", "n2", "N3"]
SEMI = {t: i for i, t in enumerate(TOKENS)}
TRAD = {"S": 0, "R1": 1, "R2": 2, "R3": 3, "G1": 2, "G2": 3, "G3": 4, "M1": 5, "M2": 6,
        "P": 7, "D1": 8, "D2": 9, "D3": 10, "N1": 9, "N2": 10, "N3": 11}
SYSTEMS = {"carnatic", "hindustani", "both"}

# Literal scales of well-known melakartas (semitones), independent of any formula.
KNOWN_MELAS = {
    8: [0, 1, 3, 5, 7, 8, 10],    # Hanumatodi = Phrygian
    15: [0, 1, 4, 5, 7, 8, 11],   # Mayamalavagowla = double harmonic
    16: [0, 1, 4, 5, 7, 9, 10],   # Chakravakam = Ahir Bhairav
    20: [0, 2, 3, 5, 7, 8, 10],   # Natabhairavi = Aeolian
    21: [0, 2, 3, 5, 7, 8, 11],   # Keeravani = harmonic minor
    22: [0, 2, 3, 5, 7, 9, 10],   # Kharaharapriya = Dorian
    23: [0, 2, 3, 5, 7, 9, 11],   # Gourimanohari = melodic minor
    28: [0, 2, 4, 5, 7, 9, 10],   # Harikambhoji = Mixolydian
    29: [0, 2, 4, 5, 7, 9, 11],   # Shankarabharanam = major
    36: [0, 3, 4, 5, 7, 10, 11],  # Chalanata = S R3 G3 M1 P D3 N3
    45: [0, 1, 3, 6, 7, 8, 11],   # Shubhapantuvarali = Todi thaat
    51: [0, 1, 4, 6, 7, 8, 11],   # Kamavardhini = Purvi thaat
    53: [0, 1, 4, 6, 7, 9, 11],   # Gamanashrama = Marwa thaat
    57: [0, 2, 3, 6, 7, 8, 11],   # Simhendramadhyamam = Hungarian minor
    58: [0, 2, 3, 6, 7, 9, 10],   # Hemavati
    59: [0, 2, 3, 6, 7, 9, 11],   # Dharmavati
    64: [0, 2, 4, 6, 7, 9, 10],   # Vachaspati = Lydian dominant
    65: [0, 2, 4, 6, 7, 9, 11],   # Mechakalyani = Lydian
    1: [0, 1, 2, 5, 7, 8, 9],     # Kanakangi = S R1 G1 M1 P D1 N1
    72: [0, 3, 4, 6, 7, 10, 11],  # Rasikapriya = S R3 G3 M2 P D3 N3
}
KNOWN_NAMES = {8: "hanumatodi", 15: "mayamalavagowla", 22: "kharaharapriya", 29: "dheerasankarabharanam",
               65: "mechakalyani", 1: "kanakangi", 72: "rasikapriya", 36: "chalanata"}

REQUIRED = """mohanam hindolam madhyamavati abhogi shivaranjini sindhubhairavi bhairavi anandabhairavi kapi
reethigowla hamsadhwani hamsanandi revati bilahari atana kedaragowla sahana valachi amritavarshini kalyani
shuddhadhanyasi shuddhasaveri abheri kanada darbari_kanada behag desh des kafi khamaj yaman bhupali durga
malkauns bageshri kirwani jaunpuri jog vasant basant chandrakauns hemavati bhimpalasi pahadi mand bhairav
ahir_bhairav hanumatodi todi miyan_ki_todi puriya_dhanashri marwa kedar navroj sarasangi charukesi
gowrimanohari chakravakam keeravani panthuvarali kamavardhini shubhapantuvarali mayamalavagowla natabhairavi
kharaharapriya harikambhoji shankarabharanam dharmavati simhendramadhyamam latangi vachaspati nattai
gambhiranata arabhi begada kambhoji yadukula_kambhoji punnagavarali nadanamakriya saveri mukhari neelambari
surati brindavani_sarang madhuvanti pilu tilang bhairavi_(hindustani) sohini lalit bhinnashadjam
malayamarutham valaji vasantha kuntalavarali purvikalyani saramati nalinakanti kadanakuthuhalam tilak_kamod
kalavati megh megh_malhar shuddha_sarang gorakh_kalyan maand sindhu_bhairavi""".split()


def norm(s):
    return re.sub(r"[^a-z0-9]", "", s.lower())


def mela_structure(n):
    """Semitone set for melakarta n: M1 for 1-36, M2 for 37-72; chakra (6 per
    group) fixes R/G, position inside the chakra fixes D/N."""
    m = (n - 1) % 36
    rg = [(1, 2), (1, 3), (1, 4), (2, 3), (2, 4), (3, 4)][m // 6]
    dn = [(8, 9), (8, 10), (8, 11), (9, 10), (9, 11), (10, 11)][m % 6]
    ma = 5 if n <= 36 else 6
    return sorted({0, rg[0], rg[1], ma, 7, dn[0], dn[1]})


def main(path):
    ragas = json.load(open(path, encoding="utf-8"))
    errors, warnings = [], []
    err = errors.append

    if not isinstance(ragas, list):
        print("ERROR: top level must be a list")
        return 1

    names = {}
    melas = {}
    alias_owner = {}
    for idx, r in enumerate(ragas):
        name = r.get("name")
        where = "%s (#%d)" % (name, idx)
        if not name or name != name.lower() or not re.fullmatch(r"[a-z0-9]+", name):
            err("%s: name must be lowercase ASCII alphanumerics" % where)
        if name in names:
            err("%s: duplicate name" % where)
        names[name] = r
        if r.get("system") not in SYSTEMS:
            err("%s: bad system %r" % (where, r.get("system")))
        for f in ("aroha", "avaroha", "pcs", "aliases", "western", "hindustani_equiv"):
            if f not in r:
                err("%s: missing field %s" % (where, f))
        aro, ava = r.get("aroha", []), r.get("avaroha", [])
        if len(aro) < 4 or len(ava) < 4:
            err("%s: aroha/avaroha too short" % where)
        bad = [t for t in aro + ava if t not in SEMI]
        if bad:
            err("%s: invalid tokens %s" % (where, sorted(set(bad))))
            continue
        used = sorted({SEMI[t] for t in aro + ava})
        if r.get("pcs") != used:
            err("%s: pcs %s != tokens used %s" % (where, r.get("pcs"), used))
        if 0 not in used:
            err("%s: no Sa" % where)
        for fa, fb in (("aroha_traditional", "aroha"), ("avaroha_traditional", "avaroha")):
            if fa in r:
                tr = r[fa]
                if any(t not in TRAD for t in tr):
                    err("%s: bad traditional swara in %s" % (where, fa))
                elif [TRAD[t] for t in tr] != [SEMI[t] for t in r[fb]]:
                    err("%s: %s does not match %s" % (where, fa, fb))
        for t in r.get("anya_swaras", []):
            if t not in SEMI:
                err("%s: bad anya swara %r" % (where, t))
        ex = r.get("extra_pcs", [])
        if any((not isinstance(p, int)) or p < 1 or p > 11 for p in ex) or ex != sorted(set(ex)):
            err("%s: extra_pcs must be sorted unique ints 1..11" % where)
        if set(ex) & set(used):
            err("%s: extra_pcs overlaps pcs: %s" % (where, sorted(set(ex) & set(used))))
        if "vakra" in r and not isinstance(r["vakra"], bool):
            err("%s: vakra must be bool" % where)

        if "melakarta" in r:
            n = r["melakarta"]
            if not isinstance(n, int) or not 1 <= n <= 72:
                err("%s: melakarta %r out of range" % (where, n))
                continue
            if n in melas:
                err("%s: melakarta %d also used by %s" % (where, n, melas[n]["name"]))
            melas[n] = r
            if len(used) != 7:
                err("%s: melakarta has %d notes, expected 7" % (where, len(used)))
            if used != mela_structure(n):
                err("%s: mela %d structure %s, expected %s" % (where, n, used, mela_structure(n)))
            if n in KNOWN_MELAS and used != KNOWN_MELAS[n]:
                err("%s: mela %d spot check failed: %s vs %s" % (where, n, used, KNOWN_MELAS[n]))
            if n in KNOWN_NAMES and name != KNOWN_NAMES[n]:
                err("%s: mela %d should be named %s" % (where, n, KNOWN_NAMES[n]))
            # a sampurna mela must ascend and descend through its 7 notes in order
            if [SEMI[t] for t in aro] != used + [0] or [SEMI[t] for t in ava] != [0] + used[:0:-1] + [0]:
                err("%s: melakarta aroha/avaroha not the straight 7-note scale" % where)
            if "parent_mela" in r:
                err("%s: melakarta should not have parent_mela" % where)
        else:
            if "parent_mela" not in r:
                err("%s: non-melakarta needs parent_mela" % where)

        for a in [name] + r.get("aliases", []):
            k = norm(a)
            if not k:
                err("%s: empty alias" % where)
                continue
            if k in alias_owner and alias_owner[k] != name:
                err("alias collision: %r -> %s and %s" % (a, alias_owner[k], name))
            alias_owner.setdefault(k, name)

    missing = sorted(set(range(1, 73)) - set(melas))
    if missing:
        err("missing melakartas: %s" % missing)

    for r in ragas:
        if "parent_mela" in r:
            pm = r["parent_mela"]
            if pm not in melas:
                err("%s: parent_mela %r not a known melakarta" % (r["name"], pm))
                continue
            anya = {SEMI[t] for t in r.get("anya_swaras", []) if t in SEMI}
            outside = set(r["pcs"]) - set(melas[pm]["pcs"])
            if outside - anya:
                err("%s: notes %s not in parent mela %d and not declared anya_swaras"
                    % (r["name"], sorted(outside - anya), pm))
            if anya - outside:
                warnings.append("%s: anya_swaras %s are already in parent mela %d"
                                % (r["name"], sorted(anya - outside), pm))

    for q in REQUIRED:
        k = norm(q.replace("_", " "))
        if k not in alias_owner:
            err("required raga %r does not resolve to any name/alias" % q)

    n_mela = len(melas)
    n_other = len(ragas) - n_mela
    by_sys = {}
    for r in ragas:
        by_sys[r.get("system")] = by_sys.get(r.get("system"), 0) + 1
    print("ragas: %d total (%d melakartas, %d janya/Hindustani); systems %s; %d names+aliases"
          % (len(ragas), n_mela, n_other, by_sys, len(alias_owner)))
    for w in warnings:
        print("WARNING:", w)
    for e in errors:
        print("ERROR:", e)
    print("OK" if not errors else "%d error(s)" % len(errors))
    return 1 if errors else 0


if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, "ragas.json")))
