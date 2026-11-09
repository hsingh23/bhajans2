// @ts-nocheck
// Search quality against realistic typed queries. Expected names are exact `n` values;
// several are listed when two songs both answer the query. Reports MRR and top-1 so the
// key rules and ranking can be hill-climbed: a change must not lower either.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildSearchIndex, rankBhajans, splitYears } from './searchRank';

const bhajans = JSON.parse(readFileSync(resolve(process.cwd(), 'public/bhajan-index2.json'), 'utf8'));
const index = buildSearchIndex(bhajans);

const QUERIES = [
  ['amriteshwari', ['amrtesvari jagadisvari', 'amrtesvari jagadisvari he matrrupa', 'amrtesvari susmita', 'amrtesvari vandanam', 'amrtesvari suprabhatam']],
  ['jagadeeshwari daya karo', ['jagadisvari daya karo']],
  ['om namah shivaya', ['om namo namah sivaya']],
  ['kanna vaa vaa vaa', ['kanna va va va']],
  ['amme amritanandamayi devi', ['amme amrtanandamayi devi']],
  ['aindezhuthu', ['aintezhuttu (tamil)']],
  ['srushtiyum neeye', ['srstiyum niye']],
  ['hare krishna krishna', ['hare krsna krsna']],
  ['kahan ho kanha', ['kaha ho kanha', 'kanha kahan ho (hindi)']],
  ['kanha kaha ho', ['kanha kahan ho (hindi)', 'kaha ho kanha']],
  ['ganesha namah om', ['ganesa namah om']],
  ['gajaanana', ['gajanana']],
  ['ganapathi bappa morya', ['ganapati bappa moraya (marathi)']],
  ['shree rama jaya rama', ['sri rama jaya rama']],
  ['radhe shyam radhe shyam', ['radhe syam radhe syam', 'radhesyam radhesyam (hindi)']],
  ['panduranga vittala', ['panduranga vithala']],
  ['vitthal hari vitthal', ['vithal hari vithal nam gajari (marathi)', 'vithala hari vithala']],
  ['velmuruga', ['velmuruga velmuruga (tamil)']],
  ['saraswati saraswati', ['sarasvati sarasvati sarasija']],
  ['namo namaste mata saraswati', ['namo namaste matah sarasvati']],
  ['hara hara mahadeva shambho', ['hara hara mahadeva sambho']],
  ['shambhu mahadev', ['sambho mahadeva']],
  ['gopala govinda krishna', ['gopala govinda krsna']],
  ['daya karo hari narayan', ['daya karo hari narayana']],
  ['hari om namo narayanaya', ['hari om namo narayanaya']],
  ['satyam gnanam anantam', ['satyam jnanam anantam (sanskrit)']],
  ['laxmi narasimha', ['he laksmi nrsimha (hindi)']],
  ['azhagu azhagu', ['azhaku azhaku (tamil)']],
  ['devi sharanam durge sharanam', ['devi saranam durge saranam']],
  ['jai jagadambe durge maa', ['jai jagadambe durge ma']],
  ['krishna manamohana', ['manamohana krsna', 'krsna mana mohana']],
  ['shyama sundara madana mohana', ['syama sundara madana mohana']],
  ['amme bhagavathi kaali maheshwari', ['amme bhagavati kali mahesvari (malayalam)']],
  ['cidananda govind mukund', ['chidananda govinda mukunda']],
  ['njan ariyunnu', ['nan aṙiyunnu (malayalam, nandana)']],
  ['amrithanandamayi sadguru', ['amrtanandamayi sadguru']],
  ['ambike jagadeeswari', ['ambike jagadisvari']],
  ['kaali durge namo namah', ['kali durge namo nama']],
  ['amma amma ennum', ['amma amma enum (tamil)']],
  ['durge dukha nivarini', ['durge duhkha-nivarini bhavatarini amrtesvari (malayalam)']],
  ['only love', ['only love (english)']],
  ['onlylove', ['only love (english)']],
  ['Only Love ', ['only love (english)']],
  ['only lov', ['only love (english)']],
  ['jagadishwari', ['jagadisvari daya karo', 'jagadisvari janamana', 'jagadisvari ma (malayalam amrita)', 'isvari jagadisvari', 'ambike jagadisvari', 'amrtesvari jagadisvari']],
  ['vol5-74', ['jai jai ram']],
];

const rankOf = (query, expected) => {
  const names = rankBhajans(index, query).map((i) => bhajans[i].n);
  const ranks = expected.map((e) => names.indexOf(e)).filter((r) => r >= 0);
  return ranks.length ? Math.min(...ranks) + 1 : 0;
};

describe('search ranking', () => {
  it('every expected song exists in the index', () => {
    const names = new Set(bhajans.map((b) => b.n));
    for (const [, expected] of QUERIES) expect(expected.some((e) => names.has(e)), expected.join(' | ')).toBe(true);
  });

  it('puts the intended song first for almost every query (top-1 >= 90%, MRR >= 0.93)', () => {
    const ranks = QUERIES.map(([q, e]) => [q, rankOf(q, e)]);
    const top1 = ranks.filter(([, r]) => r === 1).length;
    const mrr = ranks.reduce((s, [, r]) => s + (r ? 1 / r : 0), 0) / ranks.length;
    const misses = ranks.filter(([, r]) => r !== 1);
    console.log(`search quality: top-1 ${top1}/${ranks.length}, MRR ${mrr.toFixed(3)}; not first: ${JSON.stringify(misses)}`);
    expect(top1 / ranks.length).toBeGreaterThanOrEqual(0.9);
    expect(mrr).toBeGreaterThanOrEqual(0.93);
    // Ranks every query against the full index: ~1 s alone, past 5 s on a busy machine.
  }, 30000);

  it('returns everything in index order for an empty query', () => {
    expect(rankBhajans(index, '')).toEqual(bhajans.map((_, i) => i));
    expect(rankBhajans(index, '   ')).toEqual(bhajans.map((_, i) => i));
  });

  it('finds songs by year and decade, alone or with a name', () => {
    const years = (query) => rankBhajans(index, query).map((i) => bhajans[i].y);
    const in1985 = rankBhajans(index, '1985');
    expect(in1985.length).toBe(bhajans.filter((b) => b.y === 1985).length);
    expect(years('1985').every((y) => y === 1985)).toBe(true);
    for (const q of ['1980s', '80s', "'80s"]) {
      const ys = years(q);
      expect(ys.length).toBe(bhajans.filter((b) => b.y >= 1980 && b.y <= 1989).length);
      expect(ys.every((y) => y >= 1980 && y <= 1989)).toBe(true);
    }
    // A name plus a year ranks the name among that year's songs only.
    const named = rankBhajans(index, 'amba bhavani 1985').map((i) => bhajans[i]);
    expect(named[0].n).toBe('amba bhavani jaya jagadambe');
    expect(named.every((b) => b.y === 1985)).toBe(true);
    // Two years mean either year.
    expect(new Set(years('1985 1987'))).toEqual(new Set([1985, 1987]));
  });

  it('still finds a supplement by its year, after the songs dated that year', () => {
    const found = rankBhajans(index, '2020').map((i) => bhajans[i]);
    const dated = found.findIndex((b) => b.y !== 2020);
    expect(found.slice(0, dated).every((b) => b.y === 2020)).toBe(true);
    expect(found.slice(dated).every((b) => b.l.some((l) => l.startsWith('2020')))).toBe(true);
  });

  it('splits year words from the rest of the query', () => {
    expect(splitYears('krishna 2010')).toEqual({ rest: 'krishna', ranges: [[2010, 2010]] });
    expect(splitYears('20s 1990s')).toEqual({ rest: '', ranges: [[2020, 2029], [1990, 1999]] });
    expect(splitYears('om 108 vol5-74')).toEqual({ rest: 'om 108 vol5-74', ranges: [] });
  });

  it('keeps location and tag substring search', () => {
    const first = rankBhajans(index, 'vol5-74')[0];
    expect(bhajans[first].l).toContain('vol5-74');
  });
});
