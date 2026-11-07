import { describe, expect, test } from 'vitest';
import { groupSheetMusic, parseSheetMusicName, preferredSheetFile, stepKey } from './sheetMusicGroups';

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

describe('preferredSheetFile', () => {
  const files = ['FragranceDb.pdf', 'IrulTingiC.pdf', 'FragranceC.pdf', 'FragranceBb.pdf'];

  test('uses the remembered key of the default song', () => {
    expect(preferredSheetFile(files, (song) => (song === 'Fragrance' ? 'Bb' : undefined))).toBe('FragranceBb.pdf');
  });

  test('falls back to the first file when nothing (or a missing key) is remembered', () => {
    expect(preferredSheetFile(files, () => undefined)).toBe('FragranceDb.pdf');
    expect(preferredSheetFile(files, () => 'F#')).toBe('FragranceDb.pdf');
    expect(preferredSheetFile(['notes.pdf'], () => 'C')).toBe('notes.pdf');
    expect(preferredSheetFile([], () => 'C')).toBeUndefined();
  });
});

describe('stepKey', () => {
  const { keys } = groupSheetMusic(['SongBb.pdf', 'SongC.pdf', 'SongEb.pdf', 'SongDb.pdf']).groups[0];

  test('moves to the neighbouring available key in pitch order', () => {
    expect(stepKey(keys, 'SongEb.pdf', -1).key).toBe('Db');
    expect(stepKey(keys, 'SongEb.pdf', 1).key).toBe('Bb');
  });

  test('does not wrap around at either end', () => {
    expect(stepKey(keys, 'SongC.pdf', -1)).toBeNull();
    expect(stepKey(keys, 'SongBb.pdf', 1)).toBeNull();
    expect(stepKey(keys, 'Other.pdf', 1)).toBeNull();
  });
});
