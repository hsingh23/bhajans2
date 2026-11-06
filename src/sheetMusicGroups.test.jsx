import { describe, expect, test } from 'vitest';
import { groupSheetMusic, parseSheetMusicName } from './sheetMusicGroups';

describe('parseSheetMusicName', () => {
  test('reads flats, sharps, minors and the original marker', () => {
    expect(parseSheetMusicName('FragranceInTheDarkDb.pdf')).toMatchObject({ song: 'FragranceInTheDark', key: 'Db', pitch: 1, minor: false });
    expect(parseSheetMusicName('GopiyargalFsharpm.pdf')).toMatchObject({ song: 'Gopiyargal', key: 'F#m', pitch: 6, minor: true });
    expect(parseSheetMusicName('AmmeCo.pdf')).toMatchObject({ song: 'Amme', key: 'C' });
    expect(parseSheetMusicName('KaisaSandesaC.pdf')).toMatchObject({ song: 'KaisaSandesa', key: 'C', pitch: 0 });
  });

  test('returns null when there is no key', () => {
    expect(parseSheetMusicName('C.pdf')).toBeNull();
    expect(parseSheetMusicName('notes.txt')).toBeNull();
  });
});

describe('groupSheetMusic', () => {
  test('groups by song in first-seen order with keys sorted chromatically', () => {
    const { groups, other } = groupSheetMusic([
      'IrulTingiC.pdf',
      'FragranceDb.pdf',
      'IrulTingiDb.pdf',
      'FragranceInTheDarkAm.pdf',
      'FragranceInTheDarkBb.pdf',
      'FragranceC.pdf',
      'FragranceInTheDarkC.pdf',
      'readme.pdf',
    ]);
    expect(groups.map((g) => g.label)).toEqual(['Irul Tingi', 'Fragrance', 'Fragrance In The Dark']);
    expect(groups[1].keys.map((k) => k.key)).toEqual(['C', 'Db']);
    expect(groups[2].keys.map((k) => k.key)).toEqual(['C', 'Bb', 'Am']);
    expect(other).toEqual(['readme.pdf']);
  });

  test('splits numbered song names into words', () => {
    const { groups } = groupSheetMusic(['OmkaraDivyaPorule10cGm.pdf']);
    expect(groups[0].label).toBe('Omkara Divya Porule 10c');
  });
});
