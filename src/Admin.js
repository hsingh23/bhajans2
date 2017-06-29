import React, { PureComponent } from 'react';
import { auth, checkRefOnce, db, ref } from './firebase';
import { Link } from 'react-router-dom';

class Admin extends PureComponent {
  constructor(props) {
    super(props);
    this.state = { users: {} };
  }

  componentWillMount() {
    const { history, match } = this.props;
    const uid = (auth.currentUser && auth.currentUser.uid) || localStorage.uid || null;
    if (checkRefOnce(`/admin/${uid}`) === '1') {
      history.push(`/login?next=${decodeURIComponent(match.params.next || '/')}`);
    }
    db.goOnline();
    this.confirmPayment = db.ref('confirmPayment');
    this.paid = db.ref('paid');
    // TODO: this should not be value!
    this.confirmPayment.on('value', snap => {
      this.setState({ users: snap.val() || {} });
    });
  }
  componentWillUnmount() {
    return db.goOffline();
  }

  setPaid = uid => {
    this.confirmPayment.child(uid).remove();
    this.paid.child(uid).set('1');
  };

  render() {
    const { users } = this.state;
    return (
      <div className="App">
        <div className="App-header">
          <div className="title">Amma's Bhajans</div>
          <nav>
            <Link to={'/'}>Back </Link>
          </nav>
        </div>
        <div className="restPage">
          <p>
            The following people are waiting to get access to the app
          </p>
          <table>
            {users &&
              Object.entries(users).map(([key, user]) =>
                <tr>
                  <td>{`${user.email} ${user.name || ''}`}</td>
                  <td>{key}</td>
                  <td>
                    <button
                      onClick={() => {
                        this.setPaid(key);
                      }}>
                      Paid
                    </button>
                  </td>
                </tr>
              )}
          </table>
        </div>
      </div>
    );
  }
}

export default Admin;
