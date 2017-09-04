import './index.css';
import './App.css';
import React from 'react';
import ReactDOM from 'react-dom';
import Login from './Login';
import Logout from './Logout';
import Admin from './Admin';
import Pay from './Pay';
import FAQ from './FAQ';
import Beta from './Beta';
import registerServiceWorker from './registerServiceWorker';
import App from './App';
import createHashHistory from 'history/createHashHistory';
import { Router, Route, Switch, withRouter } from 'react-router-dom';
import injectTapEventPlugin from 'react-tap-event-plugin';
injectTapEventPlugin();

var history = createHashHistory();
history.listen(function(location) {
  console.log(location);
  window.ga('send', 'pageview', location.pathname);
});

// auto logout user if +localstorage.updated
// auth.currentUser && signedIn(auth.currentUser);
// http://bodiddlie.github.io/firebase-auth-with-react-router/
ReactDOM.render(
  <Router history={history}>
    <Switch>
      <Route exact path="/login" component={Login} />
      <Route exact path="/logout" component={Logout} />
      <Route exact path="/pay" component={Pay} />
      <Route exact path="/beta" component={Beta} />
      <Route exact path="/admin" component={Admin} />
      <Route exact path="/faq" component={FAQ} />
      <Route path="*" component={App} />
    </Switch>
  </Router>,
  document.getElementById('root')
);
registerServiceWorker();
