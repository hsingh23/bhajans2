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
import { groupSheetMusic, parseSheetMusicName } from "./sheetMusicGroups";

const InvertiblePdfComponent = memo(InvertiblePDF);
const HEADER_AUTO_HIDE_MS = 3000;
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
  const onPageComplete = useCallback((p) => setPage(pagesRef.current && p > pagesRef.current ? pagesRef.current : p), []);

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
  // A key change remounts the page; keep the top bar as the reader left it.
  const [headerHidden, setHeaderHidden] = useState(Boolean(navState?.headerHidden));
  const [headerToggled, setHeaderToggled] = useState(false);
  const shouldAutoHide = isPhoneSized(width, height) && !headerToggled;

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

  const toggleHeader = () => {
    setHeaderToggled(true);
    setHeaderHidden((hidden) => !hidden);
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
                  onClick={() => (playing === cdbabySampleUrls[0] ? stop() : play(cdbabySampleUrls[0]))}>
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
            {keysOpen && (
              <>
                <div className='viewer-key-backdrop' onClick={() => setKeysOpen(false)} />
                <div id='viewer-key-menu' className='viewer-key-menu' role='menu' aria-label='Keys'>
                  {keyChoices.map(({ file, key }) => (
                    <button
                      key={file}
                      type='button'
                      role='menuitemradio'
                      aria-checked={file === locationParam}
                      className={file === locationParam ? "current" : undefined}
                      onClick={() => changeKey(file)}>
                      {key}
                    </button>
                  ))}
                </div>
              </>
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
            <div className='pdf-center-wrapper'>
              {(pages === 0 || verifyingSession) && <Loader />}
              <InvertiblePdfComponent
                file={url.replace(/sharp/i, "%23")}
                onDocumentComplete={onDocumentComplete}
                onPageComplete={onPageComplete}
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
