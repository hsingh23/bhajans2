import './index.css';
import './App.css';
import React from 'react';
import ReactDOM from 'react-dom';
import Search from './Search';
import RenderPage from './RenderPage';
import Login from './Login';
import Logout from './Logout';
import Admin from './Admin';
import Pay from './Pay';
import Beta from './Beta';
import registerServiceWorker from './registerServiceWorker';
import withFavorites from './withFavorites';
import { HashRouter as Router, Route, Switch, Redirect } from 'react-router-dom';
import injectTapEventPlugin from 'react-tap-event-plugin';

injectTapEventPlugin();
function logPageView() {
  window.ga.set({ page: window.location.pathname + window.location.search });
  window.ga('send', 'pageview', window.location.pathname);
}

// auto logout user if +localstorage.updated
// auth.currentUser && signedIn(auth.currentUser);
// http://bodiddlie.github.io/firebase-auth-with-react-router/
ReactDOM.render(
  <Router onUpdate={logPageView}>
    <Switch>
      <Route exact path="/login" component={Login} />
      <Route exact path="/logout" component={Logout} />
      <Route exact path="/pay" component={Pay} />
      <Route exact path="/beta" component={Beta} />
      <Route exact path="/admin" component={Admin} />
      <Route exact path="/" component={withFavorites(Search)} />
      <Route exact path="/my-favorites" component={withFavorites(Search)} />
      <Route path="/pdf/:location/:name" component={withFavorites(RenderPage)} />
      <Redirect path="*" to="/" />
    </Switch>
  </Router>,
  document.getElementById('root')
);
registerServiceWorker();
