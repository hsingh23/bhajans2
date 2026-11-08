import json,re,collections
M=json.load(open('matches.json')); idx=json.load(open('../../public/bhajan-index2.json'))
FR=re.compile(r'^(.*?)([A-G])(sharp|#|b)?(m)?(o)?\.pdf$')
old=collections.defaultdict(set)
for s in idx:
    for f in s.get('sm',[]):
        m=FR.match(f); old[m.group(1) if m else f].add(s['n'])
print('### REVIEW')
for k,v in M.items():
    if v['decision']=='review':
        r=v['rows'][0] if v['rows'] else {}
        print(f"{k[:26]:26} g={v['grams']:4} | {str(r.get('song'))[:32]:32} ly={r.get('lyric')} ln={r.get('lines')} co={r.get('cover')} ti={r.get('title')} ref={r.get('ref')} {r.get('copy')} {r.get('placed')} | old={sorted(old.get(k,[]))[:2]}")
print('### NONE with old links')
for k,v in M.items():
    if v['decision']=='none' and old.get(k):
        r=v['rows'][0] if v['rows'] else {}
        print(f"{k[:26]:26} g={v['grams']:4} | {str(r.get('song'))[:32]:32} ly={r.get('lyric')} ti={r.get('title')} ref={r.get('ref')} | old={sorted(old.get(k,[]))[:3]}")
print('### ACCEPTED title<75 & no ref')
for k,v in M.items():
    rows={r['song']:r for r in v['rows']}
    for sn in v['songs']:
        r=rows[sn]
        if r['title']<75 and not r['ref']:
            print(f"{k[:26]:26} -> {sn[:40]:40} ly={r['lyric']} ln={r['lines']} co={r['cover']} ti={r['title']} {r['copy']}")
print('### MULTI accepts, different pages')
for k,v in M.items():
    if len(v['songs'])>1:
        rows={r['song']:r for r in v['rows']}
        if len({rows[s]['copy'] for s in v['songs']})>1:
            print(k[:26], [(s[:28], rows[s]['lyric'], rows[s]['lines'], rows[s]['title'], rows[s]['copy']) for s in v['songs']])
