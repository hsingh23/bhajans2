// @ts-nocheck
// The reader's own key ("my key"): one Sa, saved like the other prefs, that
// every song's key, scale notes, piano keys, chords and summary are shown in.
// A fixed Sa rather than a semitone shift, because a singer's comfortable
// shruti stays put while the recordings' keys vary from song to song.
import { track } from './analytics';
import { setPref, usePref } from './prefs';
import { isPitchClass } from './musicTheory';

export const MY_KEY_PREF = 'musicKey';

/** The saved Sa as a pitch class, or undefined when the reader has not chosen one. */
export const useMyKey = () => {
  const value = usePref(MY_KEY_PREF);
  return isPitchClass(value) ? value : undefined;
};

/** Saves (or, with anything but a pitch class, clears) the reader's key. */
export const setMyKey = (pc) => {
  const value = isPitchClass(pc) ? pc : undefined;
  setPref(MY_KEY_PREF, value);
  track('set_my_key', { my_key: value ?? 'none' });
};
