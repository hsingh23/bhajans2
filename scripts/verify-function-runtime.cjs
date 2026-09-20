// Read-only production guard: never treat a successful deploy as proof of IAM correctness.
const { execFileSync } = require("node:child_process");
const assert = require("node:assert/strict");
const expectedNames = [
  "getUserByEmail",
  "updateUserAccess",
  "amritabooks",
  "manuallyAddUser",
  "shopifyWebhook",
  "paidNotification",
  "getSalesDashboard",
  "archiveDashboardPayment",
  "captureDashboardSnapshot",
];
const deployed = JSON.parse(
  execFileSync(
    "gcloud",
    ["functions", "list", "--project", "bhajans-588f5", "--format=json"],
    { encoding: "utf8" },
  ),
);
for (const name of expectedNames) {
  const fn = deployed.find((f) => f.name.split("/").pop() === name);
  assert.ok(fn, `${name} is missing from production`);
  assert.equal(fn.state, "ACTIVE", `${name} is not active`);
  assert.equal(
    fn.buildConfig.runtime,
    "nodejs24",
    `${name} has the wrong runtime`,
  );
  assert.equal(
    fn.serviceConfig.serviceAccountEmail,
    "bhajans-588f5@appspot.gserviceaccount.com",
    `${name} has the wrong database runtime identity`,
  );
  console.log(`${name}: ACTIVE, Node 24, Firebase runtime identity verified`);
}
console.log(
  "Runtime configuration passed. Also verify authenticated admin lookup and analytics, plus unauthenticated/non-admin analytics rejection.",
);
