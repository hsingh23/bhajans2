const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

// Loads functions/src/index.js with a map-backed database and counts the emails sendAuthEmail sends.
function load() {
  const data = new Map();
  const database = {
    ref: (path) => ({
      transaction: async (fn) => {
        const next = fn(data.has(path) ? structuredClone(data.get(path)) : null);
        if (next === undefined) return { committed: false };
        data.set(path, next);
        return { committed: true, snapshot: { val: () => next } };
      },
      get: async () => ({ val: () => data.get(path) ?? null }),
    }),
  };
  const sent = [];
  const logs = [];
  class HttpsError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
    }
  }
  const modules = {
    "firebase-functions/logger": {
      info: (m, d) => logs.push({ level: "info", m, d }),
      warn: (m, d) => logs.push({ level: "warn", m, d }),
      error: (m, d) => logs.push({ level: "error", m, d }),
    },
    "firebase-functions/v2/https": { onRequest: (_, fn) => fn, onCall: (_, fn) => fn, HttpsError },
    "firebase-functions/v2/database": { onValueWritten: (_, fn) => fn },
    "firebase-functions/params": { defineSecret: () => ({ value: () => "test-secret" }) },
    "firebase-admin/app": { initializeApp() {} },
    "firebase-admin/auth": {
      getAuth: () => ({
        generateSignInWithEmailLink: async () => "https://sing.withamma.com/login?oobCode=x",
        generatePasswordResetLink: async () => "https://sing.withamma.com/login?oobCode=y",
      }),
    },
    "firebase-admin/database": { getDatabase: () => database },
    "firebase-admin/messaging": { getMessaging: () => ({}) },
    "./engagement": {
      ga4ApiSecret: { value: () => "test-secret" },
      recordGa4Purchase: async () => true,
      sendRenewalReminders: () => {},
      sendAnnouncement: () => {},
    },
    "./mail": { sendAuthEmail: async (msg) => sent.push(msg) },
  };
  const exports = {};
  vm.runInNewContext(fs.readFileSync(require.resolve("../src/index.js"), "utf8"), {
    require: (name) => modules[name] || require(name),
    exports,
    console,
    Buffer,
    structuredClone,
    URL,
  });
  const call = (email, type = "signin") =>
    exports.sendAuthEmail({ data: { email, type, continueUrl: "https://sing.withamma.com/login" } });
  return { exports, call, sent, logs, data };
}

test("a second email to the same address within a minute is refused and not sent", async () => {
  const { call, sent } = load();
  assert.equal((await call("a@example.com")).sent, true);
  await assert.rejects(call("A@Example.com "), { code: "resource-exhausted" });
  await assert.rejects(call("a@example.com", "reset"), { code: "resource-exhausted" });
  assert.equal(sent.length, 1);
});

test("twenty calls for one address send one email", async () => {
  const { call, sent } = load();
  const results = await Promise.allSettled(Array.from({ length: 20 }, () => call("victim@example.com")));
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(sent.length, 1);
});

test("an address gets at most five emails an hour, one a minute", async () => {
  const { exports } = load();
  const start = Date.UTC(2026, 10, 8, 10, 0, 0);
  const take = (minutes) => exports.takeAuthEmailSlot("b@example.com", start + minutes * 60000);
  assert.equal(await take(0), null);
  assert.equal(await take(0.5), "recipient"); // within the minute
  for (const m of [1, 2, 3, 4]) assert.equal(await take(m), null);
  assert.equal(await take(5), "recipient"); // sixth in the hour
  assert.equal(await take(61), null); // the first one has aged out
});

test("other addresses are unaffected by one address's limit", async () => {
  const { call, sent } = load();
  await call("c@example.com");
  await assert.rejects(call("c@example.com"), { code: "resource-exhausted" });
  assert.equal((await call("d@example.com")).sent, true);
  assert.equal(sent.length, 2);
});

test("over the hourly total the branded sender reports unavailable so the app falls back", async () => {
  const { exports, call, sent, data } = load();
  const hour = Math.floor(Date.now() / 3600000);
  data.set(`authEmailLimits/total/${hour}`, 200);
  await assert.rejects(call("e@example.com"), { code: "unavailable" });
  assert.equal(sent.length, 0);
  assert.equal(await exports.takeAuthEmailSlot("f@example.com", (hour + 1) * 3600000), null);
});

test("refused calls for one address do not use up the hourly total", async () => {
  const { call, data } = load();
  await call("g@example.com");
  for (let i = 0; i < 10; i++) await assert.rejects(call("g@example.com"), { code: "resource-exhausted" });
  const hour = Math.floor(Date.now() / 3600000);
  assert.ok(data.get(`authEmailLimits/total/${hour}`) <= 2);
});

test("limits are stored under hashed keys, never the address", async () => {
  const { call, data } = load();
  await call("private.person@example.com");
  const keys = [...data.keys()].join(" ");
  assert.ok(!keys.includes("private"), keys);
  assert.ok(keys.includes("authEmailLimits/to/"), keys);
});
