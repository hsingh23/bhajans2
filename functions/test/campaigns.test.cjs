const { test } = require("node:test");
const assert = require("node:assert/strict");
const c = require("../src/campaigns.js");

const bhajans = [
  { n: "manamohana krsna", l: ["vol3-118"], sm: Array(36).fill("x.pdf"), cs: ["a.mp3", "b.mp3"], y: 1996, az: "B0" },
  { n: "sheet only", l: ["Song.pdf"], sm: ["Song.pdf"] },
  { n: "a-i bhavani (marathi)", l: ["vol6-8"] },
];
const music = { "manamohana krsna": { r: [{ id: "natabhairavi", c: 0.7 }], t: { id: "keherwa", ts: "4/4", c: 0.92 } } };
const stats = c.indexStats(bhajans);
const DAY = 86400000;

test("favorites resolve by name to tracked viewer links and drop missing or lyric-less songs", () => {
  const fav = c.resolveFavorites(
    { "a-i bhavani (marathi)": "1", "manamohana krsna": "1", "sheet only": "1", "renamed away": "1" },
    bhajans,
    music,
    { campaign: "winback-test" },
  );
  assert.equal(fav.total, 2);
  assert.equal(fav.songs[0].title, "Manamohana Krsna"); // richest first
  assert.equal(fav.songs[1].title, "A-I Bhavani (Marathi)");
  const url = new URL(fav.songs[0].url);
  assert.equal(url.origin + url.pathname, "https://sing.withamma.com/pdf/vol3-118/0/manamohana%20krsna");
  assert.equal(url.searchParams.get("utm_campaign"), "winback-test");
  assert.deepEqual(fav.songs[0].highlights, [
    "2 sample recordings",
    "Sheet music in every key",
    "Raga Natabhairavi",
    "Keherwa (4/4)",
    "First sung 1996",
    "Amma’s recording on Amazon",
  ]);
});

test("win-back email names the favorites, escapes input and links to renewal", () => {
  const favorites = c.resolveFavorites({ "manamohana krsna": "1" }, bhajans, music, { campaign: "wb" });
  const now = Date.UTC(2026, 10, 8);
  const { subject, html, text } = c.renderWinback({
    name: "<Priya & co>",
    expiredOn: now - 40 * DAY,
    favorites,
    stats,
    campaign: "wb",
    now,
    postalAddress: "1 Example Road",
  });
  assert.equal(subject, "Manamohana Krsna is waiting for you");
  assert.match(html, /Dear &lt;Priya &amp; co&gt;,/);
  assert.doesNotMatch(html, /<Priya/);
  assert.match(html, /WE MISS YOU/);
  assert.match(html, /ended in September 2026/);
  assert.match(html, /\/pay\?utm_source=email&amp;utm_medium=email&amp;utm_campaign=wb&amp;utm_content=renew/);
  assert.match(html, /Unsubscribe from these updates/);
  assert.match(html, /1 Example Road/);
  assert.match(text, /Renew: https:\/\/sing\.withamma\.com\/pay\?/);
});

test("win-back without favorites falls back to the what's-new pitch for long-lapsed users", () => {
  const now = Date.UTC(2026, 10, 8);
  const { subject, html } = c.renderWinback({ expiredOn: now - 900 * DAY, stats, campaign: "wb", now });
  assert.match(subject, /^Sing with Amma has grown/);
  assert.match(html, /Dear friend,/);
  assert.match(html, /IT’S BEEN A WHILE/);
  assert.doesNotMatch(html, /YOUR FAVORITES/);
});

test("features email adapts its call to action to active and lapsed accounts", () => {
  const active = c.renderFeatures({ name: "Priya", active: true, validUntil: "March 4, 2027", stats, campaign: "fe" });
  assert.match(active.html, /Open Sing with Amma/);
  assert.match(active.html, /runs through March 4, 2027/);
  const lapsed = c.renderFeatures({ active: false, stats, campaign: "fe" });
  assert.match(lapsed.html, /Start singing/);
  assert.match(lapsed.html, /utm_content=subscribe/);
});

test("messages carry one-click unsubscribe headers for both SES and Mailjet", () => {
  const rendered = { subject: "s", html: "h", text: "t" };
  const unsubscribeUrl = "https://us-central1-bhajans-588f5.cloudfunctions.net/unsubscribe?u=a&t=b";
  const m = c.emailMessage({ email: "a@example.com", name: "Śrī", rendered, campaign: "fe", unsubscribeUrl });
  assert.equal(m.headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  assert.match(m.headers["List-Unsubscribe"], /^<https:\/\/us-central1-.*>, <mailto:/);

  const ses = c.toSes(m);
  assert.equal(ses.Destination.ToAddresses[0], `=?UTF-8?B?${Buffer.from("Śrī").toString("base64")}?= <a@example.com>`);
  assert.deepEqual(ses.EmailTags, [{ Name: "campaign", Value: "fe" }]);
  assert.ok(ses.Content.Simple.Headers.some((h) => h.Name === "List-Unsubscribe-Post"));
  assert.equal(ses.ConfigurationSetName, undefined);

  const mj = c.toMailjet(c.emailMessage({ email: "a@example.com", rendered, campaign: "fe" }));
  assert.equal(mj.To[0].Name, "a@example.com");
  assert.equal(mj.Headers["List-Unsubscribe-Post"], undefined); // mailto only: no one-click claim
});

test("footer carries the unsubscribe link and the MA Center postal address by default", () => {
  const { html, text } = c.renderFeatures({ active: true, stats, campaign: "fe", unsubscribeUrl: "https://x.example/u?u=1&t=2" });
  assert.match(html, /href="https:\/\/x\.example\/u\?u=1&amp;t=2"/);
  assert.match(html, /41W501 Keslinger Road, Elburn, IL 60119/);
  assert.match(text, /Unsubscribe: https:\/\/x\.example\/u\?u=1&t=2/);
});

test("both emails link the feature tour video with a hosted poster and a text fallback", () => {
  const now = Date.UTC(2026, 10, 8);
  for (const { html, text } of [
    c.renderFeatures({ active: true, stats, campaign: "fe" }),
    c.renderWinback({ expiredOn: now - 40 * DAY, stats, campaign: "wb", now }),
  ]) {
    assert.match(html, /<a href="https:\/\/www\.loom\.com\/share\/[0-9a-f]{32}"[^>]*><img src="https:\/\/singwithamma\.s3\.amazonaws\.com\/email\/whats-new-video\.jpg"/);
    assert.match(html, /Watch the 1:18 tour<\/a>/);
    assert.match(text, /Watch the 1:18 tour: https:\/\/www\.loom\.com\/share\//);
  }
});
