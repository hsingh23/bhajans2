import React, { Component } from 'react';
import { auth, checkRefOnce, firebase } from './firebase';
import firebaseui from 'firebaseui';
import 'firebaseui/dist/firebaseui.css';
import { getNext } from './util';

var authUi = new firebaseui.auth.AuthUI(auth);

class Login extends Component {
  componentDidMount() {
    const { history, location } = this.props;
    if (localStorage.beta === '1') history.replace('/' + getNext());

    const redirectOnLogin = async function(user) {
      const beta = await checkRefOnce(`/beta/${user.uid}`);
      const admin = await checkRefOnce(`/admin/${user.uid}`);
      if (admin !== null) localStorage.admin = 1;
      if (beta) {
        localStorage.beta = 1;
        // save user name, email, browser data
        history.push('/' + getNext());
      } else {
        localStorage.beta = 0;
        // TODO: redirect to pay once beta testing period is over
        history.push(`/beta${location.search}}`);
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
      //   history.push(`/pay${location.search}}`);
      //   // redirect to a page with an email template that allows a user to pay to a paypal account and sends their userid
      //   // ideally you want to show stripe, upon payment kick off cloud function to update user account
      // }
    };
    const signedIn = function signedIn(user) {
      if (!user) return false;
      localStorage.uid = user.uid;
      localStorage.updated = +new Date();
      localStorage.displayName = user.displayName;
      localStorage.email = user.email;
      localStorage.photoURL = user.photoURL;
      redirectOnLogin(user);
    };

    signedIn(auth.currentUser);

    if (localStorage.uid && !auth.currentUser) {
      setTimeout(() => signedIn(auth.currentUser), 500);
    }
    const uiConfig = {
      callbacks: {
        signInSuccess: signedIn,
      },
      // credentialHelper: firebaseui.auth.CredentialHelper.NONE,
      signInOptions: [firebase.auth.EmailAuthProvider.PROVIDER_ID],
    };
    authUi.start('#firebaseui-auth', uiConfig);
  }

  componentWillUnmount() {
    authUi.reset();
  }

  render() {
    return <div id="firebaseui-auth" />;
  }
}

export default Login;
