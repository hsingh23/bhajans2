#!/usr/bin/env node
// Campaign sender for the win-back and "what's new" emails (functions/src/campaigns.js).
//
//   node --env-file=functions/.env.local scripts/send-campaign.cjs <winback|features> [options]
//
// Modes (default --dry-run, which sends nothing):
//   --dry-run          count recipients, write previews + a recipient list to --out
//   --to-me[=N]        send up to N (default 6) emails, one per segment/favorites variant, to OPERATOR only
//   --send --yes       send for real
// Options:
//   --via=ses|mailjet      provider (default ses, AWS profile bhajans-mailer, us-east-1)
//   --id=<campaignId>      claim key, utm_campaign and provider campaign tag (default <kind>-2026-11)
//   --max=<n>              stop after n real sends this run (default 2000; use 180 on Mailjet free)
//   --rate=<n>             SES sends per second (default 10; stay under the account's quota)
//   --audience=<a>         features only: active (default) | paid | everyone (incl. never paid)
//   --postal-address=<a>   override the footer address (default MA Center Chicago)
//   --out=<dir>            where dry-run files go (default node_modules/.cache/campaigns/<id>)
//   --skip-manual          leave out accounts an admin granted by hand (paid/<uid>/manual)
//
// Every real send is claimed at campaignLog/<id>/<uid> first, so reruns continue
// where the last run stopped and nobody gets the same campaign twice. Opt-outs live
// at emailOptOut/<uid>, written by the one-click unsubscribe function
// (functions/src/unsubscribe.js), and are always skipped. Links are signed with
// UNSUBSCRIBE_SECRET from functions/.env.local (same value as the Firebase secret).
// Credentials: GOOGLE_APPLICATION_CREDENTIALS if set, else the Firebase CLI login;
// AWS_PROFILE (default bhajans-mailer) for SES.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createRequire } = require("node:module");

const root = path.resolve(__dirname, "..");
const fnRequire = createRequire(path.join(root, "functions/package.json"));
const { initializeApp, refreshToken, applicationDefault } = fnRequire("firebase-admin/app");
const { getDatabase } = fnRequire("firebase-admin/database");
const { getAuth } = fnRequire("firebase-admin/auth");
const campaigns = require("../functions/src/campaigns.js");
const { unsubscribeUrl } = require("../functions/src/unsubscribe.js");

const OPERATOR = { email: "hisingh1@gmail.com", name: "Harsh Singh" };
const DAY = 86400000;
const RECENT_REMINDER_GAP = 7 * DAY; // renewal reminders just reached these people
const TEST_ACCOUNT = /(@example\.(com|org)$)|(@maxric\.com$)|(^test-create-account)|(\+test@)/i;

function parseArgs(argv) {
  const [kind, ...rest] = argv;
  const opts = { kind, mode: "dry-run", toMe: 6, max: 2000, rate: 10, audience: "active", via: "ses" };
  for (const arg of rest) {
    const [key, value] = arg.replace(/^--/, "").split("=");
    if (key === "dry-run") opts.mode = "dry-run";
    else if (key === "to-me") {
      opts.mode = "to-me";
      if (value) opts.toMe = Number(value);
    } else if (key === "send") opts.mode = "send";
    else if (key === "yes") opts.yes = true;
    else if (key === "id") opts.id = value;
    else if (key === "max") opts.max = Number(value);
    else if (key === "audience") opts.audience = value;
    else if (key === "out") opts.out = value;
    else if (key === "postal-address") opts.postalAddress = value;
    else if (key === "skip-manual") opts.skipManual = true;
    else if (key === "via") opts.via = value;
    else if (key === "rate") opts.rate = Number(value);
    else throw new Error(`Unknown option --${key}`);
  }
  if (!["winback", "features"].includes(kind)) throw new Error("First argument must be winback or features");
  if (!["active", "paid", "everyone"].includes(opts.audience)) throw new Error("--audience must be active, paid or everyone");
  opts.id ||= `${kind}-2026-11`;
  if (!/^[a-z0-9-]{3,40}$/.test(opts.id)) throw new Error("--id: lowercase letters, digits and dashes only");
  if (!["ses", "mailjet"].includes(opts.via)) throw new Error("--via must be ses or mailjet");
  opts.postalAddress ||= process.env.CAMPAIGN_POSTAL_ADDRESS || undefined;
  opts.secret = process.env.UNSUBSCRIBE_SECRET;
  opts.out ||= path.join(root, "node_modules/.cache/campaigns", opts.id);
  return opts;
}

function credential() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return applicationDefault();
  const api = fnRequire("firebase-tools/lib/api.js");
  const store = path.join(os.homedir(), ".config/configstore/firebase-tools.json");
  const token = JSON.parse(fs.readFileSync(store, "utf8")).tokens?.refresh_token;
  if (!token) throw new Error("No Firebase CLI login found; run firebase login");
  return refreshToken({
    type: "authorized_user",
    client_id: api.clientId(),
    client_secret: api.clientSecret(),
    refresh_token: token,
  });
}

const read = async (db, ref) => (await db.ref(ref).get()).val() || {};

async function authUsers(uids) {
  const users = new Map();
  for (let i = 0; i < uids.length; i += 100) {
    const { users: found } = await getAuth().getUsers(uids.slice(i, i + 100).map((uid) => ({ uid })));
    for (const user of found) users.set(user.uid, user);
  }
  return users;
}

async function allAuthUsers() {
  const users = new Map();
  let pageToken;
  do {
    const page = await getAuth().listUsers(1000, pageToken);
    for (const user of page.users) users.set(user.uid, user);
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
}

const firstName = (user, record) =>
  (user?.displayName || record?.billing_address?.first_name || "").trim().split(/\s+/)[0] || "";

const longDate = (ms) =>
  new Date(ms).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

async function buildRecipients(opts, db, now) {
  const [paid, favorites, admins, optOut, claimed] = await Promise.all([
    read(db, "paid"),
    read(db, "favorites"),
    read(db, "admin"),
    read(db, "emailOptOut"),
    read(db, `campaignLog/${opts.id}`),
  ]);
  const bhajans = JSON.parse(fs.readFileSync(path.join(root, "public/bhajan-index2.json"), "utf8"));
  const music = JSON.parse(fs.readFileSync(path.join(root, "public/bhajan-music.json"), "utf8"));
  const stats = campaigns.indexStats(bhajans);

  let pool;
  if (opts.kind === "winback")
    pool = Object.keys(paid).filter((uid) => Number(paid[uid]?.expiresOn) < now - RECENT_REMINDER_GAP);
  else if (opts.audience === "active") pool = Object.keys(paid).filter((uid) => Number(paid[uid]?.expiresOn) > now);
  else if (opts.audience === "paid") pool = Object.keys(paid);
  else pool = null; // everyone: every auth account

  const users = pool ? await authUsers(pool) : await allAuthUsers();
  pool ||= [...users.keys()];

  const skipped = {};
  const skip = (why) => (skipped[why] = (skipped[why] || 0) + 1);
  const seenEmails = new Set();
  const recipients = [];
  for (const uid of pool) {
    const user = users.get(uid);
    const email = user?.email?.trim();
    if (!email) { skip("no email / no auth account"); continue; }
    if (user.disabled) { skip("disabled account"); continue; }
    if (admins[uid]) { skip("admin"); continue; }
    if (TEST_ACCOUNT.test(email)) { skip("test account"); continue; }
    if (optOut[uid]) { skip("opted out"); continue; }
    if (claimed[uid]) { skip("already sent this campaign"); continue; }
    if (opts.skipManual && paid[uid]?.manual) { skip("manual grant (--skip-manual)"); continue; }
    const key = email.toLowerCase();
    if (seenEmails.has(key)) { skip("duplicate email"); continue; }
    seenEmails.add(key);

    const record = paid[uid];
    const expiresOn = Number(record?.expiresOn);
    const active = Number.isFinite(expiresOn) && expiresOn > now;
    const favs = campaigns.resolveFavorites(favorites[uid], bhajans, music, { campaign: opts.id });
    const name = firstName(user, record);
    const render = (link) =>
      opts.kind === "winback"
        ? campaigns.renderWinback({ name, expiredOn: expiresOn, favorites: favs, stats, campaign: opts.id, now, postalAddress: opts.postalAddress, unsubscribeUrl: link })
        : campaigns.renderFeatures({
            name,
            active,
            validUntil: active ? longDate(expiresOn) : null,
            favorite: favs.songs[0],
            stats,
            campaign: opts.id,
            postalAddress: opts.postalAddress,
            unsubscribeUrl: link,
          });
    const link = opts.secret ? unsubscribeUrl(uid, opts.secret) : undefined;
    const rendered = render(link);
    const segment =
      opts.kind === "winback"
        ? now - expiresOn <= 90 * DAY ? "lapsed <90d" : now - expiresOn <= 365 * DAY ? "lapsed 90d-1y" : "lapsed >1y"
        : !record ? "never paid" : active ? "active" : "lapsed";
    recipients.push({ uid, email, name, segment, expiresOn, favorites: favs.total, manual: !!record?.manual, rendered, render, link });
  }
  // Most recent lapsers first: they are likeliest to come back, and a capped run reaches them first.
  recipients.sort((a, b) => (b.expiresOn || 0) - (a.expiresOn || 0));
  return { recipients, skipped, stats };
}

// Senders take one provider-neutral message (campaigns.emailMessage) and
// resolve to the provider's message id, or throw.
function mailjetSender() {
  const apiKey = process.env.MAILJET_AUTH_HEADER;
  if (!apiKey) throw new Error("MAILJET_AUTH_HEADER missing; run with --env-file=functions/.env.local");
  return async (message) => {
    const response = await fetch("https://api.mailjet.com/v3.1/send", {
      method: "POST",
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ Messages: [campaigns.toMailjet(message)] }),
    });
    const result = await response.json().catch(() => ({}));
    const sent = result.Messages?.[0];
    if (!response.ok || sent?.Status !== "success") throw new Error(`Mailjet HTTP ${response.status}: ${JSON.stringify(result).slice(0, 300)}`);
    return String(sent.To?.[0]?.MessageID ?? "");
  };
}

function sesSender(opts) {
  process.env.AWS_PROFILE ||= "bhajans-mailer";
  const { SESv2Client, SendEmailCommand } = require("@aws-sdk/client-sesv2");
  const client = new SESv2Client({ region: process.env.AWS_REGION || "us-east-1" });
  return async (message) => {
    const out = await client.send(new SendEmailCommand(campaigns.toSes(message, { configurationSet: process.env.SES_CONFIGURATION_SET })));
    return out.MessageId;
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function summarize(opts, recipients, skipped, stats) {
  const bySegment = {};
  for (const r of recipients) {
    const row = (bySegment[r.segment] ||= { recipients: 0, withFavorites: 0, manualGrant: 0 });
    row.recipients += 1;
    if (r.favorites) row.withFavorites += 1;
    if (r.manual) row.manualGrant += 1;
  }
  return { campaign: opts.id, kind: opts.kind, audience: opts.kind === "features" ? opts.audience : "lapsed 7+ days", recipients: recipients.length, bySegment, skipped, indexStats: stats, mailjetFreeTierDays: Math.ceil(recipients.length / 180) };
}

function writeDryRun(opts, recipients, summary) {
  fs.mkdirSync(opts.out, { recursive: true, mode: 0o700 });
  const write = (name, body) => fs.writeFileSync(path.join(opts.out, name), body, { mode: 0o600 });
  write("summary.json", JSON.stringify(summary, null, 2));
  const csv = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  write(
    "recipients.csv",
    ["uid,email,segment,favorites,subject", ...recipients.map((r) => [r.uid, r.email, r.segment, r.favorites, r.rendered.subject].map(csv).join(","))].join("\n"),
  );
  // One preview per segment with favorites, and one without, for review.
  const picks = new Map();
  for (const r of recipients) {
    const key = `${r.segment}-${r.favorites ? "favorites" : "no-favorites"}`;
    if (!picks.has(key)) picks.set(key, r);
  }
  for (const [key, r] of picks) write(`preview-${key.replace(/[^a-z0-9-]+/gi, "_")}.html`, r.rendered.html);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.mode !== "dry-run" && !opts.secret)
    throw new Error("UNSUBSCRIBE_SECRET missing; run with --env-file=functions/.env.local");
  initializeApp({ credential: credential(), projectId: "bhajans-588f5", databaseURL: "https://bhajans-588f5.firebaseio.com" });
  const db = getDatabase();
  const now = Date.now();
  const { recipients, skipped, stats } = await buildRecipients(opts, db, now);
  const summary = summarize(opts, recipients, skipped, stats);

  if (opts.mode === "dry-run") {
    writeDryRun(opts, recipients, summary);
    console.log(JSON.stringify(summary, null, 2));
    console.log(`Dry run only, nothing sent. Previews and recipients.csv in ${opts.out}`);
    return;
  }

  const send = opts.via === "ses" ? sesSender(opts) : mailjetSender();

  if (opts.mode === "to-me") {
    // One email per segment, with and without favorites, so every variant gets reviewed.
    const picks = new Map();
    for (const r of recipients) {
      const key = `${r.segment}-${r.favorites ? "favorites" : "no-favorites"}`;
      if (!picks.has(key)) picks.set(key, r);
    }
    // The unsubscribe link in a test points at a test uid, never the real subscriber's.
    const testLink = unsubscribeUrl("campaign-test", opts.secret);
    let ok = 0;
    for (const r of [...picks.values()].slice(0, opts.toMe)) {
      const rendered = r.render(testLink);
      const message = campaigns.emailMessage({ ...OPERATOR, rendered, campaign: `${opts.id}-test`, unsubscribeUrl: testLink });
      message.subject = `[TEST ${opts.via} ${r.segment}${r.favorites ? "" : ", no favorites"}] ${message.subject}`;
      try {
        await send(message);
        ok += 1;
      } catch (error) {
        console.error(`Test send failed: ${error.message}`);
      }
    }
    console.log(`Sent ${ok} test emails via ${opts.via} to ${OPERATOR.email} only.`);
    return;
  }

  // Real send: claim, send, record. A failure releases the claim for the next run.
  if (!opts.yes) throw new Error("Real send needs --yes as well as --send");
  const queue = recipients.slice(0, opts.max);
  const gap = opts.via === "ses" ? 1000 / Math.max(1, opts.rate) : 250;
  let sent = 0;
  let failed = 0;
  for (const r of queue) {
    const ref = db.ref(`campaignLog/${opts.id}/${r.uid}`);
    const claim = await ref.transaction((current) => (current ? undefined : { at: now, status: "sending" }));
    if (!claim.committed) continue;
    const started = Date.now();
    let messageId;
    try {
      messageId = await send(campaigns.emailMessage({ email: r.email, name: r.name, rendered: r.rendered, campaign: opts.id, unsubscribeUrl: r.link }));
    } catch (error) {
      // The provider refused it, so nobody got it: release the claim for a later run.
      failed += 1;
      await ref.remove().catch((e) => console.error(`Could not release claim for ${r.uid}: ${e.message}`));
      console.error(`Send failed for ${r.uid}: ${error.name || ""} ${error.message}`);
      if (/Throttl|MaxSendRate|Daily message quota/i.test(`${error.name} ${error.message}`)) {
        console.error("Provider quota reached; stopping. Rerun later to continue.");
        break;
      }
      await sleep(Math.max(0, gap - (Date.now() - started)));
      continue;
    }
    // Delivered. Never release the claim from here on, even if recording fails:
    // a released claim would send this person the same email again next run.
    sent += 1;
    await ref
      .set({ at: Date.now(), status: "sent", via: opts.via, messageId: messageId || "" })
      .catch((e) => console.error(`Sent to ${r.uid} but could not record it (claim kept): ${e.message}`));
    if ((sent + failed) % 50 === 0) console.log(`Progress: ${sent} sent, ${failed} failed of ${queue.length}`);
    await sleep(Math.max(0, gap - (Date.now() - started)));
  }
  console.log(`Done: ${sent} sent, ${failed} failed (released for retry), ${recipients.length - queue.length} beyond --max for the next run.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
