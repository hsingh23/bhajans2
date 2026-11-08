#!/usr/bin/env python3
"""Cut 75-second song samples from downloaded Layamritam recordings.

The app's existing samples (bhajan-samples.withamma.com/samples-cd/...) are the first
75 s of the recording: 73 s of music fading out over the last 2 s, then 2 s of silence,
MP3 96 kb/s, 44.1 kHz stereo. This makes the same from `<repo>/layamritam/audio/`.

  python3 create-index/layamritam/make_samples.py LIST.json [LIST.json ...]

Each LIST is a json array with at least `songId`, `title`, `name` (the index song name),
e.g. layamritam/no-sample-to-download.json. Writes `<repo>/layamritam/samples/<key>.mp3`
(local only, uploaded to s3://singwithamma/samples-layamritam/) and adds each new sample
to `samples.json` next to this script: {index song name: [{"path", "song", "songId"}]},
which link_samples.py patches into public/bhajan-index2.json. Recordings not downloaded
yet are skipped, so rerun after more downloads.
"""
import json, os, re, subprocess, sys, unicodedata
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
AUDIO = os.path.join(REPO, "layamritam", "audio")
OUT = os.path.join(REPO, "layamritam", "samples")
MAP = os.path.join(HERE, "samples.json")
PREFIX = "/samples-layamritam/"


def ascii_title(title):
    t = unicodedata.normalize("NFKD", title)
    t = "".join(c for c in t if not unicodedata.combining(c))
    t = re.sub(r"[^A-Za-z0-9 ()'&,-]+", " ", t)
    return re.sub(r"\s+", " ", t).strip(" .-")


def key(song_id, title):
    return f"{song_id} {ascii_title(title)[:70]}".strip()


def song_label(title):
    """Lower-case words, like samples.json `song` ("amba bhavani vintage")."""
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]+", " ", ascii_title(title).lower())).strip()


def cut(src, dest):
    tmp = dest + ".part.mp3"
    subprocess.run(
        ["ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-t", "73", "-i", src, "-vn",
         "-af", "afade=t=out:st=71:d=2,apad=pad_dur=2", "-ac", "2", "-ar", "44100",
         "-c:a", "libmp3lame", "-b:a", "96k", "-map_metadata", "-1", tmp],
        check=True)
    os.replace(tmp, dest)


def main(lists):
    os.makedirs(OUT, exist_ok=True)
    files = {int(f.split(" - ")[0]): f for f in os.listdir(AUDIO) if f.endswith(".mp3")}
    mapping = json.load(open(MAP)) if os.path.exists(MAP) else {}
    todo = []
    for lst in lists:
        for r in json.load(open(lst)):
            sid = int(r["songId"])
            if sid not in files:
                continue
            k = key(sid, r["title"])
            entry = {"path": PREFIX + k + ".mp3", "song": song_label(r["title"]), "songId": sid}
            have = mapping.setdefault(r["name"], [])
            if not any(e["songId"] == sid for e in have):
                have.append(entry)
            dest = os.path.join(OUT, k + ".mp3")
            if not os.path.exists(dest):
                todo.append((os.path.join(AUDIO, files[sid]), dest))
    with ThreadPoolExecutor(6) as ex:
        for i, _ in enumerate(ex.map(lambda a: cut(*a), todo), 1):
            if i % 50 == 0:
                print(f"cut {i}/{len(todo)}", flush=True)
    for v in mapping.values():
        v.sort(key=lambda e: e["songId"])
    json.dump(dict(sorted(mapping.items())), open(MAP, "w"), ensure_ascii=False, indent=1)
    print(f"cut {len(todo)} new samples; {sum(len(v) for v in mapping.values())} samples "
          f"for {len(mapping)} songs in {os.path.relpath(MAP, REPO)}")


if __name__ == "__main__":
    main(sys.argv[1:])
