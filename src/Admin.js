import React, { PureComponent } from "react";
import { auth, db } from "./firebase";
import { Link } from "react-router-dom";
import { PLANS } from "./Pay";
import Select from "react-select";

class Admin extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      users: {},
      selectedPlan: PLANS[2]
    };
  }

  input = React.createRef();
  handleChange = selectedPlan => this.setState({ selectedPlan });

  componentDidMount() {
    const { history, match } = this.props;
    const awaitCurrentUser = () => {
      const uid =
        (auth.currentUser && auth.currentUser.uid) || localStorage.uid;
      if (!uid) {
        console.log("Need to login");
        history.push(
          `/login?next=${decodeURIComponent(match.params.next || "/")}`
        );
      }
      db.ref(`admin/${uid}`).once("value").then(function(snapshot) {
        console.log(snapshot.val(), "value");

        if (snapshot.val() === null)
          history.replace(
            `/login?next=${decodeURIComponent(match.params.next || "/")}`
          );
      });
      this.confirmBeta.on("value", snap => {
        this.setState({ users: snap.val() || {} });
      });
    };
    setTimeout(awaitCurrentUser, 500);
    this.confirmBeta = db.ref("confirmBeta");
    this.confirmedBeta = db.ref("confirmedBeta");
    this.beta = db.ref("beta");

    // TODO: this should not be value!
    // TODO: set renewBeta table
  }
  // componentWillUnmount() {
  //   return goOffline();
  // }

  //   createEmailTemplate = user => {
  //     const body = encodeURIComponent(`Om Namah Shivaya ${user.name},

  // Thank you for joining the beta team for https://sing.withamma.com/#/ 🤗. We may send you surveys, push notifications, emails to help us make this a better experience for everyone.

  // Please like our Facebook page: https://www.facebook.com/sing.withamma/?ref=beta_email

  // If you have see any errors like incorrect page number, broken search, website malfunctions, etc. please let me know at https://feedback.userreport.com/9f29eba3-9795-415f-9f34-3e1a2c8fb6ed/

  // 🎉 Thanks so much 🎉

  // Peace `);

  //     return window.localStorage.email.includes("gmail") && window.document.documentElement.clientWidth > 1024
  //       ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(user.email)}&su=${encodeURIComponent(
  //           "[sing.withamma.com] Thanks for joining the beta 😄"
  //         )}&bcc=hisingh1@gmail.com&body=${body}`
  //       : `mailto:${encodeURIComponent(user.email)}?subject=${encodeURIComponent(
  //           "[sing.withamma.com] Thanks for joining the beta"
  //         )}&bcc=hisingh1@gmail.com&body=${body}`;
  //   };

  setBeta = function(uid, user) {
    this.confirmedBeta.child(uid).set(user);
    this.confirmBeta.child(uid).remove();
    this.beta.child(uid).set("1");
    window.open(this.createEmailTemplate(user));
    return 1;
  };

  setPaid = () => {
    db.ref(`paid/${this.input.current.value}`).set({
      expiresOn: +new Date() + this.state.selectedPlan.time,
      gross_total_amount: {
        currency: "USD",
        value: this.state.selectedPlan.price
      },
      mode: "live",
      manual: true,
      orderID: "admin",
      paidOn: +new Date(),
      payer: {
        payer_id: "admin"
      }
    });
  };

  render() {
    // const { users } = this.state;
    return (
      <div className="App">
        <div className="App-header">
          <div className="title">Amma's Bhajans</div>
          <nav>
            <Link to={"/"}>Back </Link>
          </nav>
        </div>
        <div className="restPage">
          <p>Given a userId, give them access to the paid site.</p>
          <div>
            <input type="text" ref={this.input} placeholder="uid" />
            <Select
              value={this.state.selectedPlan}
              onChange={this.handleChange}
              options={PLANS}
            />
            <input type="button" value="submit" onClick={this.setPaid} />
          </div>
        </div>
      </div>
    );
  }
}

export default Admin;
