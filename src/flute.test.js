// @ts-nocheck
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { fluteKeys, fluteLine, fluteRegister } from './flute';

const keys = (k) =>
  [k.thumb && 'T', ...k.left.map((on, i) => on && `L${i + 1}`), k.gSharp && 'G#', ...k.right.map((on, i) => on && `R${i + 1}`), k.eFlat && 'Eb', k.lowC && 'C', k.lowCSharp && 'C#']
    .filter(Boolean)
    .join(' ');

describe('concert flute fingerings', () => {
  it('uses the common Boehm fingerings', () => {
    expect(keys(fluteKeys(60))).toBe('T L1 L2 L3 R1 R2 R3 C'); // low C
    expect(keys(fluteKeys(67))).toBe('T L1 L2 L3 Eb'); // G4
    expect(keys(fluteKeys(70))).toBe('T L1 R1 Eb'); // Bb4, one-and-one
    expect(keys(fluteKeys(73))).toBe('Eb'); // C#5, all fingers off
    expect(keys(fluteKeys(74))).toBe('T L2 L3 R1 R2 R3'); // D5 vents L1
    expect(keys(fluteKeys(87))).toBe('T L1 L2 L3 G# R1 R2 R3 Eb'); // Eb6
    expect(fluteKeys(59)).toBeNull();
    expect(fluteKeys(94)).toBeNull();
    expect([60, 73, 74, 85, 86, 93].map(fluteRegister)).toEqual([0, 0, 1, 1, 2, 2]);
  });

  it('puts the line in the lowest octave the flute can play (Mohanam on G)', () => {
    const line = fluteLine(7, ['S', 'R2', 'G3', 'P', 'D2', 'S']);
    expect(line.map((n) => n.midi)).toEqual([67, 69, 71, 74, 76, 79]);
    expect(line.map((n) => n.register)).toEqual([0, 0, 0, 1, 1, 1]);
    expect(fluteLine(undefined, ['S'])).toBeNull();
  });

  it('fits every reference raga line in every key', () => {
    const { ragas } = JSON.parse(readFileSync(`${process.cwd()}/public/music-reference.json`, 'utf8'));
    const misses = [];
    for (const [id, r] of Object.entries(ragas)) {
      for (const [swaras, down] of [
        [r.aroha, false],
        [r.avaroha, true],
      ]) {
        if (!swaras?.length) continue;
        for (let pc = 0; pc < 12; pc += 1) if (!fluteLine(pc, swaras, down)) misses.push(`${id} ${pc}`);
      }
    }
    expect(misses).toEqual([]);
  });
});
