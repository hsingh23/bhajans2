"""Calibrate the head-to-head scale test on the hand-adjudicated raga answer key (88 songs).
For each gold song, gold raga vs every reference raga with a different scale sharing >=4 notes:
does the lower (outside mass + 0.04 per missing note) pick gold?  Accuracy by margin bucket."""
import json,re,numpy as np,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]; MM=ROOT/'create-index/music-meta'
sys.path.insert(0,str(Path(__file__).parent)); from raga_fit import hist_from_swaras
ref=json.load(open(ROOT/'public/music-reference.json'))['ragas']
gold=json.load(open(MM/'rubric_raga_adjudicated.json'))
ev=json.load(open(MM/'features/raga_evidence.json'))
sheet=json.load(open(MM/'features/sheet.json')); trust=json.load(open(MM/'features/sheet_trust.json')); ssa=json.load(open(MM/'features/tonic_sheet_sa.json'))
def score(h,pcs):
    p=set(pcs); return sum(h[i] for i in range(12) if i not in p)+0.04*sum(1 for i in p if h[i]<0.012)
def hists(song):
    out={}
    a=ev.get(song,{}).get('audio')
    if a and a.get('swaras'): out['audio']=hist_from_swaras(a['swaras'])
    sh=sheet.get(song)
    if sh and trust.get(song,{}).get('trust') in('trusted','trusted-unique') and song in ssa:
        out['sheet']=list(sh['pc_hist'])
    return out
if __name__=='__main__':
    B={'audio':{},'sheet':{}}
    for song,g in gold.items():
        if g.get('human_verdict') in(None,) : pass
        if g.get('sa_fix'): continue  # pipeline Sa wrong there: test would be unfair
        names=[x['name'] for x in g['ragas'] if x['name'] in ref]
        if len(names)!=1: continue
        gp=set(ref[names[0]]['pcs'])
        for src,h in hists(song).items():
            for rid,r in ref.items():
                q=set(r['pcs'])
                if q==gp or len(q&gp)<4: continue
                m=score(h,q)-score(h,gp)
                b=min(int(abs(m)/0.05),4)
                B[src].setdefault(b,[0,0]); B[src][b][0]+=1; B[src][b][1]+= m>0
    for src,bb in B.items():
        print(src,{f'{k*0.05:.2f}+':(n,round(c/n,3)) for k,(n,c) in sorted(bb.items())})
