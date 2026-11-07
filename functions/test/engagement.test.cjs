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
