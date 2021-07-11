import { auth, db, getUserByEmail } from "./firebase";
import { Link } from "react-router-dom";
import { PLANS } from "./Plans";

import { Button, CircularProgress } from "@material-ui/core";


import React, { useState, useEffect, useCallback } from 'react';
import { useHistory } from "react-router-dom/cjs/react-router-dom.min";
import { DebounceInput } from "react-debounce-input";
const Admin = () => {
  const history = useHistory()
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState(null);
  const [user, setUser] = useState({});
  let getUser = useCallback(async () => {
    try {
      let user = await getUserByEmail({email}).then(x => x.data)
      setUser(user || {})
    } catch (error) {
    }
  }, [email])
  useEffect(() => {
    if (email != null && email.includes("@")) {
      getUser()
    }
  }, [email, getUser])
  useEffect(() => {
    async function fetchData() {
      const uid = (auth.currentUser && auth.currentUser.uid) || localStorage.uid;
      if (!uid) {
        console.log("Need to login");
        history.push(`/login`);
      }
      await db.ref(`admin/${uid}`).once("value").then(function(snapshot) {
        if (snapshot.val() === null) {
          history.replace(`/login`);
          setIsAdmin(false);
        } else {
          setIsAdmin(true);
        }
      });
    }
    fetchData()
  }, [history])

  let setPaid = async (e) => {
    let plan = PLANS.find(x => x.value === (e.target.name || e.target.parentElement.name))
    console.log(plan, e.target.name || e.target.parentElement.name)
    await getUser()
    if (user.uid) {
      try{
        await db.ref(`paid/${user.uid}`).set({
          expiresOn: +new Date() + plan.time,
          gross_total_amount: {
            currency: "USD",
            value: plan.price
          },
          mode: "live",
          manual: true,
          orderID: "admin",
          paidOn: +new Date(),
          payer: {
            payer_id: "admin"
          }
        });
        getUser()
      } catch (e) {
        
      }
      
    }
  };
  
  return !isAdmin ? <CircularProgress /> :
        <div className="App">
          <div className="App-header">
            <div className="title">Amma's Bhajans</div>
            <nav>
              <Link to={"/"}>Back </Link>
            </nav>
          </div>
          <div className="restPage">
            <div>
              {/* <input type="text" ref={this.input} placeholder="uid" /> */}
              <DebounceInput
                minLength={3}
                debounceTimeout={700}
                type="text" value={email} placeholder="email" onChange={(e) => setEmail(e.target.value.trim().replace(/^mailto:/, ""))} /> 
              {PLANS.map(x => 
                <Button onClick={setPaid} name={x.value} variant="contained" style={{ display: 'block', margin: "10px" } }>{x.label}</Button>
              )}
            </div>
            {user.uid && <div>
              <p>UID: {user.uid}</p>
              <p>email: {user.email}</p>
              <p>displayName: {user.displayName}</p>
              <p>paidOn: {new Date(user.paidOn).toLocaleDateString()}</p>
              <p>expiresOn: {new Date(user.expiresOn).toLocaleDateString()}</p>
            </div>}

          </div>
        </div>
}
 
export default Admin;