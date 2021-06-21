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
    let plan = PLANS.find(x => x.value === e.target.name || e.target.parentElement.name)
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
                type="text" value={email} placeholder="email" onChange={(e) => setEmail(e.target.value)} /> 
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
// class Admin extends PureComponent {
//   constructor(props) {
//     super(props);
//     this.state = {
//       isAdmin: false
//     };
//   }

//   input = React.createRef();
//   handleChange = selectedPlan => this.setState({ selectedPlan });

//   componentDidMount() {
//     const { history, match } = this.props;
//     const {setState} = this;
//     const awaitCurrentUser = () => {
//       const uid =
//         (auth.currentUser && auth.currentUser.uid) || localStorage.uid;
//       if (!uid) {
//         console.log("Need to login");
//         history.push(
//           `/login?next=${decodeURIComponent(match.params.next || "/")}`
//         );
//       }
//       db.ref(`admin/${uid}`).once("value").then(function(snapshot) {
//         if (snapshot.val() === null) {
//           history.replace(
//             `/login?next=${decodeURIComponent(match.params.next || "/")}`
//           );
//         } else {
//           setState({isAdmin: true})
//         }
//       });
//     };
//     setTimeout(awaitCurrentUser, 500);
//     this.confirmBeta = db.ref("confirmBeta");
//     this.confirmedBeta = db.ref("confirmedBeta");
//     this.beta = db.ref("beta");

//     // TODO: this should not be value!
//     // TODO: set renewBeta table
//   }
//   // componentWillUnmount() {
//   //   return goOffline();
//   // }

//   //   createEmailTemplate = user => {
//   //     const body = encodeURIComponent(`Om Namah Shivaya ${user.name},

//   // Thank you for joining the beta team for https://sing.withamma.com/#/ 🤗. We may send you surveys, push notifications, emails to help us make this a better experience for everyone.

//   // Please like our Facebook page: https://www.facebook.com/sing.withamma/?ref=beta_email

//   // If you have see any errors like incorrect page number, broken search, website malfunctions, etc. please let me know at https://feedback.userreport.com/9f29eba3-9795-415f-9f34-3e1a2c8fb6ed/

//   // 🎉 Thanks so much 🎉

//   // Peace `);

//   //     return window.localStorage.email.includes("gmail") && window.document.documentElement.clientWidth > 1024
//   //       ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(user.email)}&su=${encodeURIComponent(
//   //           "[sing.withamma.com] Thanks for joining the beta 😄"
//   //         )}&bcc=hisingh1@gmail.com&body=${body}`
//   //       : `mailto:${encodeURIComponent(user.email)}?subject=${encodeURIComponent(
//   //           "[sing.withamma.com] Thanks for joining the beta"
//   //         )}&bcc=hisingh1@gmail.com&body=${body}`;
//   //   };

//   setBeta = function(uid, user) {
//     this.confirmedBeta.child(uid).set(user);
//     this.confirmBeta.child(uid).remove();
//     this.beta.child(uid).set("1");
//     window.open(this.createEmailTemplate(user));
//     return 1;
//   };

//   setPaid = (e) => {
//     let plan = PLANS.find(x => x.value === e.target.value)
//     db.ref(`paid/${this.input.current.value}`).set({
//       expiresOn: +new Date() + plan.time,
//       gross_total_amount: {
//         currency: "USD",
//         value: plan.price
//       },
//       mode: "live",
//       manual: true,
//       orderID: "admin",
//       paidOn: +new Date(),
//       payer: {
//         payer_id: "admin"
//       }
//     });
//   };

//   render() {
//     // const { users } = this.state;
//     return (
//       this.state.isAdmin ? <CircularProgress /> :
//       <div className="App">
//         <div className="App-header">
//           <div className="title">Amma's Bhajans</div>
//           <nav>
//             <Link to={"/"}>Back </Link>
//           </nav>
//         </div>
//         <div className="restPage">
//           <div>
//             {/* <input type="text" ref={this.input} placeholder="uid" /> */}
//             <Input type="text" ref={this.input} placeholder="email" /> 
//             {PLANS.map(x => 
//               <Button onClick={this.setPaid} value={x.value} variant="contained" style={{ display: 'block', margin: "10px" } }>{x.label}</Button>
//             )}
//             {/* <Select
//               value={this.state.selectedPlan}
//               onChange={this.handleChange}
//               options={PLANS}
//             />
//             <input type="button" value="submit" onClick={this.setPaid} /> */}
//           </div>
//         </div>
//       </div>
//     );
//   }
// }

// export default Admin;
