// @ts-nocheck
// Opt-in web push. Tokens are stored under messages/{uid}/tokens/{token}
// (the same place the server already reads), and the app's own service
// worker shows the notifications (public/push-handler.js).
import { getMessaging, getToken, deleteToken, isSupported } from "firebase/messaging";
import { firebaseApp, setRefOnce, removeRefOnce } from "./firebase";
import { track } from "./analytics";

const DISMISSED_KEY = "notificationPromptDismissedAt";
// Which account this browser's push token belongs to.
const OWNER_KEY = "pushTokenOwner";
const ASK_AGAIN_AFTER_MS = 30 * 86400000;
export const MIN_BHAJANS_BEFORE_ASKING = 3;

/** True when this browser can receive web push from this app. */
export const pushSupported = async () => {
  if (!import.meta.env.PROD) return false;
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return false;
  try {
    return await isSupported();
  } catch {
    return false;
  }
};

/** Ask only signed-in people who have opened a few bhajans and haven't said "not now" lately. */
export const shouldOfferNotifications = ({
  uid,
  bhajansOpened,
  permission = typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  dismissedAt = Number(localStorage.getItem(DISMISSED_KEY)) || 0,
  now = Date.now(),
}) =>
  Boolean(uid) &&
  permission === "default" &&
  bhajansOpened >= MIN_BHAJANS_BEFORE_ASKING &&
  now - dismissedAt > ASK_AGAIN_AFTER_MS;

/** Gets this browser's push token and stores it for the signed-in user. */
export const saveNotificationToken = async (uid) => {
  const registration = await navigator.serviceWorker.ready;
  const token = await getToken(getMessaging(firebaseApp), { serviceWorkerRegistration: registration });
  if (token) {
    await setRefOnce(`messages/${uid}/tokens/${token}`, Date.now());
    localStorage.setItem(OWNER_KEY, uid);
  }
  return token;
};

/**
 * Unlinks this browser from an account's notifications: removes the stored
 * token and invalidates it with FCM, so nothing meant for that account
 * (admin payment alerts, reminders) reaches the next person on this browser.
 */
export const detachNotificationToken = async (uid) => {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  if (!(await pushSupported())) return;
  try {
    const messaging = getMessaging(firebaseApp);
    const registration = await navigator.serviceWorker.ready;
    const token = await getToken(messaging, { serviceWorkerRegistration: registration });
    if (uid && token) await removeRefOnce(`messages/${uid}/tokens/${token}`);
    await deleteToken(messaging);
  } catch (error) {
    console.warn("Could not unlink push notifications:", error);
  } finally {
    localStorage.removeItem(OWNER_KEY);
  }
};

/** Shows the browser's permission prompt; stores the token when granted. */
export const enableNotifications = async (uid) => {
  const permission = await Notification.requestPermission();
  const result = permission === "granted" ? "granted" : permission === "denied" ? "denied" : "dismissed";
  track("notification_prompt", { result });
  if (result !== "granted") {
    if (result === "dismissed") localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    return false;
  }
  await saveNotificationToken(uid);
  return true;
};

export const dismissNotificationPrompt = () => {
  localStorage.setItem(DISMISSED_KEY, String(Date.now()));
  track("notification_prompt", { result: "dismissed" });
};

/** Keeps the stored token fresh for people who already said yes. */
export const refreshNotificationToken = async (uid) => {
  if (!uid || typeof Notification === "undefined" || Notification.permission !== "granted") return;
  if (!(await pushSupported())) return;
  // Another account signed in on this browser without signing out first:
  // invalidate its token (we can't edit that account's records) before
  // registering a fresh one for this account.
  const previousOwner = localStorage.getItem(OWNER_KEY);
  if (previousOwner && previousOwner !== uid) {
    await deleteToken(getMessaging(firebaseApp)).catch((error) => console.warn("Push token reset failed:", error));
    localStorage.removeItem(OWNER_KEY);
  }
  await saveNotificationToken(uid).catch((error) => console.warn("Push token refresh failed:", error));
};
