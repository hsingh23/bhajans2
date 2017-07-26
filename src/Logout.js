import React, { Component } from 'react';
import { auth, goOnline, goOffline } from './firebase';
import { getNext } from './util';

class Logout extends Component {
  componentWillMount() {
    goOnline();
    auth.signOut();
    localStorage.clear();
    goOffline();
    this.props.history.push(getNext());
  }

  render() {
    return <div />;
  }
}

export default Logout;
