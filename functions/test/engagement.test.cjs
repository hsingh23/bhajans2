const { test } = require("node:test");
const assert = require("node:assert/strict");
const { helpers, recordGa4Purchase } = require("../src/engagement.js");
const { renderRenewalReminder } = require("../src/mail.js");
const { reminderDue, safeLink, fallbackClientId, ga4PurchasePayload } = helpers;
const DAY = 86400000;
const NOW = Date.parse("2026-11-07T15:00:00Z");

test("reminders fire once in the 7-day window and once in the last day", () => {
  assert.equal(reminderDue(NOW + 6.5 * DAY, NOW), "7d");
  assert.equal(reminderDue(NOW + 7 * DAY, NOW), "7d");
  assert.equal(reminderDue(NOW + 7 * DAY + 1, NOW), null);
  assert.equal(reminderDue(NOW + 6 * DAY, NOW), null);
  assert.equal(reminderDue(NOW + 3 * DAY, NOW), null);
  assert.equal(reminderDue(NOW + 0.5 * DAY, NOW), "1d");
  assert.equal(reminderDue(NOW - 1, NOW), null);
  assert.equal(reminderDue("not a date", NOW), null);
});

test("announcement links stay on sing.withamma.com", () => {
  assert.equal(safeLink(undefined), "/");
  assert.equal(safeLink("/pay"), "/pay");
  assert.equal(safeLink("https://sing.withamma.com/my-favorites?x=1"), "/my-favorites?x=1");
  assert.equal(safeLink("//evil.example/pay"), null);
  assert.equal(safeLink("https://evil.example/"), null);
  assert.equal(safeLink("javascript:alert(1)"), null);
});

test("GA4 purchase payload carries order, revenue, plan and identity", () => {
  const payload = ga4PurchasePayload({
    clientId: "123.456",
    uid: "u1",
    orderId: "shopify:42",
    value: "40.00",
    currency: "USD",
    lineItems: [
      { variant_id: 37277000794276, price: "40.00", quantity: 1 },
      { variant_id: 999, price: "5.00", quantity: 1 },
    ],
    paidOn: NOW,
  });
  assert.equal(payload.client_id, "123.456");
  assert.equal(payload.user_id, "u1");
  assert.equal(payload.timestamp_micros, NOW * 1000);
  assert.deepEqual(payload.events[0], {
    name: "purchase",
    params: {
      transaction_id: "shopify:42",
      value: 40,
      currency: "USD",
      items: [{ item_id: "37277000794276", item_name: "Sing with Amma 5 years", price: 40, quantity: 1 }],
      engagement_time_msec: 1,
    },
  });
});

test("visitors without a saved GA client id get a stable one from their uid", () => {
  assert.match(fallbackClientId("u1"), /^\d+\.\d+$/);
  assert.equal(fallbackClientId("u1"), fallbackClientId("u1"));
  assert.notEqual(fallbackClientId("u1"), fallbackClientId("u2"));
});

test("GA4 problems never fail an order", async () => {
  assert.equal(await recordGa4Purchase({ uid: "u1", orderId: "o", apiSecret: "" }), false);
  // No Firebase app in tests, so the lookup throws; it must be swallowed.
  assert.equal(await recordGa4Purchase({ uid: "u1", orderId: "o", apiSecret: "s", fetchImpl: async () => ({ ok: true }) }), false);
});

test("renewal reminder email names the date and links to payment", () => {
  const week = renderRenewalReminder({ name: "Devi <b>", daysLeft: 7, validUntil: "November 14, 2026" });
  assert.match(week.subject, /a week left/i);
  assert.match(week.html, /in 7 days/);
  assert.match(week.html, /Devi &lt;b&gt;/);
  assert.match(week.html, /https:\/\/sing\.withamma\.com\/pay/);
  const tomorrow = renderRenewalReminder({ daysLeft: 1, validUntil: "November 8, 2026" });
  assert.match(tomorrow.text, /ends tomorrow/);
});

test("a failed reminder can be retried within its window by the 6-hourly job", () => {
  // Failed at 6.9 days left; the next run is 6 hours later.
  for (const left of [6.9, 1.0])
    assert.equal(reminderDue(NOW + left * DAY - 6 * 3600000, NOW), left > 6 ? "7d" : "1d");
});

// Loads engagement.js with in-memory Firebase, FCM and mail stand-ins.
function loadReminderJob({ pushResults }) {
  const fs = require("node:fs");
  const vm = require("node:vm");
  const tree = {};
  const parts = (path) => path.split("/").filter(Boolean);
  const read = (path) => parts(path).reduce((node, key) => (node == null ? undefined : node[key]), tree);
  const write = (path, value) => {
    const keys = parts(path);
    let node = tree;
    for (const key of keys.slice(0, -1)) node = node[key] = typeof node[key] === "object" && node[key] ? node[key] : {};
    if (value === undefined) delete node[keys.at(-1)];
    else node[keys.at(-1)] = value;
  };
  const ref = (path) => ({
    get: async () => ({ val: () => structuredClone(read(path) ?? null) }),
    remove: async () => write(path, undefined),
    update: async (values) => Object.entries(values).forEach(([key, value]) => write(`${path}/${key}`, value)),
    transaction: async (fn) => {
      const next = fn(read(path) ?? null);
      if (next === undefined) return { committed: false };
      write(path, next);
      return { committed: true };
    },
    orderByChild: () => ({ startAt: () => ({ endAt: () => ({ get: async () => ({ val: () => structuredClone(read(path)) }) }) }) }),
    child: (sub) => ref(`${path}/${sub}`),
  });
  const emails = [];
  const pushes = [];
  const modules = {
    "firebase-functions/v2/scheduler": { onSchedule: (_, fn) => fn },
    "firebase-functions/v2/https": { onCall: (_, fn) => fn, HttpsError: Error },
    "firebase-functions/params": { defineSecret: () => ({ value: () => "secret" }) },
    "firebase-functions/logger": { info() {}, warn() {}, error() {} },
    "firebase-admin/auth": { getAuth: () => ({ getUser: async (uid) => ({ uid, email: `${uid}@example.com` }) }) },
    "firebase-admin/database": { getDatabase: () => ({ ref: (path = "") => ref(path) }) },
    "firebase-admin/messaging": {
      getMessaging: () => ({
        sendEachForMulticast: async ({ tokens }) => {
          pushes.push([...tokens]);
          const outcome = pushResults.shift() || "success";
          const responses = tokens.map(() =>
            outcome === "success" ? { success: true } : { success: false, error: { code: outcome } },
          );
          return { successCount: responses.filter((r) => r.success).length, responses };
        },
      }),
    },
    "./mail": { renewalReminderEmail: async (args) => emails.push(args.email) },
  };
  const exports = {};
  vm.runInNewContext(fs.readFileSync(require.resolve("../src/engagement.js"), "utf8"), {
    exports,
    require: (name) => modules[name] || require(name),
    URL,
    structuredClone,
    Date,
  });
  return { run: exports.sendRenewalReminders, tree, emails, pushes, write };
}

test("a transient push failure is retried without resending the email", async () => {
  const job = loadReminderJob({ pushResults: ["messaging/server-unavailable", "success"] });
  job.write("paid/u1/expiresOn", Date.now() + 6.5 * DAY);
  job.write("messages/u1/tokens/tok-1", 1);

  await assert.rejects(job.run(), /will be retried/);
  assert.deepEqual(job.emails, ["u1@example.com"]);
  assert.equal(job.pushes.length, 1);

  await job.run();
  assert.deepEqual(job.emails, ["u1@example.com"], "email is not sent twice");
  assert.deepEqual(job.pushes, [["tok-1"], ["tok-1"]], "push is retried");

  await job.run();
  assert.equal(job.pushes.length, 2, "a delivered push is not repeated");
});
