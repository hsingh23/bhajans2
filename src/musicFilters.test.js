// @ts-nocheck
import { describe, it, expect } from 'vitest';
import songs from './__fixtures__/bhajan-music.json';
import reference from './__fixtures__/music-reference.json';
import { MUSIC_FACETS, activeMusicFilters, matchesMusic, musicFacetCounts, musicSearchText } from './musicFilters';

const music = { songs, ...reference };
const facet = (id) => MUSIC_FACETS.find((f) => f.id === id);
const kali = songs['kali kali kali (gujarati)'];
const arivenum = songs['arivenum akakkan (tamil)'];
const names = Object.keys(songs);

describe('music facets', () => {
  it("reads a song's key, raga, scale, taal, tempo and chords", () => {
    const values = Object.fromEntries(MUSIC_FACETS.map((f) => [f.id, f.values(kali, music, {})]));
    expect(values).toEqual({
      key: ['7'],
      raga: ['mohanam'],
      scale: ['5'],
      third: ['major'],
      taal: ['keherwa'],
      tempo: ['medium'],
      chords: ['yes'],
    });
  });

  it('names values the way a musician reads them', () => {
    expect(facet('key').label('7', music)).toBe('G · 5 kattai');
    expect(facet('raga').label('mohanam', music)).toBe('Mohanam');
    expect(facet('scale').label('5', music)).toBe('Pentatonic (5 notes)');
    expect(facet('third').label('minor', music)).toBe('Minor (flat 3rd)');
    expect(facet('taal').label('keherwa', music)).toBe('Keherwa · 8 beats');
    expect(facet('tempo').label('slow', music)).toBe('Slow (under 80 BPM)');
  });

  it('matches any raga of a song that changes raga between sections', () => {
    expect(matchesMusic(arivenum, music, { raga: 'sarasangi' })).toBe(true);
    expect(matchesMusic(arivenum, music, { raga: 'mohanam' })).toBe(false);
  });

  it('needs every chosen filter to match', () => {
    expect(matchesMusic(kali, music, { key: '7', taal: 'keherwa' })).toBe(true);
    expect(matchesMusic(kali, music, { key: '7', taal: 'dadra' })).toBe(false);
  });

  it('drops best guesses when only confident matches are wanted', () => {
    // arivenum's ragas are below the 0.85 bar for naming a raga plainly
    expect(matchesMusic(arivenum, music, { raga: 'maand', sureOnly: true })).toBe(false);
    expect(matchesMusic(kali, music, { raga: 'mohanam', sureOnly: true })).toBe(true);
  });

  it('counts each option as if its own filter were not set', () => {
    const counts = musicFacetCounts(names, music, { taal: 'keherwa' });
    // Every taal stays offered, so the reader can switch taal without clearing first.
    expect(Object.keys(counts.taal)).toEqual(expect.arrayContaining(['keherwa', 'dadra']));
    // Other facets only count keherwa songs.
    const keherwaSongs = names.filter((n) => songs[n].t?.id === 'keherwa');
    expect(Object.values(counts.key).reduce((a, b) => a + b, 0)).toBe(keherwaSongs.filter((n) => Number.isInteger(songs[n].sh?.pc)).length);
  });

  it('knows whether any music filter is set', () => {
    expect(activeMusicFilters({})).toBe(false);
    expect(activeMusicFilters({ sureOnly: true })).toBe(false);
    expect(activeMusicFilters({ raga: 'mohanam' })).toBe(true);
  });

  it('lets the search box find raga and taal names', () => {
    expect(musicSearchText(kali, music)).toMatch(/mohanam/i);
    expect(musicSearchText(kali, music)).toMatch(/keherwa/i);
    expect(musicSearchText(undefined, music)).toBe('');
  });
});
