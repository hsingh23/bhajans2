import json,glob,collections,math
key=json.load(open('packets/key.json'))
def load(p):
    d={}
    for f in glob.glob(f'packets/out_{p}_*.jsonl'):
        for line in open(f):
            line=line.strip()
            if line: x=json.loads(line); d[x['id']]=x
    return d
O,S=load('opus'),load('sonnet')
print('opus',len(O),'sonnet',len(S))
def wilson(k,n,z=1.96):
    if n==0: return (0,0)
    p=k/n; d=1+z*z/n; c=p+z*z/(2*n); m=z*math.sqrt(p*(1-p)/n+z*z/(4*n*n)); return (round((c-m)/d,3),round((c+m)/d,3))
for name,R in (('opus',O),('sonnet',S)):
    for f,k1,k2 in (('lg','app_lg','lg'),('d','app_d','d')):
        ok=n=0; bad=[]
        for i,v in key.items():
            if not v['control'] or i not in R: continue
            n+=1; r=R[i]
            hit = r[k2]==v[k1] or r.get(k2+'2')==v[k1]
            ok+=hit
            if not hit: bad.append((v['song'],v[k1],r[k2],r.get(k2+'2')))
        print(name,f,'controls',ok,'/',n,wilson(ok,n),bad[:8])
# agreement opus vs sonnet on conflicts
for f in ('lg','d'):
    a=n=0
    for i,v in key.items():
        if v['control']: continue
        n+=1; a+= O[i][f]==S[i][f]
    print('opus-sonnet agree',f,a,n)
