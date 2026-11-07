// @ts-nocheck
// Analytics goes through Google Tag Manager (container GTM-KF3RQXP). The app
// only pushes named events and user state to window.dataLayer; GTM decides
// which tags fire (today the GA4 property "Amma bhajan searcher - GA4",
// G-X9L5Q47RLJ). Page views, including in-app route changes, come from the
// GA4 stream's enhanced measurement, so the app sends none itself.
//
// Events pushed (all lowercase snake_case, GA4 naming):
//   user_state        { login_status, subscription_status, user_id }
//   search            { search_term }
//   filter_bhajans    { filter_type: "deity" | "language", filter_value }
//   view_lyrics       { bhajan_name, book, page_number, language, deity }
//   view_sheet_music  { bhajan_name, music_key }
//   play_sample       { bhajan_name }
//   add_to_favorites / remove_from_favorites { bhajan_name }
//   resume_reading    { bhajan_name }
//   open_bhajan_of_the_day { bhajan_name }
//   login             { method: "magic_link" | "password" }
//   logout            {}
//   begin_checkout    { plan, value, currency, items }
//   report_problem / report_problem_submitted {}
//   notification_prompt { result: "granted" | "denied" | "dismissed" }
//   toggle_musician_mode { musician_mode: "on" | "off" }
//   app_installed     {}
// purchase is sent server-side by the Shopify webhook (Measurement Protocol).

export const GTM_ID = "GTM-KF3RQXP";
export const GA_MEASUREMENT_ID = "G-X9L5Q47RLJ";

const dataLayer = () => (window.dataLayer = window.dataLayer || []);

/** Records a named event with its parameters. Safe to call before GTM loads. */
export function track(event, params = {}) {
  dataLayer().push({ event, ...params });
}

const DAY_MS = 86400000;

/** Describes the visitor for GA4 user properties: signed in or out, and subscription state. */
export function userState({ uid, expiresOn, now = Date.now() } = {}) {
  const expires = Number(expiresOn);
  let subscription = "none";
  if (uid && Number.isFinite(expires) && expires > 0) {
    if (expires <= now) subscription = "expired";
    else if (expires - now <= 14 * DAY_MS) subscription = "expiring_soon";
    else subscription = "active";
  }
  return {
    login_status: uid ? "signed_in" : "signed_out",
    subscription_status: subscription,
    // GTM maps this to GA4 user_id; undefined clears it after sign-out.
    user_id: uid || undefined,
  };
}

let lastUserState = "";
/** Pushes user_state when it changes, so GA4 can split signed-in and signed-out visitors. */
export function setUserState(details) {
  const state = userState(details);
  const key = JSON.stringify(state);
  if (key === lastUserState) return;
  lastUserState = key;
  track("user_state", state);
}

/** Loads the Tag Manager container once. */
export function loadTagManager() {
  if (document.getElementById("gtm-script")) return;
  dataLayer().push({ "gtm.start": Date.now(), event: "gtm.js" });
  const script = document.createElement("script");
  script.id = "gtm-script";
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
  document.head.appendChild(script);
}

/**
 * Runs `callback` once Tag Manager has loaded and processed the queue
 * (GTM calls eventCallback after the event's tags have fired).
 */
export function onAnalyticsReady(callback) {
  track("analytics_ready_check", { eventCallback: () => callback() });
}

/** GA4 client id from the _ga cookie ("GA1.1.<id>.<timestamp>"), or null. */
export function gaClientId(cookie = document.cookie) {
  const match = cookie.match(/(?:^|;\s*)_ga=GA\d+\.\d+\.(\d+\.\d+)/);
  return match ? match[1] : null;
}
