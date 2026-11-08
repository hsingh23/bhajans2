"""Per raga row: head-to-head scale fit (app raga vs best Layamritam raga) on sheet and audio,
turned into P(app right) with the margin->accuracy table measured by raga_calib.py."""
import json,sys,collections,math
from pathlib import Path
HERE=Path(__file__).parent; ROOT=HERE.parents[2]
sys.path.insert(0,str(HERE)); from raga_calib import score, hists
ref=json.load(open(ROOT/'public/music-reference.json'))['ragas']
CAL={'sheet':[(0.2,0.97),(0.05,0.87),(0,0.6)],'audio':[(0.2,0.87),(0.05,0.74),(0,0.52)]}
def acc(src,m):
    for t,a in CAL[src]:
        if abs(m)>=t: return a
fit=json.load(open(HERE/'raga_fit.json'))
out=[]
for x in fit:
    if not x['app'] or not x['lay'] or x['app'][0] not in ref: continue
    a=x['app'][0]; hs=hists(x['song'])
    lo=1.0; ev={}
    for src,h in hs.items():
        sa=score(h,ref[a]['pcs'])
        ls=[(score(h,ref[l]['pcs']),l) for l in x['lay'] if l in ref]
        if not ls: continue
        sl,lb=min(ls)
        if set(ref[a]['pcs'])==set(ref[lb]['pcs']): continue
        m=sl-sa  # >0: app fits better
        p=acc(src,m); p=p if m>0 else 1-p
        lo*= p/(1-p); ev[src]=dict(margin=round(m,3),p_app=round(p,3),lay_best=lb)
    # weak prior: app label confidence vs Layamritam source quality
    prior = 0.5
    pa = lo*prior/(lo*prior+(1-prior)) if ev else None
    out.append(dict(song=x['song'],kind=x['kind'],app=a,app_c=x['app_c'],lay=x['lay'],lay_src=x['lay_src'],evidence=ev,p_app=None if pa is None else round(pa,3)))
json.dump(out,open(HERE/'raga_verdict.json','w'),ensure_ascii=False,indent=1)
for kind in('conflict','weak'):
    c=collections.Counter()
    for o in out:
        if o['kind']!=kind: continue
        p=o['p_app']
        c['no evidence' if p is None else 'app>=0.9' if p>=0.9 else 'app 0.7-0.9' if p>=0.7 else 'lay>=0.9' if p<=0.1 else 'lay 0.7-0.9' if p<=0.3 else 'unresolved 0.3-0.7']+=1
    print(kind,sum(c.values()),dict(c))
c=collections.Counter()
for o in out:
    if o['kind']=='conflict' and 'human' in o['lay_src'] and o['p_app'] is not None: c['app' if o['p_app']>=0.7 else 'lay' if o['p_app']<=0.3 else 'unres']+=1
print('vs Layamritam human labels',c)
