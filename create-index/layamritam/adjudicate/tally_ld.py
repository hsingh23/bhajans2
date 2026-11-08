import json,collections
exec(open('score_ld.py').read().split("print('opus'")[0])
def norm(x): return x
res=[]
for i,v in key.items():
    if v['control']: continue
    o,s=O[i],S[i]
    for f,ak,lk in (('language','app_lg','lay_lg'),('deity','app_d','lay_d')):
        if f not in v['fields']: continue
        k='lg' if f=='language' else 'd'
        app=v[ak]; lay=set(v[lk]) if f=='language' else set(x for l in v[lk] for x in l)
        lay.discard(None)
        votes=[o[k],s[k]]; sec=[o.get(k+'2'),s.get(k+'2')]
        def side(x):
            a = x==app; b = x in lay
            return 'both' if a and b else 'app' if a else 'lay' if b else 'neither'
        so,ss=side(o[k]),side(s[k])
        mixed = any(sec) and (app in sec+votes) and (lay & set(sec+votes))
        res.append(dict(id=i,song=v['song'],field=f,app=app,lay='/'.join(sorted(lay)),opus=o[k],opus2=o.get(k+'2'),oc=o[k+'_conf'],sonnet=s[k],sonnet2=s.get(k+'2'),sc=s[k+'_conf'],
            so=so,ss=ss,mixed=bool(mixed),owhy=o[k+'_why'],swhy=s[k+'_why'],note=o.get('note') or s.get('note')))
json.dump(res,open('ld_tally.json','w'),ensure_ascii=False,indent=1)
for f in ('language','deity'):
    rs=[r for r in res if r['field']==f]
    c=collections.Counter((r['so'],r['ss']) for r in rs)
    print(f,len(rs),c.most_common())
    c2=collections.Counter(r['so'] if r['so']==r['ss'] else 'split' for r in rs); print('  verdict when raters agree:',c2, ' mixed:',sum(r['mixed'] for r in rs))
