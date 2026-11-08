import React, { useState, useEffect, useCallback, useRef, memo } from "react";
import Icon from "./Icon";
import { 
  Snackbar, 
  Alert 
} from "@mui/material";
import { useParams, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import InvertiblePDF from "./InvertiblePDF";
import InvertibleEmbed from "./InvertibleEmbed";
import Header from "./Header";
import Loader from "./Loader";
import { useGoBack } from "./useGoBack";
import { groupSheetMusic, parseSheetMusicName, stepKey } from "./sheetMusicGroups";
import { useViewerPrefs, rememberedSheetKey } from "./prefs";
import { useMusicianMode, useSongMusic, SongMusicSection } from "./MusicianMode";
import { musicChips } from "./MusicChips";
import { useMyKey } from "./myKey";

// "G · Mohanam": the key and raga, short enough for a floating button.
const musicPillText = (entry, music, myKey) => {
  const chips = musicChips(entry, music, myKey);
  const shruti = chips.find((c) => c.kind === "shruti")?.text.split(" · ")[0];
  const raga = chips.find((c) => c.kind === "raga")?.text;
  return [shruti, raga].filter(Boolean).join(" · ") || "Musician";
};
import { track } from "./analytics";
import { rememberOpened } from "./engagement";

const InvertiblePdfComponent = memo(InvertiblePDF);
const HEADER_AUTO_HIDE_MS = 3000;
const HEADER_HEIGHT = 64;
// The PDF page itself; the loading animation draws on a canvas of its own.
const PDF_CANVAS = ".invertible-pdf-container canvas";

/**
 * Scrolls the window so the point `fraction` of the way down the rendered
 * page sits just below the header (`headerOffset` px tall).
 */
const scrollToPageFraction = (wrapper, fraction, headerOffset) => {
  const canvas = wrapper?.querySelector(PDF_CANVAS);
  if (!canvas) return;
  const { top, height } = canvas.getBoundingClientRect();
  window.scrollTo(0, Math.max(0, Math.round(top + window.scrollY + fraction * height - headerOffset)));
};
// Phones in either orientation: narrow in portrait, short in landscape.
const isPhoneSized = (width, height) => width < 768 || height <= 500;

const removeServiceWorkers = () => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.unregister();
    });
    navigator.serviceWorker.getRegistrations().then(function (registrations) {
      for (let registration of registrations) {
        registration.unregister();
      }
    });
  }
};

import { syncUserData, THREE_MONTHS_MS } from "./firebase";

const RenderPage = ({ bhajans = {}, renderFavorite }) => {
  const { id, location: locationParam, name: nameParam } = useParams();
  const navigate = useNavigate();
  const { state: navState, key: locationKey } = useLocation();
  // Rewriting the URL in place gives it a new key, so remember that this page
  // was the one the app opened on; useGoBack then still goes to search.
  const entryPoint = Boolean(navState?.entryPoint) || locationKey === "default";
  const [toast, setToast] = useState({ open: false, message: "", severity: "info" });
  const [verifyingSession, setVerifyingSession] = useState(false);

  const showToast = (message, severity = "info") => {
    setToast({ open: true, message, severity });
  };

  const handleCloseToast = () => {
    setToast({ ...toast, open: false });
  };

  let initialPageVal;
  if (!locationParam.includes(".pdf")) {
    initialPageVal = parseInt(locationParam.split("-")[1], 10);
  } else {
    initialPageVal = 1;
  }

  // The current page lives in ?page=N so a reload reopens the same page.
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(() => {
    const fromUrl = Number(searchParams.get("page"));
    return Number.isInteger(fromUrl) && fromUrl >= initialPageVal ? fromUrl : initialPageVal;
  });
  const [initialPage] = useState(initialPageVal);
  const [pages, setPages] = useState(0);
  
  const audioTagRef = useRef(null);
  
  const [playing, setPlaying] = useState(() => {
    const audio = document.querySelector("#audio");
    return audio instanceof HTMLAudioElement && !audio.paused ? decodeURIComponent(audio.src) : false;
  });

  useEffect(() => {
    audioTagRef.current = document.querySelector("#audio");

    const checkSubscription = async () => {
      // Check offline validity - use new offlineValidUntil if available, fallback to legacy check
      const storedOfflineValidUntil = Number(localStorage.offlineValidUntil);
      const expiresOn = Number(localStorage.expiresOn);
      const lastOnline = Number(localStorage.lastOnline);
      const now = Date.now();
      const hasExpiresOn = Number.isFinite(expiresOn);
      const hasLastOnline = Number.isFinite(lastOnline);
      const hasStoredOfflineValidUntil = Number.isFinite(storedOfflineValidUntil);

      // Prefer offlineValidUntil (set when user was last online)
      // Fallback to legacy lastOnline + 3 months check
      // If both are missing (e.g. cleared storage), treat as valid until sync occurs
      const offlineValidUntil = hasStoredOfflineValidUntil
        ? storedOfflineValidUntil
        : hasExpiresOn && hasLastOnline
          ? Math.min(expiresOn, lastOnline + THREE_MONTHS_MS)
          : hasExpiresOn
            ? expiresOn
            : null;
      
      let isOfflineTooLong = offlineValidUntil ? offlineValidUntil < now : false;

      // If it looks like it expired locally, try to sync one more time if online
      if (isOfflineTooLong && navigator.onLine) {
        setVerifyingSession(true);
        try {
          const freshData = await syncUserData();
          setVerifyingSession(false);
          const freshOfflineValidUntil = Number(localStorage.offlineValidUntil);
          isOfflineTooLong = freshOfflineValidUntil ? freshOfflineValidUntil < now : false;
          if (freshData) console.log("Session verified");
        } catch (e) {
          console.error("Failed to verify session online", e);
          setVerifyingSession(false);
        }
      }

      if (isOfflineTooLong) {
        const subscriptionExpired = hasExpiresOn && expiresOn < now;
        const message = subscriptionExpired
          ? "Your subscription has expired. Please pay for a new subscription"
          : "Your offline access period has expired. Please go online to continue using the app.";
        const severity = subscriptionExpired ? "error" : "warning";
        const destination = subscriptionExpired ? "/pay" : "/login";
        showToast(message, severity);
        setTimeout(() => {
          removeServiceWorkers();
          navigate(destination);
        }, 3000);
        return;
      }
    };

    checkSubscription();

    const audio = audioTagRef.current;
    if (audio) {
      const handleEnded = () => setPlaying(false);
      audio.addEventListener('ended', handleEnded);
      return () => audio.removeEventListener('ended', handleEnded);
    }
  }, [navigate]);

  const play = useCallback((url) => {
    if (audioTagRef.current) {
      audioTagRef.current.src = url;
      audioTagRef.current.play();
      setPlaying(url);
    }
  }, []);

  const stop = useCallback(() => {
    if (audioTagRef.current) {
      audioTagRef.current.pause();
      setPlaying(false);
    }
  }, []);

  const pagesRef = useRef(0);
  // The page the PDF viewer last drew. react-pdf-js has no page-drawn
  // callback, but it sets the canvas's height as it starts drawing a page.
  const [shownPage, setShownPage] = useState(0);
  const wrapperRef = useRef(null);
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || typeof MutationObserver !== "function") return;
    const observer = new MutationObserver((records) => {
      if (records.some((record) => record.target instanceof Element && record.target.matches(PDF_CANVAS))) setShownPage(page);
    });
    observer.observe(wrapper, { subtree: true, attributes: true, attributeFilter: ["height"] });
    return () => observer.disconnect();
  }, [page]);

  useEffect(() => {
    if (searchParams.get("page") === String(page)) return;
    const next = new URLSearchParams(searchParams);
    next.set("page", String(page));
    // Replace, so turning pages doesn't fill the back history; keep the header state.
    setSearchParams(next, { replace: true, state: { ...navState, entryPoint } });
  }, [page, searchParams, setSearchParams, navState, entryPoint]);
  const onDocumentComplete = useCallback((p) => {
    // react-pdf-js reports 0 pages once before the document has loaded.
    if (!(p > 0)) return;
    pagesRef.current = p;
    setPages(p);
    // A ?page= past the end of this PDF falls back to its last page.
    setPage((prev) => Math.min(prev, p));
  }, []);
  
  const handlePrevious = useCallback(() => {
    setPage((prev) => (prev > initialPage ? prev - 1 : prev));
  }, [initialPage]);

  const handleNext = useCallback(() => {
    setPage((prev) => (prev < pages ? prev + 1 : prev));
  }, [pages]);

  const name = bhajans && bhajans[id] && bhajans[id].n;
  const isSheetMusic = locationParam.includes(".pdf");

  // One view event per bhajan opened (page turns don't remount this page).
  useEffect(() => {
    if (!name) return;
    if (isSheetMusic) {
      track("view_sheet_music", { bhajan_name: name, music_key: parseSheetMusicName(locationParam)?.key });
    } else {
      track("view_lyrics", {
        bhajan_name: name,
        book: locationParam.split("-")[0],
        page_number: initialPage,
        language: bhajans[id]?.lg,
        deity: bhajans[id]?.d,
      });
    }
  }, [name, isSheetMusic, locationParam, initialPage, bhajans, id]);

  // Keep "recently opened" pointing at the page being read, for resuming later.
  useEffect(() => {
    if (name && !isSheetMusic) rememberOpened({ name, location: locationParam, page });
  }, [name, isSheetMusic, locationParam, page]);
  const cdbabyBuyUrls = bhajans && bhajans[id] && bhajans[id].cu;
  const cdbabySampleUrls = bhajans && bhajans[id] && bhajans[id].cs;
  
  let book, url, scale = 3;
  if (!locationParam.includes(".pdf")) {
    [book] = locationParam.split("-");
    url = `/pdfs/${book}.pdf`;
  } else {
    url = `https://singwithamma.s3.amazonaws.com/sheetmusic/${locationParam}`;
    scale = 2;
  }

  const pagination = pages ? (
    <span>
      <span className='pdf-prev-arrow arrow' />
      <span className='pdf-next-arrow arrow' />
      <span className='pdf-previous' onClick={handlePrevious} />
      <span className='pdf-next' onClick={handleNext} />
    </span>
  ) : null;

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (event.key === "ArrowLeft") handlePrevious();
      else if (event.key === "ArrowRight") handleNext();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handlePrevious, handleNext]);

  // Handle window resize to switch between embed and InvertiblePDF
  const [{ width, height }, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  useEffect(() => {
    const handleResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const goBack = useGoBack();
  const viewerPrefs = useViewerPrefs();
  const { setHeaderHidden: saveHeaderHidden, sheetKeys, rememberSheetKey } = viewerPrefs;
  // The top bar stays as the reader last left it, on this song and the next.
  // A key change passes it along too, so it holds even before prefs are read.
  const [headerHidden, setHeaderHidden] = useState(() => Boolean(navState?.headerHidden ?? viewerPrefs.headerHidden));

  // Open at the line where the song starts; every page turn after that starts
  // at the top of the new page instead of wherever the last one was scrolled.
  const scrolledPageRef = useRef(0);
  const isLyrics = !locationParam.includes(".pdf");
  // The index arrives after the viewer mounts, so wait for it before the first scroll.
  const indexLoaded = Boolean(bhajans && Object.keys(bhajans).length);
  // Where the song starts on its first page, as a fraction of the page height
  // (see create-index/song-starts.py). Missing means the top.
  const startFraction = (isLyrics && bhajans?.[id]?.lo?.[locationParam]) || 0;
  useEffect(() => {
    if (!shownPage || shownPage === scrolledPageRef.current) return;
    const opening = scrolledPageRef.current === 0 && shownPage === initialPage;
    if (opening && isLyrics && !indexLoaded) return;
    scrolledPageRef.current = shownPage;
    const fraction = opening ? startFraction : 0;
    scrollToPageFraction(wrapperRef.current, fraction, headerHidden ? 0 : HEADER_HEIGHT);
  }, [shownPage, initialPage, isLyrics, indexLoaded, startFraction, headerHidden]);
  const [headerToggled, setHeaderToggled] = useState(false);
  // Phones hide the bar after a moment, unless the reader has chosen for themselves.
  const shouldAutoHide = isPhoneSized(width, height) && !headerToggled && viewerPrefs.headerHidden === undefined;

  useEffect(() => {
    if (!shouldAutoHide) return;
    const timer = setTimeout(() => setHeaderHidden(true), HEADER_AUTO_HIDE_MS);
    return () => clearTimeout(timer);
  }, [shouldAutoHide]);

  const currentSheet = parseSheetMusicName(locationParam);
  const keyChoices = currentSheet
    ? groupSheetMusic(bhajans?.[id]?.sm).groups.find((group) => group.song === currentSheet.song)?.keys ?? []
    : [];
  const [keysOpen, setKeysOpen] = useState(false);
  const lowerKey = currentSheet ? stepKey(keyChoices, locationParam, -1) : null;
  const higherKey = currentSheet ? stepKey(keyChoices, locationParam, 1) : null;

  // Reopening this song from search opens the key the reader was last using.
  const currentSong = currentSheet?.song;
  const currentKey = currentSheet?.key;
  useEffect(() => {
    if (currentSong && currentKey && rememberedSheetKey(sheetKeys, currentSong) !== currentKey) {
      rememberSheetKey(currentSong, currentKey);
    }
  }, [currentSong, currentKey, sheetKeys, rememberSheetKey]);

  // Musician mode marks the PDF in the key the recording is sung in. PDFs are named by the
  // arranger's key root, which is not always Sa (hindolam is often written as a minor key whose
  // fifth is Sa), so prefer the data's pdf_pc and fall back to Sa.
  const songMusic = useSongMusic(name);
  const { music } = useMusicianMode();
  const myKey = useMyKey();
  const sh = songMusic?.sh;
  const recordingPc = Number.isInteger(sh?.pdf_pc) ? sh.pdf_pc : Number.isInteger(sh?.pc) ? sh.pc : null;
  const [musicOpen, setMusicOpen] = useState(false);
  useEffect(() => {
    if (!musicOpen) return;
    const closeOnEscape = (event) => event.key === "Escape" && setMusicOpen(false);
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [musicOpen]);
  useEffect(() => {
    if (!keysOpen) return;
    const closeOnEscape = (event) => event.key === "Escape" && setKeysOpen(false);
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [keysOpen]);

  const changeKey = (file) => {
    setKeysOpen(false);
    if (file === locationParam) return;
    // Replace, so the back button still returns to search after changing keys.
    navigate(`/pdf/${encodeURIComponent(file)}/${id}/${encodeURIComponent(nameParam)}`, {
      replace: true,
      state: { headerHidden, entryPoint },
    });
  };

  // "-" and "=" / "+" step the key down or up on a keyboard.
  useEffect(() => {
    if (!lowerKey && !higherKey) return;
    const onKeyDown = (event) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      const next = event.key === "-" ? lowerKey : event.key === "=" || event.key === "+" ? higherKey : null;
      if (!next) return;
      event.preventDefault();
      changeKey(next.file);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const toggleHeader = () => {
    const hidden = !headerHidden;
    setHeaderToggled(true);
    setHeaderHidden(hidden);
    saveHeaderHidden(hidden);
  };

  return (
    <>
      <div className={headerHidden ? "App header-hidden" : "App"}>
        <Header 
          back 
          title={name}
          rightContent={
            <>
              {cdbabyBuyUrls && (
                <a
                  className='button button-circle'
                  href={`https://www.amazon.com/s?k=${encodeURIComponent(name)} amma`}
                  target='_blank'
                  rel='noopener noreferrer'
                  aria-label='Buy on Amazon'>
                  <span role='img' aria-label='cd'>
                    <Icon name='cart' />
                  </span>
                </a>
              )}
              {cdbabySampleUrls && (
                <button
                  aria-label='play sample'
                  className='button button-circle'
                  onClick={() => {
                    if (playing === cdbabySampleUrls[0]) return stop();
                    track("play_sample", { bhajan_name: name });
                    play(cdbabySampleUrls[0]);
                  }}>
                  <span role='img' aria-label='music sample'>
                    <Icon name={playing === cdbabySampleUrls[0] ? "stop" : "play"} />
                  </span>
                </button>
              )}
              {renderFavorite(name, "button button-circle", "button button-circle")}
            </>
          }
        />
        {headerHidden && (
          <button type='button' aria-label='Go back' className='viewer-back' onClick={goBack}>
            <Icon name='arrow-left' />
          </button>
        )}
        {keyChoices.length > 1 && (
          <>
            <div className='viewer-keybar' role='group' aria-label='Key'>
              <button
                type='button'
                className='viewer-key-step'
                aria-label='Lower key'
                title={lowerKey ? `Lower key: ${lowerKey.key} (-)` : 'Lowest key'}
                disabled={!lowerKey}
                onClick={() => lowerKey && changeKey(lowerKey.file)}>
                <span aria-hidden='true'>−</span>
              </button>
              <button
                type='button'
                className='viewer-key'
                aria-label={`Change key, now ${currentSheet.key}`}
                aria-expanded={keysOpen}
                aria-controls='viewer-key-menu'
                onClick={() => setKeysOpen((open) => !open)}>
                <Icon name='music' />
                <span>{currentSheet.key}</span>
              </button>
              <button
                type='button'
                className='viewer-key-step'
                aria-label='Higher key'
                title={higherKey ? `Higher key: ${higherKey.key} (+)` : 'Highest key'}
                disabled={!higherKey}
                onClick={() => higherKey && changeKey(higherKey.file)}>
                <span aria-hidden='true'>+</span>
              </button>
            </div>
            {keysOpen && (
              <>
                <div className='viewer-key-backdrop' onClick={() => setKeysOpen(false)} />
                <div id='viewer-key-menu' className='viewer-key-menu' role='menu' aria-label='Keys'>
                  {keyChoices.map(({ file, key, pitch }) => {
                    const recording = pitch === recordingPc;
                    return (
                      <button
                        key={file}
                        type='button'
                        role='menuitemradio'
                        aria-checked={file === locationParam}
                        aria-label={recording ? `${key} · recording` : undefined}
                        title={recording ? "The key the recording is sung in" : undefined}
                        className={[file === locationParam && "current", recording && "recording"].filter(Boolean).join(" ") || undefined}
                        onClick={() => changeKey(file)}>
                        {key}
                      </button>
                    );
                  })}
                  {recordingPc !== null && keyChoices.some((k) => k.pitch === recordingPc) && (
                    <p className='viewer-key-legend'>
                      <span className='viewer-key-dot' aria-hidden='true' /> recording
                    </p>
                  )}
                </div>
              </>
            )}
          </>
        )}
        {songMusic && (
          <>
            <button
              type='button'
              className='viewer-music'
              aria-label='For musicians: key, raga and taal'
              aria-expanded={musicOpen}
              aria-haspopup='dialog'
              onClick={() => setMusicOpen(true)}>
              <Icon name='music-note' />
              <span>{musicPillText(songMusic, music, myKey)}</span>
            </button>
            {musicOpen && (
              <div className='modal-window open viewer-music-dialog' onClick={() => setMusicOpen(false)} role='dialog' aria-modal='true' aria-label={`For musicians: ${name}`}>
                <div className='modal-panel' onClick={(e) => e.stopPropagation()}>
                  <div className='modal-head'>
                    <h1 className='modal-title'>{name}</h1>
                    <button
                      type='button'
                      className='button button-circle modal-close'
                      autoFocus
                      title='Close'
                      aria-label='close musician details'
                      onClick={() => setMusicOpen(false)}>
                      <Icon name='close' />
                    </button>
                  </div>
                  <div className='modal-body'>
                    <SongMusicSection name={name} />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <button
          type='button'
          aria-label={headerHidden ? 'Show top bar' : 'Hide top bar'}
          aria-expanded={!headerHidden}
          className='viewer-header-toggle'
          onClick={toggleHeader}>
          <Icon name={headerHidden ? 'chevron-down' : 'chevron-up'} />
        </button>
        <div className='rest'>
          {localStorage.presenter && width > 1200 ? (
            <InvertibleEmbed
              src={`${url}#page=${page}`}
              style={{ width: "100vw", height: headerHidden ? "100vh" : "calc( 100vh - 64px )" }}
            />
          ) : (
            <div className='pdf-center-wrapper' ref={wrapperRef}>
              {(pages === 0 || verifyingSession) && <Loader />}
              <InvertiblePdfComponent
                file={url.replace(/sharp/i, "%23")}
                onDocumentComplete={onDocumentComplete}
                page={page}
                scale={scale}
                style={{
                  maxWidth: "100vw",
                  display: "block",
                  margin: "0 auto",
                }}
              />
              {pages === 0 && <Loader />}
              {pagination}
            </div>
          )}
        </div>
      </div>
      <Snackbar 
        open={toast.open} 
        autoHideDuration={6000} 
        onClose={handleCloseToast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {/* @ts-ignore */}
        <Alert onClose={handleCloseToast} severity={toast.severity} variant="filled" sx={{ width: '100%', borderRadius: 3 }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default memo(RenderPage);
