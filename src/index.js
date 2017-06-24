import React from 'react';
import ReactDOM from 'react-dom';
import Search from './Search';
import RenderPage from './RenderPage';
import registerServiceWorker from './registerServiceWorker';
import { HashRouter as Router, Route, Switch } from 'react-router-dom';

import './index.css';
import './App.css';

ReactDOM.render(
  <Router>
    <Switch>
      <Route exact path="/" component={Search} />
      <Route path="/pdf/:location/:name" component={RenderPage} />
    </Switch>
  </Router>,
  document.getElementById('root')
);
registerServiceWorker();
