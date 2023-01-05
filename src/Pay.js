import React, { PureComponent } from "react";
import { useEffect, useState } from "react";

import { auth, whenUser } from "./firebase";
// import { PayPalButton } from "react-paypal-button-v2";
// import Select from "react-select";
import { alert } from "notie";
import { Link, useHistory } from "react-router-dom";
import { PLANS } from "./Plans";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableContainer from "@material-ui/core/TableContainer";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";

class Pay extends PureComponent {
  state = { selectedPlan: {} };

  handleChange2 = (selectedPlan) => this.setState({ selectedPlan });
  handleChange = (e) => {
    this.setState({
      selectedPlan: PLANS.find((x) => x.value === e.currentTarget.id),
    });
  };
  paypalButtonRef = React.createRef();

  render() {
    // Change mode here              ⬇️ to switch between sandbox and live paypal
    const { email, displayName, expiresOn = undefined, uid } = localStorage;
    const cleanedDisplayName = displayName || "";
    const paymentMessage =
      new Date(+expiresOn) > new Date()
        ? ` and your membership expires on ${new Date(
            +expiresOn
          ).toLocaleDateString()}.`
        : " and you have not yet paid for the app.";

    const body = encodeURIComponent(`Om namaha shivaya,
I'm having payment issues. My Paypal transaction number is:

-----
name: ${cleanedDisplayName}
email: ${email}
uid: ${uid}
expiresOn: ${expiresOn}`);
    let helloText = cleanedDisplayName
      ? `Hello ${cleanedDisplayName}`
      : "Hello";
    return (
      <div className='App'>
        <div className='App-header'>
          <Link to={"/"} className='title'>
            Amma's Bhajans
          </Link>
        </div>
        <div className='pay'>
          <h1>Payments</h1>
          <p className='yellowBg'>
            {helloText}, you are signed in with the email {email}{" "}
            {paymentMessage}
            <br />
            <Link to='/'>Home (Bhajan List)</Link>
            <br />
            <Link to='/logout'>Logout / Change User</Link>
          </p>

          <iframe
            width='100%'
            height='500'
            src='https://www.youtube.com/embed/Wm5Nc3tR_kI'
            title='YouTube video player'
            frameborder='0'
            allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
            allowfullscreen></iframe>

          <p>
            <strong>
              All the money (except for taxes and payment gateway fees) goes to{" "}
              <a href='http://www.embracingtheworld.org/'>
                Embracing the World
              </a>{" "}
              nonprofit. Please note there are NO refunds due to payment
              processing restrictions. Please be sure to double check your order
              before paying!
              <h4>
                Important: When checking out, please use the email - {email}{" "}
                (should be autofilled). DO NOT change this as this will make it
                harder to link your account.
              </h4>
            </strong>
          </p>

          <h3>
            Please allow two business day for your account to be enabled - the
            process is manual.
          </h3>

          <h2 style={{ textAlign: "center" }}>Payment links</h2>
          <div
            style={{
              display: "flex",
              justifyContent: "space-around",
              margin: "20px",
            }}>
            <Button
              variant='contained'
              color='primary'
              href={`http://theammashop.com/cart/37277000728740:1?email=${email}`}>
              1 Years - $10
            </Button>
            <Button
              variant='contained'
              color='primary'
              href={`http://theammashop.com/cart/37277000794276:1?email=${email}`}>
              5 Years - $50
            </Button>
            <Button
              variant='contained'
              color='primary'
              href={`http://theammashop.com/cart/37277000827044:1?email=${email}`}>
              10 Years - $50
            </Button>
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
