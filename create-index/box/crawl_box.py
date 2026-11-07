#!/usr/bin/env python3
"""Map every file under the shared Box folder "1 MP3" into box-inventory.json.

Uses the public shared link (no Box login): each shared-folder page embeds its
listing as JSON in `postStreamData`. Files download anonymously from
download_url(file_id).

Usage: BOX_SHARED_NAME=<name from the folder's shared link> python3 crawl_box.py [shared_name] [root_folder_id]
"""
import json
import os
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Lock

SHARED = sys.argv[1] if len(sys.argv) > 1 else os.environ["BOX_SHARED_NAME"]
ROOT = sys.argv[2] if len(sys.argv) > 2 else "49579023048"
OUT = Path(__file__).with_name("box-inventory.json")
MARK = "postStreamData = "


def download_url(file_id):
    return (
        "https://app.box.com/index.php?rm=box_download_shared_file"
        f"&shared_name={SHARED}&file_id=f_{file_id}"
    )


def fetch_page(folder_id, page):
    url = f"https://app.box.com/s/{SHARED}/folder/{folder_id}?page={page}"
    for attempt in range(5):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            html = urllib.request.urlopen(req, timeout=60).read().decode("utf-8")
            i = html.index(MARK) + len(MARK)
            data, _ = json.JSONDecoder().raw_decode(html[i:])
            return data["/app-api/enduserapp/shared-folder"]
        except Exception as e:  # noqa: BLE001 - retry any network/parse error
            if attempt == 4:
                raise RuntimeError(f"{url}: {e}") from e
            time.sleep(2 * (attempt + 1))


files, folders, lock = [], [], Lock()


def crawl(folder_id, path):
    page, subfolders = 1, []
    while True:
        sf = fetch_page(folder_id, page)
        for it in sf["items"]:
            if it["type"] == "folder":
                subfolders.append((str(it["id"]), f"{path}/{it['name']}"))
            else:
                with lock:
                    files.append(
                        {
                            "id": str(it["id"]),
                            "name": it["name"],
                            "ext": (it.get("extension") or "").lower(),
                            "size": it.get("itemSize"),
                            "folder": path,
                            "folder_id": str(folder_id),
                            "updated": it.get("contentUpdated"),
                        }
                    )
        if page >= sf.get("pageCount", 1):
            break
        page += 1
    with lock:
        folders.append({"id": str(folder_id), "path": path, "subfolders": len(subfolders)})
    return subfolders


def main():
    queue = [(ROOT, "1 MP3")]
    with ThreadPoolExecutor(6) as pool:
        while queue:
            batch, queue = queue, []
            for subs in pool.map(lambda a: crawl(*a), batch):
                queue.extend(subs)
            print(f"folders={len(folders)} files={len(files)}", flush=True)
    files.sort(key=lambda f: (f["folder"], f["name"]))
    folders.sort(key=lambda f: f["path"])
    OUT.write_text(
        json.dumps(
            {
                "shared_name": SHARED,
                "root_folder_id": ROOT,
                "download_url_template": download_url("{id}"),
                "crawled_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
                "folders": folders,
                "files": files,
            },
            ensure_ascii=False,
            indent=1,
        )
    )
    print(f"wrote {OUT}: {len(folders)} folders, {len(files)} files")


if __name__ == "__main__":
    main()
