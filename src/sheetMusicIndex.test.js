// @ts-nocheck
// Data checks for the sheet-music links (`sm`) in the bhajan index. The links are
// produced by create-index/sheet-match (lyrics of each PDF matched against the
// songbook pages); these tests catch a regenerated index that drifts from them.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseSheetMusicName } from './sheetMusicGroups';

const index = JSON.parse(readFileSync(resolve(process.cwd(), 'public/bhajan-index2.json'), 'utf8'));
const files = new Set(
  readFileSync(resolve(process.cwd(), 'create-index/sheetmusiclist.txt'), 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.endsWith('.pdf')),
);
const stem = (file) => parseSheetMusicName(file)?.song ?? file;

describe('sheet music links in bhajan-index2.json', () => {
  it('only point at files in sheetmusiclist.txt, without duplicates', () => {
    for (const song of index) {
      const sm = song.sm ?? [];
      expect(new Set(sm).size, song.n).toBe(sm.length);
      for (const file of sm) expect(files.has(file), `${song.n}: ${file}`).toBe(true);
    }
  });

  it('link every key of a song together (no half-linked songs)', () => {
    const keysByStem = new Map();
    for (const file of files) keysByStem.set(stem(file), (keysByStem.get(stem(file)) ?? 0) + 1);
    for (const song of index) {
      const counts = new Map();
      for (const file of song.sm ?? []) counts.set(stem(file), (counts.get(stem(file)) ?? 0) + 1);
      for (const [s, n] of counts) expect(n, `${song.n}: ${s}`).toBe(keysByStem.get(s));
    }
  });

  it('never fan one sheet out over many songs (the old name matcher put "Amme" on 70 songs)', () => {
    const songsByStem = new Map();
    for (const song of index) {
      for (const s of new Set((song.sm ?? []).map(stem))) songsByStem.set(s, (songsByStem.get(s) ?? 0) + 1);
    }
    for (const [s, n] of songsByStem) expect(n, s).toBeLessThanOrEqual(3);
  });

  it('keep the regressions reported by users fixed', () => {
    const byName = new Map(index.map((song) => [song.n, new Set((song.sm ?? []).map(stem))]));
    const mustNot = [
      ['amme abhayaprade (malayalam, krishna)', 'Amme'],
      ['amrtanandamayi jay jay', 'AmrtanandamayiMata'],
      ['amrtapuresvari devi', 'VarDe'],
      ['durge durge', 'DurgeDurgatiHarane'],
      ['jai kalyani jai bhavani (hindi,marathi)', 'A-IBhavani'],
      ['one tiny atom', 'OneInAMillion'],
    ];
    for (const [song, s] of mustNot) expect(byName.get(song)?.has(s) ?? false, `${song} <- ${s}`).toBe(false);
    const must = [
      ['abhayam abhayam amma', 'AbhayamAbhayamAmma'],
      ['durge durge', 'DurgeDurge'],
      ['one tiny atom', 'OneTinyAtom'],
      ['jagadisvari daya karo', 'Jagadishvari'],
      ['amrtanandamayi ma tucch ko', 'AmrtanandamayiMaTucchKo'],
    ];
    for (const [song, s] of must) expect(byName.get(song)?.has(s) ?? false, `${song} <- ${s}`).toBe(true);
  });
});
