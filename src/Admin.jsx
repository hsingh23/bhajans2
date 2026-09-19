// @ts-nocheck
import React, { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref } from "firebase/database";
import { auth, db, getUserByEmail, updateUserAccess } from "./firebase";
import Header from "./Header";
import "./Admin.css";

const fieldStyle = {
  padding: 12,
  width: "100%",
  boxSizing: "border-box",
  background: "var(--input-bg)",
  color: "var(--text-main)",
  border: "1px solid var(--border-color)",
  borderRadius: 8,
  fontSize: 16,
};
const formatDate = (value) =>
  value
    ? new Date(value).toLocaleString(undefined, { timeZone: "UTC" }) + " UTC"
    : "Not set";

export default function Admin() {
  const [authorization, setAuthorization] = useState("loading");
  const [query, setQuery] = useState("");
  const [user, setUser] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [years, setYears] = useState("1");
  const [date, setDate] = useState("");

  useEffect(() => {
    let generation = 0;
    const unsubscribe = onAuthStateChanged(auth, async (signedIn) => {
      const current = ++generation;
      setAuthorization("loading");
      setUser(null);
      if (!signedIn) {
        setAuthorization("signed-out");
        return;
      }
      try {
        const snapshot = await get(ref(db, `admin/${signedIn.uid}`));
        if (current === generation)
          setAuthorization(snapshot.val() === "1" ? "admin" : "denied");
      } catch {
        if (current === generation) setAuthorization("error");
      }
    });
    return () => {
      generation++;
      unsubscribe();
    };
  }, []);

  async function search(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setUser(null);
    setBusy(true);
    const input = query.trim().replace(/^mailto:/i, "");
    try {
      const result = await getUserByEmail(
        input.includes("@") ? { email: input.toLowerCase() } : { uid: input },
      );
      if (!result.data?.uid)
        throw new Error(
          "Lookup returned no account. Please retry or check the backend deployment.",
        );
      setUser(result.data);
      setDate(
        result.data.expiresOn
          ? new Date(result.data.expiresOn).toISOString().slice(0, 10)
          : "",
      );
    } catch (err) {
      setError(
        err.code === "functions/not-found"
          ? "No account matches this email or UID."
          : `Lookup failed: ${err.message}`,
      );
    } finally {
      setBusy(false);
    }
  }
  async function save(change) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await updateUserAccess({ uid: user.uid, ...change });
      setUser(result.data);
      setDate(new Date(result.data.expiresOn).toISOString().slice(0, 10));
      setNotice(`Access saved. Expires ${formatDate(result.data.expiresOn)}.`);
    } catch (err) {
      setError(`Access was not saved: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="App">
      <Header back title="Admin Dashboard" />
      <main
        className="restPage admin-dashboard-page"
      >
        <section
          style={{
            background: "var(--card-bg)",
            padding: 24,
            borderRadius: 16,
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <h2>Admin Dashboard</h2>
          {authorization === "loading" && (
            <p role="status">Checking admin access…</p>
          )}
          {authorization === "signed-out" && (
            <p>
              <a href="#/login">Sign in</a> to use the admin dashboard.
            </p>
          )}
          {authorization === "denied" && (
            <p role="alert">This account does not have admin access.</p>
          )}
          {authorization === "error" && (
            <p role="alert">
              Could not check admin access. Check your connection and reload.
            </p>
          )}
          {authorization === "admin" && (
            <>
              <form onSubmit={search}>
                <label htmlFor="user-search">Find user by email or UID</label>
                <input
                  id="user-search"
                  style={fieldStyle}
                  value={query}
                  disabled={busy}
                  required
                  placeholder="Email address or Firebase UID"
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setUser(null);
                    setError("");
                    setNotice("");
                  }}
                />
                <button
                  className="button button-primary"
                  disabled={busy || !query.trim()}
                  type="submit"
                  style={{ marginTop: 12 }}
                >
                  {busy ? "Working…" : "Find user"}
                </button>
              </form>
              {error && <p role="alert">{error}</p>}
              {notice && <p role="status">{notice}</p>}
              {user && (
                <div style={{ marginTop: 24, overflowWrap: "anywhere" }}>
                  <h3>{user.displayName || "User details"}</h3>
                  <p>
                    <strong>Email:</strong> {user.email || "No email address"}
                  </p>
                  <p>
                    <strong>UID:</strong> {user.uid}
                  </p>
                  <p>
                    <strong>Account:</strong>{" "}
                    {user.disabled ? "Disabled" : "Enabled"}
                  </p>
                  <p>
                    <strong>Paid on:</strong> {formatDate(user.paidOn)}
                  </p>
                  <p>
                    <strong>Expires on:</strong> {formatDate(user.expiresOn)}
                  </p>
                  <h3>Extend access</h3>
                  <p>
                    Years are added to the existing expiration, or today if
                    access has expired.
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                    <button
                      className="button button-primary"
                      disabled={busy}
                      onClick={() => save({ mode: "years", years: 1 })}
                    >
                      Add 1 year
                    </button>
                    <button
                      className="button button-primary"
                      disabled={busy}
                      onClick={() => save({ mode: "years", years: 10 })}
                    >
                      Add 10 years
                    </button>
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      save({ mode: "years", years: Number(years) });
                    }}
                    style={{ marginTop: 20 }}
                  >
                    <label htmlFor="extra-years">Extra years (1–100)</label>
                    <input
                      id="extra-years"
                      type="number"
                      min="1"
                      max="100"
                      step="1"
                      required
                      disabled={busy}
                      value={years}
                      onChange={(e) => setYears(e.target.value)}
                      style={fieldStyle}
                    />
                    <button
                      type="submit"
                      disabled={busy}
                      className="button button-primary"
                      style={{ marginTop: 12 }}
                    >
                      Add years
                    </button>
                  </form>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      save({ mode: "date", date });
                    }}
                    style={{ marginTop: 24 }}
                  >
                    <label htmlFor="expiration">Set expiration date</label>
                    <input
                      id="expiration"
                      type="date"
                      required
                      disabled={busy}
                      min={new Date().toISOString().slice(0, 10)}
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      style={fieldStyle}
                    />
                    <p>
                      Replaces the current expiration. Access lasts through the
                      selected date in UTC.
                    </p>
                    <button
                      type="submit"
                      disabled={busy}
                      className="button button-primary"
                    >
                      Set expiration
                    </button>
                  </form>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
