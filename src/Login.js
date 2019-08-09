import React, { Component } from "react";
import { auth, checkRefOnce, firebase } from "./firebase";
import firebaseui from "firebaseui";
import "firebaseui/dist/firebaseui.css";
import { getNext } from "./util";

var authUi = new firebaseui.auth.AuthUI(auth);

class Login extends Component {
  signedIn = user => {
    if (!user) return false;
    localStorage.uid = user.uid;
    localStorage.displayName = user.displayName;
    localStorage.email = user.email;
    localStorage.photoURL = user.photoURL;
    this.redirectOnLogin(user);
    return true;
  };

  redirectOnLogin = async user => {
    const { history } = this.props;
    const expiresOn = await checkRefOnce(`/paid/${user.uid}/expiresOn`);
    const admin = await checkRefOnce(`/admin/${user.uid}`);
    const next = getNext();
    localStorage.lastOnline = +new Date();
    if (admin !== null) localStorage.admin = 1;
    if (expiresOn) {
      localStorage.expiresOn = +expiresOn;
      // save user name, email, browser data
      return history.push(next);
    } else {
      return history.push(`/pay`);
    }
  };

  componentDidMount() {
    const { history } = this.props;
    if (localStorage.uid && localStorage.expiresOn && +localStorage.expiresOn < +new Date())
      return history.push(`/pay`);

    this.signedIn(auth.currentUser);
    if (localStorage.uid && !auth.currentUser) {
      setTimeout(() => this.signedIn(auth.currentUser), 500);
    }
    const uiConfig = {
      callbacks: {
        signInSuccess: this.signedIn
      },
      credentialHelper: firebaseui.auth.CredentialHelper.NONE,
      signInOptions: [firebase.auth.EmailAuthProvider.PROVIDER_ID]
    };

    authUi.reset();
    authUi.start("#firebaseui-auth", uiConfig);
  }

  componentWillUnmount() {
    authUi.reset();
  }

  render() {
    return (
      <div className="App">
        <div className="App-header">
          <div className="title">Amma's Bhajans</div>
        </div>
        <div className="restPage">
          <p style={{ textAlign: "center" }}>Don't have an account? Enter the email you want to sign up with.</p>
          <div id="firebaseui-auth" />
        </div>
      </div>
    );
  }
}

export default Login;
