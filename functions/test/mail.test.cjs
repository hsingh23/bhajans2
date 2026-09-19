const { test } = require("node:test");
const assert = require("node:assert/strict");
const mail = require("../src/mail.js");
const data = {
  email: "customer@example.com",
  name: "<Customer & family>",
  password: "NEVER-RENDER-THIS",
  resetLink: "https://example.com/reset?code=abc&lang=en",
  validUntil: "December 31, 2036",
  apiKey: "test",
};
test("welcome email uses compatible images, readable mobile layout, and a secure setup link", async () => {
  let payload;
  const original = global.fetch;
  global.fetch = async (_url, options) => {
    payload = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({ Messages: [{ Status: "success" }] }),
    };
  };
  try {
    await mail.newUserResetPasswordEmailShopify(data);
    const message = payload.Messages[0];
    assert.match(message.HTMLPart, /<img[^>]+amma_singing\.jpg/);
    assert.doesNotMatch(message.HTMLPart, /<amp-img|<script/);
    assert.doesNotMatch(message.HTMLPart, /NEVER-RENDER-THIS/);
    assert.match(message.HTMLPart, /Set your password/);
    assert.match(message.TextPart, /December 31, 2036/);
  } finally {
    global.fetch = original;
  }
});
test("activation email escapes names and includes account and expiration in text alternative", async () => {
  let payload;
  const original = global.fetch;
  global.fetch = async (_url, options) => {
    payload = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({ Messages: [{ Status: "success" }] }),
    };
  };
  try {
    await mail.accountActivated(data);
    assert.match(payload.Messages[0].HTMLPart, /&lt;Customer &amp; family&gt;/);
    assert.match(payload.Messages[0].TextPart, /customer@example.com/);
  } finally {
    global.fetch = original;
  }
});
test("email delivery failures are surfaced to the webhook", async () => {
  const original = global.fetch;
  global.fetch = async () => ({ ok: false, status: 503 });
  try {
    await assert.rejects(mail.accountActivated(data), /Mail delivery failed/);
  } finally {
    global.fetch = original;
  }
});

test("mobile hero is reduced and centered", async () => {
  let payload;
  const original = global.fetch;
  global.fetch = async (_url, options) => {
    payload = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({ Messages: [{ Status: "success" }] }),
    };
  };
  try {
    await mail.accountActivated(data);
    const html = payload.Messages[0].HTMLPart;
    assert.ok(html.includes("max-width:280px!important"));
    assert.ok(html.includes("margin-left:auto!important"));
    assert.ok(html.includes("margin-right:auto!important"));
    assert.ok(html.includes('align="center"'));
  } finally {
    global.fetch = original;
  }
});

test("email includes subscription and purchase date in HTML and plain text", async () => {
  let payload;
  const original = global.fetch;
  global.fetch = async (_url, options) => {
    payload = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({ Messages: [{ Status: "success" }] }),
    };
  };
  try {
    await mail.accountActivated({
      ...data,
      subscriptionName: "10-year subscription",
      purchasedOn: "September 10, 2026",
    });
    for (const body of [
      payload.Messages[0].HTMLPart,
      payload.Messages[0].TextPart,
    ]) {
      assert.ok(body.includes("10-year subscription"));
      assert.ok(body.includes("September 10, 2026"));
    }
  } finally {
    global.fetch = original;
  }
});
