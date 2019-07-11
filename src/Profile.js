import React, { PureComponent } from "react";
import { auth, db, goOnline, goOffline } from "./firebase";
import { Link } from "react-router-dom";
import { getNext } from "./util";
// import PaypalExpressBtn from "react-paypal-express-checkout";
import { PayPalButton } from "react-paypal-button-v2";

class Pay extends PureComponent {
  componentWillMount() {
    const { history, location } = this.props;
    if (localStorage.paid === "1") history.push(getNext());
    const checkUser = async function() {
      if (auth.currentUser) {
        // only ask to confirmPayment if the person hasn't paid
        goOnline();
        var didPay = await db.ref(`/paid/${auth.currentUser.uid}`).once("value");
        if (didPay.val() === null) {
          await db
            .ref(`/confirmPayment/${auth.currentUser.uid}`)
            .set({ email: auth.currentUser.email, name: auth.currentUser.displayName, date: +new Date() });
        } else {
          localStorage.paid = "1";
          history.push(getNext());
        }
        goOffline();
      } else {
        history.replace(`/login${location.search}`);
      }
    };
    if (localStorage.uid && !auth.currentUser) {
      setTimeout(checkUser, 500);
    } else {
      checkUser();
    }
  }

  render() {
    // TODO reword this, work with bhuvanesh for payment flow, investigate firebase cloud function
    return (
      <div className="App">
        <div className="App-header">
          <img src="favicon.ico" alt="Sing " />
          <div className="title">Amma's Bhajans</div>
          <nav>
            <Link to={"/"}>Back </Link>
          </nav>
        </div>
        <div className="restPage">
          <p>To see the bhajans you need to pay.</p>
          <PayPalButton
            options={{
              clientId: "AYULgCpmdmH30YkpN4wPyPyV8zLVs6xjhAPf4xn5L7630tjjKtVYq36-24QrTOY4ZqsauweNE3IoCoQv"
            }}
            amount="15.00"
            onSuccess={(details, data) => {
              alert("Transaction completed by " + details.payer.name.given_name);
              // OPTIONAL: Call your server to save the transaction
              return fetch("/process", {
                method: "post",
                body: JSON.stringify({
                  ...data,
                  details
                })
              });
            }}
          />
        </div>
      </div>
    );
  }
}

export default Pay;
