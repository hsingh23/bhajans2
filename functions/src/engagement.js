// Engagement: renewal reminders (push + email), admin announcements (push),
// and GA4 purchase events for Shopify orders (Measurement Protocol).
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const { getAuth } = require("firebase-admin/auth");
const { getDatabase } = require("firebase-admin/database");
const { getMessaging } = require("firebase-admin/messaging");
const crypto = require("node:crypto");
const { renewalReminderEmail } = require("./mail");

const DAY = 86400000;
const APP_ORIGIN = "https://sing.withamma.com";
const GA_MEASUREMENT_ID = "G-X9L5Q47RLJ";
const mailjetAuth = defineSecret("MAILJET_AUTH_HEADER");
const ga4ApiSecret = defineSecret("GA4_API_SECRET");
const options = {
  region: "us-central1",
  maxInstances: 5,
  serviceAccount: "bhajans-588f5@appspot.gserviceaccount.com",
};

// ---------------------------------------------------------------- pushes

const INVALID_TOKEN = new Set([
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
]);

/**
 * Sends one notification to many tokens; removes tokens FCM says are dead.
 * `delivered` lists tokens that got it; `retryable` lists tokens that failed
 * for another reason (e.g. FCM temporarily unavailable) and can be retried.
 */
async function pushToTokens(tokenOwners, { title, body, link }) {
  const root = getDatabase().ref();
  const tokens = [...tokenOwners.keys()];
  let sent = 0;
  let removed = 0;
  const delivered = [];
  const retryable = [];
  for (let offset = 0; offset < tokens.length; offset += 500) {
    const batch = tokens.slice(offset, offset + 500);
    const response = await getMessaging().sendEachForMulticast({
      tokens: batch,
      notification: { title, body },
      webpush: { fcmOptions: { link: new URL(link || "/", APP_ORIGIN).href } },
    });
    sent += response.successCount;
    await Promise.all(
      response.responses.map((result, index) => {
        const token = batch[index];
        if (result.success) {
          delivered.push(token);
          return null;
        }
        if (!INVALID_TOKEN.has(result.error?.code)) {
          retryable.push(token);
          return null;
        }
        removed += 1;
        return root.child(`messages/${tokenOwners.get(token)}/tokens/${token}`).remove();
      }),
    );
  }
  return { sent, failed: tokens.length - sent, removed, delivered, retryable };
}

async function tokensFor(uids) {
  const root = getDatabase().ref();
  const owners = new Map();
  await Promise.all(
    uids.map(async (uid) => {
      const snapshot = await root.child(`messages/${uid}/tokens`).get();
      for (const token of Object.keys(snapshot.val() || {})) owners.set(token, uid);
    }),
  );
  return owners;
}

// ------------------------------------------------------- renewal reminders

/**
 * "7d" when 6–7 days are left, "1d" when under a day is left, else null.
 * The job runs every 6 hours, so each window is checked about four times:
 * the claim below sends once, and a failed send is retried on a later run
 * while the subscription is still in the window.
 */
function reminderDue(expiresOn, now) {
  const left = Number(expiresOn) - now;
  if (!Number.isFinite(left)) return null;
  if (left > 6 * DAY && left <= 7 * DAY) return "7d";
  if (left > 0 && left <= DAY) return "1d";
  return null;
}

const longDate = (ms) =>
  new Date(ms).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

/** Runs every 6 hours; each subscription gets at most one reminder per window. */
exports.sendRenewalReminders = onSchedule(
  {
    ...options,
    schedule: "every 6 hours",
    timeZone: "UTC",
    secrets: [mailjetAuth],
  },
  async () => {
    const now = Date.now();
    const db = getDatabase();
    const due = (
      await db
        .ref("paid")
        .orderByChild("expiresOn")
        .startAt(now)
        .endAt(now + 7 * DAY)
        .get()
    ).val() || {};
    let emails = 0;
    let pushes = 0;
    let failures = 0;
    for (const [uid, record] of Object.entries(due)) {
      const kind = reminderDue(record?.expiresOn, now);
      if (!kind) continue;
      // Email and push are tracked apart, so retrying one never repeats the other:
      //   .../email           claimed once; released if sending fails
      //   .../pushed/{token}  each device that received the push
      const base = `messages/${uid}/reminders/${record.expiresOn}_${kind}`;
      const daysLeft = kind === "7d" ? 7 : 1;
      const validUntil = longDate(Number(record.expiresOn));

      const emailClaim = await db.ref(`${base}/email`).transaction((current) => (current ? undefined : now));
      if (emailClaim.committed) {
        try {
          const user = await getAuth().getUser(uid);
          if (user.email) {
            await renewalReminderEmail({
              email: user.email,
              name: user.displayName,
              daysLeft,
              validUntil,
              apiKey: mailjetAuth.value(),
            });
            emails += 1;
          }
        } catch (error) {
          // The next run (6 hours later, still inside the window) tries again.
          failures += 1;
          await db.ref(`${base}/email`).remove();
          logger.error("renewal reminder email failed", { uid, kind, code: error?.code, message: error?.message });
        }
      }

      try {
        const already = (await db.ref(`${base}/pushed`).get()).val() || {};
        const owners = await tokensFor([uid]);
        for (const token of Object.keys(already)) owners.delete(token);
        if (!owners.size) continue;
        const result = await pushToTokens(owners, {
          title:
            daysLeft === 1
              ? "Your Sing with Amma access ends tomorrow"
              : "A week left on your Sing with Amma access",
          body: `Renew to keep your lyrics and sheet music after ${validUntil}.`,
          link: "/pay",
        });
        pushes += result.sent;
        if (result.delivered.length)
          await db.ref(`${base}/pushed`).update(Object.fromEntries(result.delivered.map((token) => [token, now])));
        if (result.retryable.length) {
          // Undelivered devices are retried on the next run; delivered ones are skipped.
          failures += 1;
          logger.warn("renewal reminder push will be retried", { uid, kind, devices: result.retryable.length });
        }
      } catch (error) {
        failures += 1;
        logger.error("renewal reminder push failed", { uid, kind, code: error?.code, message: error?.message });
      }
    }
    logger.info("renewal reminders sent", { emails, pushes, failures });
    // Mark the run as failed so it shows up in monitoring; claims for the
    // reminders that did go out stay in place, so nothing is sent twice.
    if (failures) throw new Error(`${failures} renewal reminder(s) failed; they will be retried`);
  },
);

// ---------------------------------------------------------- announcements

/** Same-site path, or an https link on sing.withamma.com. */
function safeLink(link) {
  if (!link) return "/";
  if (typeof link !== "string") return null;
  if (/^\/(?!\/)/.test(link)) return link;
  try {
    const url = new URL(link);
    return url.origin === APP_ORIGIN ? url.pathname + url.search : null;
  } catch {
    return null;
  }
}

/** Admins only: pushes a short announcement to everyone who opted in. */
exports.sendAnnouncement = onCall(options, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first");
  const role = (await getDatabase().ref(`admin/${uid}`).get()).val();
  if (role !== "1") throw new HttpsError("permission-denied", "Admins only");
  const title = String(request.data?.title || "").trim();
  const body = String(request.data?.body || "").trim();
  const link = safeLink(request.data?.link);
  if (!title || title.length > 65) throw new HttpsError("invalid-argument", "Title must be 1–65 characters");
  if (!body || body.length > 180) throw new HttpsError("invalid-argument", "Message must be 1–180 characters");
  if (!link) throw new HttpsError("invalid-argument", "Link must be a sing.withamma.com page");
  const messages = (await getDatabase().ref("messages").get()).val() || {};
  const owners = new Map();
  for (const [owner, value] of Object.entries(messages))
    for (const token of Object.keys(value?.tokens || {})) owners.set(token, owner);
  const result = await pushToTokens(owners, { title, body, link });
  logger.info("announcement sent", { by: uid, ...result });
  return result;
});

// ------------------------------------------------------- GA4 purchases

/** GA4 client ids look like "<random>.<seconds>"; derive a stable one from the uid. */
function fallbackClientId(uid) {
  const hex = crypto.createHash("sha256").update(`swa:${uid}`).digest("hex");
  return `${parseInt(hex.slice(0, 8), 16)}.${parseInt(hex.slice(8, 16), 16)}`;
}

const PLAN_YEARS = { 37277000728740: 1, 37277000794276: 5, 37277000827044: 10 };

/** Measurement Protocol body for a Shopify order. */
function ga4PurchasePayload({ clientId, uid, orderId, value, currency, lineItems = [], paidOn }) {
  const items = lineItems
    .filter((item) => PLAN_YEARS[item?.variant_id])
    .map((item) => {
      const years = PLAN_YEARS[item.variant_id];
      return {
        item_id: String(item.variant_id),
        item_name: `Sing with Amma ${years} year${years > 1 ? "s" : ""}`,
        price: Number(item.price) || undefined,
        quantity: Number(item.quantity) || 1,
      };
    });
  return {
    client_id: clientId || fallbackClientId(uid),
    user_id: uid,
    ...(paidOn ? { timestamp_micros: Math.round(paidOn * 1000) } : {}),
    events: [
      {
        name: "purchase",
        params: {
          transaction_id: orderId,
          value: Number(value) || 0,
          currency: currency || "USD",
          items,
          engagement_time_msec: 1,
        },
      },
    ],
  };
}

/** Sends the purchase to GA4. Never throws: analytics must not fail an order. */
async function recordGa4Purchase({ uid, orderId, value, currency, lineItems, paidOn, apiSecret, fetchImpl = fetch }) {
  try {
    if (!apiSecret) return false;
    const clientId = (await getDatabase().ref(`messages/${uid}/gaClientId`).get()).val();
    // GA4 rejects timestamps more than 72 hours old.
    const recent = paidOn && Date.now() - paidOn < 70 * 3600000 ? paidOn : undefined;
    const response = await fetchImpl(
      `https://www.google-analytics.com/mp/collect?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${encodeURIComponent(apiSecret)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ga4PurchasePayload({ clientId, uid, orderId, value, currency, lineItems, paidOn: recent })),
      },
    );
    if (!response.ok) throw new Error(`GA4 responded ${response.status}`);
    return true;
  } catch (error) {
    logger.warn("GA4 purchase not recorded", { orderId, message: error?.message });
    return false;
  }
}

exports.ga4ApiSecret = ga4ApiSecret;
exports.recordGa4Purchase = recordGa4Purchase;
exports.helpers = { reminderDue, safeLink, fallbackClientId, ga4PurchasePayload, pushToTokens };
