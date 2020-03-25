import React, { PureComponent } from "react";
import { auth } from "./firebase";
import { PayPalButton } from "react-paypal-button-v2";
import Select from "react-select";
import { alert } from "notie";
import { Link } from "react-router-dom";
import { PLANS } from "./Plans";

class Pay extends PureComponent {
  state = { selectedPlan: {} };
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

  handleChange2 = selectedPlan => this.setState({ selectedPlan });
  handleChange = e => {
    this.setState({
      selectedPlan: PLANS.find(x => x.value === e.currentTarget.id)
    });
  };
  paypalButtonRef = React.createRef();

  render() {
    // Change mode here              ⬇️ to switch between sandbox and live paypal
    const { email, displayName, expiresOn = undefined, uid } = localStorage;
    const { selectedPlan } = this.state;
    const paymentMessage =
      new Date(+expiresOn) > new Date()
        ? ` and your membership expires on ${new Date(
            +expiresOn
          ).toLocaleDateString()}.`
        : " and you have not yet paid for the app.";

    const mode = ["sandbox", "live"][0];
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
            The paid version of the app has many exciting features as listed
            below.
          </p>

          <div className="features">
            <span>Fast and trouble free search</span>
            <span>
              Unlimited access to lyrics (works offline on most phones)
            </span>
            <span>Unlimited access to sheet music</span>
            <span>Save your favorite songs</span>
          </div>

          <h2>Pricing</h2>
          <p>
            <strong>
              All proceeds support{" "}
              <a href="http://www.embracingtheworld.org/">
                Embracing the World
              </a>{" "}
              nonprofit. Please note there are no refunds due to payment
              processing restrictions. Please be sure to double check your order
              before paying!
            </strong>
          </p>

          <Select
            value={this.state.selectedPlan}
            onChange={this.handleChange2}
            options={PLANS}
          />
          {/* <div class="flexC">
            {PLANS.map(plan =>
              <div
                className={classNames("options", {
                  selected: selectedPlan.value === plan.value
                })}>
                <div className="planHeader">
                  {plan.label} Plan
                </div>
                <div className="price">
                  Price: ${plan.price}
                </div>
                <div className="features">
                  {plan.isBest &&
                    <div className="ourMostPopularPlan">
                      Our most popular plan!
                    </div>}

                  <span>
                    Unlimited access to lyrics (even works offline for most
                    phones)
                  </span>
                  <span>Unlimited access to sheet music</span>
                  <span>Save your favorite songs</span>
                  <span>Fast and trouble free search</span>
                </div>

                <button
                  id={plan.value}
                  onClick={this.handleChange}
                  className="signUp">
                  Sign me up!
                </button>
              </div>
            )}
          </div> */}
          {!!selectedPlan.value
            ? <div className="paypalButton" ref={this.paypalButtonRef}>
                <div className="price">
                  ${selectedPlan.price}
                </div>
                <PayPalButton
                  options={{
                    clientId
                  }}
                  amount={selectedPlan.price}
                  onSuccess={(details, data) => {
                    alert({
                      text:
                        "Payment successful, updating app, please stay online."
                    });
                    return fetch(
                      "https://us-central1-bhajans-588f5.cloudfunctions.net/process",
                      {
                        method: "post",
                        body: JSON.stringify({
                          ...data,
                          type: selectedPlan.value,
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
            : <p>Select plan to pay</p>}
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
