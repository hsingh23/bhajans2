const { test } = require("node:test");
const assert = require("node:assert/strict");
test("actual production modules load and expose all payment handlers and mail functions", () => {
  const handlers = require("../src/index.js");
  for (const name of [
    "amritabooks",
    "manuallyAddUser",
    "paidNotification",
    "shopifyWebhook",
  ]) {
    assert.equal(typeof handlers[name], "function");
    assert.equal(
      handlers[name].__endpoint.serviceAccountEmail,
      "bhajans-588f5@appspot.gserviceaccount.com",
      `${name} must retain its Firebase database-authorized identity`,
    );
  }
  const mail = require("../src/mail.js");
  for (const name of [
    "newUserResetPasswordEmail",
    "newUserResetPasswordEmailShopify",
    "accountActivated",
  ])
    assert.equal(typeof mail[name], "function");
});
