const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const crypto = require("node:crypto");
function load({
  lookupError,
  saveError,
  role = "1",
  newUser = false,
  failFirstEmail = false,
} = {}) {
  let payment = null;
  let creates = 0;
  let emails = 0;
  const database = {
    ref: () => ({
      get: async () => ({ val: () => role }),
      transaction: async (fn) => {
        if (saveError) throw new Error("offline");
        const next = fn(payment);
        if (next === undefined) return { committed: false };
        payment = next;
        return { committed: true, snapshot: { val: () => payment } };
      },
      child: (key) => ({
        get: async () => ({ val: () => ({}) }),
        set: async (value) => {
          payment[key] = value;
        },
      }),
    }),
  };
  const auth = {
    getUserByEmail: async () => {
      if (lookupError) throw { code: lookupError };
      if (newUser && !creates) throw { code: "auth/user-not-found" };
      return { uid: "user" };
    },
    createUser: async () => {
      creates++;
      return { uid: "user" };
    },
    generatePasswordResetLink: async () => "https://example.com/reset",
    verifyIdToken: async () => ({ uid: "admin" }),
  };
  // Records what the handler passes to the logger, as Cloud Logging would see it.
  const logs = [];
  const record = (level) => (message, data) =>
    logs.push({
      level,
      message,
      data: JSON.parse(JSON.stringify(data ?? {})),
    });
  const modules = {
    "firebase-functions/logger": {
      info: record("info"),
      warn: record("warn"),
      error: record("error"),
    },
    "firebase-functions/v2/https": { onRequest: (_, fn) => fn },
    "firebase-functions/v2/database": {
      onValueWritten: (_, fn) => (event) => fn({ data: event }),
    },
    "firebase-functions/params": {
      defineSecret: () => ({ value: () => "test-secret" }),
    },
    "firebase-admin/app": { initializeApp() {} },
    "firebase-admin/auth": { getAuth: () => auth },
    "firebase-admin/database": { getDatabase: () => database },
    "firebase-admin/messaging": { getMessaging: () => ({}) },
    "./engagement": {
      ga4ApiSecret: { value: () => "test-secret" },
      recordGa4Purchase: async () => true,
      sendRenewalReminders: () => {},
      sendAnnouncement: () => {},
    },
    "./mail": {
      newUserResetPasswordEmail: async () => {
        emails++;
        if (failFirstEmail && emails === 1) throw new Error("mail unavailable");
      },
    },
  };
  const exports = {};
  vm.runInNewContext(
    fs.readFileSync(require.resolve("../src/index.js"), "utf8"),
    {
      require: (name) => modules[name] || require(name),
      exports,
      console,
      Buffer,
    },
  );
  return {
    handlers: exports,
    logs: () => logs,
    payment: () => payment,
    creates: () => creates,
    emails: () => emails,
  };
}
function response() {
  return {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}
function order(signature = true) {
  const rawBody = Buffer.from(
    JSON.stringify({
      status: "processing",
      needs_payment: false,
      id: 555,
      number: "1234",
      billing: {
        email: "USER@EXAMPLE.COM",
        first_name: "Asha",
        last_name: "Rao",
        city: "Pune",
      },
      order_key: "wc_order_key_secret_7f3a",
      line_items: [{ sku: "SingWithAmma-1year" }],
    }),
  );
  return {
    method: "POST",
    rawBody,
    headers: {
      "x-wc-webhook-signature": signature
        ? crypto
            .createHmac("sha256", "test-secret")
            .update(rawBody)
            .digest("base64")
        : "bad",
      "x-wc-webhook-id": "wc-hook-9",
      "x-wc-webhook-topic": "order.updated",
      "x-wc-webhook-source": "https://shop.example",
    },
  };
}
test("payment deletion does not crash notification trigger", async () => {
  await load().handlers.paidNotification({ after: { val: () => null } });
});
test("manual payment without payer name does not crash notification trigger", async () => {
  await load().handlers.paidNotification({
    after: {
      val: () => ({
        manual: true,
        payer: { payer_id: "admin" },
        gross_total_amount: { value: 9.99 },
      }),
    },
  });
});
test("manual HTTP endpoint requires authentication", async () => {
  const res = response();
  await load().handlers.manuallyAddUser({ method: "POST", headers: {} }, res);
  assert.equal(res.statusCode, 401);
});
test("manual HTTP endpoint rejects non-admin", async () => {
  const res = response();
  await load({ role: null }).handlers.manuallyAddUser(
    { method: "POST", headers: { authorization: "Bearer test" } },
    res,
  );
  assert.equal(res.statusCode, 403);
});
test("webhook rejects invalid signatures without changing access", async () => {
  const ctx = load();
  const res = response();
  await ctx.handlers.amritabooks(order(false), res);
  assert.equal(res.statusCode, 401);
  assert.equal(ctx.payment(), null);
});
test("signed webhook awaits saved access and duplicate delivery is idempotent", async () => {
  const ctx = load();
  const res = response();
  await ctx.handlers.amritabooks(order(), res);
  assert.equal(res.statusCode, 200);
  assert.equal(ctx.payment().payer.payer_id, "user@example.com");
  const expires = ctx.payment().expiresOn;
  await ctx.handlers.amritabooks(order(), response());
  assert.equal(ctx.payment().expiresOn, expires);
});
test("database failure returns retryable status", async () => {
  const res = response();
  await load({ saveError: true }).handlers.amritabooks(order(), res);
  assert.equal(res.statusCode, 500);
});
test("auth outage does not create another account", async () => {
  const ctx = load({ lookupError: "auth/internal-error" });
  const res = response();
  await ctx.handlers.amritabooks(order(), res);
  assert.equal(res.statusCode, 500);
  assert.equal(ctx.creates(), 0);
});

test("Amritabooks retries a failed welcome email without granting another year", async () => {
  const ctx = load({ newUser: true, failFirstEmail: true });
  const first = response();
  await ctx.handlers.amritabooks(order(), first);
  assert.equal(first.statusCode, 500);
  const expires = ctx.payment().expiresOn;
  const retry = response();
  await ctx.handlers.amritabooks(order(), retry);
  assert.equal(retry.statusCode, 200);
  assert.equal(ctx.emails(), 2);
  assert.equal(ctx.payment().expiresOn, expires);
  assert.equal(ctx.payment().welcomeEmailPending, false);
});

test("failed Amritabooks processing logs order identity, customer and order key", async () => {
  const ctx = load({ saveError: true });
  const res = response();
  await ctx.handlers.amritabooks(order(), res);
  assert.equal(res.statusCode, 500);
  const errors = ctx.logs().filter((entry) => entry.level === "error");
  assert.equal(errors.length, 1);
  assert.equal(errors[0].message, "amritabooks order processing failed");
  const data = errors[0].data;
  assert.equal(data.orderId, 555);
  assert.equal(data.orderNumber, "1234");
  assert.equal(data.email, "user@example.com");
  assert.equal(data.customerName, "Asha Rao");
  assert.equal(data.billingAddress.city, "Pune");
  assert.equal(data.orderKey, "wc_order_key_secret_7f3a");
  assert.equal(data.webhookId, "wc-hook-9");
  assert.equal(data.topic, "order.updated");
  assert.equal(data.error, "offline");
});
