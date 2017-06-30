import React, { PureComponent } from 'react';
import { auth, checkRefOnce, db } from './firebase';
import { Link } from 'react-router-dom';

class Admin extends PureComponent {
  constructor(props) {
    super(props);
    this.state = { users: {} };
  }

  componentWillMount() {
    const { history, match } = this.props;
    db.goOnline();
    const awaitCurrentUser = () => {
      const uid = (auth.currentUser && auth.currentUser.uid) || localStorage.uid;
      if (!uid) {
        console.log('Need to login');
        history.push(`/login?next=${decodeURIComponent(match.params.next || '/')}`);
      }
      db.ref(`admin/${uid}`).once('value').then(function(snapshot) {
        console.log(snapshot.val(), 'value');

        if (snapshot.val() === null) history.push(`/login?next=${decodeURIComponent(match.params.next || '/')}`);
      });
      this.confirmPayment.on('value', snap => {
        this.setState({ users: snap.val() || {} });
      });
    };
    setTimeout(awaitCurrentUser, 500);
    this.confirmPayment = db.ref('confirmPayment');
    this.paid = db.ref('paid');

    // TODO: this should not be value!
  }
  componentWillUnmount() {
    return db.goOffline();
  }

  setPaid = function(uid) {
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
            <tbody>
              {users &&
                Object.entries(users).map(([uid, user]) =>
                  <tr key={uid}>
                    <td>{user.name}</td>
                    <td>{user.email} <small>{uid}</small></td>
                    <td>
                      <button
                        onClick={() => {
                          this.setPaid(uid);
                        }}>
                        Paid
                      </button>
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
}

export default Admin;
