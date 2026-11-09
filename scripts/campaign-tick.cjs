#!/usr/bin/env node
// One step of the SES rollout, safe to run every few hours:
//   1. stop unless SES production access is granted
//   2. stop if the 24h bounce rate > 2% or complaint rate > 0.1% (CloudWatch)
//   3. send up to DAILY_CAP emails in the rolling 24 hours: features (active
//      subscribers) first, then the win-back (most recently lapsed first)
//
//   node --env-file=functions/.env.local scripts/campaign-tick.cjs [--dry-run]
//
// Prints one STATUS line last: WAITING_APPROVAL | DENIED | PAUSED | SENT | COMPLETE | ERROR.
// send-campaign.cjs claims each recipient, so overlapping or repeated runs never double-send.

const path = require("node:path");
const { execFileSync } = require("node:child_process");

process.env.AWS_PROFILE ||= "bhajans-mailer";
process.env.AWS_REGION ||= "us-east-1";
const { SESv2Client, GetAccountCommand } = require("@aws-sdk/client-sesv2");
const { CloudWatchClient, GetMetricStatisticsCommand } = require("@aws-sdk/client-cloudwatch");

const DAILY_CAP = 300;
const MAX_BOUNCE = 0.02;
const MAX_COMPLAINT = 0.001;
const CAMPAIGNS = ["features", "winback"]; // order matters: engaged recipients first
const dryRun = process.argv.includes("--dry-run");
const script = path.join(__dirname, "send-campaign.cjs");

async function reputation() {
  const cw = new CloudWatchClient({});
  const read = async (metric) => {
    const out = await cw.send(
      new GetMetricStatisticsCommand({
        Namespace: "AWS/SES",
        MetricName: metric,
        StartTime: new Date(Date.now() - 86400000),
        EndTime: new Date(),
        Period: 3600,
        Statistics: ["Maximum"],
      }),
    );
    return Math.max(0, ...(out.Datapoints || []).map((d) => d.Maximum ?? 0));
  };
  return { bounce: await read("Reputation.BounceRate"), complaint: await read("Reputation.ComplaintRate") };
}

function run(kind, args) {
  return execFileSync(process.execPath, [script, kind, ...args], {
    encoding: "utf8",
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1 << 26,
  });
}

function remaining(kind) {
  // A dry run lists only people not yet claimed for this campaign.
  const out = run(kind, ["--dry-run"]);
  const summary = JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1));
  return summary.recipients;
}

async function main() {
  const account = await new SESv2Client({}).send(new GetAccountCommand({}));
  const review = account.Details?.ReviewDetails?.Status;
  if (!account.ProductionAccessEnabled) {
    console.log(`SES production access: ${review || "not requested"}; nothing sent.`);
    return review === "DENIED" ? "DENIED" : "WAITING_APPROVAL";
  }

  const rep = await reputation();
  console.log(`Reputation (24h max): bounce ${(rep.bounce * 100).toFixed(2)}%, complaint ${(rep.complaint * 100).toFixed(3)}%`);
  if (rep.bounce > MAX_BOUNCE || rep.complaint > MAX_COMPLAINT) {
    console.log("Above the safety limits; not sending.");
    return "PAUSED";
  }

  const sentLast24 = Math.round(account.SendQuota?.SentLast24Hours || 0);
  let budget = Math.min(DAILY_CAP - sentLast24, Math.floor((account.SendQuota?.Max24HourSend || 0) - sentLast24));
  console.log(`Sent in the last 24h: ${sentLast24}; budget now: ${Math.max(0, budget)}`);

  let left = 0;
  for (const kind of CAMPAIGNS) {
    const todo = remaining(kind);
    console.log(`${kind}: ${todo} still to send`);
    if (!todo) continue;
    if (budget <= 0) {
      left += todo;
      continue;
    }
    const batch = Math.min(budget, todo);
    if (dryRun) {
      console.log(`(dry run) would send ${batch} ${kind}`);
      left += Math.max(0, todo - batch);
      continue;
    }
    const out = run(kind, ["--send", "--yes", `--max=${batch}`]);
    const done = out.match(/Done: (\d+) sent, (\d+) failed/);
    console.log(out.trim().split("\n").filter((l) => !/FIREBASE WARNING/.test(l)).slice(-3).join("\n"));
    // Failed sends count against the quota too, so spend them from the budget.
    budget -= done ? Number(done[1]) + Number(done[2]) : batch;
    // Recount from the claims instead of trusting the batch size: failed and
    // unattempted recipients stay unclaimed and must keep the rollout open.
    left += remaining(kind);
  }
  if (!left && !dryRun) return "COMPLETE";
  return dryRun ? "DRY_RUN" : "SENT";
}

main()
  .then((status) => {
    console.log(`STATUS ${status}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(error.message);
    console.log("STATUS ERROR");
    process.exit(1);
  });
