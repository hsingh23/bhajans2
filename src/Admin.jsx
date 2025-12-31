// @ts-nocheck
import { auth, db, getUserByEmail } from "./firebase";
import { Link } from "react-router-dom";
import { PLANS } from "./Plans";
import { ref, get, set } from "firebase/database";

import { CircularProgress } from "@mui/material";

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DebounceInput } from "react-debounce-input";
import { useQuery } from "@tanstack/react-query";
import DarkModeToggle from "./DarkModeToggle";
import Header from "./Header";

const createBody = encodeURIComponent(`Dear Customer

Thank you so much for your purchase of the Sing with Amma App and supporting Amma's Charities.

To get started, it is important that you create an account by visiting https://sing.withamma.com/#/login. Once you have created your account, please reply to this email with the email address you used to register. This will allow me to grant you access to the app and ensure that you have a smooth and seamless experience.

**** Without this step, you will not have access to the app.****

So please do not hesitate to reach out to me if you have any questions or need assistance with creating your account.

Thank you for your cooperation and we look forward to helping you get the most out of the Sing with Amma App.

Sincerely,
Harsh Singh`);

const Admin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const { isFetching, data } = useQuery({
    queryKey: ["email", email],
    queryFn: () => getUserByEmail({ email }).then((x) => x.data),
    enabled: !!email && email?.length > 3 && email.includes("@"),
  });
  const user = data || {};

  useEffect(() => {
    async function fetchData() {
      const uid = (auth.currentUser && auth.currentUser.uid) || localStorage.uid;
      if (!uid) {
        console.log("Need to login");
        navigate(`/login`);
        return;
      }
      try {
        const snap = await get(ref(db, `admin/${uid}`));
        if (!snap.exists()) {
          navigate(`/login`, { replace: true });
        }
      } catch (err) {
        console.error(err);
        navigate(`/login`, { replace: true });
      }
    }
    fetchData();
  }, [navigate]);

  const activateBody = encodeURIComponent(`Dear ${
    user?.displayName?.length > 2 ? user.displayName : "Customer"
  },

Thank you for purchasing a subscription to https://sing.withamma.com/#/ Your account is now active and you will have full access to all the bhajans and sheet music.

We hope you enjoy using the site and encourage you to share any feedback or questions you may have by clicking the bottom left button on the site.

Happy singing!

Sincerely,
Harsh Singh`);

  let setPaid = async (e) => {
    let planName = e.target.name || e.target.parentElement.name;
    let plan = PLANS.find((x) => x.value === planName);
    if (user?.uid && plan) {
      try {
        await set(ref(db, `paid/${user.uid}`), {
          expiresOn: +new Date() + plan.time,
          gross_total_amount: {
            currency: "USD",
            value: plan.price,
          },
          mode: "live",
          manual: true,
          orderID: "admin",
          paidOn: +new Date(),
          payer: {
            payer_id: "admin",
          },
        });
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className='App'>
      <Header back title="Admin Dashboard" />
      <div className='restPage' style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', paddingTop: '100px' }}>
        <div style={{ backgroundColor: 'var(--card-bg)', padding: '30px', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)' }}>
          <h2 style={{ marginTop: 0, marginBottom: '20px', textAlign: 'center' }}>Admin Dashboard</h2>
          
          <div style={{ marginBottom: '30px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Find User by Email</label>
            <div style={{ display: "flex", gap: '10px', alignItems: 'center' }}>
              <DebounceInput
                className="form-control"
                style={{ flex: "1", padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', backgroundColor: 'var(--input-bg)', color: 'var(--text-main)', fontSize: '16px' }}
                debounceTimeout={400}
                type='text'
                value={email}
                placeholder='user@example.com'
                onChange={(e) =>
                  setEmail(() => e.target.value.trim().replace(/^mailto:/, ""))
                }
              />
              {isFetching && <CircularProgress size={24} />}
            </div>
          </div>

          {user?.uid ? (
            <div style={{ border: '1px solid var(--border-color)', padding: '20px', borderRadius: 'var(--radius-md)', marginBottom: '30px' }}>
              <h3 style={{ marginTop: 0 }}>User Details</h3>
              <p style={{ margin: '5px 0', fontSize: '16px' }}><strong>UID:</strong> {user.uid}</p>
              <p style={{ margin: '5px 0', fontSize: '16px' }}><strong>Email:</strong> {user.email}</p>
              <p style={{ margin: '5px 0', fontSize: '16px' }}><strong>Name:</strong> {user.displayName}</p>
              <p style={{ margin: '5px 0', fontSize: '16px' }}><strong>Paid On:</strong> {user.paidOn ? new Date(user.paidOn).toLocaleDateString() : 'N/A'}</p>
              <p style={{ margin: '5px 0', fontSize: '16px', color: (user.expiresOn && +user.expiresOn < +new Date()) ? 'red' : 'inherit' }}>
                <strong>Expires On:</strong> {user.expiresOn ? new Date(user.expiresOn).toLocaleDateString() : 'N/A'}
              </p>
              
              <div style={{ marginTop: '20px' }}>
                <a
                  className="button button-action"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  target='_blank'
                  rel='noreferrer'
                  href={`mailto:${user.email}?subject=Welcome to Sing with Amma - Full Access Granted&body=${activateBody}`}>
                  Send Activation Email
                </a>
              </div>
            </div>
          ) : email && !isFetching && (
            <div style={{ textAlign: 'center', padding: '20px', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)', marginBottom: '30px' }}>
              <p style={{ margin: 0, marginBottom: '15px' }}>User not found or hasn&apos;t logged in yet.</p>
              <a
                className="button button-primary"
                style={{ textDecoration: 'none' }}
                href={`mailto:${email}?subject=Important: Complete Account Setup to Gain Access to Sing with Amma&body=${createBody}`}
                target='_blank'
                rel='noreferrer'>
                Send Setup Instructions
              </a>
            </div>
          )}

          {user?.uid && (
            <div>
              <h3 style={{ marginBottom: '15px' }}>Grant Access</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {PLANS.map((x) => (
                  <button
                    key={x.value}
                    onClick={setPaid}
                    name={x.value}
                    className="button button-3d button-primary"
                    style={{ width: '100%' }}>
                    {x.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Admin;
