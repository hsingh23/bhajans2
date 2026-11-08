// @ts-nocheck
// Per-reader preferences: kept on this device in localStorage and, for a
// signed-in reader, copied to prefs/{uid} in the Realtime Database (the same
// way favorites sync), so the next device picks them up at sign-in.
//
// Shape (local and remote):
//   musicianMode   boolean   show raga / taal / shruti details
//   musicInstrument  one of MUSIC_INSTRUMENTS        how scales and chords are drawn
//   musicKey       0-11      the reader's own Sa (pitch class, 0 = C): every song's
//                            notes and key are shown from it; 'recording' or absent =
//                            each song's recording key ('recording' so a reset syncs)
//   viewer.headerHidden  boolean | absent   top bar on the song page; absent = no choice yet
//   viewer.sheetKeys     { [sheetSong]: "Db" }  last key opened for each sheet-music song
//
// Paths are Firebase-style ("viewer/headerHidden"); add a new pref by giving it a
// path and, if it can come from another device, a check in REMOTE_FIELDS.
import { useCallback, useSyncExternalStore } from 'react';
import { loadFirebase } from './loadFirebase';

const STORAGE_KEY = 'prefs';
const listeners = new Set();
const EMPTY = Object.freeze({});

// Parse once per stored string, so the snapshot keeps its identity between reads
// and clearing localStorage (as tests do) resets the prefs with it.
let cachedRaw;
let cachedPrefs = EMPTY;
export const getPrefs = () => {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      const parsed = raw ? JSON.parse(raw) : null;
      cachedPrefs = parsed && typeof parsed === 'object' ? parsed : EMPTY;
    } catch {
      cachedPrefs = EMPTY;
    }
  }
  return cachedPrefs;
};

const save = (prefs) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage full or blocked: the choice still applies until the page closes.
  }
  listeners.forEach((listener) => listener());
};

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Firebase keys can't hold . $ # [ ] / */
export const safeKey = (key) => String(key).replace(/[.$#[\]/]/g, '_');

const parts = (path) => path.split('/').filter(Boolean);

export const readPref = (prefs, path) =>
  parts(path).reduce((value, part) => (value && typeof value === 'object' ? value[part] : undefined), prefs);

const writePath = (prefs, [head, ...rest], value) => {
  const next = { ...(prefs && typeof prefs === 'object' ? prefs : {}) };
  if (rest.length) next[head] = writePath(next[head], rest, value);
  else if (value === undefined) delete next[head];
  else next[head] = value;
  return next;
};

/** Saves one preference here and, when signed in, on the reader's account. */
export const setPref = (path, value) => {
  if (readPref(getPrefs(), path) === value) return;
  save(writePath(getPrefs(), parts(path), value));
  loadFirebase()
    .then(({ auth, setRefOnce, removeRefOnce }) => {
      const uid = auth?.currentUser?.uid;
      if (!uid) return;
      const remotePath = `prefs/${uid}/${path}`;
      return value === undefined ? removeRefOnce(remotePath) : setRefOnce(remotePath, value);
    })
    .catch((error) => console.warn('Could not save preference:', error));
};

// What may come back from the account; anything else there is ignored.
const isBool = (value) => typeof value === 'boolean';
const isPitchClass = (value) => Number.isInteger(value) && value >= 0 && value < 12;
export const INSTRUMENT_PREF = 'musicInstrument';
/** Instruments the musician panel draws for; the account may only set one of these. */
export const MUSIC_INSTRUMENTS = ['voice', 'piano', 'guitar', 'ukulele', 'bansuri'];
const REMOTE_FIELDS = {
  musicianMode: isBool,
  musicKey: (value) => isPitchClass(value) || value === 'recording',
  [INSTRUMENT_PREF]: (value) => MUSIC_INSTRUMENTS.includes(value),
  'viewer/headerHidden': isBool,
};

/** Merges prefs read from prefs/{uid} at sign-in: the account wins where it has a value. */
export const applyRemotePrefs = (remote) => {
  if (!remote || typeof remote !== 'object') return;
  let next = getPrefs();
  for (const [path, valid] of Object.entries(REMOTE_FIELDS)) {
    const value = readPref(remote, path);
    if (valid(value)) next = writePath(next, parts(path), value);
  }
  const remoteKeys = readPref(remote, 'viewer/sheetKeys');
  if (remoteKeys && typeof remoteKeys === 'object') {
    for (const [song, key] of Object.entries(remoteKeys)) {
      if (typeof key === 'string' && key.length <= 8) next = writePath(next, ['viewer', 'sheetKeys', song], key);
    }
  }
  if (next !== getPrefs()) save(next);
};

/** Reads one preference and re-renders when it changes. */
export const usePref = (path) => {
  const prefs = useSyncExternalStore(subscribe, getPrefs, getPrefs);
  return readPref(prefs, path);
};

/**
 * Song-page settings that follow the reader from song to song.
 * headerHidden is undefined until the reader chooses.
 */
export const useViewerPrefs = () => {
  const headerHidden = usePref('viewer/headerHidden');
  const sheetKeys = usePref('viewer/sheetKeys') || EMPTY;
  const setHeaderHidden = useCallback((hidden) => setPref('viewer/headerHidden', Boolean(hidden)), []);
  const rememberSheetKey = useCallback(
    (song, key) => song && key && setPref(`viewer/sheetKeys/${safeKey(song)}`, key),
    []
  );
  return { headerHidden, setHeaderHidden, sheetKeys, rememberSheetKey };
};

export const rememberedSheetKey = (sheetKeys, song) => sheetKeys?.[safeKey(song)];
