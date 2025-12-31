import React, { useState, useEffect, useCallback, useRef, memo } from "react";
import { HotKeys } from "react-hotkeys";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { 
  Snackbar, 
  Alert 
} from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";
import InvertiblePDF from "./InvertiblePDF";
import InvertibleEmbed from "./InvertibleEmbed";
import Header from "./Header";
import Loader from "./Loader";

const THREE_MONTHS_MS = 7776000000;
const InvertiblePdfComponent = memo(InvertiblePDF);
const keyMap = {
  left: "left",
  right: "right",
};

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

const RenderPage = ({ bhajans = {}, renderFavorite }) => {
  const { id, location: locationParam } = useParams();
  const navigate = useNavigate();
  const [toast, setToast] = useState({ open: false, message: "", severity: "info" });

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

  const [page, setPage] = useState(initialPageVal);
  const [initialPage] = useState(initialPageVal);
  const [pages, setPages] = useState(0);
  
  const audioTagRef = useRef(null);
  
  const [playing, setPlaying] = useState(() => {
    const audio = document.querySelector("#audio");
    return audio instanceof HTMLAudioElement && !audio.paused ? decodeURIComponent(audio.src) : false;
  });

  useEffect(() => {
    audioTagRef.current = document.querySelector("#audio");

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
    const isOfflineTooLong = offlineValidUntil ? offlineValidUntil < now : false;

    if (isOfflineTooLong) {
      const subscriptionExpired = hasExpiresOn && expiresOn < now;
      const message = subscriptionExpired
        ? "Your subscription has expired. Please pay for a new subscription"
        : "Your offline access period has expired. Please go online to continue using the app.";
      const severity = subscriptionExpired ? "error" : "warning";
      const destination = subscriptionExpired ? "/pay" : "/login";
      setTimeout(() => showToast(message, severity), 0);
      setTimeout(() => {
        removeServiceWorkers();
        navigate(destination);
      }, 3000);
      return;
    }

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

  const onPageComplete = useCallback((p) => setPage(p), []);
  const onDocumentComplete = useCallback((p) => setPages(p), []);
  
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

  const handlers = { left: handlePrevious, right: handleNext };

  // Handle window resize to switch between embed and InvertiblePDF
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <HotKeys keyMap={keyMap} handlers={handlers}>
      <div className='App'>
        <Header 
          back 
          title={name}
          rightContent={
            <>
              {cdbabyBuyUrls && (
                <a
                  className='button button-3d button-circle button-action'
                  href={`https://www.amazon.com/s?k=${encodeURIComponent(name)} amma`}
                  target='_blank'
                  rel='noopener noreferrer'
                  aria-label='Buy on Amazon'>
                  <span role='img' aria-label='cd'>
                    <FontAwesomeIcon icon='cart-arrow-down' />
                  </span>
                </a>
              )}
              {cdbabySampleUrls && (
                <button
                  aria-label='play sample'
                  className='button button-3d button-circle button-action'
                  onClick={() => (playing === cdbabySampleUrls[0] ? stop() : play(cdbabySampleUrls[0]))}>
                  <span role='img' aria-label='music sample'>
                    <FontAwesomeIcon icon={playing === cdbabySampleUrls[0] ? "stop" : "play"} />
                  </span>
                </button>
              )}
              {renderFavorite(
                name,
                "button button-3d button-caution button-circle",
                "button button-3d button-circle"
              )}
            </>
          }
        />
        <div className='rest'>
          {localStorage.presenter && width > 1200 ? (
            <InvertibleEmbed
              src={`${url}#page=${page}`}
              style={{ width: "100vw", height: "calc( 100vh - 56px )" }}
            />
          ) : (
            <div className='pdf-center-wrapper'>
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
    </HotKeys>
  );
};

export default memo(RenderPage);
