import { auth, db, getUserByEmail } from "./firebase";
import { Link } from "react-router-dom";
import { PLANS } from "./Plans";

import { Button, CircularProgress } from "@material-ui/core";

import React, { useState, useEffect, useCallback } from "react";
import { useHistory } from "react-router-dom/cjs/react-router-dom.min";
import { DebounceInput } from "react-debounce-input";

const createBody = encodeURIComponent(`Dear Customer

Thank you so much for your purchase of the Sing with Amma App and supporting Amma's Charities.

To get started, it is important that you create an account by visiting https://sing.withamma.com/#/login. Once you have created your account, please reply to this email with the email address you used to register. This will allow me to grant you access to the app and ensure that you have a smooth and seamless experience.

**** Without this step, you will not have access to the app.****

So please do not hesitate to reach out to me if you have any questions or need assistance with creating your account.

Thank you for your cooperation and we look forward to helping you get the most out of the Sing with Amma App.

Sincerely,
Harsh Singh`);

const Admin = () => {
  const history = useHistory();
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState(null);
  const [user, setUser] = useState({});
  let getUser = useCallback(async () => {
    if (email.includes("@")) {
      try {
        let user = await getUserByEmail({ email }).then((x) => x.data);
        setUser(user || {});
      } catch (error) {}
    }
  }, [email]);
  useEffect(() => {
    if (email != null && email.includes("@")) {
      getUser();
    }
  }, [email, getUser]);
  useEffect(() => {
    async function fetchData() {
      const uid =
        (auth.currentUser && auth.currentUser.uid) || localStorage.uid;
      if (!uid) {
        console.log("Need to login");
        history.push(`/login`);
      }
      await db
        .ref(`admin/${uid}`)
        .once("value")
        .then(function (snapshot) {
          if (snapshot.val() === null) {
            history.replace(`/login`);
            setIsAdmin(false);
          } else {
            setIsAdmin(true);
          }
        });
    }
    fetchData();
  }, [history]);
  const activateBody = encodeURIComponent(`Dear ${
    user?.name?.length > 2 ? user.name : "Customer"
  },

Thank you for purchasing a subscription to https://sing.withamma.com/#/ Your account is now active and you will have full access to all the bhajans and sheet music.

We hope you enjoy using the site and encourage you to share any feedback or questions you may have by clicking the bottom left button on the site.

Happy singing!

Sincerely,
Harsh Singh`);

  let setPaid = async (e) => {
    let plan = PLANS.find(
      (x) => x.value === (e.target.name || e.target.parentElement.name)
    );
    console.log(plan, e.target.name || e.target.parentElement.name);
    await getUser();
    if (user.uid) {
      try {
        await db.ref(`paid/${user.uid}`).set({
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
        getUser();
      } catch (e) {}
    }
  };

  return !isAdmin ? (
    <CircularProgress />
  ) : (
    <div className='App'>
      <div className='App-header'>
        <div className='title'>Amma's Bhajans</div>
        <nav>
          <Link to={"/"}>Back </Link>
        </nav>
      </div>
      <div className='restPage'>
        <div>
          {/* <input type="text" ref={this.input} placeholder="uid" /> */}
          <DebounceInput
            style={{ minWidth: "min( 95%, 800px )" }}
            minLength={3}
            debounceTimeout={100}
            type='text'
            value={email}
            placeholder='email'
            onChange={(e) =>
              setEmail(e.target.value.trim().replace(/^mailto:/, ""))
            }
          />
          {PLANS.map((x) => (
            <Button
              onClick={setPaid}
              name={x.value}
              variant='contained'
              style={{ display: "block", margin: "10px" }}>
              {x.label}
            </Button>
          ))}
        </div>
        {user.uid && (
          <div>
            <a
              target='_blank'
              rel='noreferrer'
              href={`mailto:${user.email}?subject=Welcome to Sing with Amma - Full Access Granted&body=${activateBody}`}>
              Account Activated Email
            </a>
            <p>UID: {user.uid}</p>
            <p>email: {user.email}</p>
            <p>displayName: {user.displayName}</p>
            <p>paidOn: {new Date(user.paidOn).toLocaleDateString()}</p>
            <p>expiresOn: {new Date(user.expiresOn).toLocaleDateString()}</p>
          </div>
        )}
        {email && !user.uid && (
          <a
            href={`mailto:${email}?subject=Important: Complete Account Setup to Gain Access to Sing with Amma&body=${createBody}`}
            target='_blank'
            rel='noreferrer'>
            Create Account Email
          </a>
        )}
      </div>
    </div>
  );
};

export default Admin;
