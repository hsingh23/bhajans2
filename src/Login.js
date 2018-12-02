import React, { Component } from 'react';
import { auth, checkRefOnce, firebase } from './firebase';
import firebaseui from 'firebaseui';
import 'firebaseui/dist/firebaseui.css';
import { getNext } from './util';

var authUi = new firebaseui.auth.AuthUI(auth);

class Login extends Component {
  signedIn = user => {
    if (!user) return false;
    localStorage.uid = user.uid;
    localStorage.updated = +new Date();
    localStorage.displayName = user.displayName;
    localStorage.email = user.email;
    localStorage.photoURL = user.photoURL;
    this.redirectOnLogin(user);
    return true;
  };

  redirectOnLogin = async user => {
    const { history, location } = this.props;
    const beta = await checkRefOnce(`/beta/${user.uid}`);
    const admin = await checkRefOnce(`/admin/${user.uid}`);
    const next = getNext();
    if (admin !== null) localStorage.admin = 1;
    if (beta) {
      localStorage.beta = 1;
      // save user name, email, browser data
      return history.push(next);
    } else {
      localStorage.beta = 0;
      // TODO: redirect to pay once beta testing period is over
      return history.push(`/beta${location.search}`);
      // redirect to a page with an email template that allows a user to pay to a paypal account and sends their userid
      // ideally you want to show stripe, upon payment kick off cloud function to update user account
    }
    // const paid = await checkRefOnce(`/paid/${user.uid}`);
    // if (paid === '1') {
    //   localStorage.paid = 1;
    //   history.push('/'+getNext());
    // } else {
    //   localStorage.paid = 0;
    //   // redirect to pay once beta testing period is over
    //   history.push(`/pay${location.search}`);
    //   // redirect to a page with an email template that allows a user to pay to a paypal account and sends their userid
    //   // ideally you want to show stripe, upon payment kick off cloud function to update user account
    // }
  };

  componentDidMount() {
    const { history } = this.props;
    const next = getNext();
    if (localStorage.beta === '1') return history.replace(next);

    this.signedIn(auth.currentUser);

    if (localStorage.uid && !auth.currentUser) {
      setTimeout(() => this.signedIn(auth.currentUser), 500);
    }
    const uiConfig = {
      callbacks: {
        signInSuccess: this.signedIn,
      },
      credentialHelper: firebaseui.auth.CredentialHelper.NONE,
      signInOptions: [firebase.auth.EmailAuthProvider.PROVIDER_ID],
    };

    authUi.reset();
    authUi.start('#firebaseui-auth', uiConfig);
  }

  componentWillUnmount() {
    authUi.reset();
  }

  render() {
    return (
      <div>
        <h2>Sign In or Sign Up</h2>
        <div id="firebaseui-auth" />
      </div>
    );
  }
}

export default Login;
