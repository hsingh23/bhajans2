const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getDatabase } = require("firebase-admin/database");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { expirationFor } = require("./access.cjs");
initializeApp();
const options = {
  region: "us-central1",
  maxInstances: 5,
  invoker: "public",
  // Gen 2 otherwise resets this to the Compute identity on every deployment.
  // The existing Firebase runtime identity has Auth and RTDB permissions.
  serviceAccount: "bhajans-588f5@appspot.gserviceaccount.com",
};

async function requireAdmin(request) {
  if (!request.auth)
    throw new HttpsError(
      "unauthenticated",
      "Sign in before using the admin dashboard.",
    );
  const role = (
    await getDatabase().ref(`admin/${request.auth.uid}`).get()
  ).val();
  if (role !== "1")
    throw new HttpsError(
      "permission-denied",
      "This account does not have admin access.",
    );
}

async function findUser(data) {
  const uid = typeof data?.uid === "string" ? data.uid.trim() : "";
  const email =
    typeof data?.email === "string"
      ? data.email
          .trim()
          .replace(/^mailto:/i, "")
          .toLowerCase()
      : "";
  if ((!uid && !email) || (uid && email) || uid.length > 128) {
    throw new HttpsError("invalid-argument", "Enter an email address or UID.");
  }
  try {
    return uid
      ? await getAuth().getUser(uid)
      : await getAuth().getUserByEmail(email);
  } catch (error) {
    if (error.code === "auth/user-not-found")
      throw new HttpsError(
        "not-found",
        "No account matches this email or UID.",
      );
    if (
      error.code === "auth/invalid-email" ||
      error.code === "auth/invalid-uid"
    )
      throw new HttpsError(
        "invalid-argument",
        "Enter a valid email address or UID.",
      );
    throw error;
  }
}
function userDetails(user, paid) {
  return {
    uid: user.uid,
    email: user.email || "",
    displayName: user.displayName || "",
    disabled: user.disabled,
    paidOn: paid?.paidOn || null,
    expiresOn: paid?.expiresOn || null,
  };
}
exports.getUserByEmail = onCall(options, async (request) => {
  await requireAdmin(request);
  const user = await findUser(request.data);
  const paid = (await getDatabase().ref(`paid/${user.uid}`).get()).val();
  return userDetails(user, paid);
});
exports.updateUserAccess = onCall(options, async (request) => {
  await requireAdmin(request);
  const user = await findUser({ uid: request.data?.uid });
  const now = Date.now();
  try {
    expirationFor(null, request.data, now);
  } catch (error) {
    throw new HttpsError("invalid-argument", error.message);
  }
  const result = await getDatabase()
    .ref(`paid/${user.uid}`)
    .transaction((current) => ({
      ...current,
      expiresOn: expirationFor(current, request.data, now),
      accessUpdatedOn: now,
      accessUpdatedBy: request.auth.uid,
    }));
  if (!result.committed)
    throw new HttpsError("aborted", "Access was not saved. Please retry.");
  return userDetails(user, result.snapshot.val());
});
