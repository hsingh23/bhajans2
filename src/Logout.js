import React, { Component } from "react";
import { auth } from "./firebase";
import { getNext } from "./util";

class Logout extends Component {
  componentWillMount() {
    auth.signOut().then(() => {
      localStorage.clear();
      this.props.history.push(getNext());
    });
  }

  render() {
    return <div />;
  }
}

export default Logout;
