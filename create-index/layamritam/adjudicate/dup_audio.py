"""New-song duplicates: is Layamritam's recording of the new song the same recording as a sample
the claimed index song already plays (cs)? Same recording => same song (same language)."""
import json,sys,os
from pathlib import Path
HERE=Path(__file__).parent; ROOT=HERE.parents[2]
sys.path.insert(0,str(HERE.parent)); import link_samples as L
R=json.load(open(HERE/'rows.json'))
out={}
for r in R:
    if r['kind']!='new song': continue
    ix=r['index']; cs=ix.get('cs') or []
    l=r['lay'][0]
    if not l['audio'] or not cs: out[r['song']]={'note':'no audio' if not l['audio'] else 'index song has no sample'}; continue
    a=L.pcm(str(ROOT/'layamritam/audio'/l['audio']))
    best=0; which=None
    for u in cs:
        try: b=L.pcm(L.cd_file(u))
        except Exception as e: print('fail',u,e); continue
        s=max(L.same_score(a,b),L.same_score(b,a)); 
        if s>best: best,which=s,u
    out[r['song']]={'best':round(best,3),'sample':which,'n_samples':len(cs)}
    print(r['song'][:40],'->',r['app'][:30],round(best,3))
json.dump(out,open(HERE/'dup_audio.json','w'),ensure_ascii=False,indent=1)
