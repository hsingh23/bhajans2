import React, { PureComponent } from "react";
import { auth, db, goOnline, goOffline } from "./firebase";
import { getNext } from "./util";
import { PayPalButton } from "react-paypal-button-v2";
import Select from "react-select";
import { alert } from "notie";

export const PLANS = [
  { value: "oneIndividual15", label: "One Year Individual - $15", price: 15.0, time: 31536000000 },
  { value: "fiveIndividual50", label: "Five Year Individual - $50", price: 50.0, time: 157680000000 },
  { value: "lifetimeIndividual80", label: "Lifetime Individual - $80", price: 80.0, time: 3153600000000 }
];

class Pay extends PureComponent {
  state = { selectedPlan: PLANS[1] };
  componentDidMount() {
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
          // TODO check when plan is over
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

  handleChange = selectedPlan => this.setState({ selectedPlan });

  render() {
    // TODO reword this, work with bhuvanesh for payment flow, investigate firebase cloud function

    return (
      <div className="App">
        <div className="App-header">
          <div className="title">Amma's Bhajans</div>
        </div>
        <div className="pay">
          <h2>Pricing</h2>
          <p>To see the bhajans you need to pay.</p>
          <p>There are 3 payment plans to choose from.</p>
          <ol>
            <li>
              <strong>$15</strong> - 1 year of access with updates
            </li>
            <li>
              <strong>$50</strong> - 5 years of access with updates
            </li>
            <li>
              <strong>$80</strong> - lifetime access with updates (best value)
            </li>
          </ol>
          <p>
            I will eventually add support for family plans which allow many users. It is recommended that each user gets
            their own account for personalization reasons (favorite songs, notifications, etc.).
          </p>
          <p>All the money collected is dontated to Embracing the World.</p>
          <p>
            Please select your payment plan and hit pay now. For any payment complications please email me at{" "}
            <a href="mailto:singwithamma@gmail.com">singwithamma@gmail.com</a> and I’ll get back to you as soon as I
            can. Low income plans are available by email only at this time.
          </p>
          <Select value={this.state.selectedPlan} onChange={this.handleChange} options={PLANS} />
          <div className="paypalButton">
            <PayPalButton
              options={{
                clientId: "AYULgCpmdmH30YkpN4wPyPyV8zLVs6xjhAPf4xn5L7630tjjKtVYq36-24QrTOY4ZqsauweNE3IoCoQv"
              }}
              amount={this.state.selectedPlan.price}
              onSuccess={(details, data) => {
                alert({ text: "Payment successful, updating app, please stay online." });
                // OPTIONAL: Call your server to save the transaction
                return fetch("https://us-central1-bhajans-588f5.cloudfunctions.net/process", {
                  method: "post",
                  body: JSON.stringify({
                    ...data,
                    type: this.state.selectedPlan.value,
                    uid: localStorage.uid
                  })
                }).then(resp => {
                  if (resp.ok) {
                    alert({ text: "App updated! Thanks for your support." });
                    this.props.history.push(`/login`);
                  }
                });
              }}
            />
          </div>
        </div>
      </div>
    );
  }
}

export default Pay;
