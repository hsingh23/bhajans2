import React, { Component } from 'react';
import { auth, db } from './firebase';
import { getNext } from './util';

class Logout extends Component {
  componentWillMount() {
    db.goOnline();
    auth.signOut();
    localStorage.clear();
    db.goOffline();
    this.props.history.push('/' + getNext());
  }

  render() {
    return <div />;
  }
}

export default Logout;
