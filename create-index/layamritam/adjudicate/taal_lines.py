"""Lyric-line test for taal: beats (Beat This!, Layamritam recording) between Layamritam's own
lyric-line timestamps. Lines of 3*2^k beats point to 3-beat bars at the tracked level, 2^k to
2/4-beat bars. Compared with the trusted sheet meter where there is one."""
import json,numpy as np,collections
R=[r for r in json.load(open('rows.json')) if r['field']=='taal']
tj=json.load(open('../../music-meta/features/taal.json'))
P2={2**k for k in range(3,9)}; P3={3*2**k for k in range(2,7)}
def near(n,S): return any(abs(n-s)<=max(1,round(0.03*s)) for s in S)
out={}
for r in R:
    for l in r['lay']:
        try: b=np.load(f'work/lay_taal_cache/lay{l["songId"]}.npz')['beats']
        except Exception: continue
        st=np.array(sorted(int(x) for s in l['starts'] if s for x in str(s).split('~~') if x.strip().isdigit()))/1000
        nb=[int(np.sum((b>=a)&(b<c))) for a,c in zip(st[:-1],st[1:])]
        nb=[n for n in nb if n>=12]
        two=sum(near(n,P2) and not near(n,P3) for n in nb); three=sum(near(n,P3) and not near(n,P2) for n in nb)
        out.setdefault(r['song'],[]).append(dict(songId=l['songId'],lines=nb,two=two,three=three))
json.dump(out,open('taal_lines.json','w'),indent=1)
c=collections.Counter()
for song,recs in out.items():
    a=tj[song]; sm=a.get('sheet_meter') or {}
    x=max(recs,key=lambda z:z['two']+z['three'])
    vote='3-bars' if x['three']>x['two']+1 else '2/4-bars' if x['two']>x['three']+1 else 'unclear'
    tracked3 = a.get('meter_group')=='3' if 'meter_group' in a else None
    sig=(sm.get('first') if isinstance(sm,dict) else sm)
    c[(vote, 'app '+str(a['beats_class'])+'/'+str(a.get('subdivision'))+'/'+str(a.get('pulse')), 'sheet '+str(sig))]+=1
for k,v in sorted(c.items(),key=lambda x:-x[1]): print(v,k)
