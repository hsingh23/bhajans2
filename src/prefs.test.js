// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyRemotePrefs, getPrefs, readPref, rememberedSheetKey, safeKey, setPref } from './prefs';

const mockSetRefOnce = vi.fn(() => Promise.resolve());
const mockAuth = { currentUser: { uid: 'u1' } };
vi.mock('./loadFirebase', () => ({
  loadFirebase: () => Promise.resolve({ auth: mockAuth, setRefOnce: mockSetRefOnce, removeRefOnce: vi.fn() }),
}));

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('prefs', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('starts empty and keeps one object until something changes', () => {
    expect(getPrefs()).toEqual({});
    expect(getPrefs()).toBe(getPrefs());
  });

  it('stores nested prefs locally and on the account', async () => {
    setPref('viewer/headerHidden', true);
    setPref('viewer/sheetKeys/Fragrance', 'Db');
    expect(JSON.parse(localStorage.getItem('prefs'))).toEqual({ viewer: { headerHidden: true, sheetKeys: { Fragrance: 'Db' } } });
    await flush();
    expect(mockSetRefOnce).toHaveBeenCalledWith('prefs/u1/viewer/headerHidden', true);
    expect(mockSetRefOnce).toHaveBeenCalledWith('prefs/u1/viewer/sheetKeys/Fragrance', 'Db');
  });

  it('skips writes that change nothing', async () => {
    setPref('musicianMode', true);
    await flush();
    mockSetRefOnce.mockClear();
    setPref('musicianMode', true);
    await flush();
    expect(mockSetRefOnce).not.toHaveBeenCalled();
  });

  it('merges the account copy, keeping local song keys the account lacks', () => {
    setPref('viewer/sheetKeys/Local', 'C');
    applyRemotePrefs({ musicianMode: false, viewer: { headerHidden: true, sheetKeys: { Remote: 'Eb', Bad: 42 } } });
    expect(getPrefs()).toEqual({
      musicianMode: false,
      viewer: { headerHidden: true, sheetKeys: { Local: 'C', Remote: 'Eb' } },
    });
    applyRemotePrefs(null);
    expect(readPref(getPrefs(), 'viewer/headerHidden')).toBe(true);
  });

  it('makes song names safe as database keys', () => {
    expect(safeKey('a.b#c$d[e]f/g')).toBe('a_b_c_d_e_f_g');
    expect(rememberedSheetKey({ 'Song_1': 'D' }, 'Song.1')).toBe('D');
  });

  it('survives a corrupt stored value', () => {
    localStorage.setItem('prefs', '{not json');
    expect(getPrefs()).toEqual({});
  });
});
