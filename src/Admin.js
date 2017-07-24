import React, { PureComponent } from 'react';
import { auth, db } from './firebase';
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
      db.ref(`admin/${uid}`).once('value').then(function (snapshot) {
        console.log(snapshot.val(), 'value');

        if (snapshot.val() === null) history.push(`/login?next=${decodeURIComponent(match.params.next || '/')}`);
      });
      this.confirmBeta.on('value', snap => {
        this.setState({ users: snap.val() || {} });
      });
    };
    setTimeout(awaitCurrentUser, 500);
    this.confirmBeta = db.ref('confirmBeta');
    this.confirmedBeta = db.ref('confirmedBeta');
    this.beta = db.ref('beta');

    // TODO: this should not be value!
    // TODO: set renewBeta table
  }
  componentWillUnmount() {
    return db.goOffline();
  }

  createEmailTemplate = (user) => {
    const body = encodeURIComponent(`Om Namah Shivaya ${user.name},

Thank you for joining the beta team for this website 🤗. We may send you surveys, push notifications, emails to help us make this a better experience for everyone. 

Please like our Facebook page: https://www.facebook.com/sing.withamma/?ref=beta_email 

If you have see any errors like incorrect page number, broken search, website malfunctions, etc. please let me know at https://feedback.userreport.com/9f29eba3-9795-415f-9f34-3e1a2c8fb6ed/
 
🎉 Thanks so much 🎉

Peace `)

    return window.localStorage.email.includes('gmail') ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(user.email)}&su=${encodeURIComponent('[sing.withamma.com] Thanks for joining the beta 😄')}&bcc=hisingh1@gmail.com&body=${body}` : `mailto:${encodeURIComponent(user.email)}?subject=${encodeURIComponent('[sing.withamma.com] Thanks for joining the beta')}&bcc=hisingh1@gmail.com&body=${body}`

  }

  setBeta = function (uid, user) {
    this.confirmedBeta.child(uid).set(user);
    this.confirmBeta.child(uid).remove();
    this.beta.child(uid).set('1');
    window.open(this.createEmailTemplate(user))
    return 1
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
                          this.setBeta(uid, user);
                        }}>
                        beta
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
