const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { onValueWritten } = require("firebase-functions/v2/database");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getDatabase } = require("firebase-admin/database");
const { getMessaging } = require("firebase-admin/messaging");
const crypto = require("node:crypto");
const {
  newUserResetPasswordEmail,
  newUserResetPasswordEmailShopify,
  accountActivated,
  sendAuthEmail,
} = require("./mail");
const { ga4ApiSecret, recordGa4Purchase } = require("./engagement");
initializeApp();
const amritabooksSecret = defineSecret("AMRITABOOKS_SECRET");
const shopifySecret = defineSecret("SHOPIFY_SECRET");
const mailjetAuth = defineSecret("MAILJET_AUTH_HEADER");
const options = {
  region: "us-central1",
  maxInstances: 5,
  serviceAccount: "bhajans-588f5@appspot.gserviceaccount.com",
};

function purchaseDate(value) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime())
    ? date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      })
    : "Not recorded";
}

// Header lookup that works with Express requests and plain-object test mocks.
const header = (req, name) => req.get?.(name) ?? req.headers?.[name];

// Copies only the named fields; never the whole address object.
function pick(source, keys) {
  if (!source || typeof source !== "object") return undefined;
  return Object.fromEntries(keys.map((key) => [key, source[key]]));
}

function fullName(first, last) {
  return [first, last].filter(Boolean).join(" ") || undefined;
}

// Order identity for logs. Never include the raw body, HMAC signature or secrets.
function shopifyHeaders(req) {
  return {
    webhookId: header(req, "x-shopify-webhook-id"),
    eventId: header(req, "x-shopify-event-id"),
    topic: header(req, "x-shopify-topic"),
    triggeredAt: header(req, "x-shopify-triggered-at"),
    shop: header(req, "x-shopify-shop-domain"),
  };
}

function shopifySummary(req, body) {
  const rawEmail = body.contact_email || body.email;
  return {
    orderId: body.id,
    orderNumber: body.order_number,
    email:
      typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : undefined,
    customerName:
      body.billing_address?.name ||
      fullName(body.customer?.first_name, body.customer?.last_name),
    billingAddress: pick(body.billing_address, [
      "name",
      "address1",
      "address2",
      "city",
      "province",
      "zip",
      "country",
      "phone",
    ]),
    orderStatusUrl: body.order_status_url,
    financialStatus: body.financial_status,
    processedAt: body.processed_at || body.created_at,
    total: body.total_price,
    currency: body.currency,
    items: (Array.isArray(body.line_items) ? body.line_items : []).map(
      (item) => ({
        variantId: item?.variant_id,
        sku: item?.sku,
        quantity: item?.quantity,
      }),
    ),
    ...shopifyHeaders(req),
  };
}

function wooHeaders(req) {
  return {
    webhookId: header(req, "x-wc-webhook-id"),
    topic: header(req, "x-wc-webhook-topic"),
    source: header(req, "x-wc-webhook-source"),
  };
}

// Order identity for logs. Never include the raw body, signature or secrets.
function wooSummary(req, body) {
  const rawEmail = body.billing?.email;
  return {
    orderId: body.id,
    orderNumber: body.number,
    orderKey: body.order_key,
    email:
      typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : undefined,
    customerName: fullName(body.billing?.first_name, body.billing?.last_name),
    billingAddress: pick(body.billing, [
      "address1",
      "address2",
      "city",
      "state",
      "postcode",
      "country",
      "phone",
    ]),
    status: body.status,
    paidAt: body.date_paid_gmt,
    total: body.total,
    currency: body.currency,
    skus: (Array.isArray(body.line_items) ? body.line_items : []).map(
      (item) => item?.sku,
    ),
    ...wooHeaders(req),
  };
}

exports.amritabooks = onRequest(
  { ...options, invoker: "public", secrets: [amritabooksSecret, mailjetAuth] },
  async (req, res) => {
    if (req.method !== "POST") return res.status(405).send("POST required");
    const signature = req.headers["x-wc-webhook-signature"];
    const expected = crypto
      .createHmac("sha256", amritabooksSecret.value())
      .update(req.rawBody)
      .digest("base64");
    if (
      typeof signature !== "string" ||
      Buffer.byteLength(signature) !== Buffer.byteLength(expected) ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    ) {
      const { webhookId, topic, source } = wooHeaders(req);
      logger.warn("amritabooks webhook rejected", {
        reason: "invalid signature",
        webhookId,
        topic,
        source,
      });
      return res.status(401).send("Invalid signature");
    }
    let body;
    try {
      body = JSON.parse(req.rawBody.toString());
    } catch {
      logger.warn("amritabooks webhook rejected", {
        reason: "invalid JSON",
        ...wooHeaders(req),
      });
      return res.status(400).send("Invalid JSON");
    }
    const { status, billing, order_key, needs_payment, line_items } = body;
    let ignoredReason = null;
    if (status !== "processing") ignoredReason = "not processing";
    else if (needs_payment !== false) ignoredReason = "needs payment";
    else if (!billing?.email) ignoredReason = "no email";
    else if (!line_items?.some((item) => item.sku === "SingWithAmma-1year"))
      ignoredReason = "no recognized sku";
    if (ignoredReason) {
      const { webhookId, topic } = wooHeaders(req);
      logger.info("amritabooks webhook ignored", {
        reason: ignoredReason,
        orderId: body.id,
        orderNumber: body.number,
        status,
        webhookId,
        topic,
      });
      return res.status(200).json({ message: "ignored" });
    }
    if (typeof order_key !== "string" || !order_key) {
      logger.warn("amritabooks webhook rejected", {
        reason: "missing order key",
        ...wooSummary(req, body),
      });
      return res.status(400).send("Missing order key");
    }
    try {
      const email = billing.email.trim().toLowerCase();
      let user;
      let password;
      try {
        user = await getAuth().getUserByEmail(email);
      } catch (error) {
        if (error.code !== "auth/user-not-found") throw error;
        password = crypto.randomBytes(24).toString("base64url");
        try {
          user = await getAuth().createUser({ email, password });
        } catch (createError) {
          if (createError.code !== "auth/email-already-exists")
            throw createError;
          user = await getAuth().getUserByEmail(email);
          password = undefined;
        }
      }
      const now = Date.now();
      const result = await getDatabase()
        .ref(`paid/${user.uid}`)
        .transaction((current) => {
          if (
            current?.orderID === order_key ||
            current?.processedOrders?.[
              crypto.createHash("sha256").update(order_key).digest("hex")
            ]
          )
            return current.welcomeEmailPending ? current : undefined;
          const orderHash = crypto
            .createHash("sha256")
            .update(order_key)
            .digest("hex");
          return {
            ...current,
            expiresOn:
              Math.max(Number(current?.expiresOn) || 0, now) + 31536000000,
            mode: "live",
            manual: false,
            provider: "woocommerce",
            amountScope: "order",
            gross_total_amount: {
              value: body.total ?? null,
              currency: body.currency ?? null,
            },
            line_items: null,
            order_number: null,
            order_status_url: null,
            orderID: order_key,
            paidOn:
              Date.parse(
                body.date_paid_gmt
                  ? `${body.date_paid_gmt.replace(/Z$/, "")}Z`
                  : "",
              ) || now,
            dateBasis: body.date_paid_gmt ? "provider" : "received",
            payer: { payer_id: email },
            processedOrders: { ...current?.processedOrders, [orderHash]: now },
            welcomeEmailPending: !!password || !!current?.welcomeEmailPending,
          };
        });
      if (result.committed && result.snapshot.val().welcomeEmailPending) {
        const resetLink = await getAuth().generatePasswordResetLink(email);
        await newUserResetPasswordEmail({
          email,
          password,
          resetLink,
          validUntil: new Date(
            result.snapshot.val().expiresOn,
          ).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
            timeZone: "UTC",
          }),
          subscriptionName: "1-year subscription · India",
          purchasedOn: purchaseDate(
            body.date_paid_gmt
              ? `${body.date_paid_gmt.replace(/Z$/, "")}Z`
              : null,
          ),
          apiKey: mailjetAuth.value(),
        });
        await getDatabase()
          .ref(`paid/${user.uid}`)
          .child("welcomeEmailPending")
          .set(false);
      }
      const outcome = result.committed ? "done" : "already processed";
      logger.info("amritabooks order activated", {
        ...wooSummary(req, body),
        uid: user.uid,
        expiresOn: result.snapshot?.val()?.expiresOn,
        newAccount: Boolean(password),
        outcome,
      });
      return res.status(200).json({ message: outcome });
    } catch (error) {
      logger.error("amritabooks order processing failed", {
        ...wooSummary(req, body),
        error: error?.message,
        code: error?.code,
        stack: error?.stack,
      });
      return res.status(500).send("Order processing failed; retry required");
    }
  },
);

// Legacy HTTP clients must authenticate; the dashboard uses updateUserAccess.
exports.manuallyAddUser = onRequest(
  { ...options, invoker: "public", cors: true },
  async (req, res) => {
    if (req.method !== "POST") return res.status(405).send("POST required");
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) return res.status(401).send("Authentication required");
    let caller;
    try {
      caller = await getAuth().verifyIdToken(token, true);
    } catch {
      return res.status(401).send("Invalid authentication");
    }
    if ((await getDatabase().ref(`admin/${caller.uid}`).get()).val() !== "1")
      return res.status(403).send("Admin access required");
    let body;
    try {
      body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    } catch {
      return res.status(400).send("Invalid JSON");
    }
    const years = {
      oneIndividual10: 1,
      tenIndividual50: 10,
      fiveIndividual40: 5,
    }[body?.type];
    if (!years || typeof body?.email !== "string")
      return res.status(400).send("Valid plan and email required");
    try {
      const user = await getAuth().getUserByEmail(
        body.email.trim().toLowerCase(),
      );
      const now = Date.now();
      await getDatabase()
        .ref(`paid/${user.uid}`)
        .transaction((current) => {
          const date = new Date(Math.max(Number(current?.expiresOn) || 0, now));
          const month = date.getUTCMonth();
          date.setUTCFullYear(date.getUTCFullYear() + years);
          if (date.getUTCMonth() !== month) date.setUTCDate(0);
          return {
            ...current,
            expiresOn: date.getTime(),
            accessUpdatedOn: now,
            accessUpdatedBy: caller.uid,
          };
        });
      return res.status(200).json({ message: "done" });
    } catch (error) {
      logger.error("manual access update failed", {
        error: error?.message,
        code: error?.code,
      });
      return res
        .status(error.code === "auth/user-not-found" ? 404 : 500)
        .send("Access was not saved");
    }
  },
);

exports.paidNotification = onValueWritten(
  { ...options, ref: "/paid/{uid}", instance: "bhajans-588f5" },
  async (event) => {
    const payment = event.data.after.val();
    if (!payment || payment.manual || !payment.gross_total_amount) return;
    const before = event.data.before.val();
    if (
      before?.paidOn === payment.paidOn &&
      before?.orderID === payment.orderID
    )
      return;
    const { payer, gross_total_amount } = payment;
    const root = getDatabase().ref();
    const admins = (await root.child("admin").get()).val() || {};
    const tokens = new Map();
    await Promise.all(
      Object.entries(admins)
        .filter(([, role]) => role === "1")
        .map(async ([uid]) => {
          const snapshot = await root.child(`messages/${uid}/tokens`).get();
          for (const token of Object.keys(snapshot.val() || {}))
            tokens.set(token, uid);
        }),
    );
    const allTokens = [...tokens.keys()];
    for (let offset = 0; offset < allTokens.length; offset += 500) {
      const batch = allTokens.slice(offset, offset + 500);
      const name =
        [payer?.name?.given_name, payer?.name?.surname]
          .filter(Boolean)
          .join(" ") ||
        payer?.email_address ||
        payer?.payer_id ||
        "A customer";
      const response = await getMessaging().sendEachForMulticast({
        tokens: batch,
        notification: {
          title: `${name} signed up!`,
          body: `${name} paid ${gross_total_amount.value}`,
        },
      });
      await Promise.all(
        response.responses.map((result, index) => {
          if (
            [
              "messaging/invalid-registration-token",
              "messaging/registration-token-not-registered",
            ].includes(result.error?.code)
          ) {
            const token = batch[index];
            return root
              .child(`messages/${tokens.get(token)}/tokens/${token}`)
              .remove();
          }
        }),
      );
    }
  },
);

// Product IDs and durations recovered from the deployed Shopify webhook.
const SHOPIFY_VARIANTS = {
  37277000728740: 31536000000,
  37277000794276: 157680000000,
  37277000827044: 315360000000,
};
exports.shopifyWebhook = onRequest(
  { ...options, invoker: "public", secrets: [shopifySecret, mailjetAuth, ga4ApiSecret] },
  async (req, res) => {
    if (req.method !== "POST") return res.status(405).send("POST required");
    const signature = req.headers["x-shopify-hmac-sha256"];
    const expected = crypto
      .createHmac("sha256", shopifySecret.value())
      .update(req.rawBody)
      .digest("base64");
    if (
      typeof signature !== "string" ||
      Buffer.byteLength(signature) !== Buffer.byteLength(expected) ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    ) {
      const { webhookId, topic, shop } = shopifyHeaders(req);
      logger.warn("shopify webhook rejected", {
        reason: "invalid signature",
        webhookId,
        topic,
        shop,
      });
      return res.status(401).send("Invalid signature");
    }
    let body;
    try {
      body = JSON.parse(req.rawBody.toString());
    } catch {
      logger.warn("shopify webhook rejected", {
        reason: "invalid JSON",
        ...shopifyHeaders(req),
      });
      return res.status(400).send("Invalid JSON");
    }
    const {
      financial_status,
      line_items,
      email,
      contact_email,
      order_status_url,
      order_number,
      billing_address,
    } = body;
    let time;
    // Preserve deployed behavior: the last recognized variant determines duration.
    for (const item of line_items || [])
      if (SHOPIFY_VARIANTS[item.variant_id])
        time = SHOPIFY_VARIANTS[item.variant_id];
    // Email is deliberately left out of ignored logs: most are unrelated purchases.
    let ignoredReason = null;
    if (financial_status !== "paid") ignoredReason = "not paid";
    else if (!(contact_email || email)) ignoredReason = "no email";
    else if (!time) ignoredReason = "no recognized variant";
    if (ignoredReason) {
      const { webhookId, topic } = shopifyHeaders(req);
      logger.info("shopify webhook ignored", {
        reason: ignoredReason,
        orderId: body.id,
        orderNumber: order_number,
        financialStatus: financial_status,
        webhookId,
        topic,
      });
      return res.status(200).json({ message: "ignored" });
    }
    if (body.id == null || order_number == null) {
      logger.warn("shopify webhook rejected", {
        reason: "missing order identity",
        ...shopifySummary(req, body),
      });
      return res.status(400).send("Missing order identity");
    }
    try {
      const accountEmail = (contact_email || email).trim().toLowerCase();
      let user;
      let password;
      try {
        user = await getAuth().getUserByEmail(accountEmail);
      } catch (error) {
        if (error.code !== "auth/user-not-found") throw error;
        password = crypto.randomBytes(24).toString("base64url");
        try {
          user = await getAuth().createUser({ email: accountEmail, password });
        } catch (createError) {
          if (createError.code !== "auth/email-already-exists")
            throw createError;
          user = await getAuth().getUserByEmail(accountEmail);
          password = undefined;
        }
      }
      const now = Date.now();
      const paidOn = Date.parse(body.processed_at || body.created_at) || now;
      const expiresOn = now + time;
      const orderHash = crypto
        .createHash("sha256")
        .update(`shopify:${body.id}`)
        .digest("hex");
      const result = await getDatabase()
        .ref(`paid/${user.uid}`)
        .transaction((current) => {
          if (current?.processedOrders?.[orderHash])
            return current.shopifyEmailPending === orderHash
              ? current
              : undefined;
          return {
            ...current,
            expiresOn,
            mode: "live",
            manual: false,
            provider: "shopify",
            amountScope: "order",
            dateBasis:
              body.processed_at || body.created_at ? "provider" : "received",
            gross_total_amount: {
              value: body.total_price ?? null,
              currency: body.currency ?? null,
            },
            orderID: `shopify:${body.id}`,
            processedOrders: { ...current?.processedOrders, [orderHash]: now },
            shopifyEmailPending: orderHash,
            shopifyWelcomePending: !!password,
            order_status_url: order_status_url || null,
            order_number: order_number || null,
            billing_address: billing_address || null,
            line_items,
            paidOn,
            payer: { payer_id: accountEmail },
          };
        });
      if (!result.committed) {
        logger.info("shopify order activated", {
          ...shopifySummary(req, body),
          uid: user.uid,
          expiresOn: result.snapshot?.val()?.expiresOn,
          newAccount: Boolean(password),
          outcome: "already processed",
        });
        return res.status(200).json({ message: "already processed" });
      }
      const validUntil = purchaseDate(result.snapshot.val().expiresOn);
      if (result.snapshot.val().shopifyWelcomePending) {
        const resetLink =
          await getAuth().generatePasswordResetLink(accountEmail);
        await newUserResetPasswordEmailShopify({
          email: accountEmail,
          password,
          resetLink,
          validUntil,
          subscriptionName: `${time / 31536000000}-year subscription`,
          purchasedOn: purchaseDate(body.processed_at || body.created_at),
          apiKey: mailjetAuth.value(),
        });
      } else {
        await accountActivated({
          email: accountEmail,
          name: user.displayName || billing_address?.name || "Customer",
          validUntil,
          subscriptionName: `${time / 31536000000}-year subscription`,
          purchasedOn: purchaseDate(body.processed_at || body.created_at),
          apiKey: mailjetAuth.value(),
        });
      }
      await getDatabase()
        .ref(`paid/${user.uid}`)
        .transaction((current) =>
          current?.shopifyEmailPending === orderHash
            ? {
                ...current,
                shopifyEmailPending: null,
                shopifyWelcomePending: false,
              }
            : undefined,
        );
      logger.info("shopify order activated", {
        ...shopifySummary(req, body),
        uid: user.uid,
        expiresOn: result.snapshot.val().expiresOn,
        newAccount: Boolean(password),
        outcome: "done",
      });
      // GA4 purchase for revenue and attribution; never fails the order.
      await recordGa4Purchase({
        uid: user.uid,
        orderId: `shopify:${body.id}`,
        value: body.total_price,
        currency: body.currency,
        lineItems: line_items,
        paidOn,
        apiSecret: ga4ApiSecret.value(),
      });
      return res.status(200).json({ message: "done" });
    } catch (error) {
      logger.error("shopify order processing failed", {
        ...shopifySummary(req, body),
        error: error?.message,
        code: error?.code,
        stack: error?.stack,
      });
      return res.status(500).send("Order processing failed; retry required");
    }
  },
);

// Sends the magic sign-in link or password reset link in a branded email,
// instead of Firebase's plain default templates. The client falls back to
// Firebase's own email if this fails.
const AUTH_EMAIL_HOSTS = new Set([
  "sing.withamma.com",
  "bhajans-588f5.web.app",
  "bhajans-588f5.firebaseapp.com",
  "localhost",
]);
const isAllowedContinueUrl = (value) => {
  try {
    const url = new URL(value);
    return (
      AUTH_EMAIL_HOSTS.has(url.hostname) ||
      /^deploy-preview-\d+--bhajans\.netlify\.app$/.test(url.hostname)
    );
  } catch {
    return false;
  }
};
exports.sendAuthEmail = onCall(
  { ...options, secrets: [mailjetAuth] },
  async (request) => {
    const { email: rawEmail, type, continueUrl } = request.data || {};
    const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
      throw new HttpsError("invalid-argument", "A valid email address is required");
    if (!["signin", "reset"].includes(type))
      throw new HttpsError("invalid-argument", "Unknown email type");
    if (!isAllowedContinueUrl(continueUrl))
      throw new HttpsError("invalid-argument", "Unsupported return address");
    let link;
    try {
      link =
        type === "signin"
          ? await getAuth().generateSignInWithEmailLink(email, {
              url: continueUrl,
              handleCodeInApp: true,
            })
          : await getAuth().generatePasswordResetLink(email, { url: continueUrl });
    } catch (error) {
      // Don't reveal whether an account exists.
      if (error?.code === "auth/user-not-found" || error?.code === "auth/email-not-found")
        return { sent: true };
      logger.error("Auth link generation failed", { type, code: error?.code });
      throw new HttpsError("internal", "Could not create the link");
    }
    await sendAuthEmail({ email, link, type, apiKey: mailjetAuth.value() });
    logger.info("Auth email sent", { type });
    return { sent: true };
  },
);

// Engagement: daily renewal reminders and admin push announcements.
const engagement = require("./engagement");
exports.sendRenewalReminders = engagement.sendRenewalReminders;
exports.sendAnnouncement = engagement.sendAnnouncement;
