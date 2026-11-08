const APP_URL = "https://sing.withamma.com/login";
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

// Sign-in (magic link) and password reset emails, sent instead of Firebase's
// plain default templates. Same look as the account emails above.
const AUTH_COPY = {
  signin: {
    subject: "Your Sing with Amma sign-in link",
    preheader: "Tap the button to sign in. The link works once and expires in an hour.",
    eyebrow: "SIGN IN",
    title: "Welcome back",
    intro: "Tap the button below to sign in to Sing with Amma. No password needed.",
    cta: "Sign in to Sing with Amma",
    note: "For your security, this link works once and expires in an hour. Open it on the device where you asked for it, or you’ll be asked to confirm your email.",
    ignore: "Didn’t ask to sign in? You can safely ignore this email; nobody can sign in without this link.",
  },
  reset: {
    subject: "Reset your Sing with Amma password",
    preheader: "Choose a new password. The link expires in an hour.",
    eyebrow: "PASSWORD RESET",
    title: "Let’s get you back in",
    intro: "We received a request to reset the password for your Sing with Amma account. Choose a new one with the button below.",
    cta: "Choose a new password",
    note: "This link expires in an hour. Prefer not to use a password at all? You can always sign in with an email magic link from the sign-in page.",
    ignore: "Didn’t ask for this? You can safely ignore this email; your password stays the same.",
  },
};

function renderAuthEmail({ email, link, type }) {
  const copy = AUTH_COPY[type];
  if (!copy) throw new Error(`Unknown auth email type: ${type}`);
  if (!link || !/^https:\/\//.test(link)) throw new Error("A secure link is required");
  const safeLink = escapeHtml(link);
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${copy.subject}</title>
<style>@media only screen and (max-width:620px){.outer{padding:12px 8px!important}.content{padding:28px 24px!important}.headline{font-size:28px!important}.button{display:block!important;text-align:center!important}}</style></head>
<body style="margin:0;padding:0;background:#f4efe7;color:#342b24;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${copy.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4efe7;"><tr><td class="outer" align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fffdf9;border:1px solid #e7ded2;border-radius:12px;overflow:hidden;">
<tr><td style="padding:24px 28px;text-align:center;border-bottom:1px solid #e7ded2;"><p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:26px;color:#57361f;">Sing with Amma</p><p style="margin:6px 0 0;font-size:11px;letter-spacing:2px;color:#8a6348;">BHAJANS · LYRICS · SHEET MUSIC</p></td></tr>
<tr><td class="content" style="padding:36px 40px;">
<p style="margin:0 0 12px;font-size:11px;letter-spacing:1.8px;font-weight:bold;color:#a34d27;">${copy.eyebrow}</p>
<h1 class="headline" style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:32px;line-height:1.2;font-weight:normal;color:#432c1e;">${copy.title}</h1>
<p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#65594e;">${copy.intro}</p>
<p style="margin:0 0 6px;font-size:11px;letter-spacing:1.2px;color:#82674f;">FOR</p>
<p style="margin:0 0 26px;font-size:16px;line-height:1.5;overflow-wrap:anywhere;word-break:break-word;color:#342b24;">${escapeHtml(email)}</p>
<p style="margin:0 0 26px;"><a class="button" href="${safeLink}" style="display:inline-block;background:#a9441d;border:1px solid #a9441d;border-radius:6px;padding:15px 26px;color:#ffffff;font-size:16px;font-weight:bold;line-height:1.4;text-decoration:none;">${copy.cta} &rarr;</a></p>
<p style="margin:0 0 18px;font-size:14px;line-height:1.7;color:#74685c;">${copy.note}</p>
<p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#87786a;">Button not working? Copy this link into your browser:</p>
<p style="margin:0 0 24px;font-size:12px;line-height:1.6;overflow-wrap:anywhere;word-break:break-all;"><a href="${safeLink}" style="color:#9a3f1c;">${safeLink}</a></p>
<div style="margin:8px 0 0;padding-top:24px;border-top:1px solid #eadfd2;">
<p style="margin:0 0 16px;font-size:13px;line-height:1.7;color:#87786a;">${copy.ignore}</p>
<p style="margin:0 0 6px;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-style:italic;color:#754123;">Happy singing.</p>
<p style="margin:0;font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:#8a7059;">The Sing with Amma team</p>
</div>
</td></tr></table>
<p style="max-width:520px;margin:20px auto 0;font-size:12px;line-height:1.7;color:#87786a;text-align:center;">Need a hand? <a href="mailto:hisingh1@gmail.com" style="color:#73563f;">Contact support</a> · <a href="https://sing.withamma.com/" style="color:#73563f;">sing.withamma.com</a></p>
</td></tr></table></body></html>`;
  const text = `${copy.title}\n\n${copy.intro}\n\nFor: ${email}\n\n${copy.cta}: ${link}\n\n${copy.note}\n\n${copy.ignore}\n\nHappy singing!\nThe Sing with Amma team\nSupport: hisingh1@gmail.com`;
  return { subject: copy.subject, html, text };
}

async function sendAuthEmail({ email, link, type, apiKey }) {
  const { subject, html, text } = renderAuthEmail({ email, link, type });
  const response = await fetch("https://api.mailjet.com/v3.1/send", {
    method: "POST",
    headers: { Authorization: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      Messages: [
        {
          From: { Email: "no-reply@withamma.com", Name: "Sing with Amma" },
          To: [{ Email: email }],
          Subject: subject,
          HTMLPart: html,
          TextPart: text,
        },
      ],
    }),
  });
  if (!response.ok) throw new Error(`Mail delivery failed (${response.status})`);
  const result = await response.json();
  if (!result.Messages?.length || result.Messages.some((m) => m.Status !== "success"))
    throw new Error("Mail delivery failed: provider rejected message");
}
exports.renderAuthEmail = renderAuthEmail;
exports.sendAuthEmail = sendAuthEmail;

// Renewal reminder, sent 7 days and 1 day before a subscription ends.
function renderRenewalReminder({ name, daysLeft, validUntil }) {
  const when = daysLeft === 1 ? "tomorrow" : `in ${daysLeft} days`;
  const title = daysLeft === 1 ? "Your access ends tomorrow" : "A week left on your access";
  const greeting = name ? `Dear ${escapeHtml(name)},` : "Dear friend,";
  const payUrl = "https://sing.withamma.com/pay";
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f4efe7;color:#342b24;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your Sing with Amma access ends ${when}, on ${escapeHtml(validUntil)}.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4efe7;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fffdf9;border:1px solid #e7ded2;border-radius:12px;overflow:hidden;">
<tr><td style="padding:24px 28px;text-align:center;border-bottom:1px solid #e7ded2;"><p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:26px;color:#57361f;">Sing with Amma</p></td></tr>
<tr><td style="padding:36px 40px;">
<p style="margin:0 0 12px;font-size:11px;letter-spacing:1.8px;font-weight:bold;color:#a34d27;">RENEWAL REMINDER</p>
<h1 style="margin:0 0 24px;font-family:Georgia,'Times New Roman',serif;font-size:32px;line-height:1.2;font-weight:normal;color:#432c1e;">${title}</h1>
<p style="margin:0 0 12px;font-size:16px;line-height:1.7;">${greeting}</p>
<p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#65594e;">Your access to the lyrics and sheet music ends ${when}, on <strong>${escapeHtml(validUntil)}</strong>. Renew now to keep singing without a break. Every subscription supports Amma’s charities.</p>
<p style="margin:0 0 24px;"><a href="${payUrl}" style="display:inline-block;background:#a9441d;border:1px solid #a9441d;border-radius:6px;padding:15px 24px;color:#ffffff;font-size:16px;font-weight:bold;text-decoration:none;">Renew my subscription &rarr;</a></p>
<p style="margin:0;font-size:14px;line-height:1.7;color:#74685c;">Already renewed? Thank you, and please ignore this note.</p>
</td></tr></table>
<p style="max-width:520px;margin:20px auto 0;font-size:12px;line-height:1.7;color:#87786a;text-align:center;">You’re receiving this because your Sing with Amma subscription is ending soon.<br>Need a hand? <a href="mailto:hisingh1@gmail.com" style="color:#73563f;">Contact support</a></p>
</td></tr></table></body></html>`;
  const text = `${title}\n\n${name ? `Dear ${name},` : "Dear friend,"}\n\nYour access to the lyrics and sheet music ends ${when}, on ${validUntil}. Renew to keep singing without a break: ${payUrl}\n\nAlready renewed? Thank you, and please ignore this note.\nThe Sing with Amma team`;
  return { subject: `Sing with Amma: ${title.toLowerCase()}`, html, text };
}

async function renewalReminderEmail({ email, name, daysLeft, validUntil, apiKey }) {
  const { subject, html, text } = renderRenewalReminder({ name, daysLeft, validUntil });
  const response = await fetch("https://api.mailjet.com/v3.1/send", {
    method: "POST",
    headers: { Authorization: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      Messages: [
        {
          From: { Email: "no-reply@withamma.com", Name: "Sing with Amma" },
          To: [{ Email: email, Name: name || email }],
          Subject: subject,
          HTMLPart: html,
          TextPart: text,
        },
      ],
    }),
  });
  if (!response.ok) throw new Error(`Mail delivery failed (${response.status})`);
  const result = await response.json();
  if (!result.Messages?.length || result.Messages.some((m) => m.Status !== "success"))
    throw new Error("Mail delivery failed: provider rejected message");
}
exports.renderRenewalReminder = renderRenewalReminder;
exports.renewalReminderEmail = renewalReminderEmail;
