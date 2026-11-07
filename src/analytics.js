// @ts-nocheck
// Google Analytics 4 ("Amma bhajan searcher - GA4", web stream for
// sing.withamma.com). Page views, including in-app route changes, are
// recorded by the stream's enhanced measurement, so the app sends none itself.
export const GA_MEASUREMENT_ID = "G-X9L5Q47RLJ";

export function loadGoogleAnalytics() {
  if (window.gtag) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // gtag.js reads the arguments object itself, so it must be pushed as-is.
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", GA_MEASUREMENT_ID, localStorage.uid ? { user_id: localStorage.uid } : {});
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);
}

/** Runs `callback` once gtag.js has loaded and processed the config. */
export function onAnalyticsReady(callback) {
  window.gtag("get", GA_MEASUREMENT_ID, "client_id", () => callback());
}
