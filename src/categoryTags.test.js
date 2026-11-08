import { describe, expect, it } from 'vitest';
import { countBy, hasTag } from './categoryTags';

const songs = [
  { n: 'amrtapuresvari devi', lg: 'Malayalam', lg2: 'Sanskrit', d: 'Devi', d2: 'Amma' },
  { n: 'om namah sivaya', lg: 'Sanskrit', d: 'Shiva' },
  { n: 'kanna va', lg: 'Malayalam', d: 'Krishna' },
];

describe('second language and deity tags', () => {
  it('match either tag', () => {
    expect(songs.filter((b) => hasTag(b, 'lg', 'Sanskrit')).map((b) => b.n)).toEqual([
      'amrtapuresvari devi',
      'om namah sivaya',
    ]);
    expect(songs.filter((b) => hasTag(b, 'd', 'Amma')).map((b) => b.n)).toEqual(['amrtapuresvari devi']);
    expect(hasTag(undefined, 'd', 'Amma')).toBe(false);
  });

  it('count a song under both of its tags, once each', () => {
    expect(countBy(songs, 'lg')).toEqual({ Malayalam: 2, Sanskrit: 2 });
    expect(countBy(songs, 'd')).toEqual({ Devi: 1, Amma: 1, Shiva: 1, Krishna: 1 });
    expect(countBy([{ lg: 'Hindi', lg2: 'Hindi' }], 'lg')).toEqual({ Hindi: 1 });
  });
});
