import React, { PureComponent } from 'react';
import { auth, db } from './firebase';
import { Link } from 'react-router-dom';
import { getNext } from './util';

class Pay extends PureComponent {
  componentWillMount() {
    const { history, location } = this.props;
    if (localStorage.paid === '1') history.push('/' + getNext());
    const checkUser = async function() {
      if (auth.currentUser) {
        // only ask to confirmPayment if the person hasn't paid
        db.goOnline();
        var didPay = await db.ref(`/paid/${auth.currentUser.uid}`).once('value');
        if (didPay.val() === null) {
          await db.ref(`/confirmPayment/${auth.currentUser.uid}`).set({ email: auth.currentUser.email, name: auth.currentUser.displayName, date: +new Date() });
        } else {
          localStorage.paid = '1';
          history.push('/' + getNext());
        }
        db.goOffline();
      } else {
        history.push(`/login${location.search}`);
      }
    };
    if (localStorage.uid && !auth.currentUser) {
      setTimeout(checkUser, 500);
    } else {
      checkUser();
    }
  }

  render() {
    // TODO reword this, work with bhuvanesh for payment flow, investigate firebase cloud function
    return (
      <div className="App">
        <div className="App-header">
          <img src="favicon.ico" alt="Sing " />
          <div className="title">Amma's Bhajans</div>
          <nav>
            <Link to={'/'}>Back </Link>
          </nav>
        </div>
        <div className="restPage">
          <p>
            To see the bhajans you need to pay. This is easiest when you are on tour, simply pay at the cash register and come to the store. The admin will
            grant you access once you log in.

            If you are not on tour: Please go to paypal.me/Something and pay $X. Once that is done. Please then use this following email template to
            alert us that you paid. You should be able to access the full website within 3 business days. We thank you for your patience as we build out a more
            self-service experience. To check if you have access, simply click here.
          </p>
        </div>
      </div>
    );
  }
}

export default Pay;
