import React, { Component } from "react";
import { auth } from "./firebase";
import { getNext } from "./util";
import { track } from "./analytics";

class Logout extends Component {
  componentDidMount() {
    auth.signOut().then(() => {
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
