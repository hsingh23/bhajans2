import React, { PureComponent } from 'react';
import { auth, db, checkRefOnce } from './firebase';
import { getNext } from './util';

class Beta extends PureComponent {
  constructor(props) {
    super(props);
    this.state = { optedIn: false };
    this.optIn = this.optIn.bind(this);
  }

  componentWillMount() {
    const { history } = this.props;
    if (localStorage.beta === '1') {
      history.push(getNext());
    }
    this.interval = setInterval(this.checkBeta, 2000);

    auth.currentUser &&
      checkRefOnce(`/confirmBeta/${auth.currentUser.uid}`).then(optedIn => {
        if (optedIn) {
          this.setState({ optedIn });
        }
      });
  }
  componentWillUnmount() {
    clearInterval(this.interval);
  }

  checkBeta = () => {
    const { history } = this.props;
    checkRefOnce(`/beta/${auth.currentUser.uid}`).then(isBetaUser => {
      if (isBetaUser) {
        localStorage.beta = '1';
        history.push(getNext());
      }
    });
  };

  async optIn() {
    const { history, location } = this.props;
    if (auth.currentUser) {
      // only ask to confirmBeta if the person hasn't beta
      db.goOnline();
      var inBeta = await db.ref(`/beta/${auth.currentUser.uid}`).once('value');
      if (inBeta.val() === null) {
        await db
          .ref(`/confirmBeta/${auth.currentUser.uid}`)
          .set({ email: auth.currentUser.email, name: auth.currentUser.displayName, signupDate: +new Date() });
        this.setState({ optedIn: true });
      } else {
        localStorage.beta = '1';
        history.push(getNext());
      }
      db.goOffline();
    } else {
      history.push(`/login${location.search}`);
    }
  }

  render() {
    // TODO: if beta user and beta has expired add them to renew beta and

    return (
      <div className="App">
        <div className="App-header">
          <img src="favicon.ico" alt="Sing " />
          <div className="title">Amma's Bhajans</div>
        </div>
        <div className="restPage">
          <p>
            Welcome to Amma's Bhajan Searcher. This is a beta website which you will be allowed to use for free until the beta period has expired. Current
            expiration date is <strong>September 1st 2017</strong>. In exchange, please help us make
            the site better by filling out our surveys, sending bug and feature requests. We may contact you via email during the beta period to answer short
            surveys. If you like the site, please like <a href="some facebook link">our facebook page</a>.
          </p>
          {this.state.optedIn ? <div className="bigRedText">Awaiting approval</div> : <button onClick={this.optIn}>Agree and Continue</button>}

        </div>

      </div>
    );
  }
}

export default Beta;
