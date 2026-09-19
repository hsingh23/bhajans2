const { onRequest } = require("firebase-functions/v2/https");
const { onValueWritten } = require("firebase-functions/v2/database");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const crypto = require("node:crypto");
const {
  newUserResetPasswordEmail,
  newUserResetPasswordEmailShopify,
  accountActivated,
} = require("./mail");
admin.initializeApp();
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
      return res.status(401).send("Invalid signature");
    }
    let body;
    try {
      body = JSON.parse(req.rawBody.toString());
    } catch {
      return res.status(400).send("Invalid JSON");
    }
    const { status, billing, order_key, needs_payment, line_items } = body;
    if (
      status !== "processing" ||
      needs_payment !== false ||
      !billing?.email ||
      !line_items?.some((item) => item.sku === "SingWithAmma-1year")
    ) {
      return res.status(200).json({ message: "ignored" });
    }
    if (typeof order_key !== "string" || !order_key)
      return res.status(400).send("Missing order key");
    try {
      const email = billing.email.trim().toLowerCase();
      let user;
      let password;
      try {
        user = await admin.auth().getUserByEmail(email);
      } catch (error) {
        if (error.code !== "auth/user-not-found") throw error;
        password = crypto.randomBytes(24).toString("base64url");
        try {
          user = await admin.auth().createUser({ email, password });
        } catch (createError) {
          if (createError.code !== "auth/email-already-exists")
            throw createError;
          user = await admin.auth().getUserByEmail(email);
          password = undefined;
        }
      }
      const now = Date.now();
      const result = await admin
        .database()
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
            orderID: order_key,
            paidOn: now,
            payer: { payer_id: email },
            processedOrders: { ...current?.processedOrders, [orderHash]: now },
            welcomeEmailPending: !!password || !!current?.welcomeEmailPending,
          };
        });
      if (result.committed && result.snapshot.val().welcomeEmailPending) {
        const resetLink = await admin.auth().generatePasswordResetLink(email);
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
        await admin
          .database()
          .ref(`paid/${user.uid}`)
          .child("welcomeEmailPending")
          .set(false);
      }
      return res
        .status(200)
        .json({ message: result.committed ? "done" : "already processed" });
    } catch (error) {
      console.error("Order processing failed", error.code || error.message);
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
      caller = await admin.auth().verifyIdToken(token, true);
    } catch {
      return res.status(401).send("Invalid authentication");
    }
    if ((await admin.database().ref(`admin/${caller.uid}`).get()).val() !== "1")
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
      const user = await admin
        .auth()
        .getUserByEmail(body.email.trim().toLowerCase());
      const now = Date.now();
      await admin
        .database()
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
    const root = admin.database().ref();
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
      const response = await admin.messaging().sendEachForMulticast({
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
  { ...options, invoker: "public", secrets: [shopifySecret, mailjetAuth] },
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
      return res.status(401).send("Invalid signature");
    }
    let body;
    try {
      body = JSON.parse(req.rawBody.toString());
    } catch {
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
    if (financial_status !== "paid" || !(contact_email || email) || !time)
      return res.status(200).json({ message: "ignored" });
    try {
      const accountEmail = (contact_email || email).trim().toLowerCase();
      let user;
      let password;
      try {
        user = await admin.auth().getUserByEmail(accountEmail);
      } catch (error) {
        if (error.code !== "auth/user-not-found") throw error;
        password = crypto.randomBytes(24).toString("base64url");
        try {
          user = await admin
            .auth()
            .createUser({ email: accountEmail, password });
        } catch (createError) {
          if (createError.code !== "auth/email-already-exists")
            throw createError;
          user = await admin.auth().getUserByEmail(accountEmail);
          password = undefined;
        }
      }
      const paidOn = Date.now();
      const expiresOn = paidOn + time;
      await admin
        .database()
        .ref(`paid/${user.uid}`)
        .set({
          expiresOn,
          mode: "live",
          manual: false,
          order_status_url: order_status_url || null,
          order_number: order_number || null,
          billing_address: billing_address || null,
          line_items,
          paidOn,
          payer: { payer_id: accountEmail },
        });
      const validUntil = purchaseDate(expiresOn);
      if (password) {
        const resetLink = await admin
          .auth()
          .generatePasswordResetLink(accountEmail);
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
      return res.status(200).json({ message: "done" });
    } catch (error) {
      console.error(
        "Shopify order processing failed",
        error.code || error.message,
      );
      return res.status(500).send("Order processing failed; retry required");
    }
  },
);
