const APP_URL = "https://sing.withamma.com/#/login";
const IMAGE_URL = "https://sing.withamma.com/email-images/amma_singing.jpg";
const GUIDE_URL =
  "https://scribehow.com/shared/Sing_With_Amma_Guide__t3Z6fF91QFiQUEqxZfKGHQ";
const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );

async function sendAccountEmail(
  {
    email,
    name,
    resetLink,
    validUntil,
    apiKey,
    subscriptionName = "Subscription access",
    purchasedOn = "Not recorded",
  },
  { welcome = false, india = false } = {},
) {
  const title = welcome
    ? "Welcome to Sing with Amma"
    : "Your next bhajan awaits";
  const greeting = name ? `Dear ${escapeHtml(name)},` : "Dear friend,";
  const intro = welcome
    ? "Your account is ready. Discover Amma’s bhajans, open the lyrics and sheet music, and make space for a little more music in your day."
    : "Your subscription is active. Your favorite bhajans, lyrics, and sheet music are ready whenever you are.";
  const cta = welcome ? "Set your password" : "Open Sing with Amma";
  const actionUrl = welcome ? resetLink : APP_URL;
  if (!actionUrl || !/^https:\/\//.test(actionUrl))
    throw new Error("A secure account link is required");
  const safeEmail = escapeHtml(email);
  const safeDate = escapeHtml(validUntil);
  const safeSubscription = escapeHtml(subscriptionName);
  const safePurchaseDate = escapeHtml(purchasedOn);
  const regionNote = india
    ? `<div style="margin-top:24px;padding:16px;background:#fff5e8;border-left:3px solid #b95325;font-size:14px;line-height:1.65;color:#684328;"><strong>Your India subscription</strong><br>This subscription is for use in India. For access elsewhere, please visit <a href="https://theammashop.org/products/sing-with-amma-bhajan-lyrics-app" style="color:#9a3f1c;">The Amma Shop</a>.</div><p lang="hi" style="font-size:15px;line-height:1.7;color:#665a50;">सिंग विथ अम्मा में आपका स्वागत है। अम्मा के भजनों से जुड़ें।</p><p lang="ml" style="font-size:15px;line-height:1.7;color:#665a50;">സിംഗ് വിത്ത് അമ്മയിലേക്ക് സ്വാഗതം. അമ്മയുടെ ഭജനകളുമായി ബന്ധപ്പെടാം.</p>`
    : "";
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${title}</title>
<style>@media only screen and (max-width:620px){.outer{padding:12px 8px!important}.content{padding:28px 24px!important}.headline{font-size:29px!important}.hero{width:78%!important;max-width:280px!important;height:auto!important;margin-left:auto!important;margin-right:auto!important}.button{display:block!important;text-align:center!important}}</style></head>
<body style="margin:0;padding:0;background:#f4efe7;color:#342b24;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your access is active through ${safeDate}. Welcome to a world of bhajans.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4efe7;"><tr><td class="outer" align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fffdf9;border:1px solid #e7ded2;border-radius:12px;overflow:hidden;">
<tr><td style="padding:24px 28px;text-align:center;border-bottom:1px solid #e7ded2;"><p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:26px;color:#57361f;">Sing with Amma</p><p style="margin:6px 0 0;font-size:11px;letter-spacing:2px;color:#8a6348;">BHAJANS · LYRICS · SHEET MUSIC</p></td></tr>
<tr><td align="center" style="text-align:center;background:#f6f0e7;"><img class="hero" src="${IMAGE_URL}" alt="Amma singing with a gathering of devotees" width="600" height="337" style="display:block;width:100%;max-width:600px;height:auto;border:0;"></td></tr>
<tr><td class="content" style="padding:36px 40px;">
<p style="margin:0 0 12px;font-size:11px;letter-spacing:1.8px;font-weight:bold;color:#a34d27;">YOUR SUBSCRIPTION IS ACTIVE</p>
<h1 class="headline" style="margin:0 0 24px;font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:1.18;font-weight:normal;color:#432c1e;">${title}</h1>
<p style="margin:0 0 12px;font-size:16px;line-height:1.7;">${greeting}</p>
<p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#65594e;">${intro}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f0e7;border:1px solid #e9ddcd;border-radius:8px;"><tr><td style="padding:20px 22px;">
<p style="margin:0 0 5px;font-size:11px;letter-spacing:1.2px;color:#82674f;">YOUR ACCOUNT</p><p style="margin:0 0 18px;font-size:16px;line-height:1.5;overflow-wrap:anywhere;word-break:break-word;color:#342b24;">${safeEmail}</p>
<p style="margin:0 0 5px;font-size:11px;letter-spacing:1.2px;color:#82674f;">YOUR SUBSCRIPTION</p><p style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:21px;line-height:1.4;color:#57361f;">${safeSubscription}</p>
<p style="margin:0 0 5px;font-size:11px;letter-spacing:1.2px;color:#82674f;">PURCHASED ON</p><p style="margin:0 0 18px;font-size:16px;line-height:1.5;color:#342b24;">${safePurchaseDate}</p>
<p style="margin:0 0 5px;font-size:11px;letter-spacing:1.2px;color:#82674f;">ACCESS THROUGH</p><p style="margin:0;font-size:18px;line-height:1.5;font-weight:bold;color:#57361f;">${safeDate}</p>
</td></tr></table>
<p style="margin:28px 0 18px;"><a class="button" href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#a9441d;border:1px solid #a9441d;border-radius:6px;padding:15px 24px;color:#ffffff;font-size:16px;font-weight:bold;line-height:1.4;text-decoration:none;">${cta} &rarr;</a></p>
<p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#74685c;">${welcome ? `Choose your password using the button above. You can also <a href="${APP_URL}" style="color:#9a3f1c;">sign in with an email magic link</a> — no password needed.` : `Sign in with the email address shown above. You can request a magic link from the sign-in page.`}</p>
<p style="margin:0;font-size:14px;line-height:1.7;color:#74685c;">New to the app? <a href="${GUIDE_URL}" style="color:#9a3f1c;">Read the getting-started guide</a>.</p>
${regionNote}
<div style="margin:32px 0 0;padding-top:28px;border-top:1px solid #eadfd2;text-align:center;">
<p style="margin:0 0 18px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.8;color:#756351;">Thank you for supporting<br><strong style="font-weight:normal;color:#57361f;">Amma’s charities.</strong></p>
<p style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-size:30px;font-style:italic;line-height:1.3;color:#754123;">Happy singing.</p>
<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:1.4px;line-height:1.8;text-transform:uppercase;color:#8a7059;">The Sing with Amma team</p>
</div>
</td></tr></table>
<p style="max-width:520px;margin:20px auto 0;font-size:12px;line-height:1.7;color:#87786a;text-align:center;">You’re receiving this email because your Sing with Amma subscription was activated.<br>Need a hand? <a href="mailto:hisingh1@gmail.com" style="color:#73563f;">Contact support</a> · <a href="https://sing.withamma.com/" style="color:#73563f;">sing.withamma.com</a></p>
</td></tr></table></body></html>`;
  const text = `${title}\n\n${name ? `Dear ${name},` : "Dear friend,"}\n\n${intro}\n\nYour account: ${email}\nSubscription: ${subscriptionName}\nPurchased on: ${purchasedOn}\nAccess through: ${validUntil}\n\n${cta}: ${actionUrl}\n\nSign in with an email magic link: ${APP_URL}\nGetting-started guide: ${GUIDE_URL}${india ? "\n\nThis subscription is for use in India. For international access, visit https://theammashop.org/products/sing-with-amma-bhajan-lyrics-app" : ""}\n\nThank you for supporting Amma’s charities. Happy singing!\nThe Sing with Amma team\nSupport: hisingh1@gmail.com`;
  const response = await fetch("https://api.mailjet.com/v3.1/send", {
    method: "POST",
    headers: { Authorization: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      Messages: [
        {
          From: { Email: "no-reply@withamma.com", Name: "Sing with Amma" },
          To: [{ Email: email, Name: name || email }],
          Bcc: [
            {
              Email: india
                ? "hisingh1+SingWithAmmaIndia@gmail.com"
                : "hisingh1+SingWithAmmaShopify@gmail.com",
              Name: india ? "SingWithAmma India" : "SingWithAmma Shopify",
            },
          ],
          Subject: welcome
            ? "Sing with Amma, account created and subscription activated"
            : "Sing with Amma, Account Activated",
          HTMLPart: html,
          TextPart: text,
        },
      ],
    }),
  });
  if (!response.ok)
    throw new Error(`Mail delivery failed (${response.status})`);
  const result = await response.json();
  if (
    !result.Messages?.length ||
    result.Messages.some((message) => message.Status !== "success")
  )
    throw new Error("Mail delivery failed: provider rejected message");
}
exports.newUserResetPasswordEmailShopify = (data) =>
  sendAccountEmail(data, { welcome: true });
exports.newUserResetPasswordEmail = (data) =>
  sendAccountEmail(data, { welcome: true, india: true });
exports.accountActivated = (data) => sendAccountEmail(data);
