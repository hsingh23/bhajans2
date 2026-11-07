export {};

declare global {
  /** Lyrics book PDF URLs, injected by vite.config.js. */
  const __LYRICS_PDFS__: { url: string; rev: string }[];

  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
    _urq: any[];
    setGAUid: boolean;
    fetchedBhajans: any[];
    searchableBhajans: string[];
    searchFilter: string;
    searchLanguage: string;
    searchDeity: string;
    scrollTop: number;
    dbHistory: any;
    firebase: any;
    requestServiceWorkerUpdate: () => void;
  }
}
