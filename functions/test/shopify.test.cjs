const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const crypto = require("node:crypto");
const NOW = Date.parse("2026-09-19T12:00:00Z");
function load({ newUser = false, lookupError, saveError } = {}) {
  let paid = null;
  let queriedEmail;
  let created;
  let sent = [];
  const auth = {
    getUserByEmail: async (email) => {
      queriedEmail = email;
      if (newUser || lookupError)
        throw { code: lookupError || "auth/user-not-found" };
      return { uid: "existing", displayName: "Customer" };
    },
    createUser: async (data) => {
      created = data;
      return { uid: "created" };
    },
    generatePasswordResetLink: async () => "https://reset.example/test",
  };
  const ref = {
    set: async (data) => {
      if (saveError) throw Error("offline");
      paid = data;
    },
    transaction: async (fn) => {
      if (saveError) throw Error("offline");
      const data = fn(paid);
      if (data === undefined)
        return { committed: false, snapshot: { val: () => paid } };
      paid = data;
      return { committed: true, snapshot: { val: () => paid } };
    },
    child: () => ref,
  };
  const functions = {
    config: () => ({ config: { shopify_secret: "test-secret" } }),
    region: () => functions,
    https: { onRequest: (fn) => fn, onCall: (fn) => fn },
    database: { ref: () => ({ onWrite: (fn) => fn }) },
  };
  const mails = {
    newUserResetPasswordEmailShopify: async (data) =>
      sent.push({ type: "welcome", ...data }),
    accountActivated: async (data) => sent.push({ type: "activated", ...data }),
    newUserResetPasswordEmail: async () => {},
  };
  const modules = {
    "firebase-functions": functions,
    "firebase-admin": {
      initializeApp() {},
      auth: () => auth,
      database: () => ({ ref: () => ref }),
    },
    "paypal-rest-sdk": {},
    cors: () => () => {},
    "firebase-functions/v2/https": { onRequest: (_, fn) => fn },
    "firebase-functions/v2/database": { onValueWritten: (_, fn) => fn },
    "firebase-functions/params": {
      defineSecret: () => ({ value: () => "test-secret" }),
    },
    "./mail": mails,
  };
  let source = fs.readFileSync(
    process.env.SHOPIFY_BASELINE_SOURCE || require.resolve("../src/index.js"),
    "utf8",
  );
  source = source
    .replace(/import\s*\{[^}]*\}\s*from "\.\/mail";/, "")
    .replace(/export const (\w+) =/g, "exports.$1 =");
  const exports = {};
  class Clock extends Date {
    constructor(...args) {
      super(...(args.length ? args : [NOW]));
    }
    static now() {
      return NOW;
    }
  }
  vm.runInNewContext(source, {
    exports,
    require: (name) => modules[name] || require(name),
    ...mails,
    Buffer,
    Date: Clock,
    console: { log() {}, error() {} },
  });
  return {
    handler: exports.shopifyWebhook,
    paid: () => paid,
    email: () => queriedEmail,
    created: () => created,
    sent: () => sent,
  };
}
function req(overrides = {}, valid = true) {
  const rawBody = Buffer.from(
    JSON.stringify({
      id: 123,
      financial_status: "paid",
      contact_email: "customer@example.com",
      email: "fallback@example.com",
      order_number: 1001,
      order_status_url: "https://shop.example/order/123",
      billing_address: { name: "Customer Name" },
      line_items: [{ variant_id: 37277000728740 }],
      ...overrides,
    }),
  );
  return {
    method: "POST",
    rawBody,
    headers: {
      "x-shopify-hmac-sha256": valid
        ? crypto
            .createHmac("sha256", "test-secret")
            .update(rawBody)
            .digest("base64")
        : "wrong",
    },
  };
}
function res() {
  return {
    statusCode: 200,
    set() {},
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
for (const [variant, years] of [
  [37277000728740, 1],
  [37277000794276, 5],
  [37277000827044, 10],
]) {
  test(`Shopify production variant ${variant} grants ${years} years`, async () => {
    const ctx = load();
    const response = res();
    await ctx.handler(req({ line_items: [{ variant_id: variant }] }), response);
    assert.equal(response.statusCode, 200);
    assert.equal(ctx.paid().expiresOn, NOW + years * 31536000000);
    assert.equal(ctx.paid().order_number, 1001);
    assert.equal(ctx.paid().order_status_url, "https://shop.example/order/123");
    assert.equal(ctx.email(), "customer@example.com");
    assert.equal(ctx.sent()[0].type, "activated");
  });
}
test("Shopify falls back to email and creates missing accounts with welcome instructions", async () => {
  const ctx = load({ newUser: true });
  await ctx.handler(req({ contact_email: null }), res());
  assert.equal(ctx.email(), "fallback@example.com");
  assert.equal(ctx.created().email, "fallback@example.com");
  assert.equal(ctx.sent()[0].type, "welcome");
  assert.equal(ctx.sent()[0].resetLink, "https://reset.example/test");
});
test("Shopify rejects forged signatures", async () => {
  const ctx = load();
  const response = res();
  await ctx.handler(req({}, false), response);
  assert.equal(response.statusCode, 401);
  assert.equal(ctx.paid(), null);
});
test("Shopify ignores unpaid orders and unrelated products", async () => {
  for (const body of [
    { financial_status: "pending" },
    { line_items: [{ variant_id: 999 }] },
  ]) {
    const ctx = load();
    await ctx.handler(req(body), res());
    assert.equal(ctx.paid(), null);
    assert.equal(ctx.sent().length, 0);
  }
});

test("Shopify auth service failures return retryable status without creating an account", async () => {
  const ctx = load({ lookupError: "auth/internal-error" });
  const response = res();
  await ctx.handler(req(), response);
  assert.equal(response.statusCode, 500);
  assert.equal(ctx.created(), undefined);
  assert.equal(ctx.paid(), null);
});
test("Shopify save failures return retryable status and do not send activation email", async () => {
  const ctx = load({ saveError: true });
  const response = res();
  await ctx.handler(req(), response);
  assert.equal(response.statusCode, 500);
  assert.equal(ctx.sent().length, 0);
});

test("Shopify email includes purchased subscription and actual order date", async () => {
  const ctx = load();
  await ctx.handler(
    req({
      processed_at: "2026-09-10T08:30:00Z",
      line_items: [{ variant_id: 37277000827044 }],
    }),
    res(),
  );
  assert.equal(ctx.sent()[0].subscriptionName, "10-year subscription");
  assert.equal(ctx.sent()[0].purchasedOn, "September 10, 2026");
});
