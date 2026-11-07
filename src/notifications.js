// @ts-nocheck
// Opt-in web push. Tokens are stored under messages/{uid}/tokens/{token}
// (the same place the server already reads), and the app's own service
// worker shows the notifications (public/push-handler.js).
import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { firebaseApp, setRefOnce } from "./firebase";
import { track } from "./analytics";

const DISMISSED_KEY = "notificationPromptDismissedAt";
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
  if (token) await setRefOnce(`messages/${uid}/tokens/${token}`, Date.now());
  return token;
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
  await saveNotificationToken(uid).catch((error) => console.warn("Push token refresh failed:", error));
};
