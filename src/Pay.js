import React, { PureComponent } from "react";
import { auth } from "./firebase";
// import { PayPalButton } from "react-paypal-button-v2";
// import Select from "react-select";
import { alert } from "notie";
import { Link } from "react-router-dom";
import { PLANS } from "./Plans";
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Paper from '@material-ui/core/Paper';
import Button from '@material-ui/core/Button';

class Pay extends PureComponent {
  state = { selectedPlan: {} };
  componentDidMount() {
    const { history } = this.props;
    const checkUser = async function () {
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
            The paid version of the app has many exciting features as listed
            below.
          </p>

          <div className="features" style={{ marginBottom: "10px" }}>
            <span>Fast and trouble free search</span>
            <span>
              Unlimited access to lyrics (works offline on most phones)
            </span>
            <span>Unlimited access to sheet music</span>
            <span>Save your favorite songs</span>
          </div>
          <iframe width="100%" height="500" src="https://www.youtube.com/embed/Wm5Nc3tR_kI" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

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

          <h3>Important: When checking out, please use the email you used to sign up on this website - {email}</h3>
          <h4>Please allow one business day for your account to be enabled - the process is currently manual.</h4>

          <TableContainer component={Paper}>
            <Table aria-label="Checkout table">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell align="right">Years</TableCell>
                  <TableCell align="right">Cost (USD $)</TableCell>
                  <TableCell align="right">Link</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[["The Decade", 10, "$50", "http://theammashop.com/cart/37277000827044:1"],
                ["The 1/2 Decade", 5, "$40", "http://theammashop.com/cart/37277000794276:1"],
                ["One Year", 1, "$10", "http://theammashop.com/cart/37277000728740:1"]
                ].map((row) => (
                  <TableRow key={row[0]}>
                    <TableCell component="th" scope="row">
                      {row[0]}
                    </TableCell>
                    <TableCell align="right">{row[1]}</TableCell>
                    <TableCell align="right">{row[2]}</TableCell>
                    <TableCell align="right"><Button variant="contained" color="primary" href={row[3]}> Amma Shop Link </Button> </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {/* 
          <table class="table table-bordered table-hover table-condensed">
            <thead><tr><th title="Field #1">Name</th>
              <th title="Field #2">Years</th>
              <th title="Field #3">Cost</th>
              <th title="Field #4">Link</th>
            </tr></thead>
            <tbody><tr>
              <td>Decade</td>
              <td align="right"> 10</td>
              <td> $50</td>
              <td> <a href="http://theammashop.com/cart/37277000827044:1" >Amma Shop</a></td>
            </tr>
              <tr>
                <td>Half Decade</td>
                <td align="right"> 5</td>
                <td> $40</td>
                <td> <a href="http://theammashop.com/cart/37277000794276:1" >Amma Shop</a></td>
              </tr>
              <tr>
                <td>Year</td>
                <td align="right"> 1</td>
                <td> $10</td>
                <td> <a href="http://theammashop.com/cart/37277000827044:1" >Amma Shop</a></td>
              </tr>
            </tbody></table> */}


          {/* <Select
            value={this.state.selectedPlan}
            onChange={this.handleChange2}
            options={PLANS}
          />
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
            : <p>Select plan to pay</p>} */}
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
