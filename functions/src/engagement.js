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

/** Sends one notification to many tokens; removes tokens FCM says are dead. */
async function pushToTokens(tokenOwners, { title, body, link }) {
  const root = getDatabase().ref();
  const tokens = [...tokenOwners.keys()];
  let sent = 0;
  let removed = 0;
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
        if (!INVALID_TOKEN.has(result.error?.code)) return null;
        removed += 1;
        const token = batch[index];
        return root.child(`messages/${tokenOwners.get(token)}/tokens/${token}`).remove();
      }),
    );
  }
  return { sent, failed: tokens.length - sent, removed };
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

/** "7d" when 6–7 days are left, "1d" when under a day is left, else null. */
function reminderDue(expiresOn, now) {
  const left = Number(expiresOn) - now;
  if (!Number.isFinite(left)) return null;
  if (left >= 6 * DAY && left < 7 * DAY) return "7d";
  if (left > 0 && left < DAY) return "1d";
  return null;
}

const longDate = (ms) =>
  new Date(ms).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

/** Runs daily; each subscription gets at most one reminder per window. */
exports.sendRenewalReminders = onSchedule(
  {
    ...options,
    schedule: "every day 15:00",
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
    for (const [uid, record] of Object.entries(due)) {
      const kind = reminderDue(record?.expiresOn, now);
      if (!kind) continue;
      const claim = await db
        .ref(`messages/${uid}/reminders/${record.expiresOn}_${kind}`)
        .transaction((current) => (current ? undefined : now));
      if (!claim.committed) continue;
      const daysLeft = kind === "7d" ? 7 : 1;
      const validUntil = longDate(Number(record.expiresOn));
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
        const result = await pushToTokens(await tokensFor([uid]), {
          title:
            daysLeft === 1
              ? "Your Sing with Amma access ends tomorrow"
              : "A week left on your Sing with Amma access",
          body: `Renew to keep your lyrics and sheet music after ${validUntil}.`,
          link: "/pay",
        });
        pushes += result.sent;
      } catch (error) {
        // Release the claim so tomorrow's run can try again.
        await db.ref(`messages/${uid}/reminders/${record.expiresOn}_${kind}`).remove();
        logger.error("renewal reminder failed", { uid, kind, code: error?.code, message: error?.message });
      }
    }
    logger.info("renewal reminders sent", { emails, pushes });
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
exports.helpers = { reminderDue, safeLink, fallbackClientId, ga4PurchasePayload };
