// @ts-nocheck
// Firebase (auth, database) is about 75 KB and isn't needed to show the bhajan
// list, so it loads on demand: right away on pages that need sign-in, and
// once the browser is idle everywhere else.
let firebasePromise;

export const loadFirebase = () => (firebasePromise ||= import("./firebase"));

/** Loads Firebase once the page has settled (or after `timeout` ms at most). */
export const loadFirebaseWhenIdle = (timeout = 3000) =>
  new Promise((resolve) => {
    const start = () => resolve(loadFirebase());
    if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(start, { timeout });
    else setTimeout(start, 1);
  });
