// @ts-nocheck
import React, { useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseApp } from "./firebase";

const field = {
  padding: 12,
  width: "100%",
  boxSizing: "border-box",
  background: "var(--input-bg)",
  color: "var(--text-main)",
  border: "1px solid var(--border-color)",
  borderRadius: 8,
  fontSize: 16,
};

/** Admin form: push a short announcement to everyone who turned notifications on. */
const AnnouncementForm = () => {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("/");
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  const send = async (event) => {
    event.preventDefault();
    if (!window.confirm(`Send "${title}" to everyone with notifications on?`)) return;
    setBusy(true);
    setStatus(null);
    try {
      const call = httpsCallable(getFunctions(firebaseApp, "us-central1"), "sendAnnouncement");
      const { data } = await call({ title, body, link });
      setStatus({ ok: true, text: `Sent to ${data.sent} devices (${data.removed} expired ones cleaned up).` });
    } catch (error) {
      setStatus({ ok: false, text: error.message || "Could not send the announcement." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      style={{ marginTop: 24, background: "var(--card-bg)", padding: 24, borderRadius: 16, boxShadow: "var(--shadow-lg)" }}>
      <h2>Send a notification</h2>
      <p>Goes to everyone who turned on notifications in the app. Keep it rare and useful, like new bhajans.</p>
      <form onSubmit={send} style={{ display: "grid", gap: 12 }}>
        <label>
          Title ({title.length}/65)
          <input style={field} value={title} maxLength={65} required onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          Message ({body.length}/180)
          <textarea style={field} rows={3} value={body} maxLength={180} required onChange={(e) => setBody(e.target.value)} />
        </label>
        <label>
          Opens (a page on sing.withamma.com)
          <input style={field} value={link} onChange={(e) => setLink(e.target.value)} placeholder='/' />
        </label>
        <button type='submit' disabled={busy || !title || !body} className='button button-primary'>
          {busy ? "Sending…" : "Send notification"}
        </button>
        {status && <p role={status.ok ? "status" : "alert"}>{status.text}</p>}
      </form>
    </section>
  );
};

export default AnnouncementForm;
