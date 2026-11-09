// One-click unsubscribe for campaign emails. Each link carries the account's
// uid and an HMAC of it, so only the person we emailed can opt that account out.
//
//   GET  /unsubscribe?u=<uid>&t=<token>   confirmation page (link scanners only GET,
//                                          so opening the page never unsubscribes)
//   POST same URL, body List-Unsubscribe=One-Click   RFC 8058 one-click from Gmail/Yahoo
//   POST same URL, body action=unsubscribe|resubscribe   the page's buttons
//
// Opt-outs live at emailOptOut/<uid> = { at, source }; scripts/send-campaign.cjs skips them.

const crypto = require("node:crypto");

const FUNCTION_URL = "https://us-central1-bhajans-588f5.cloudfunctions.net/unsubscribe";
const UID = /^[A-Za-z0-9_-]{1,128}$/;

const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
  );

function token(uid, secret) {
  if (!secret) throw new Error("Unsubscribe secret missing");
  return crypto.createHmac("sha256", secret).update(`unsubscribe:${uid}`).digest("base64url").slice(0, 32);
}

function validToken(uid, given, secret) {
  if (typeof uid !== "string" || !UID.test(uid) || typeof given !== "string") return false;
  const expected = Buffer.from(token(uid, secret));
  const actual = Buffer.from(given);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

/** The link that goes in the email footer and the List-Unsubscribe header. */
function unsubscribeUrl(uid, secret) {
  const url = new URL(FUNCTION_URL);
  url.searchParams.set("u", uid);
  url.searchParams.set("t", token(uid, secret));
  return url.toString();
}

function page({ title, message, uid, t, action, button }) {
  const form = action
    ? `<form method="post"><input type="hidden" name="u" value="${escapeHtml(uid)}"><input type="hidden" name="t" value="${escapeHtml(t)}"><input type="hidden" name="action" value="${action}"><button type="submit" style="background:#a9441d;border:0;border-radius:6px;padding:14px 22px;color:#fff;font-size:16px;font-weight:bold;cursor:pointer;">${button}</button></form>`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)} · Sing with Amma</title></head>
<body style="margin:0;background:#f4efe7;color:#342b24;font-family:Arial,Helvetica,sans-serif;">
<main style="max-width:520px;margin:48px auto;padding:32px 28px;background:#fffdf9;border:1px solid #e7ded2;border-radius:12px;">
<p style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#57361f;">Sing with Amma</p>
<h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:normal;color:#432c1e;">${escapeHtml(title)}</h1>
<p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#65594e;">${escapeHtml(message)}</p>
${form}
<p style="margin:28px 0 0;font-size:13px;line-height:1.7;color:#87786a;">Account emails such as sign-in links and renewal reminders still arrive. <a href="https://sing.withamma.com/" style="color:#73563f;">Open Sing with Amma</a></p>
</main></body></html>`;
}

/**
 * Handles one request. `db` is a firebase-admin Database. Returns nothing;
 * writes the response. Kept apart from onRequest so it can be tested.
 */
async function handleUnsubscribe(req, res, { secret, db, now = Date.now() }) {
  res.set("Cache-Control", "no-store");
  if (!["GET", "POST"].includes(req.method)) return res.status(405).send("GET or POST required");
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const uid = body.u || req.query.u;
  const t = body.t || req.query.t;
  if (!validToken(uid, t, secret))
    return res
      .status(400)
      .send(page({ title: "This link has expired", message: "We couldn’t read this unsubscribe link. Reply to any of our emails with “unsubscribe” and we’ll take care of it." }));

  const ref = db.ref(`emailOptOut/${uid}`);
  if (req.method === "GET") {
    const already = (await ref.get()).exists();
    return res.status(200).send(
      already
        ? page({ title: "You’re unsubscribed", message: "You won’t receive Sing with Amma news and offers.", uid, t, action: "resubscribe", button: "Subscribe again" })
        : page({ title: "Unsubscribe from Sing with Amma news?", message: "You’ll stop receiving news about new bhajans and features, and offers to renew.", uid, t, action: "unsubscribe", button: "Unsubscribe" }),
    );
  }

  const oneClick = body["List-Unsubscribe"] === "One-Click";
  if (body.action === "resubscribe") {
    await ref.remove();
    return res.status(200).send(page({ title: "You’re subscribed again", message: "Thank you. We’ll keep you posted about new bhajans and features.", uid, t, action: "unsubscribe", button: "Unsubscribe" }));
  }
  if (!oneClick && body.action !== "unsubscribe") return res.status(400).send("Unknown action");
  await ref.set({ at: now, source: oneClick ? "one-click" : "page" });
  if (oneClick) return res.status(200).send("Unsubscribed");
  return res.status(200).send(page({ title: "You’re unsubscribed", message: "You won’t receive Sing with Amma news and offers.", uid, t, action: "resubscribe", button: "Subscribe again" }));
}

module.exports = { token, validToken, unsubscribeUrl, handleUnsubscribe, FUNCTION_URL };
