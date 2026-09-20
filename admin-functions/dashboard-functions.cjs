const { getDatabase } = require("firebase-admin/database");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onValueWritten } = require("firebase-functions/v2/database");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { createHash } = require("node:crypto");
const {
  aggregateDashboard,
  paymentEvidence,
  createSnapshot,
} = require("./analytics.cjs");
const options = {
  region: "us-central1",
  maxInstances: 3,
  serviceAccount: "bhajans-588f5@appspot.gserviceaccount.com",
};
exports.getSalesDashboard = onCall(
  { ...options, invoker: "public", timeoutSeconds: 120, memory: "512MiB" },
  async (request) => {
    if (!request.auth)
      throw new HttpsError("unauthenticated", "Sign in to view analytics.");
    const db = getDatabase();
    const role = (await db.ref(`admin/${request.auth.uid}`).get()).val();
    if (role !== "1")
      throw new HttpsError("permission-denied", "Admin access is required.");
    // Never accept a caller-selected database path or cache across authorization checks.
    const paths = [
      "paid",
      "transactions",
      "favorites",
      "analytics/paymentEvents",
      "analytics/snapshots",
    ];
    const [paid, transactions, favorites, events, snapshots] =
      await Promise.all(
        paths.map(async (path) => {
          const reference = db.ref(path);
          const query =
            path === "analytics/snapshots"
              ? reference.orderByKey().limitToLast(400)
              : reference;
          return (await query.get()).val() || {};
        }),
      );
    request.rawRequest?.res?.setHeader("Cache-Control", "private, no-store");
    return aggregateDashboard({
      paid,
      transactions,
      favorites,
      events,
      snapshots,
    });
  },
);
exports.archiveDashboardPayment = onValueWritten(
  { ...options, ref: "/paid/{uid}", instance: "bhajans-588f5", retry: true },
  async (event) => {
    const before = paymentEvidence(event.data.before.val()),
      after = paymentEvidence(event.data.after.val());
    if (JSON.stringify(before) === JSON.stringify(after)) return;
    const key = createHash("sha256").update(event.id).digest("hex");
    const record = {
      uid: event.params.uid,
      observedAt: Date.parse(event.time),
      before,
      after,
    };
    await getDatabase()
      .ref(`analytics/paymentEvents/${key}`)
      .transaction((current) => (current ? undefined : record));
  },
);
exports.captureDashboardSnapshot = onSchedule(
  {
    ...options,
    maxInstances: 1,
    schedule: "5 0 * * *",
    timeZone: "UTC",
    retryCount: 3,
    timeoutSeconds: 120,
  },
  async () => {
    const db = getDatabase();
    const [paid, favorites] = await Promise.all(
      ["paid", "favorites"].map(
        async (path) => (await db.ref(path).get()).val() || {},
      ),
    );
    const now = Date.now(),
      day = new Date(now).toISOString().slice(0, 10);
    const snapshot = createSnapshot(paid, favorites, now);
    await db
      .ref(`analytics/snapshots/${day}`)
      .transaction((current) => (current ? undefined : snapshot));
  },
);
