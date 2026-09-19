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
  const modules = {
    "firebase-functions/v2/https": { onRequest: (_, fn) => fn },
    "firebase-functions/v2/database": {
      onValueWritten: (_, fn) => (event) => fn({ data: event }),
    },
    "firebase-functions/params": {
      defineSecret: () => ({ value: () => "test-secret" }),
    },
    "firebase-admin": {
      initializeApp() {},
      database: () => database,
      auth: () => auth,
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
      billing: { email: "USER@EXAMPLE.COM" },
      order_key: "order-1",
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
