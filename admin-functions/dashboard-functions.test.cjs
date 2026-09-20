const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
function load(role = "1") {
  const reads = [],
    writes = [];
  const values = {};
  class HttpsError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
    }
  }
  const ref = (path) => ({
    get: async () => {
      reads.push(path);
      return {
        val: () => (path.startsWith("admin/") ? role : values[path] || null),
      };
    },
    orderByKey() {
      return this;
    },
    limitToLast() {
      return this;
    },
    transaction: async (fn) => {
      const value = fn(values[path] || null);
      if (value !== undefined) {
        values[path] = value;
        writes.push(path);
      }
    },
  });
  const modules = {
    "firebase-admin/database": { getDatabase: () => ({ ref }) },
    "firebase-functions/v2/https": {
      onCall: (options, handler) => Object.assign(handler, { options }),
      HttpsError,
    },
    "firebase-functions/v2/database": {
      onValueWritten: (options, handler) => Object.assign(handler, { options }),
    },
    "firebase-functions/v2/scheduler": {
      onSchedule: (options, handler) => Object.assign(handler, { options }),
    },
    "./analytics.cjs": require("./analytics.cjs"),
    "node:crypto": require("node:crypto"),
  };
  const exports = {};
  vm.runInNewContext(
    fs.readFileSync(require.resolve("./dashboard-functions.cjs"), "utf8"),
    { require: (n) => modules[n], exports, Date, JSON },
  );
  return { exports, reads, writes, values };
}
test("dashboard rejects unauthenticated caller without any database read", async () => {
  const ctx = load();
  await assert.rejects(ctx.exports.getSalesDashboard({ data: {} }), {
    code: "unauthenticated",
  });
  assert.deepEqual(ctx.reads, []);
});
test("dashboard checks exact server-side role before reading any data", async () => {
  for (const role of [null, 1, true, "0", "admin"]) {
    const ctx = load(role);
    await assert.rejects(
      ctx.exports.getSalesDashboard({
        auth: { uid: "caller" },
        data: { admin: true },
      }),
      { code: "permission-denied" },
    );
    assert.deepEqual(ctx.reads, ["admin/caller"]);
  }
});
test("admin dashboard returns aggregates and never writes customer data", async () => {
  const ctx = load();
  const result = await ctx.exports.getSalesDashboard({
    auth: { uid: "caller" },
  });
  assert.equal(result.schemaVersion, 1);
  assert.deepEqual(ctx.reads, [
    "admin/caller",
    "paid",
    "transactions",
    "favorites",
    "analytics/paymentEvents",
    "analytics/snapshots",
  ]);
  assert.deepEqual(ctx.writes, []);
});
test("every new function pins the database-authorized runtime identity", () => {
  for (const handler of Object.values(load().exports))
    assert.equal(
      handler.options.serviceAccount,
      "bhajans-588f5@appspot.gserviceaccount.com",
    );
});
test("payment archive is idempotent, strips PII, and never changes paid records", async () => {
  const ctx = load();
  const event = {
    id: "repeat",
    time: "2026-09-19T00:00:00Z",
    params: { uid: "u" },
    data: {
      before: { val: () => null },
      after: {
        val: () => ({
          mode: "live",
          orderID: "a",
          payer: { email_address: "private@example.com" },
          billing_address: { name: "Private" },
          order_status_url: "secret",
          paidOn: Date.now(),
        }),
      },
    },
  };
  await ctx.exports.archiveDashboardPayment(event);
  await ctx.exports.archiveDashboardPayment(event);
  assert.equal(ctx.writes.length, 1);
  assert.ok(ctx.writes.every((x) => x.startsWith("analytics/paymentEvents/")));
  assert.ok(!JSON.stringify(ctx.values).includes("private@example.com"));
  assert.ok(!JSON.stringify(ctx.values).includes("secret"));
});
test("snapshot retries preserve the first observation for the UTC day", async () => {
  const ctx = load();
  await ctx.exports.captureDashboardSnapshot();
  await ctx.exports.captureDashboardSnapshot();
  assert.equal(ctx.writes.length, 1);
  assert.ok(ctx.writes[0].startsWith("analytics/snapshots/"));
});
