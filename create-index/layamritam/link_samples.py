#!/usr/bin/env python3
"""Link Layamritam samples (samples.json, from make_samples.py) into the app index.

  python3 create-index/layamritam/link_samples.py [--check-dups]

Adds each sample's URL to the song's `cs` (sample urls) and its label to `cn` in
public/bhajan-index2.json, after the song's CD samples, and drops Layamritam sample URLs
that are no longer in samples.json. Safe to rerun; mergelinks.js calls the same mapping.

--check-dups compares each sample of a song that already has CD samples with those CD
samples (audio cross-correlation of the first 25 s) and records `"dupOf": <cd url>` in
samples.json when it is the same recording; such samples are not linked.
"""
import json, os, subprocess, sys, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
INDEX = os.path.join(REPO, "public", "bhajan-index2.json")
MAP = os.path.join(HERE, "samples.json")
SAMPLES = os.path.join(REPO, "layamritam", "samples")
CD_CACHE = os.path.join(REPO, "layamritam", "cd-samples")
HOST = "https://singwithamma.s3.amazonaws.com"
SR = 2000


def pcm(src):
    import numpy as np
    out = subprocess.run(["ffmpeg", "-nostdin", "-loglevel", "error", "-i", src, "-t", "75",
                          "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"], capture_output=True).stdout
    return np.frombuffer(out, dtype=np.int16).astype(np.float64)


def same_score(a, b):
    """Best normalised correlation of a's 3-23 s against anywhere in b (0..1)."""
    import numpy as np
    seg = a[SR * 3:SR * 23]
    if len(seg) < SR * 10 or len(b) < len(seg):
        return 0.0
    seg = seg - seg.mean()
    n, L = len(b), len(seg)
    c = np.fft.irfft(np.fft.rfft(b, 2 * n) * np.fft.rfft(seg[::-1], 2 * n))[L - 1:n]
    cs = np.concatenate([[0], np.cumsum(b ** 2)])
    e = np.sqrt(np.maximum(cs[L:] - cs[:-L], 0))[:len(c)] + 1e-6
    return float((c[:len(e)] / e / (np.linalg.norm(seg) + 1e-6)).max())


def cd_file(url):
    os.makedirs(CD_CACHE, exist_ok=True)
    dest = os.path.join(CD_CACHE, urllib.parse.unquote(url.rsplit("/", 1)[1]))
    if not os.path.exists(dest):
        req = urllib.request.Request(urllib.parse.quote(url, safe=":/%"),  # Cloudflare refuses urllib's UA
                                     headers={"User-Agent": "Mozilla/5.0 (Macintosh) bhajan-sample-check"})
        with urllib.request.urlopen(req, timeout=60) as r:
            open(dest, "wb").write(r.read())
    return dest


def main():
    idx = json.load(open(INDEX))
    mapping = json.load(open(MAP))
    by_name = {}
    for i, s in enumerate(idx):
        by_name.setdefault(s["n"], []).append(i)
    if "--check-dups" in sys.argv:
        checked = 0
        for name, entries in mapping.items():
            for i in by_name.get(name, []):
                cds = [u for u in idx[i].get("cs", []) if "/samples-layamritam/" not in u]
                for e in entries:
                    if not cds or "dupChecked" in e:
                        continue
                    a = pcm(os.path.join(SAMPLES, urllib.parse.unquote(e["path"].rsplit("/", 1)[1])))
                    best = max(((same_score(a, pcm(cd_file(u))), u) for u in cds), default=(0, None))
                    e["dupChecked"] = round(best[0], 2)
                    if best[0] >= 0.5:
                        e["dupOf"] = best[1]
                    checked += 1
        json.dump(mapping, open(MAP, "w"), ensure_ascii=False, indent=1)
        dups = sum(1 for v in mapping.values() for e in v if e.get("dupOf"))
        print(f"dup check: {checked} compared, {dups} same recording as a CD sample")

    linked = songs = 0
    wanted = {}
    for name, entries in mapping.items():
        for e in entries:
            if not e.get("dupOf"):
                wanted.setdefault(name, []).append(e)
    missing = [n for n in wanted if n not in by_name]
    for s in idx:
        cs, cn = s.get("cs", []), s.get("cn", [])
        keep = [(u, l) for u, l in zip(cs, cn) if "/samples-layamritam/" not in u]
        for e in wanted.get(s["n"], []):
            # same escaping as JS encodeURI, which mergelinks.js uses
            keep.append((HOST + urllib.parse.quote(e["path"], safe="/;,?:@&=+$-_.!~*'()#"), e["song"]))
            linked += 1
        if keep:
            s["cs"], s["cn"] = [u for u, _ in keep], [l for _, l in keep]
        else:
            s.pop("cs", None), s.pop("cn", None)
        songs += bool(wanted.get(s["n"]))
    with open(INDEX, "w") as f:
        json.dump(idx, f, ensure_ascii=False, separators=(",", ":"))
    print(f"linked {linked} Layamritam samples to {songs} songs; names not in index: {missing}")


if __name__ == "__main__":
    main()
