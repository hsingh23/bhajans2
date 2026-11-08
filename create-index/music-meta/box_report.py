"""Regenerate ../sheet-match/box-link-changes.md and box-spelling-variants.md from box-matches.json
against box-matches-before.json (the old matcher's output, kept for the comparison).
Run from music-meta: uv run --with rapidfuzz python box_report.py
"""
import json, sys
sys.path.insert(0,'.'); sys.path.insert(0,'..')
import match_box as mb
a=json.load(open('box-matches-before.json')); b=json.load(open('box-matches.json'))
idx_songs={x['n']:x for x in json.load(open('../../public/bhajan-index2.json'))}; idx_names=set(idx_songs)
renamed=json.load(open('../sheet-match/renamed-songs.json'))
titles={n: mb.song_titles(n) for n in idx_names}; aliases={n: mb.song_aliases(idx_songs[n]) for n in idx_names}
def acc(d): return {k:{x['id']:x['name'] for x in v if x['accept']} for k,v in d.items()}
A=acc(a); B=acc(b)
tier_cache={}
_owner_cache={}
_fm={}
def _full_matches(track):
    """Per track, once: the songs whose own title the whole track title matches (tier >= 2, tier == 3)."""
    if track not in _fm:
        tk,_=mb.clean_box_name(track); tw=mb.track_words(track)
        m2=set(); m3=set()
        for n in idx_names:
            t=max((mb.title_tier(tk,k,tw,w,full=True) for k,w in titles[n]), default=0)
            if t>=2: m2.add(n)
            if t==3: m3.add(n)
        _fm[track]=(m2,m3)
    return _fm[track]
def _main_is_entry(track):
    return bool(_full_matches(track)[0])
def _owners(track, hint):
    if track not in _owner_cache:
        owners=set()
        if _main_is_entry(track):
            _owner_cache[track]=owners; return owners
        for h in hint:
            hw=mb.key_words(h)
            if len(hw)>=2 and mb.phonetic(h): owners|={n for n in idx_names if mb.song_tier(mb.phonetic(h), hw, idx_songs[n], titles[n], []) >= 2}
        _owner_cache[track]=owners
    return _owner_cache[track]
_folder_of={}
for _s,_v in list(a.items())+list(b.items()):
    for _x in _v: _folder_of.setdefault(_x['name'], _x['folder'])
_amb={}
def _core(ws): return ws[1:] if ws and ws[0] in mb.ARTICLES and len(ws)>1 else ws
def _ambiguous(w, song):
    if w not in _amb:
        exact={n for n in idx_names if any(any(''.join(_core(ws)[:k])==w and k==len(_core(ws)) for k in range(1,len(_core(ws))+1)) for _,ws in titles[n])}
        opens={n for n in idx_names if any(any(''.join(_core(ws)[:k])==w and k<len(_core(ws)) for k in range(1,len(_core(ws)))) for _,ws in titles[n])}
        _amb[w]=(exact,opens)
    exact,opens=_amb[w]
    return song not in exact and len(opens)>=2
def tier(track, song):
    tk,hint=mb.clean_box_name(track); tw=mb.track_words(track)
    tl=mb.language_of(track)
    if tl and _lang(song) and tl!=_lang(song): return 0
    al=mb.album_language(_folder_of.get(track,''))
    if not tl and al and _lang(song) and al!=_lang(song): return 0
    if _lang(song) in mb.FOREIGN and not (tl==_lang(song) or al==_lang(song)):
        m3=_full_matches(track)[1]
        if song not in m3: return 0
        if any(n!=song and _lang(n) not in mb.FOREIGN for n in m3): return 0
    core=[w for k,w in enumerate(tw) if not (k==0 and w in mb.ARTICLES)]
    if len(core)==1 and _ambiguous(core[0], song): return 0
    owners=_owners(track, hint)
    if owners and song not in owners: return 0
    return mb.song_tier(tk, tw, idx_songs[song], titles[song], aliases[song])
_t3={}
def _tier3(track):
    if track not in _t3: _t3[track]=[n for n in idx_names if tier(track,n)==3]
    return _t3[track]
def _full3(track):
    return [n for n in _full_matches(track)[1] if tier(track,n)>0]
def _other(track, song, pool): return [n for n in pool if n!=song and _lang(n) not in mb.FOREIGN and _lang(n)!=_lang(song)]
def _yields(track, song):
    tl=mb.language_of(track); al=mb.album_language(_folder_of.get(track,''))
    if tl or al or not mb.is_version(song): return False
    return any(not mb.name_tagged(n) for n in _other(track, song, _tier3(track)))
def _rivals_block(track, song):
    """mirrors match_box rivals_block: (blocks, languages involved)"""
    tl=mb.language_of(track); al=mb.album_language(_folder_of.get(track,''))
    if tl or al or _lang(song) in mb.FOREIGN: return False, set()
    if _yields(track, song): return True, {_lang(song)}|{_lang(n) for n in _other(track, song, _tier3(track)) if not mb.name_tagged(n)}
    full=_full3(track)
    if song not in full: return False, set()
    rivals=_other(track, song, full)
    if not rivals: return False, set()
    return (mb.name_tagged(song) or not all(mb.is_version(n) for n in rivals)), {_lang(n) for n in rivals}|{_lang(song)}
def best(track):
    if track not in tier_cache:
        tier_cache[track]=max(((tier(track,n),n) for n in idx_names), default=(0,None))
    return tier_cache[track]
import re as _re
overrides=json.load(open('box-overrides.json'))
import re as _re2
def _lang(song):
    return mb.language_of(song) or (idx_songs[song].get('lg') or '').lower() or None
def verdict(song, track):
    if song not in idx_names: return ('song renamed in the index', f'now {renamed.get(song, "?")}')
    tk,_h=mb.clean_box_name(track)
    tl=mb.language_of(track)
    if tl and _lang(song) and tl!=_lang(song): return ('language version differs', f'recording {tl}, entry {_lang(song)}')
    al=mb.album_language(_folder_of.get(track,''))
    if not tl and al and _lang(song) and al!=_lang(song): return ('album is a translation', f'album {al}, entry {_lang(song)}')
    tw=mb.track_words(track)
    m3=_full_matches(track)[1]
    m3=_full_matches(track)[1]
    if not tl and not al and tier(track,song)==3:
        blocks,twins=_rivals_block(track, song)
        if blocks: return ('version entry yields to the untagged original' if mb.is_version(song) else 'same title in two languages, no language evidence', ', '.join(sorted(x for x in twins if x)))
    if _lang(song) in mb.FOREIGN and not (tl==_lang(song) or al==_lang(song)) and (song not in m3 or any(n!=song and _lang(n) not in mb.FOREIGN for n in m3)): return ('untagged recording on a translation entry', f'entry {_lang(song)}; the Indian original holds it')
    core=[w for k,w in enumerate(tw) if not (k==0 and w in mb.ARTICLES)]
    if len(core)==1 and _ambiguous(core[0], song): return ('one-word title opens several songs', core[0])
    m3_ok=[n for n in _full3(track) if not _yields(track,n)]
    if song not in m3 and m3_ok and tier(track,song)==3: return ('the whole title is another entry', 'a song whose whole name is the track title holds it')
    ov=overrides.get(song,{})
    if track in ov.get('add',[]): return ('linked from the recording\'s own words', ov.get('why',''))
    if track in ov.get('drop',[]): return ('unlinked from the recording\'s own words', ov.get('why',''))
    tk,_=mb.clean_box_name(track)
    sp=mb.part_number(mb.clean_index_name_raw(song)); tp=mb.part_number(_re.sub(r"\.(mp3|m4a|wav|aif)$", "", track))
    if sp is not None and tp is not None and sp != tp: return ('numbered part differs', f'track part {tp}, song part {sp}')
    t=tier(track, song)
    if t==0 and len(tk) < 6: return ('title too short to tell apart', f'{len(tk)} letters: {tk}')
    if t==0: return ('different words', f'{mb.track_words(track)} / {mb.song_words(song)}')
    bt,bn=best(track)
    if t < bt: return ('belongs to another song', f'{bn} fits better: {mb.TIER_NAME[bt]} there, {mb.TIER_NAME[t]} here')
    if t==3 and max((mb.title_tier(tk,k,mb.track_words(track),w) for k,w in titles[song]), default=0) < 3:
        return ('same title as a CD Baby alias of the song', f'cn {idx_songs[song].get("cn")}')
    return (mb.TIER_NAME[t], '' if t==3 else f'{mb.track_words(track)} / {mb.song_words(song)}')
rows=['# Box recordings: every song whose accepted recordings changed\n',
'`music-meta/match_box.py` accepts a recording for a song only when its title names that song through the shared phonetic key, word for word: the same words (word breaks and a Hindi word-final schwa ignored: "Jay Ma Jay Ma" is "jaya ma jaya ma", "Japo Nam" is "japonam"); or every word a spelling of the same word (same consonant skeleton with vowels identical, or the same written consonants with only the final vowel run or one inserted inner vowel different: Amudam/Amutam, Satguru/Sadguru, tujhe/tuje, namame/namamu, kisiki/kiski); or a long word one consonant apart. An inner vowel change (nalam/nalum), a consonant change (Skanda/Ananda, Raja/Rama, Karunalaye/Karunamayi) or a different word is not the song. Either title may run out first (a track titled with the first words of the song), but the aligned part must be six letters or more with exact-or-spelling words carrying half of it, and the title goes to the song(s) it fits best: "Dam Dam Dum Dum" is dam dam dum dum damaru bole, not dam dam dam dam. A non-language parenthetical in the index name counts as a title of its own. Per changed song: old and new accepted tracks and the verdict for each new track; lost tracks carry the verdict that excluded them.\n\n',
'| song | old accepted | now accepted | verdicts |\n|---|---|---|---|\n']
changed=sorted({k for k in set(A)|set(B) if set(A.get(k,{}))!=set(B.get(k,{}))}); counts={}; lostall=[]; diff=[]
for k in changed:
    new=list(B.get(k,{}).values()); old=list(A.get(k,{}).values())
    vs=[]
    for t in new:
        c,d=verdict(k,t); counts[c]=counts.get(c,0)+1; vs.append(f'{t}: {c}'+(f' ({d})' if d else ''))
        if c in ('different words','belongs to another song'): diff.append((k,t,c))
    lost=[t for t in old if t not in new]
    for t in lost[:3]:
        c,d=verdict(k,t); counts['lost: '+c]=counts.get('lost: '+c,0)+1; vs.append(f'lost {t}: {c}'+(f' ({d})' if d else ''))
    if old and not new: lostall.append((k,old[:2],verdict(k,old[0])))
    rows.append(f"| {k} | {', '.join(old[:2]) or '-'} | {', '.join(new[:3]) or '-'} | {'; '.join(vs[:5])} |\n")
rows.append(f"\nSummary: {sum(1 for v in A.values() if v)} songs had an accepted recording with the old matcher, {sum(1 for v in B.values() if v)} now; {len(changed)} songs changed; verdict counts {json.dumps(counts)}; {len(lostall)} songs lost every recording (all listed above with the verdict that excluded the old track); {len(diff)} accepted tracks whose verdict is not a title match (should be 0).\n")
open('../sheet-match/box-link-changes.md','w').write(''.join(rows))
print('accepted old', sum(1 for v in A.values() if v), 'now', sum(1 for v in B.values() if v), '| changed', len(changed)); print('verdicts', json.dumps(counts, indent=0))
print('songs losing every recording:', len(lostall)); [print('  -',x) for x in lostall]
print('accepted but not a title match:', len(diff)); [print('  ?',x) for x in diff]
out=['# Box recordings accepted as spelling variants (every one; all other accepted recordings carry the song\'s own words)\n\nEach row: the song, the track, the keyed words of track / song, and the tier (2 = spelling of the same words, 1 = a long word one consonant apart).\n\n| song | track | track words / song words | tier |\n|---|---|---|---|\n']; n=0; tiers={}
for song,v in b.items():
    seen=set()
    for x in v:
        if not x['accept'] or x['name'] in seen: continue
        seen.add(x['name']); t=x.get('tier',0); tiers[t]=tiers.get(t,0)+1
        if t>=3: continue
        n+=1; out.append(f'| {song} | {x["name"]} | {mb.track_words(x["name"])} / {mb.song_words(song)} | {t} |\n')
out.append(f'\n{n} accepted pairs beyond same-words; accepted pairs by tier: {tiers}.\n')
open('../sheet-match/box-spelling-variants.md','w').write(''.join(out)); print('accepted pairs by tier:', tiers, '| spelling-variant acceptances:', n)
