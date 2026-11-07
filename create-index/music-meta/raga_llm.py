#!/usr/bin/env python3
"""Name each song's raga(s) with a model, from note evidence only (blind to human labels).

  python raga_llm.py packs                 # build features/raga_packs.json
  python raga_llm.py run MODEL LIST OUT [batch] [workers]
      MODEL: sonnet | opus | haiku (claude CLI) or glm-5.3 / glm-5.3-flash (pi CLI)
      LIST: file with one song name per line; OUT: jsonl of answers
Each call gets <= batch songs (default 8) and must return a JSON array.
"""
import json
import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
SW = ["S", "r1", "R2", "g2", "G3", "M1", "M2", "P", "d1", "D2", "n2", "N3"]

SYSTEM = """You are an expert in Carnatic and Hindustani raga theory labelling Amma's bhajans (devotional, light-classical; light-music liberties are normal; some songs move between ragas; some newer songs are Western-style with no raga).
For each song you get note evidence RELATIVE TO Sa (swara tokens S r1 R2 g2 G3 M1 M2 P d1 D2 n2 N3 = semitones 0..11):
- sheet: notes read exactly from the sheet music (percent of notes), which swaras are approached from below (ascending) and above (descending), per-section swara sets, the final 30 notes, Sa confidence and the alternative Sa reading;
- audio: the recording's pitch histogram relative to Sa (less exact: ornaments/gamakas and accompaniment blur it) and the best-fitting scale per 30 s window;
- scale candidates from a raga table (lower score = better fit), plus language/deity/title.
Rules (from an expert adjudication of this corpus):
- Decide Sa first. If the note set has a mode partner (shivaranjani/revati, shuddhadhanyasi/hindolam, shuddhadhanyasi/mohanam, mohanam/madhyamavati, durga/sri, jog/shubhapantuvarali-without-P), choose by the final note, where phrases resolve and the drone; report sa_shift (semitones to move Sa) if the given Sa is wrong.
- Separate same-scale ragas by direction: kapi vs kharaharapriya (N3 rising, n2 falling); jaijaiwanti vs kapi (G3 rising & dominant vs g2 dominant); bilahari vs mohanam/shankarabharanam (M1, N3 only falling); bhairavi vs natabhairavi (D2 rising, d1 falling); kalyanavasantham vs keeravani (P only falling); jog vs dhani (G3 rising, g2 falling); sri vs madhyamavati (g2 only in R g R S); kedar vs begada (M2 only in P M2 P).
- Check what is absent: with no dha, natabhairavi and kharaharapriya cannot be told apart - say so and give both.
- Accept one or two anya swaras under ~10% as light-music usage and name them; only call a raga change when a swara appears or disappears for a whole section.
- If sheet and audio disagree badly, or nothing fits, say so (sheet may belong to another song).
- Use the Carnatic name as primary (it is what this community uses), give the Hindustani equivalent.
Answer ONLY with a JSON array, one object per song, in input order:
{"song": "...", "ragas": [{"name": "carnatic name", "hindustani": "...", "sections": "all" | "which sections", "anya_swaras": [...]}], "no_raga": false, "sa_shift": 0, "alternatives": ["..."], "confidence": "high"|"medium"|"low", "reason": "one line citing the decisive notes"}"""


def fmt_sw(d):
    return d if isinstance(d, str) else ""


def build_packs(hinted=False):
    ev = json.loads((HERE / "features/raga_evidence.json").read_text())
    trust = json.loads((HERE / "features/sheet_trust.json").read_text())
    sheet = json.loads((HERE / "features/sheet.json").read_text())
    sa = json.loads((HERE / "features/sheet_sa.json").read_text())
    index = {s["n"]: s for s in json.loads((ROOT / "public/bhajan-index2.json").read_text())}
    matches = json.loads((HERE / "box-matches-verified.json").read_text())
    rub = json.loads((HERE / "rubric.json").read_text()) if hinted else {}
    packs = {}
    for name, e in ev.items():
        lines = [f"SONG: {name} | language {index.get(name, {}).get('lg', '?')} | deity {index.get(name, {}).get('d', '?')}"]
        m = matches.get(name)
        if m and m[0].get("accept"):
            hint = m[0].get("hint")
            lines.append(f"recording title: {m[0]['name']}" + (f" (title hint: {hint})" if hint else ""))
        t = trust.get(name, {})
        if "sheet" in e and t.get("trust") != "mismatch":
            s = e["sheet"]
            so = s.get("sa_offset_from_key_root", 0)
            last = [SW[(x - so) % 12] for x in sheet[name]["notes"][-30:]]
            alt = sa.get(name, {}).get("sa_candidates", [0])
            alt = [((a - so) % 12) for a in alt if a != so]
            lines += [
                f"sheet (link trust: {t.get('trust')}; Sa confidence {s.get('sa_confidence')}"
                + (f"; alternative Sa = {SW[alt[0]]} of this reading" if alt else "") + ")",
                f"  swaras %: {s['swaras']}  rare: {' '.join(s['rare']) or '-'}",
                f"  ascending use: {s['ascending_use']}",
                f"  descending use: {s['descending_use']}",
                f"  sections: {' | '.join(s['section_swaras'])}",
                f"  final 30 notes: {' '.join(last)}",
                f"  scale candidates: {', '.join(f'{n} {sc}' for sc, n in s['candidates'])}",
            ]
        if "audio" in e:
            a = e["audio"]
            lines += [
                f"audio (recording, Sa at pitch class {a['sa_pc']}): swaras %: {a['swaras']}",
                f"  scale candidates: {', '.join(f'{n} {sc}' for sc, n in a['candidates'])}",
                f"  best scale per 30 s window: {' '.join(a['window_top'])}",
            ]
        r = rub.get(name)
        if r and (r["raaga_raw"] or r["hints"]):
            lines.append("community label (human, often shorthand or wrong; use only if the notes support it): "
                         + "; ".join(r["raaga_raw"] + r["hints"])[:300])
        packs[name] = "\n".join(lines)
    (HERE / ("features/raga_packs_hinted.json" if hinted else "features/raga_packs.json")).write_text(json.dumps(packs, ensure_ascii=False, indent=0))
    print(f"{len(packs)} packs")


def call(model, prompt):
    if model.startswith("glm"):
        cmd = ["pi", "-p", "--model", f"zai/{model}", "--thinking", "medium", "--no-tools", "--no-session",
               "--no-extensions", "--no-skills", "--no-context-files", "--no-mcp", "--system-prompt", SYSTEM, prompt]
    else:
        cmd = ["claude", "-p", "--model", model, "--system-prompt", SYSTEM, "--no-session-persistence",
               "--strict-mcp-config", "--setting-sources", "", "--disallowedTools", "Bash", "Edit", "Write",
               "Read", "WebFetch", "WebSearch", "Agent", "--", prompt]
    r = subprocess.run(cmd, capture_output=True, text=True, stdin=subprocess.DEVNULL, timeout=900)
    txt = r.stdout
    m = re.search(r"\[\s*\{.*\}\s*\]", txt, re.S)
    if not m:
        raise ValueError(f"no JSON array in output: {txt[-400:]} {r.stderr[-300:]}")
    return json.loads(m.group(0))


def run(model, listfile, out, batch=8, workers=6):
    packs = json.loads((HERE / "features/raga_packs.json").read_text())
    names = [n for n in Path(listfile).read_text().splitlines() if n.strip() and n in packs]
    done = set()
    if Path(out).exists():
        done = {json.loads(l)["song"] for l in Path(out).read_text().splitlines() if l.strip()}
    todo = [n for n in names if n not in done]
    batches = [todo[i:i + batch] for i in range(0, len(todo), batch)]
    print(f"{len(todo)} songs, {len(batches)} calls to {model}", flush=True)

    def work(b):
        prompt = "Label these songs.\n\n" + "\n\n".join(packs[n] for n in b)
        for attempt in range(3):
            try:
                res = call(model, prompt)
                by = {r.get("song"): r for r in res}
                return [{**(by.get(n) or (res[i] if i < len(res) else {})), "song": n, "model": model} for i, n in enumerate(b)]
            except Exception as e:  # noqa: BLE001
                err = str(e)
        return [{"song": n, "model": model, "error": err[:300]} for n in b]

    with ThreadPoolExecutor(workers) as pool, open(out, "a") as f:
        for rows in pool.map(work, batches):
            for r in rows:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
            f.flush()
    print("done", flush=True)


if __name__ == "__main__":
    if sys.argv[1] == "packs":
        build_packs(hinted="--hinted" in sys.argv)
    else:
        run(sys.argv[2], sys.argv[3], sys.argv[4], *(int(x) for x in sys.argv[5:7]))
