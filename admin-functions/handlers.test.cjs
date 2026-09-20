const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
function load(role = "1") {
  let paid = {
    expiresOn: Date.parse("2030-01-01T00:00:00Z"),
    orderID: "original",
    paidOn: 123,
    gross_total_amount: { value: 9.99 },
  };
  let query;
  const user = {
    uid: "user-123",
    email: "customer@example.com",
    displayName: "Test Customer",
  };
  class HttpsError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
    }
  }
  const modules = {
    "firebase-admin/app": { initializeApp() {} },
    "firebase-admin/auth": {
      getAuth: () => ({
        getUser: async (uid) => {
          query = uid;
          return user;
        },
        getUserByEmail: async (email) => {
          query = email;
          if (email === "missing@example.com")
            throw { code: "auth/user-not-found" };
          return user;
        },
      }),
    },
    "firebase-admin/database": {
      getDatabase: () => ({
        ref: (path) => ({
          get: async () => ({
            val: () => (path.startsWith("admin/") ? role : paid),
          }),
          transaction: async (fn) => {
            paid = fn(paid);
            return { committed: true, snapshot: { val: () => paid } };
          },
        }),
      }),
    },
    "firebase-functions/v2/https": { onCall: (_, fn) => fn, HttpsError },
    "./access.cjs": require("./access.cjs"),
    "./dashboard-functions.cjs": {},
  };
  const exports = {};
  vm.runInNewContext(fs.readFileSync(require.resolve("./index.cjs"), "utf8"), {
    require: (name) => modules[name],
    exports,
  });
  return { exports, paid: () => paid, query: () => query };
}
test("unauthenticated and non-admin callers are rejected", async () => {
  for (const auth of [null, { uid: "caller" }]) {
    const { exports } = load(null);
    await assert.rejects(
      exports.getUserByEmail({ auth, data: { email: "a@b.com" } }),
      { code: auth ? "permission-denied" : "unauthenticated" },
    );
    await assert.rejects(
      exports.updateUserAccess({
        auth,
        data: { uid: "user-123", mode: "years", years: 1 },
      }),
      { code: auth ? "permission-denied" : "unauthenticated" },
    );
  }
});
test("lookup normalizes email and supports UID", async () => {
  const ctx = load();
  const result = await ctx.exports.getUserByEmail({
    auth: { uid: "admin" },
    data: { email: " MAILTO:CUSTOMER@EXAMPLE.COM " },
  });
  assert.equal(ctx.query(), "customer@example.com");
  assert.equal(result.displayName, "Test Customer");
  await ctx.exports.getUserByEmail({
    auth: { uid: "admin" },
    data: { uid: " user-123 " },
  });
  assert.equal(ctx.query(), "user-123");
});
test("missing user has a distinct not-found error", async () => {
  await assert.rejects(
    load().exports.getUserByEmail({
      auth: { uid: "admin" },
      data: { email: "missing@example.com" },
    }),
    { code: "not-found" },
  );
});
test("extension preserves payment metadata and records actor", async () => {
  const ctx = load();
  await ctx.exports.updateUserAccess({
    auth: { uid: "admin" },
    data: { uid: "user-123", mode: "years", years: 10 },
  });
  assert.equal(ctx.paid().expiresOn, Date.parse("2040-01-01T00:00:00Z"));
  assert.equal(ctx.paid().orderID, "original");
  assert.equal(ctx.paid().paidOn, 123);
  assert.equal(ctx.paid().accessUpdatedBy, "admin");
});
test("invalid input leaves subscription unchanged", async () => {
  const ctx = load();
  const before = ctx.paid();
  await assert.rejects(
    ctx.exports.updateUserAccess({
      auth: { uid: "admin" },
      data: { uid: "user-123", mode: "years", years: -1 },
    }),
    { code: "invalid-argument" },
  );
  assert.equal(ctx.paid(), before);
});
