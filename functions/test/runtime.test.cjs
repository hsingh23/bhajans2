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
test("every firebase-admin export the handlers import exists in the installed SDK", () => {
  const source = require("node:fs").readFileSync(
    require.resolve("../src/index.js"),
    "utf8",
  );
  const imports = [
    ...source.matchAll(
      /const \{([^}]+)\} = require\("(firebase-admin[^"]*)"\);/g,
    ),
  ];
  assert.ok(imports.length > 0);
  assert.doesNotMatch(source, /require\("firebase-admin"\)/);
  for (const [, names, path] of imports)
    for (const name of names.split(",").map((n) => n.trim()))
      assert.equal(typeof require(path)[name], "function", `${path}.${name}`);
});
