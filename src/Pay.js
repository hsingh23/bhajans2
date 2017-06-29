import React, { PureComponent } from 'react';
import { auth, setRefOnce, db } from './firebase';
import { Link } from 'react-router-dom';

class Pay extends PureComponent {
  componentWillMount() {
    const { history, match } = this.props;
    const checkUser = () => {
      if (auth.currentUser) {
        setRefOnce(`/confirmPayment/${auth.currentUser.uid}`, { email: auth.currentUser.email, name: auth.currentUser.displayName });
      } else {
        history.push(`/login?next=${decodeURIComponent(match.params.next || '/')}`);
      }
    };
    if (localStorage.uid && !auth.currentUser) {
      setTimeout(checkUser, 500);
    } else {
      checkUser();
    }
  }

  render() {
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
            To see the bhajans you need to pay. Please go to paypal.me/Something and pay $X. Once that is done. Please then use this following email template to
            alert us that you paid. You should be able to access the full website within 3 business days. We thank you for your patience as we build out a more
            self-service experience. To check if you have access, simply click here.
          </p>
        </div>
      </div>
    );
  }
}

export default Pay;
