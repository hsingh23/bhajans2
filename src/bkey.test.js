// @ts-nocheck
import { describe, expect, it } from 'vitest';
import table from './bkey-rules.json';
import { bkey, devoice, splitCamel } from './bkey';

describe('bkey phonetic key', () => {
  it.each(table.fixtures.collide)('"%s" and "%s" share a key', (a, b) => {
    expect(bkey(a).key).toBe(bkey(b).key);
  });

  it.each(table.fixtures.distinct)('"%s" and "%s" stay distinct', (a, b) => {
    expect(bkey(a).key).not.toBe(bkey(b).key);
  });

  it('matches sheet-music file stems to index names', () => {
    expect(bkey('AmrteshvariJagadishvari', { camel: true }).key).toBe(bkey('amrtesvari jagadisvari').key);
    expect(bkey('OmNamahSivaya', { camel: true }).key).toBe(bkey('om namah sivaya').key);
    expect(splitCamel('JayGanesaJayGanesa')).toBe('Jay Ganesa Jay Ganesa');
  });

  it('drops language tags and keeps other parentheticals as aliases', () => {
    const k = bkey('devi mukambike (amme amrtesvari)');
    expect(k.key).toBe(bkey('devi mukambike').key);
    expect(k.aliases.map((a) => a.key)).toEqual([bkey('amme amrtesvari').key]);
    expect(bkey('aintezhuttu (tamil)').key).toBe(bkey('aintezhuttu').key);
    expect(bkey('a fragrance in the dark (irul tingi) english').aliases).toHaveLength(1);
  });

  it('gives Tamil spellings an alternate key', () => {
    expect(devoice(bkey('kadaloram').key)).toBe(devoice(bkey('kataloram').key));
  });
});
