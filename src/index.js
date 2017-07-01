import React from 'react';
import ReactDOM from 'react-dom';
import Search from './Search';
import RenderPage from './RenderPage';
import Login from './Login';
import Admin from './Admin';
import Pay from './Pay';
import registerServiceWorker from './registerServiceWorker';
import { HashRouter as Router, Route, Switch } from 'react-router-dom';
import './index.css';
import './App.css';
import injectTapEventPlugin from 'react-tap-event-plugin';
injectTapEventPlugin();

// auto logout user if +localstorage.updated
// auth.currentUser && signedIn(auth.currentUser);
// http://bodiddlie.github.io/firebase-auth-with-react-router/
ReactDOM.render(
  <Router>
    <Switch>
      <Route exact path="/" component={Search} />
      <Route exact path="/login" component={Login} />
      <Route exact path="/admin" component={Admin} />
      <Route exact path="/pay" component={Pay} />
      <Route path="/pdf/:location/:name" component={RenderPage} />
    </Switch>
  </Router>,
  document.getElementById('root')
);
registerServiceWorker();
