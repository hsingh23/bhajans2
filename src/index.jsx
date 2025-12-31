import "./index.css";
import "./App.css";
import React from "react";
import { createRoot } from "react-dom/client";
import Login from "./Login";
import Logout from "./Logout";
import Admin from "./Admin";
import Pay from "./Pay";
import FAQ from "./FAQ";
import Beta from "./Beta";
import Privacy from "./Privacy";
import Terms from "./Terms";
import App from "./App";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { withRouterCompat, RequireAdmin } from "./util";
import ErrorBoundary from "./ErrorBoundary";
// @ts-expect-error: virtual module not found in TS context
import { registerSW } from 'virtual:pwa-register';

// Register PWA
const updateSW = registerSW({
  onNeedRefresh() {
    console.log("New content available, reloading to update.");
    updateSW(true);
  },
  onOfflineReady() {
    console.log("App is ready to work offline.");
  },
});

const requestServiceWorkerUpdate = () => {
  if (import.meta.env.PROD) {
    updateSW(true);
  }
};

window.requestServiceWorkerUpdate = requestServiceWorkerUpdate;

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    requestServiceWorkerUpdate();
  }
});
window.addEventListener("online", requestServiceWorkerUpdate);

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ThemeProvider } from "./ThemeContext";
import MUIThemeWrapper from "./MUIThemeProvider";


const queryClient = new QueryClient();
const WrappedLogout = withRouterCompat(Logout);
const WrappedBeta = withRouterCompat(Beta);

const RouteTracker = () => {
  const location = useLocation();

  React.useEffect(() => {
    if (window.ga) {
      window.ga("send", "pageview", location.pathname + location.search);
    }
  }, [location]);

  return null;
};

async function enableMocking() {
  if (!import.meta.env.DEV) {
    return;
  }
  const { worker } = await import("./mocks/browser");
  return worker.start();
}

const renderApp = () => {
  const container = document.getElementById("root");
  const root = createRoot(container);
  
  root.render(
    <ErrorBoundary>
      <ThemeProvider>
        <MUIThemeWrapper>
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
              <RouteTracker />
              <Routes>
                <Route path='/login' element={<Login />} />
                <Route path='/logout' element={<WrappedLogout />} />
                <Route path='/pay' element={<Pay />} />
                <Route path='/beta' element={<WrappedBeta />} />
                <Route path='/admin' element={<RequireAdmin><Admin /></RequireAdmin>} />
                <Route path='/faq' element={<FAQ />} />
                <Route path='/privacy' element={<Privacy />} />
                <Route path='/terms' element={<Terms />} />
                <Route path='*' element={<App />} />
              </Routes>
            </BrowserRouter>
            {import.meta.env.DEV && <ReactQueryDevtools />}
          </QueryClientProvider>
        </MUIThemeWrapper>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

const bootstrap = async () => {
  try {
    await enableMocking();
  } catch (error) {
    console.error("Failed to enable mocking:", error);
  } finally {
    renderApp();
  }
};

bootstrap();

function doOnce() {
  window._urq = window._urq || [];
  window._urq.push(["initSite", "9f29eba3-9795-415f-9f34-3e1a2c8fb6ed"]);
  (function () {
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
  (function (i, s, o, g, r, a, m) {
    i["GoogleAnalyticsObject"] = r;
    (i[r] =
      i[r] ||
      function () {
        (i[r].q = i[r].q || []).push(arguments);
      }),
      // @ts-ignore
      (i[r].l = 1 * new Date());
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
if (import.meta.env.PROD) {
  setTimeout(doOnce, 5 * 1000);
}

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
// setInterval(handleVisibilityChange, 10 * 1000);

document.addEventListener("visibilitychange", handleVisibilityChange);
document.addEventListener("fullscreenchange", handleVisibilityChange);
requestWakeLock();
