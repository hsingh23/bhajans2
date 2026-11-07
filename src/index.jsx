// Self-hosted fonts (latin only), so no third-party stylesheet blocks the first paint.
import "@fontsource/lato/latin-400.css";
import "@fontsource/lato/latin-700.css";
import "@fontsource/lora/latin-400.css";
import "@fontsource/playfair-display/latin-700-italic.css";
import "@fontsource/playfair-display/latin-900.css";
import "./index.css";
import "./App.css";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { lazyPage } from "./lazyPage";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { withRouterCompat, RequireAdmin } from "./util";
import ErrorBoundary from "./ErrorBoundary";
// @ts-expect-error: virtual module not found in TS context
import { registerSW } from "virtual:pwa-register";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./ThemeContext";
import { MusicianModeProvider } from "./MusicianMode";
import { schedulePdfPrefetch } from "./pdfPrefetch";
import { loadTagManager, track } from "./analytics";


const queryClient = new QueryClient();
const Login = lazyPage(() => import("./Login"), { mui: true });
const Pay = lazyPage(() => import("./Pay"), { mui: true });
const Privacy = lazyPage(() => import("./Privacy"), { mui: true });
const Terms = lazyPage(() => import("./Terms"), { mui: true });
const Admin = lazyPage(() => import("./Admin"));
const SalesDashboard = lazyPage(() => import("./SalesDashboard"));
const FAQ = lazyPage(() => import("./FAQ"));
const WrappedLogout = lazyPage(() => import("./Logout").then((m) => ({ default: withRouterCompat(m.default) })));
const WrappedBeta = lazyPage(() => import("./Beta").then((m) => ({ default: withRouterCompat(m.default) })));
const ReactQueryDevtools = import.meta.env.DEV
  ? React.lazy(() => import("@tanstack/react-query-devtools").then((m) => ({ default: m.ReactQueryDevtools })))
  : () => null;


async function enableMocking() {
  if (!import.meta.env.DEV) {
    return;
  }
  const { worker } = await import("./mocks/browser");
  return worker.start();
}

const registerServiceWorkers = async () => {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
    return;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations.map((registration) => {
        const scriptURL =
          registration.active?.scriptURL ||
          registration.waiting?.scriptURL ||
          registration.installing?.scriptURL ||
          "";
        if (scriptURL && !scriptURL.includes("service-worker2.js")) {
          console.warn("Unregistering old service worker:", scriptURL);
          return registration.unregister();
        }
        return Promise.resolve();
      })
    );
  } catch (error) {
    console.warn("Failed to clean up old service workers:", error);
  }

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
    updateSW(true);
  };

  window.requestServiceWorkerUpdate = requestServiceWorkerUpdate;

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      requestServiceWorkerUpdate();
    }
  });
  window.addEventListener("online", requestServiceWorkerUpdate);
};

const renderApp = () => {
  const container = document.getElementById("root");
  const root = createRoot(container);
  
  root.render(
    <ErrorBoundary>
      <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <MusicianModeProvider>
            <BrowserRouter>
              <Routes>
                <Route path='/login' element={<Login />} />
                <Route path='/logout' element={<WrappedLogout />} />
                <Route path='/pay' element={<Pay />} />
                <Route path='/beta' element={<WrappedBeta />} />
                <Route path='/admin/analytics' element={<RequireAdmin><SalesDashboard /></RequireAdmin>} />
                <Route path='/admin' element={<RequireAdmin><Admin /></RequireAdmin>} />
                <Route path='/faq' element={<FAQ />} />
                <Route path='/privacy' element={<Privacy />} />
                <Route path='/terms' element={<Terms />} />
                <Route path='*' element={<App />} />
              </Routes>
            </BrowserRouter>
            </MusicianModeProvider>
            {import.meta.env.DEV && (
              <React.Suspense fallback={null}>
                <ReactQueryDevtools />
              </React.Suspense>
            )}
          </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

const bootstrap = async () => {
  try {
    // Dev only: the mock API must be ready before the app's first request.
    await enableMocking();
  } catch (error) {
    console.error("Failed to enable mocking:", error);
  }
  renderApp();
  // The service worker precaches ~4 MB, so it waits until the page has loaded
  // (the preloaded bhajan index included) and the browser is idle.
  await new Promise((resolve) => {
    const idle = () => (window.requestIdleCallback ? window.requestIdleCallback(resolve, { timeout: 5000 }) : setTimeout(resolve, 1));
    if (document.readyState === "complete") idle();
    else window.addEventListener("load", idle, { once: true });
  });
  registerServiceWorkers()
    .then(() => {
      if (import.meta.env.PROD) {
        schedulePdfPrefetch().catch((error) => console.warn("Lyrics PDF caching stopped:", error));
      }
    })
    .catch((error) => console.warn("Service worker setup failed:", error));
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
  loadTagManager();
}
if (import.meta.env.PROD) {
  setTimeout(doOnce, 5 * 1000);
}

window.addEventListener("appinstalled", () => track("app_installed"));

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
