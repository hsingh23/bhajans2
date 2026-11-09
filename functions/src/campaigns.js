// Campaign emails: a win-back note for lapsed subscribers (built around their
// own favorites) and a "what's new" note for everyone. Pure renderers, so the
// send script, previews and tests all share one source. Sent by
// scripts/send-campaign.cjs, never by a scheduled function.

const ORIGIN = "https://sing.withamma.com";
const IMAGE_URL = `${ORIGIN}/email-images/amma_singing.jpg`;
// 1:18 tour of the new features (Loom), with a poster frame we host because
// Loom serves no public thumbnail. Set url to null to drop the block.
const VIDEO = {
  url: "https://www.loom.com/share/88c974fa64bb4eb7947a0043665545bc",
  poster: "https://singwithamma.s3.amazonaws.com/email/whats-new-video.jpg",
  length: "1:18",
};
const SUPPORT = "hisingh1@gmail.com";
// CAN-SPAM postal address shown in every campaign footer.
const POSTAL_ADDRESS = "MA Center Chicago · 41W501 Keslinger Road, Elburn, IL 60119";
const DAY = 86400000;

const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
  );

/** Absolute app link with campaign attribution for GA4. */
function track(path, campaign, content) {
  const url = new URL(path, ORIGIN);
  url.searchParams.set("utm_source", "email");
  url.searchParams.set("utm_medium", "email");
  url.searchParams.set("utm_campaign", campaign);
  if (content) url.searchParams.set("utm_content", content);
  return url.toString();
}

const unsubscribeMailto = () =>
  `mailto:${SUPPORT}?subject=${encodeURIComponent("Unsubscribe from Sing with Amma news")}`;

// "manamohana krsna (hindi)" -> "Manamohana Krsna (Hindi)"
const titleCase = (name) =>
  String(name || "").replace(/(^|[\s(-])([a-z])/g, (_, lead, ch) => lead + ch.toUpperCase());

const LYRICS_LOCATION = /^(\d{4}(?:supl\d?)?|vol\d|extra)-\d+$/i;

/**
 * What the app now offers for one favorite, from the bhajan index (`bhajan`)
 * and the musician data (`music`). Only facts the app really shows.
 */
function songHighlights(bhajan = {}, music) {
  const out = [];
  if (bhajan.cs?.length)
    out.push(bhajan.cs.length > 1 ? `${bhajan.cs.length} sample recordings` : "A sample recording");
  // A song can have several arrangements of 12 keys each, so count keys, not files.
  if (bhajan.sm?.length) out.push(bhajan.sm.length >= 12 ? "Sheet music in every key" : "Sheet music");
  const raga = music?.r?.[0];
  if (raga?.id && raga.c >= 0.5) out.push(`Raga ${titleCase(raga.id)}`);
  if (music?.t?.id && music.t.c >= 0.7)
    out.push(`${titleCase(music.t.id)}${music.t.ts ? ` (${music.t.ts})` : ""}`);
  if (bhajan.y) out.push(`First sung ${bhajan.y}`);
  if (bhajan.az) out.push("Amma’s recording on Amazon");
  return out;
}

/**
 * Resolves a favorites record ({ "song name": "1" }) against the current index.
 * Returns up to `limit` songs with a viewer link, richest first, plus the total
 * that still exist (renamed or removed songs drop out).
 */
function resolveFavorites(favorites, bhajans, music = {}, { campaign, limit = 5 } = {}) {
  const byName = new Map();
  bhajans.forEach((b, index) => b?.n && !byName.has(b.n) && byName.set(b.n, index));
  const found = [];
  for (const name of Object.keys(favorites || {})) {
    const index = byName.get(name);
    if (index === undefined) continue;
    const bhajan = bhajans[index];
    const location = bhajan.l?.find((loc) => LYRICS_LOCATION.test(loc));
    if (!location) continue;
    const highlights = songHighlights(bhajan, music[name]);
    found.push({
      name,
      title: titleCase(name),
      highlights,
      url: track(
        `/pdf/${encodeURIComponent(location)}/${index}/${encodeURIComponent(name)}`,
        campaign,
        "favorite",
      ),
    });
  }
  found.sort((a, b) => b.highlights.length - a.highlights.length || a.title.localeCompare(b.title));
  return { songs: found.slice(0, limit), total: found.length };
}

// What changed in the app since the summer, newest worth-knowing first.
// Counts come from the shipped index so they stay true.
function features(stats = {}) {
  const n = (value, fallback) => (Number.isFinite(value) ? value.toLocaleString("en-US") : fallback);
  return [
    {
      key: "samples",
      title: "Hear a bhajan before you sing it",
      body: `${n(stats.samples, "Most")} bhajans now play a sample recording, many with more than one version to learn from.`,
    },
    {
      key: "new-songs",
      title: `${n(stats.added, "Hundreds of")} more bhajans`,
      body: `A new lyrics book brings the library to ${n(stats.total, "over 3,000")} bhajans, with raga and taal filled in where they were missing.`,
    },
    {
      key: "musician",
      title: "Musician mode",
      body: "See each bhajan’s key, raga, taal and tempo, and filter by them. Piano, guitar, ukulele, flute, bansuri and tabla views show you what to play, and the app remembers the key you transpose to.",
    },
    {
      key: "sheet-music",
      title: "Sheet music in every key",
      body: `${n(stats.sheetMusic, "Over a thousand")} bhajans have sheet music, nearly all of it in every key, with a key picker on the page.`,
    },
    {
      key: "find",
      title: "Find bhajans your way",
      body: "Filter by deity and language, search by year or decade (try “1990s”), and see the year Amma first sang each one.",
    },
    {
      key: "resume",
      title: "Pick up where you left off",
      body: "The home page reopens your last bhajan on the same page, suggests a bhajan of the day, and lyrics open right where the song starts. Lyrics books stay on your device for offline singing.",
    },
    {
      key: "amazon",
      title: "Buy Amma’s own recording",
      body: `${n(stats.amazon, "Hundreds of")} bhajans link straight to Amma’s track on Amazon.`,
    },
  ];
}

/** Counts used in the copy, taken from the live index and musician data. */
function indexStats(bhajans, { added = 297 } = {}) {
  return {
    total: bhajans.length,
    samples: bhajans.filter((b) => b?.cs?.length).length,
    sheetMusic: bhajans.filter((b) => b?.sm?.length).length,
    amazon: bhajans.filter((b) => b?.az).length,
    added,
  };
}

/** Clickable poster plus a text link, for clients that block images. */
function videoBlock() {
  if (!VIDEO.url) return "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;"><tr><td>
<a href="${escapeHtml(VIDEO.url)}" style="text-decoration:none;"><img src="${escapeHtml(VIDEO.poster)}" alt="Watch a ${VIDEO.length} tour of what’s new in Sing with Amma" width="520" style="display:block;width:100%;max-width:520px;height:auto;border:1px solid #e7ded2;border-radius:8px;"></a>
<p style="margin:10px 0 0;font-size:14px;line-height:1.6;color:#74685c;"><a href="${escapeHtml(VIDEO.url)}" style="color:#9a3f1c;font-weight:bold;">Watch the ${VIDEO.length} tour</a> to see it all in the app.</p>
</td></tr></table>`;
}
const videoText = () => (VIDEO.url ? `Watch the ${VIDEO.length} tour: ${VIDEO.url}\n\n` : "");

const button = (href, label) =>
  `<a class="button" href="${escapeHtml(href)}" style="display:inline-block;background:#a9441d;border:1px solid #a9441d;border-radius:6px;padding:15px 24px;color:#ffffff;font-size:16px;font-weight:bold;line-height:1.4;text-decoration:none;">${label} &rarr;</a>`;

function featureRows(list) {
  return list
    .map(
      (f) =>
        `<tr><td style="padding:0 0 18px;"><p style="margin:0 0 4px;font-family:Georgia,'Times New Roman',serif;font-size:19px;line-height:1.35;color:#57361f;">${escapeHtml(f.title)}</p><p style="margin:0;font-size:15px;line-height:1.65;color:#65594e;">${escapeHtml(f.body)}</p></td></tr>`,
    )
    .join("");
}

function favoriteRows(songs) {
  return songs
    .map(
      (s) =>
        `<tr><td style="padding:14px 18px;border-top:1px solid #e9ddcd;"><a href="${escapeHtml(s.url)}" style="font-family:Georgia,'Times New Roman',serif;font-size:18px;line-height:1.4;color:#9a3f1c;text-decoration:none;">${escapeHtml(s.title)}</a>${
          s.highlights.length
            ? `<p style="margin:4px 0 0;font-size:13px;line-height:1.6;color:#74685c;">${s.highlights.map(escapeHtml).join(" · ")}</p>`
            : ""
        }</td></tr>`,
    )
    .join("");
}

function shell({ title, preheader, eyebrow, body, reason, postalAddress = POSTAL_ADDRESS, unsubscribeUrl }) {
  const address = postalAddress ? `<br>${escapeHtml(postalAddress)}` : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(title)}</title>
<style>@media only screen and (max-width:620px){.outer{padding:12px 8px!important}.content{padding:28px 22px!important}.headline{font-size:28px!important}.button{display:block!important;text-align:center!important}}</style></head>
<body style="margin:0;padding:0;background:#f4efe7;color:#342b24;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4efe7;"><tr><td class="outer" align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fffdf9;border:1px solid #e7ded2;border-radius:12px;overflow:hidden;">
<tr><td style="padding:24px 28px;text-align:center;border-bottom:1px solid #e7ded2;"><p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:26px;color:#57361f;">Sing with Amma</p><p style="margin:6px 0 0;font-size:11px;letter-spacing:2px;color:#8a6348;">BHAJANS · LYRICS · SHEET MUSIC</p></td></tr>
<tr><td align="center" style="background:#f6f0e7;"><img src="${IMAGE_URL}" alt="Amma singing with a gathering of devotees" width="600" height="337" style="display:block;width:100%;max-width:600px;height:auto;border:0;"></td></tr>
<tr><td class="content" style="padding:36px 40px;">
<p style="margin:0 0 12px;font-size:11px;letter-spacing:1.8px;font-weight:bold;color:#a34d27;">${escapeHtml(eyebrow)}</p>
<h1 class="headline" style="margin:0 0 24px;font-family:Georgia,'Times New Roman',serif;font-size:32px;line-height:1.2;font-weight:normal;color:#432c1e;">${escapeHtml(title)}</h1>
${body}
<div style="margin:32px 0 0;padding-top:28px;border-top:1px solid #eadfd2;text-align:center;">
<p style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-style:italic;line-height:1.3;color:#754123;">Happy singing.</p>
<p style="margin:0;font-size:11px;letter-spacing:1.4px;line-height:1.8;text-transform:uppercase;color:#8a7059;">The Sing with Amma team</p>
</div>
</td></tr></table>
<p style="max-width:520px;margin:20px auto 0;font-size:12px;line-height:1.7;color:#87786a;text-align:center;">${escapeHtml(reason)}<br><a href="${escapeHtml(unsubscribeUrl || unsubscribeMailto())}" style="color:#73563f;">Unsubscribe from these updates</a> · <a href="mailto:${SUPPORT}" style="color:#73563f;">Contact support</a> · <a href="${ORIGIN}/" style="color:#73563f;">sing.withamma.com</a>${address}</p>
</td></tr></table></body></html>`;
}

const textFooter = (reason, postalAddress = POSTAL_ADDRESS, unsubscribeUrl) =>
  `\n\nThe Sing with Amma team\n\n${reason}\nUnsubscribe: ${unsubscribeUrl || `reply with "unsubscribe" or write to ${SUPPORT}`}${postalAddress ? `\n${postalAddress}` : ""}`;

const monthYear = (ms) =>
  new Date(ms).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

/**
 * Win-back email for a subscriber whose access ended.
 * favorites: output of resolveFavorites; expiredOn: ms timestamp.
 */
function renderWinback({ name, expiredOn, favorites = { songs: [], total: 0 }, stats, campaign, now = Date.now(), postalAddress, unsubscribeUrl }) {
  const greeting = name ? `Dear ${escapeHtml(name)},` : "Dear friend,";
  const recent = Number.isFinite(expiredOn) && now - expiredOn <= 365 * DAY;
  const ended = Number.isFinite(expiredOn) ? monthYear(expiredOn) : null;
  const songs = favorites.songs || [];
  const more = Math.max(0, (favorites.total || 0) - songs.length);
  const payUrl = track("/pay", campaign, "renew");
  const list = features(stats);
  const title = songs.length
    ? "Your favorite bhajans are waiting"
    : recent
      ? "We miss singing with you"
      : "Sing with Amma has grown";
  const intro = recent
    ? `Your subscription ended${ended ? ` in ${ended}` : ""}, and the app has kept growing since.`
    : `It has been a while since your subscription ended${ended ? ` in ${ended}` : ""}. The app has grown a lot since then.`;
  const favIntro = songs.length
    ? `You saved ${favorites.total === 1 ? "a favorite" : `${favorites.total} favorites`}, and ${songs.length === 1 ? "it is" : "they are"} still here, now with more to sing along with:`
    : "";
  const body = `<p style="margin:0 0 12px;font-size:16px;line-height:1.7;">${greeting}</p>
<p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#65594e;">${escapeHtml(intro)}${favIntro ? ` ${escapeHtml(favIntro)}` : ""}</p>
${
  songs.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f0e7;border:1px solid #e9ddcd;border-radius:8px;"><tr><td style="padding:14px 18px 2px;"><p style="margin:0;font-size:11px;letter-spacing:1.2px;color:#82674f;">YOUR FAVORITES</p></td></tr>${favoriteRows(songs)}${
        more
          ? `<tr><td style="padding:12px 18px;border-top:1px solid #e9ddcd;font-size:14px;color:#74685c;">and ${more} more in <a href="${escapeHtml(track("/my-favorites", campaign, "favorites"))}" style="color:#9a3f1c;">My Favorites</a></td></tr>`
          : ""
      }</table>
<p style="margin:24px 0 24px;">${button(payUrl, "Renew and sing again")}</p>`
    : `<p style="margin:0 0 24px;">${button(payUrl, "Renew and sing again")}</p>`
}
<p style="margin:8px 0 16px;font-size:11px;letter-spacing:1.8px;font-weight:bold;color:#a34d27;">NEW SINCE YOU LEFT</p>
${videoBlock()}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${featureRows(list.slice(0, 5))}</table>
<p style="margin:8px 0 18px;">${button(payUrl, "Renew my subscription")}</p>
<p style="margin:0;font-size:14px;line-height:1.7;color:#74685c;">Every subscription supports Amma’s charities. Sign in with this email address; you can ask for a magic link on the sign-in page, so no password is needed.</p>`;
  const reason = "You’re receiving this because you had a Sing with Amma subscription.";
  const html = shell({
    title,
    preheader: songs.length
      ? `${songs[0].title}${favorites.total > 1 ? ` and ${favorites.total - 1} more` : ""}, now with recordings, sheet music and more.`
      : "Recordings, musician mode, sheet music in every key and hundreds more bhajans.",
    eyebrow: recent ? "WE MISS YOU" : "IT’S BEEN A WHILE",
    body,
    reason,
    postalAddress,
    unsubscribeUrl,
  });
  const text = `${title}\n\n${name ? `Dear ${name},` : "Dear friend,"}\n\n${intro}${favIntro ? ` ${favIntro}` : ""}\n\n${songs
    .map((s) => `- ${s.title}${s.highlights.length ? ` (${s.highlights.join(", ")})` : ""}\n  ${s.url}`)
    .join("\n")}${more ? `\n...and ${more} more in My Favorites` : ""}\n\nRenew: ${payUrl}\n\nNew since you left:\n${videoText()}${list
    .slice(0, 5)
    .map((f) => `- ${f.title}: ${f.body}`)
    .join("\n")}\n\nEvery subscription supports Amma’s charities.${textFooter(reason, postalAddress, unsubscribeUrl)}`;
  const subject = songs.length
    ? `${songs[0].title}${favorites.total > 1 ? ` and your other favorites are` : " is"} waiting for you`
    : `Sing with Amma has grown: recordings, musician mode and ${stats?.added ?? "hundreds of"} more bhajans`;
  return { subject, html, text };
}

/** "What's new" email for everyone with an account. */
function renderFeatures({ name, active, validUntil, favorite, stats, campaign, postalAddress, unsubscribeUrl }) {
  const greeting = name ? `Dear ${escapeHtml(name)},` : "Dear friend,";
  const list = features(stats);
  const openUrl = track("/", campaign, "open");
  const cta = active ? button(openUrl, "Open Sing with Amma") : button(track("/pay", campaign, "subscribe"), "Start singing");
  const intro = "Here is what’s new in Sing with Amma. Everything below is live in the app today.";
  const tryLine = favorite
    ? `<p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#65594e;">Try it on one of your favorites: <a href="${escapeHtml(favorite.url)}" style="color:#9a3f1c;">${escapeHtml(favorite.title)}</a>${
        favorite.highlights.length ? ` (${favorite.highlights.slice(0, 3).map(escapeHtml).join(" · ")})` : ""
      }.</p>`
    : "";
  const body = `<p style="margin:0 0 12px;font-size:16px;line-height:1.7;">${greeting}</p>
<p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#65594e;">${escapeHtml(intro)}</p>
${videoBlock()}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${featureRows(list)}</table>
${tryLine}
<p style="margin:0 0 18px;">${cta}</p>
${
  active && validUntil
    ? `<p style="margin:0;font-size:14px;line-height:1.7;color:#74685c;">Your access runs through ${escapeHtml(validUntil)}. Thank you for supporting Amma’s charities.</p>`
    : `<p style="margin:0;font-size:14px;line-height:1.7;color:#74685c;">Every subscription supports Amma’s charities.</p>`
}`;
  const reason = "You’re receiving this because you have a Sing with Amma account.";
  const title = "New in Sing with Amma";
  const html = shell({
    title,
    preheader: "Sample recordings, musician mode, sheet music in every key and hundreds more bhajans.",
    eyebrow: "WHAT’S NEW",
    body,
    reason,
    postalAddress,
    unsubscribeUrl,
  });
  const text = `${title}\n\n${name ? `Dear ${name},` : "Dear friend,"}\n\n${intro}\n\n${videoText()}${list
    .map((f) => `- ${f.title}: ${f.body}`)
    .join("\n")}${favorite ? `\n\nTry it on one of your favorites, ${favorite.title}: ${favorite.url}` : ""}\n\n${
    active ? `Open the app: ${openUrl}` : `Start singing: ${track("/pay", campaign, "subscribe")}`
  }${textFooter(reason, postalAddress, unsubscribeUrl)}`;
  return {
    subject: `New in Sing with Amma: recordings, musician mode and ${stats?.added ?? "hundreds of"} more bhajans`,
    html,
    text,
  };
}

const FROM = { email: "no-reply@withamma.com", name: "Sing with Amma" };

/**
 * One recipient's email, provider-neutral. With an https unsubscribe URL the
 * headers allow RFC 8058 one-click unsubscribe (Gmail/Yahoo show a button).
 */
function emailMessage({ email, name, rendered, campaign, unsubscribeUrl }) {
  const targets = [unsubscribeUrl, unsubscribeMailto()].filter(Boolean).map((u) => `<${u}>`);
  const headers = { "List-Unsubscribe": targets.join(", ") };
  if (unsubscribeUrl) headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  return {
    from: FROM,
    replyTo: { email: SUPPORT, name: "Sing with Amma" },
    to: { email, name: name || "" },
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    headers,
    campaign,
  };
}

/** Mailjet v3.1 Messages[] entry. */
const toMailjet = (m) => ({
  From: { Email: m.from.email, Name: m.from.name },
  ReplyTo: { Email: m.replyTo.email, Name: m.replyTo.name },
  To: [{ Email: m.to.email, Name: m.to.name || m.to.email }],
  Subject: m.subject,
  HTMLPart: m.html,
  TextPart: m.text,
  CustomCampaign: m.campaign,
  Headers: m.headers,
});

// RFC 2047 so non-ASCII display names survive SES.
const mailbox = ({ email, name }) =>
  name ? `=?UTF-8?B?${Buffer.from(name).toString("base64")}?= <${email}>` : email;

/** Amazon SES v2 SendEmail input. */
const toSes = (m, { configurationSet } = {}) => ({
  FromEmailAddress: mailbox(m.from),
  ReplyToAddresses: [mailbox(m.replyTo)],
  Destination: { ToAddresses: [mailbox(m.to)] },
  Content: {
    Simple: {
      Subject: { Data: m.subject, Charset: "UTF-8" },
      Body: { Html: { Data: m.html, Charset: "UTF-8" }, Text: { Data: m.text, Charset: "UTF-8" } },
      Headers: Object.entries(m.headers).map(([Name, Value]) => ({ Name, Value })),
    },
  },
  EmailTags: [{ Name: "campaign", Value: m.campaign }],
  ...(configurationSet ? { ConfigurationSetName: configurationSet } : {}),
});

module.exports = {
  track,
  titleCase,
  songHighlights,
  resolveFavorites,
  features,
  indexStats,
  renderWinback,
  renderFeatures,
  emailMessage,
  toMailjet,
  toSes,
  POSTAL_ADDRESS,
};
