// @ts-nocheck
import { describe, it, expect } from 'vitest';
import index from '../public/bhajan-index2.json';
import { amazonTrackUrl } from './amazon';

describe('Amazon track links in the index', () => {
  const linked = index.filter((b) => b.az);

  it('are well-formed ASINs', () => {
    expect(linked.length).toBeGreaterThan(500);
    for (const b of linked) expect(b.az, b.n).toMatch(/^[A-Z0-9]{10}$/);
  });

  it('point at the track page', () => {
    expect(amazonTrackUrl('B004G1T0UK')).toBe('https://www.amazon.com/dp/B004G1T0UK');
  });

  it("keep the hand-checked pairs", () => {
    const az = Object.fromEntries(linked.map((b) => [b.n, b.az]));
    expect(az['abhayam tan aruluka']).toBe('B004G1T0UK');
    expect(az['a-i bhavani (marathi)']).toBe('B0053UZCVO');
    // Same title by another artist: never linked.
    expect(az['abhayam abhayam amma']).toBeUndefined();
  });
});
