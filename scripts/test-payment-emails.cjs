// Explicit smoke test: all recipients are replaced with the operator's address.
// Run: node --env-file=functions/.env.local scripts/test-payment-emails.cjs
const mail = require("../functions/src/mail.js");
const originalFetch = global.fetch;
const marker = `BHAJANS-TEST-${new Date().toISOString().replace(/[:.]/g, "-")}`;
global.fetch = async (url, options) => {
  if (url !== "https://api.mailjet.com/v3.1/send")
    throw new Error("Unexpected mail endpoint");
  const body = JSON.parse(options.body);
  for (const message of body.Messages) {
    message.To = [{ Email: "hisingh1@gmail.com", Name: "Harsh Singh" }];
    delete message.Bcc;
    delete message.Cc;
    message.Subject = `[${marker}] ${message.Subject}`;
    message.HTMLPart =
      `<p><strong>Deployment test only. No account or subscription was changed. ${marker}</strong></p>` +
      message.HTMLPart;
  }
  const response = await originalFetch(url, {
    ...options,
    body: JSON.stringify(body),
  });
  const result = await response.clone().json();
  if (
    !response.ok ||
    result.Messages?.some((message) => message.Status !== "success")
  ) {
    throw new Error(`Mailjet rejected test email (HTTP ${response.status})`);
  }
  console.log(
    JSON.stringify({
      marker,
      status: response.status,
      messageIds: result.Messages?.flatMap((message) =>
        message.To?.map((to) => to.MessageID),
      ),
    }),
  );
  return response;
};
(async () => {
  const data = {
    email: "hisingh1@gmail.com",
    name: "Harsh — deployment test",
    password: "TEST-ONLY-NOT-A-REAL-PASSWORD",
    resetLink: "https://sing.withamma.com/#/login",
    validUntil: "September 19, 2036 (test only)",
    apiKey: process.env.MAILJET_AUTH_HEADER,
    subscriptionName: "10-year subscription",
    purchasedOn: "September 19, 2026",
  };
  if (!data.apiKey) throw new Error("MAILJET_AUTH_HEADER is required");
  for (const type of [
    "newUserResetPasswordEmailShopify",
    "accountActivated",
    "newUserResetPasswordEmail",
  ]) {
    await mail[type]({
      ...data,
      ...(type === "newUserResetPasswordEmail"
        ? {
            subscriptionName: "1-year subscription · India",
            validUntil: "September 19, 2027 (test only)",
          }
        : {}),
    });
    console.log(`Sent ${type} test to hisingh1@gmail.com`);
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
