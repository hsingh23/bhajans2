import React, { PureComponent } from "react";
import { auth } from "./firebase";
import { PayPalButton } from "react-paypal-button-v2";
import Select from "react-select";
import { alert } from "notie";
import { Link } from "react-router-dom";

export const PLANS = [
  {
    value: "oneIndividual10",
    label: "One Year Individual - $9.99",
    price: 9.99,
    time: 31536000000
  },
  {
    value: "fiveIndividual40",
    label: "Five Year Individual - $39.99",
    price: 39.99,
    time: 157680000000
  },
  {
    value: "lifetimeIndividual50",
    label: "Lifetime Individual - $49.99",
    price: 49.99,
    time: 3153600000000
  }
];

class Pay extends PureComponent {
  state = { selectedPlan: PLANS[2] };
  componentDidMount() {
    const { history } = this.props;
    const checkUser = async function() {
      if (
        auth.currentUser &&
        localStorage.expiresOn &&
        +localStorage.expiresOn > +new Date()
      ) {
        alert({
          text: `You have already paid, your subscription will end on ${new Date(
            +localStorage.expiresOn
          ).toLocaleDateString()}`
        });
      } else if (!auth.currentUser || !localStorage.uid) {
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
    const { email, displayName, expiresOn = undefined, uid } = localStorage;
    const paymentMessage =
      new Date(+expiresOn) > new Date()
        ? ` and your membership expires on ${new Date(
            +expiresOn
          ).toLocaleDateString()}.`
        : " and you have not yet paid for the app.";

    const mode = ["sandbox", "live"][1];
    const clientId =
      mode === "sandbox"
        ? "AYULgCpmdmH30YkpN4wPyPyV8zLVs6xjhAPf4xn5L7630tjjKtVYq36-24QrTOY4ZqsauweNE3IoCoQv" // sandbox
        : "AcMLkUUIQ0-xZgsxf6I6I35spceQPDvvRu_uVXXclMOY_Vp7-Bvz4IdPVlAtmMHSIfddj0p1sUUwUu4i"; // live

    const body = encodeURIComponent(`Om namaha shivaya, 
I'm having payment issues. My Paypal transaction number is: 
    

-----
name: ${displayName}
email: ${email}
uid: ${uid}
expiresOn: ${expiresOn}`);

    return (
      <div className="App">
        <div className="App-header">
          <div className="title">Amma's Bhajans</div>
        </div>
        <div className="pay">
          <p className="yellowBg">
            Hello {displayName}, you are signed in with the email {email}{" "}
            {paymentMessage}
            <br />
            <Link to="/logout">Logout / Change User</Link>
          </p>
          <p>
            A lot of improvements have been added since the last beta release:
            over 500 sheet music pdfs added, more links to cd baby songs, the
            2019 suppliment, and speed and stability improvements. 🙌🎉💯
          </p>
          <p>
            The paid version of the app allows you to access the lyrics and
            sheet music. The entire app works offline on most modern phones. The
            free version allows you to see which book you can find the lyrics
            in.
          </p>

          <h2>Pricing</h2>
          <p>
            To see the bhajans you need to pay. There are 3 payment plans to
            choose from. Please note there are no refunds.
          </p>
          <p>
            <b>1. $9.99</b> - 1 year of access with updates <br />
            <b>2. $39.99</b> - 5 years of access with updates <br />
            <b>3. $49.99</b> - lifetime access with updates (best value)
          </p>

          <p>
            All proceeds support{" "}
            <a href="http://www.embracingtheworld.org/">
              Embracing the World
            </a>{" "}
            nonprofit.
          </p>
          <p>
            Please select your payment plan and pay with Paypal/Credit card.
          </p>
          <Select
            value={this.state.selectedPlan}
            onChange={this.handleChange}
            options={PLANS}
          />
          <div className="paypalButton">
            <PayPalButton
              options={{
                clientId
              }}
              amount={this.state.selectedPlan.price}
              onSuccess={(details, data) => {
                alert({
                  text: "Payment successful, updating app, please stay online."
                });
                return fetch(
                  "https://us-central1-bhajans-588f5.cloudfunctions.net/process",
                  {
                    method: "post",
                    body: JSON.stringify({
                      ...data,
                      type: this.state.selectedPlan.value,
                      uid:
                        localStorage.uid ||
                        (auth.currentUser && auth.currentUser.uid),
                      mode
                    })
                  }
                )
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
          <p>
            For any payment complications please send your email{" "}
            <a
              href={`mailto:singwithamma@gmail.com?subject=[swa] Payment&body=${body}`}>
              here
            </a>
          </p>
        </div>
      </div>
    );
  }
}

export default Pay;
