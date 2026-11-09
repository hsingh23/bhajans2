const { test } = require("node:test");
const assert = require("node:assert/strict");
const { token, validToken, unsubscribeUrl, handleUnsubscribe } = require("../src/unsubscribe.js");

const SECRET = "test-secret";

function fakeDb() {
  const data = {};
  return {
    data,
    ref: (path) => ({
      get: async () => ({ exists: () => path in data }),
      set: async (value) => void (data[path] = value),
      remove: async () => void delete data[path],
    }),
  };
}
function fakeRes() {
  const res = { statusCode: 0, body: "", headers: {} };
  res.set = (k, v) => ((res.headers[k] = v), res);
  res.status = (code) => ((res.statusCode = code), res);
  res.send = (body) => ((res.body = body), res);
  return res;
}
const run = async (req, db) => {
  const res = fakeRes();
  await handleUnsubscribe({ query: {}, body: {}, ...req }, res, { secret: SECRET, db, now: 42 });
  return res;
};

test("tokens are per uid and checked in constant time", () => {
  assert.ok(validToken("uid1", token("uid1", SECRET), SECRET));
  assert.equal(validToken("uid2", token("uid1", SECRET), SECRET), false);
  assert.equal(validToken("uid1", "short", SECRET), false);
  assert.equal(validToken("../admin", token("../admin", SECRET), SECRET), false);
  const url = new URL(unsubscribeUrl("uid1", SECRET));
  assert.equal(url.searchParams.get("u"), "uid1");
  assert.equal(url.searchParams.get("t"), token("uid1", SECRET));
});

test("opening the link only shows a confirm page; it never unsubscribes", async () => {
  const db = fakeDb();
  const res = await run({ method: "GET", query: { u: "uid1", t: token("uid1", SECRET) } }, db);
  assert.equal(res.statusCode, 200);
  assert.match(res.body, /Unsubscribe from Sing with Amma news\?/);
  assert.deepEqual(db.data, {});
  assert.equal(res.headers["Cache-Control"], "no-store");
});

test("a forged or missing token changes nothing", async () => {
  const db = fakeDb();
  const res = await run({ method: "POST", body: { u: "uid1", t: token("uid2", SECRET), action: "unsubscribe" } }, db);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(db.data, {});
});

test("one-click POST from the mail client records the opt-out", async () => {
  const db = fakeDb();
  const res = await run(
    { method: "POST", query: { u: "uid1", t: token("uid1", SECRET) }, body: { "List-Unsubscribe": "One-Click" } },
    db,
  );
  assert.equal(res.statusCode, 200);
  assert.deepEqual(db.data["emailOptOut/uid1"], { at: 42, source: "one-click" });
});

test("the page's buttons unsubscribe and subscribe again", async () => {
  const db = fakeDb();
  const t = token("uid1", SECRET);
  await run({ method: "POST", body: { u: "uid1", t, action: "unsubscribe" } }, db);
  assert.deepEqual(db.data["emailOptOut/uid1"], { at: 42, source: "page" });
  const again = await run({ method: "GET", query: { u: "uid1", t } }, db);
  assert.match(again.body, /Subscribe again/);
  await run({ method: "POST", body: { u: "uid1", t, action: "resubscribe" } }, db);
  assert.deepEqual(db.data, {});
});
