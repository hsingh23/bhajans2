import React, { PureComponent } from "react";
import { auth } from "./firebase";
import { getNext } from "./util";
import { PayPalButton } from "react-paypal-button-v2";
import Select from "react-select";
import { alert } from "notie";

export const PLANS = [
  { value: "oneIndividual10", label: "One Year Individual - $9.99", price: 9.99, time: 31536000000 },
  { value: "fiveIndividual40", label: "Five Year Individual - $39.99", price: 39.99, time: 157680000000 },
  { value: "lifetimeIndividual50", label: "Lifetime Individual - $49.99", price: 49.99, time: 3153600000000 }
];

class Pay extends PureComponent {
  state = { selectedPlan: PLANS[1] };
  componentDidMount() {
    const { history } = this.props;
    const checkUser = async function() {
      if (auth.currentUser && localStorage.expiresOn && +localStorage.expiresOn > +new Date()) {
        alert({
          text: `You have already paid, your subscription will end on ${new Date(
            +localStorage.expiresOn
          ).toLocaleDateString()}`
        });
      } else if (!auth.currentUser) {
        history.push(`/login`);
      }
    };
    if (localStorage.uid && !auth.currentUser) {
      setTimeout(checkUser, 700);
    } else {
      checkUser();
    }
  }

  handleChange = selectedPlan => this.setState({ selectedPlan });

  render() {
    // Change mode here              ⬇️ to switch between sandbox and live paypal
    const mode = ["sandbox", "live"][1];
    const clientId =
      mode === "sandbox"
        ? "AYULgCpmdmH30YkpN4wPyPyV8zLVs6xjhAPf4xn5L7630tjjKtVYq36-24QrTOY4ZqsauweNE3IoCoQv" // sandbox
        : "AcMLkUUIQ0-xZgsxf6I6I35spceQPDvvRu_uVXXclMOY_Vp7-Bvz4IdPVlAtmMHSIfddj0p1sUUwUu4i"; // live

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
            {/* <li>
              <strong>$10</strong> - 1 year of access with updates (for low income/ashram residents/tour staff special)
            </li> */}
            <li>
              <strong>$9.99</strong> - 1 year of access with updates
            </li>
            <li>
              <strong>$39.99</strong> - 5 years of access with updates
            </li>
            <li>
              <strong>$49.99</strong> - lifetime access with updates (best value)
            </li>
          </ol>

          <p>
            All proceeds support <a href="http://www.embracingtheworld.org/">Embracing the World</a> nonprofit.
          </p>
          <p>Please select your payment plan and pay with Paypal/Credit card.</p>
          <Select value={this.state.selectedPlan} onChange={this.handleChange} options={PLANS} />
          <div className="paypalButton">
            <PayPalButton
              options={{
                clientId
              }}
              amount={this.state.selectedPlan.price}
              onSuccess={(details, data) => {
                alert({ text: "Payment successful, updating app, please stay online." });
                return fetch("https://us-central1-bhajans-588f5.cloudfunctions.net/process", {
                  method: "post",
                  body: JSON.stringify({
                    ...data,
                    type: this.state.selectedPlan.value,
                    uid: localStorage.uid,
                    mode
                  })
                })
                  .then(resp => {
                    if (resp.ok) {
                      return resp.json();
                    }
                  })
                  .then(({ expiresOn }) => {
                    localStorage.expiresOn = +expiresOn;
                    localStorage.lastOnline = +new Date();
                    alert({
                      text: `App updated! Thanks for your support. Your subscription expires on ${new Date(
                        +localStorage.expiresOn
                      ).toLocaleDateString()}`
                    });
                    this.props.history.push(`/`);
                  });
              }}
            />
          </div>
          <small>
            For any payment complications please email{" "}
            <a href="mailto:singwithamma@gmail.com">singwithamma@gmail.com</a>.
          </small>
        </div>
      </div>
    );
  }
}

export default Pay;
