// Imported into the Workbox service worker (vite.config.js importScripts).
// Shows Firebase Cloud Messaging web pushes and opens their link on tap.
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (error) {
    payload = { notification: { body: event.data ? event.data.text() : "" } };
  }
  const notification = payload.notification || {};
  const data = payload.data || {};
  const link = (payload.fcmOptions && payload.fcmOptions.link) || data.link || "/";
  event.waitUntil(
    self.registration.showNotification(notification.title || data.title || "Sing with Amma", {
      body: notification.body || data.body || "",
      icon: "/android-chrome-192x192.png",
      badge: "/favicon-32x32.png",
      tag: data.tag || undefined,
      data: { link },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.link) || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (client.url === target && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
