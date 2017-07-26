importScripts('https://www.gstatic.com/firebasejs/3.9.0/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/3.9.0/firebase-messaging.js');

// Initialize the Firebase app in the service worker by passing in the
// messagingSenderId.

var config = {
  apiKey: 'AIzaSyB9MVmCPLBachZm1Yfc3r1IaguL6Ps2NdM',
  authDomain: 'bhajans-588f5.firebaseapp.com',
  databaseURL: 'https://bhajans-588f5.firebaseio.com',
  projectId: 'bhajans-588f5',
  storageBucket: 'bhajans-588f5.appspot.com',
  messagingSenderId: '20248152848',
};
firebase.initializeApp(config);

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();
messaging.setBackgroundMessageHandler(function (payload) {
  console.log('[firebase-messaging-service-worker.js] Received background message ', payload);
  // Customize notification here
  const notificationTitle = (payload && payload.notification && payload.notification.title) || 'Background Message Title';
  const notificationOptions = {
    body: (payload && payload.notification && payload.notification.body) || 'Background Message body.',
    icon: (payload && payload.notification && payload.notification.icon) || 'favicon.png',
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});
