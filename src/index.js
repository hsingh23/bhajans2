/* eslint-disable no-unused-expressions, no-sequences */
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
import { createHashHistory } from "history";
import { Router, Route, Switch } from "react-router-dom";
import registerServiceWorker from "./registerServiceWorker";
import bugsnag from "bugsnag-js";
import createPlugin from "bugsnag-react";

const bugsnagClient = bugsnag("a8b3dfbca1bb3f896d6e145d8e58db60");
const ErrorBoundary = bugsnagClient.use(createPlugin(React));

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

registerServiceWorker();

function doOnce() {
  window._urq = window._urq || [];
  window._urq.push(["initSite", "9f29eba3-9795-415f-9f34-3e1a2c8fb6ed"]);
  (function() {
    var ur = document.createElement("script");
    ur.type = "text/javascript";
    ur.async = true;
    ur.src =
      "https:" === document.location.protocol
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
      }), (i[r].l = 1 * new Date());
    (a = s.createElement(o)), (m = s.getElementsByTagName(o)[0]);
    a.async = 1;
    a.src = g;
    m.parentNode.insertBefore(a, m);
  })(
    window,
    document,
    "script",
    "https://www.google-analytics.com/analytics.js",
    "ga"
  );

  if (window.ga && !window.setGAUid && localStorage.uid) {
    window.ga("create", "UA-101960783-1", "auto");
    window.ga("send", "pageview");
    window.setGAUid = true;
    window.ga("set", { userId: localStorage.uid });
  }
}
setTimeout(doOnce, 5 * 1000);

// Get a wake lock if possible
let wakeLock = null;

// Function that attempts to request a wake lock.
const requestWakeLock = async () => {
  try {
    if (navigator.wakeLock) {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => {
        requestWakeLock();
        console.log("Wake Lock was released");
      });
      console.log("Wake Lock is active");
    }
  } catch (err) {
    console.error(`${err.name}, ${err.message}`);
  }
};

const handleVisibilityChange = () => {
  if (wakeLock !== null && document.visibilityState === "visible") {
    requestWakeLock();
  }
};

document.addEventListener("visibilitychange", handleVisibilityChange);
document.addEventListener("fullscreenchange", handleVisibilityChange);
requestWakeLock();
