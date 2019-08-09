import React, { PureComponent } from "react";
import { auth, db, goOnline, goOffline } from "./firebase";
import { Link } from "react-router-dom";
import { getNext } from "./util";
// import PaypalExpressBtn from "react-paypal-express-checkout";
import { PayPalButton } from "react-paypal-button-v2";

class Pay extends PureComponent {
  render() {
    // TODO reword this, work with bhuvanesh for payment flow, investigate firebase cloud function
    return (
      <div className="App">
        <div className="App-header">
          <div className="title">Amma's Bhajans</div>
        </div>
        <div className="restPage">
          <h2>Profile</h2>
        </div>
      </div>
    );
  }
}

export default Pay;
