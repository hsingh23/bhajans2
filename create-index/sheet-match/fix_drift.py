#!/usr/bin/env python3
"""Correct index locations whose printed page differs from the index (index-page-drift.json):
updates public/bhajan-index2.json and the txt source line (name##Loc/Loc) the entry came from."""
import json, re, glob
from pathlib import Path
HERE=Path(__file__).parent; CI=HERE.parent; INDEX=CI.parent/'public'/'bhajan-index2.json'
drift=json.load(open(HERE/'index-page-drift.json'))
idx=json.loads(INDEX.read_text()); byn={s['n']:s for s in idx}
srcs={p:Path(p).read_text() for p in glob.glob(str(CI/'*.txt')) if not p.endswith('.changed.txt') and 'bhajan-starts' not in p and 'sorted.' not in p and 'better-search' not in p and 'music' not in p and 'video' not in p and 'tags' not in p and 'downloadurls' not in p and 'sheetmusiclist' not in p and 'bhajan-index' not in p}
fixed=0; txtfixed=0; unplaced=[]; nosrc=[]
for d in drift:
    if d['printed'] is None: unplaced.append(d); continue
    s=byn.get(d['song'])
    if not s or d['index'] not in s['l']: continue
    if d['printed'] in s['l']:
        s['l'].remove(d['index'])  # already listed: drop the stale one
    else:
        s['l'][s['l'].index(d['index'])]=d['printed']
    fixed+=1
    old=d['index']; new=d['printed']
    done=False
    for p,t in srcs.items():
        pat=re.compile(r'(?im)^(\s*'+re.escape(d['song'])+r'\s*##[^\n]*?)\b'+re.escape(old)+r'\b')
        if pat.search(t):
            srcs[p]=pat.sub(lambda mm: mm.group(1)+new.replace('vol','Vol',1).replace('supl','supl'), t, count=1); done=True; txtfixed+=1; break
    if not done: nosrc.append((d['song'],old,new))
for p,t in srcs.items(): Path(p).write_text(t)
INDEX.write_text(json.dumps(idx,ensure_ascii=False,separators=(',',':')))
print(f'fixed {fixed} locations in the index, {txtfixed} in txt sources; no txt source for {len(nosrc)}: {nosrc[:8]}')
print('unplaced (title never found):'); [print('  ',u) for u in unplaced]
