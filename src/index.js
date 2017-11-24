import "./index.css";
import "./App.css";
import React from "react";
import ReactDOM from "react-dom";
import Login from "./Login";
import Logout from "./Logout";
import Admin from "./Admin";
import Pay from "./Pay";
import FAQ from "./FAQ";
import Beta from "./Beta";
import App from "./App";
import createHashHistory from "history/createHashHistory";
import { Router, Route, Switch, withRouter } from "react-router-dom";
import injectTapEventPlugin from "react-tap-event-plugin";
import registerServiceWorker from "./registerServiceWorker";
import "bugsnag-js";
import "whatwg-fetch";
window.Bugsnag.apiKey = "a8b3dfbca1bb3f896d6e145d8e58db60";
injectTapEventPlugin();
class ErrorBoundary extends React.Component {
  componentDidCatch(error, info) {
    window.Bugsnag.notifyException(error, { react: info });
    this.setState({});
  }
  render() {
    return this.props.children;
  }
}
var history = createHashHistory();
history.listen(function(location) {
  console.log(location);
  window.ga && window.ga("send", "pageview", location.pathname);
});

// auto logout user if +localstorage.updated
// auth.currentUser && signedIn(auth.currentUser);
// http://bodiddlie.github.io/firebase-auth-with-react-router/
ReactDOM.render(
  <ErrorBoundary>
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
    </Router>
  </ErrorBoundary>,
  document.getElementById("root")
);

(function doOnce() {
  registerServiceWorker();
  window._urq = window._urq || [];
  window._urq.push(["initSite", "9f29eba3-9795-415f-9f34-3e1a2c8fb6ed"]);
  (function() {
    var ur = document.createElement("script");
    ur.type = "text/javascript";
    ur.async = true;
    ur.src =
      "https:" == document.location.protocol
        ? "https://cdn.userreport.com/userreport.js"
        : "http://cdn.userreport.com/userreport.js";
    var s = document.getElementsByTagName("script")[0];
    s.parentNode.insertBefore(ur, s);
  })();
  (function(i, s, o, g, r, a, m) {
    i["GoogleAnalyticsObject"] = r;
    (i[r] =
      i[r] ||
      function() {
        (i[r].q = i[r].q || []).push(arguments);
      }),
      (i[r].l = 1 * new Date());
    (a = s.createElement(o)), (m = s.getElementsByTagName(o)[0]);
    a.async = 1;
    a.src = g;
    m.parentNode.insertBefore(a, m);
  })(window, document, "script", "https://www.google-analytics.com/analytics.js", "ga");

  if (window.ga && !window.setGAUid && localStorage.uid) {
    window.ga("create", "UA-101960783-1", "auto");
    window.ga("send", "pageview");
    window.setGAUid = true;
    window.ga("set", { userId: localStorage.uid });
  }
})();
