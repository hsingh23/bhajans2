const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  aggregateDashboard,
  normalizePayment,
  summarizeRetention,
} = require("./analytics.cjs");
const now = Date.parse("2026-09-19T12:00:00Z");
const date = (value) => Date.parse(value + "T00:00:00Z");
const payment = (overrides = {}) => ({
  orderID: "order-a",
  mode: "live",
  manual: false,
  paidOn: date("2025-01-01"),
  expiresOn: date("2027-01-01"),
  gross_total_amount: { currency: "USD", value: "10.00" },
  ...overrides,
});
test("deduplicates historical/current orders, excludes grants and sandbox, separates currencies", () => {
  const result = aggregateDashboard(
    {
      paid: {
        a: payment(),
        b: payment({ orderID: "admin", manual: true }),
        c: payment({
          orderID: "eur",
          gross_total_amount: { currency: "EUR", value: "8" },
        }),
      },
      transactions: {
        a: { ...payment(), uid: "a" },
        test: { ...payment({ orderID: "test", mode: "sandbox" }), uid: "x" },
      },
    },
    now,
  );
  assert.equal(result.purchases.length, 2);
  assert.deepEqual(
    result.revenue.map((x) => [x.currency, x.amount]),
    [
      ["EUR", 8],
      ["USD", 10],
    ],
  );
  assert.equal(result.quality.duplicates, 1);
  assert.equal(result.summary.manualAccess, 1);
});
test("never infers a currency or counts Shopify list prices as cash revenue", () => {
  const result = aggregateDashboard(
    {
      paid: {
        s: payment({
          orderID: undefined,
          order_number: 25,
          gross_total_amount: undefined,
          line_items: [
            { variant_id: 37277000794276, price: "40.00", quantity: 1 },
          ],
        }),
      },
    },
    now,
  );
  assert.equal(result.revenue.length, 0);
  assert.equal(result.purchases[0].plan, "5 years");
  assert.equal(result.quality.missingAmounts, 1);
});
test("unknown dates and amounts remain unknown; no fabricated month or plan", () => {
  const item = normalizePayment(
    {
      orderID: "a",
      mode: "live",
      paidOn: "bad",
      expiresOn: null,
      gross_total_amount: { value: "", currency: "USD" },
    },
    "a",
    "paid",
  );
  assert.equal(item.paidOn, null);
  assert.equal(item.amount, null);
  assert.equal(item.plan, "Unknown");
});
test("current favorite counts are grouped by current access, including measured zero", () => {
  const result = aggregateDashboard(
    {
      paid: {
        a: payment(),
        b: payment({ orderID: "b", expiresOn: date("2026-09-01") }),
      },
      favorites: { a: { one: "1", two: "1", bad: false } },
    },
    now,
  );
  assert.equal(
    result.engagement.find((x) => x.status === "Active").meanFavorites,
    2,
  );
  assert.equal(
    result.engagement.find((x) => x.status === "Expired").meanFavorites,
    0,
  );
  assert.equal(result.summary.expired, 1);
  assert.equal(
    result.members.find((x) => x.uid === "b").favoritesAtChurn,
    null,
  );
});
test("renewal evidence means multiple distinct recorded purchases, not a manual extension", () => {
  const result = aggregateDashboard(
    {
      paid: { a: payment({ orderID: "new", paidOn: date("2026-01-01") }) },
      transactions: { old: { ...payment(), uid: "a" } },
    },
    now,
  );
  assert.equal(result.summary.repeatBuyers, 1);
  assert.equal(result.members[0].recordedPurchases, 2);
  assert.equal(
    result.purchases.find((x) => x.orderKey === "payment:new").purchaseKind,
    "Repeat recorded purchase",
  );
});
test("conflicting duplicate amounts are excluded rather than silently choosing a value", () => {
  const result = aggregateDashboard(
    {
      paid: { a: payment() },
      transactions: {
        a: {
          ...payment({ gross_total_amount: { currency: "USD", value: "20" } }),
          uid: "a",
        },
      },
    },
    now,
  );
  assert.equal(result.quality.conflicts, 1);
  assert.equal(result.revenue.length, 0);
});
test("future dates and invalid negative amounts do not become historic revenue", () => {
  const result = aggregateDashboard(
    {
      paid: {
        a: payment({ paidOn: date("2027-01-01") }),
        b: payment({
          orderID: "b",
          gross_total_amount: { currency: "USD", value: "-4" },
        }),
      },
    },
    now,
  );
  assert.equal(result.revenue.length, 0);
});
test("empty data produces null engagement average and no made-up revenue series", () => {
  const result = aggregateDashboard({}, now);
  assert.equal(result.summary.active, 0);
  assert.deepEqual(result.revenue, []);
  assert.equal(result.engagement[0].meanFavorites, null);
});
test("monthly retention requires near-boundary snapshots; cohort loss is not cancellation", () => {
  const snapshots = {
    "2026-08-01": {
      observedAt: date("2026-08-01"),
      members: {
        a: { active: true, favorites: 3 },
        b: { active: true, favorites: 0 },
      },
    },
    "2026-09-01": {
      observedAt: date("2026-09-01"),
      members: {
        a: { active: false, favorites: 5 },
        b: { active: true, favorites: 1 },
        c: { active: true, favorites: 2 },
      },
    },
  };
  const result = summarizeRetention(snapshots, now);
  assert.equal(result[0].openingActive, 2);
  assert.equal(result[0].lost, 1);
  assert.equal(result[0].retentionRate, 0.5);
  assert.deepEqual(
    summarizeRetention({ "2026-08-15": snapshots["2026-08-01"] }, now),
    [],
  );
});
test("WooCommerce renewal never reuses preserved Shopify line items or legacy money", () => {
  const result = aggregateDashboard(
    {
      paid: {
        a: payment({
          orderID: "wc_order_new",
          order_number: 123,
          line_items: [
            {
              variant_id: 37277000794276,
              quantity: 1,
              price_set: {
                presentment_money: { amount: "40", currency_code: "USD" },
              },
              total_discount_set: {
                presentment_money: { amount: "0", currency_code: "USD" },
              },
            },
          ],
        }),
      },
    },
    now,
  );
  assert.equal(result.purchases[0].orderKey, "payment:wc_order_new");
  assert.equal(result.purchases[0].plan, "1 year");
  assert.equal(result.revenue.length, 0);
});
test("Shopify estimates respect customer currency, quantity, discounts and exclude other products", () => {
  const line = {
    variant_id: 37277000728740,
    quantity: 2,
    price_set: { presentment_money: { amount: "9", currency_code: "EUR" } },
    total_discount_set: {
      presentment_money: { amount: "2", currency_code: "EUR" },
    },
  };
  const result = aggregateDashboard(
    {
      paid: {
        a: payment({
          orderID: undefined,
          order_number: 456,
          line_items: [line, { ...line, variant_id: 999 }],
        }),
      },
    },
    now,
  );
  assert.deepEqual(
    result.revenue.map((x) => [x.currency, x.amount, x.basis]),
    [["EUR", 16, "Shopify merchandise estimate"]],
  );
});
test("unknown closing state suppresses retention rate", () => {
  const result = summarizeRetention(
    {
      "2026-08-01": {
        observedAt: date("2026-08-01"),
        members: { a: { active: true } },
      },
      "2026-09-01": {
        observedAt: date("2026-09-01"),
        members: { a: { active: null } },
      },
    },
    now,
  );
  assert.equal(result[0].retentionRate, null);
  assert.equal(result[0].unknown, 1);
});
test("malformed optional metadata cannot crash the whole dashboard", () => {
  const result = aggregateDashboard(
    {
      paid: {
        a: {
          orderID: 123,
          line_items: { bad: true },
          expiresOn: date("2027-01-01"),
          mode: "live",
        },
      },
    },
    now,
  );
  assert.equal(result.quality.missingOrderIds, 1);
  assert.equal(result.members[0].plan, "Unknown");
});
test("conflicting Shopify merchandise estimates are excluded", () => {
  const line = (amount) => ({
    variant_id: 37277000728740,
    quantity: 1,
    price_set: { presentment_money: { amount, currency_code: "EUR" } },
    total_discount_set: {
      presentment_money: { amount: "0", currency_code: "EUR" },
    },
  });
  const result = aggregateDashboard(
    {
      paid: { a: payment({ order_number: 10, line_items: [line("12")] }) },
      transactions: {
        a: {
          ...payment({ order_number: 10, line_items: [line("10")] }),
          uid: "a",
        },
      },
    },
    now,
  );
  assert.equal(result.quality.conflicts, 1);
  assert.equal(result.revenue.length, 0);
});
test("new access-only admin grants are manual without relabeling older purchases", () => {
  const result = aggregateDashboard(
    {
      paid: {
        grant: {
          expiresOn: date("2027-01-01"),
          accessUpdatedOn: date("2026-09-01"),
          accessUpdatedBy: "admin",
        },
        buyer: payment({
          accessUpdatedOn: date("2026-09-01"),
          accessUpdatedBy: "admin",
        }),
      },
    },
    now,
  );
  assert.equal(result.summary.manualAccess, 1);
  assert.equal(
    result.members.find((row) => row.uid === "grant").plan,
    "Manual grant",
  );
  assert.equal(
    result.members.find((row) => row.uid === "buyer").manual,
    false,
  );
  assert.equal(result.revenue[0].amount, 10);
});
