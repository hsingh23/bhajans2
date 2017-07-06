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
            Welcome to Amma's Bhajan Searcher, making bhajans easier. This is a beta website which means that things may not work as they should. Please help us
            make the website better. As a gift, you will have free access to this website until September 1st 2017.{' '}
          </p>
          <p>
            We may contact you via email, and push messages during the beta period to answer short
            surveys.
          </p>
          {this.state.optedIn
            ? <div className="bigRedText">
                <div>Thanks for requesting access to the beta program! This site will automatically redirect once you are approved.</div>{' '}
                <a href="some facebook link" target="_blank" rel="noopener noreferrer">
                  While you wait, please support us by liking our facebook page and sharing it with others who may also make like this website.
                </a>.
              </div>
            : <button onClick={this.optIn}>Agree and Continue</button>}

        </div>

      </div>
    );
  }
}

export default Beta;
