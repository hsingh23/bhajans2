import React, { Component } from 'react';
import { auth, checkRefOnce, firebase } from './firebase';
import firebaseui from 'firebaseui';
import 'firebaseui/dist/firebaseui.css';
import { getNext } from './util';

var authUi = new firebaseui.auth.AuthUI(auth);

class Login extends Component {
  componentDidMount() {
    const { history, location } = this.props;
    if (localStorage.paid === '1') history.replace(getNext());

    const redirectOnLogin = async function(user) {
      const paid = await checkRefOnce(`/paid/${user.uid}`);
      if (paid === '1') {
        localStorage.paid = 1;
        history.push(getNext());
      } else {
        localStorage.paid = 0;
        history.push(`/pay${location.search}}`);
        // redirect to a page with an email template that allows a user to pay to a paypal account and sends their userid
        // ideally you want to show stripe, upon payment kick off cloud function to update user account
      }
    };
    const signedIn = function signedIn(user) {
      if (!user) return false;
      localStorage.uid = user.uid;
      localStorage.updated = +new Date();
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
      signInOptions: [
        firebase.auth.GoogleAuthProvider.PROVIDER_ID,
        firebase.auth.EmailAuthProvider.PROVIDER_ID,
        firebase.auth.FacebookAuthProvider.PROVIDER_ID,
      ],
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