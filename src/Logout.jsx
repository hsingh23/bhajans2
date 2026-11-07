import React, { Component } from "react";
import { auth } from "./firebase";
import { getNext } from "./util";
import { track } from "./analytics";
import { detachNotificationToken } from "./notifications";

class Logout extends Component {
  componentDidMount() {
    // Unlink this browser's push notifications first, so the next person on
    // it doesn't get this account's alerts. Never let that block sign-out.
    const uid = auth.currentUser?.uid;
    Promise.race([detachNotificationToken(uid), new Promise((resolve) => setTimeout(resolve, 3000))])
      .then(() => auth.signOut())
      .then(() => {
        track("logout");
        localStorage.clear();
        // Use replace to avoid back nav to a protected page
        this.props.history.replace(getNext());
      });
  }

  render() {
    return <div />;
  }
}

export default Logout;
