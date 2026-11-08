// @ts-nocheck
// Musician mode: an opt-in switch that shows shruti, raga, taal and chords.
// Off by default; the music data (two static JSON files) is fetched only
// while it is on. See create-index/music-meta/reference/music-data-spec.md.
import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Icon from './Icon';
import { track } from './analytics';
import { setPref, usePref } from './prefs';

export const MUSIC_FILES = ['/bhajan-music.json', '/music-reference.json'];

const getJsonFile = async (url) => {
  const response = await window.fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.json();
};

/** Both files, or null when either is missing or broken (the mode then shows nothing). */
export const fetchMusicData = async () => {
  try {
    const [songs, reference] = await Promise.all(MUSIC_FILES.map(getJsonFile));
    if (!songs || typeof songs !== 'object') return null;
    return {
      songs,
      ragas: reference?.ragas || {},
      taals: reference?.taals || {},
    };
  } catch (error) {
    console.warn('Musician details unavailable:', error);
    return null;
  }
};

const noop = () => {};
// Without a provider (tests, the error page) the mode is simply off and has no toggle.
const MusicianModeContext = createContext({ available: false, enabled: false, music: null, toggle: noop, setEnabled: noop });

export const useMusicianMode = () => useContext(MusicianModeContext);

/** The song's musician details, only while the mode is on and the song has an entry. */
export const useSongMusic = (name) => {
  const { enabled, music } = useMusicianMode();
  return enabled && name && music ? music.songs[name] || null : null;
};

export const setMusicianMode = (enabled) => {
  setPref('musicianMode', Boolean(enabled));
  track('toggle_musician_mode', { musician_mode: enabled ? 'on' : 'off' });
};

export const MusicianModeProvider = ({ children }) => {
  const enabled = usePref('musicianMode') === true;
  const { data } = useQuery({
    queryKey: ['musician-data'],
    queryFn: fetchMusicData,
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  });
  // Fetch the details code with the data, so the first details view opens at once.
  useEffect(() => {
    if (enabled) import('./MusicianDetails').catch(() => {});
  }, [enabled]);
  const value = useMemo(
    () => ({
      available: true,
      enabled,
      music: enabled ? data || null : null,
      toggle: () => setMusicianMode(!enabled),
      setEnabled: setMusicianMode,
    }),
    [enabled, data]
  );
  return <MusicianModeContext.Provider value={value}>{children}</MusicianModeContext.Provider>;
};

const MusicianDetails = React.lazy(() => import('./MusicianDetails'));

/** The "For musicians" section for one song; renders nothing when the mode is off or the song has no entry. */
export const SongMusicSection = ({ name }) => {
  const { music } = useMusicianMode();
  const entry = useSongMusic(name);
  if (!entry) return null;
  return (
    <React.Suspense fallback={null}>
      <MusicianDetails key={name} entry={entry} music={music} />
    </React.Suspense>
  );
};

export const MusicianModeToggle = ({ className = 'button button-circle' }) => {
  const { available, enabled, toggle } = useMusicianMode();
  if (!available) return null;
  const label = enabled ? 'Hide musician details' : 'Show musician details';
  return (
    <button
      type='button'
      className={`${className} musician-toggle${enabled ? ' is-active' : ''}`}
      onClick={toggle}
      aria-pressed={enabled}
      aria-label={label}
      title={label}>
      <Icon name='music-note' />
    </button>
  );
};
