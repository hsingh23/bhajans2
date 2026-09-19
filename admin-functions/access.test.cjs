const { test } = require("node:test");
const assert = require("node:assert/strict");
const { expirationFor } = require("./access.cjs");
const now = Date.parse("2026-09-19T12:00:00Z");
test("active subscription extends from existing expiration", () => {
  assert.equal(
    expirationFor(
      { expiresOn: Date.parse("2030-03-01T00:00:00Z") },
      { mode: "years", years: 10 },
      now,
    ),
    Date.parse("2040-03-01T00:00:00Z"),
  );
});
test("expired or missing subscriptions extend from now", () => {
  for (const current of [null, {}, { expiresOn: 1 }])
    assert.equal(
      expirationFor(current, { mode: "years", years: 1 }, now),
      Date.parse("2027-09-19T12:00:00Z"),
    );
});
test("leap-day anniversary clamps to February 28", () => {
  assert.equal(
    expirationFor(
      null,
      { mode: "years", years: 1 },
      Date.parse("2024-02-29T10:00:00Z"),
    ),
    Date.parse("2025-02-28T10:00:00Z"),
  );
});
test("explicit date lasts through end of UTC day", () => {
  assert.equal(
    expirationFor(null, { mode: "date", date: "2031-12-25" }, now),
    Date.parse("2031-12-25T23:59:59.999Z"),
  );
});
test("invalid, fractional and unbounded years are rejected", () => {
  for (const years of [0, -1, 1.5, "2", 101, NaN])
    assert.throws(() => expirationFor(null, { mode: "years", years }, now));
});
test("invalid and past dates are rejected", () => {
  for (const date of ["2027-02-30", "2026-09-18", "bad", "2027-1-1"])
    assert.throws(() => expirationFor(null, { mode: "date", date }, now));
});
