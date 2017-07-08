import firebase from 'firebase';
import { alert } from 'notie';
// this is the perfect place to use mobx or redux to observe an object or dispatch an update event

var config = {
  apiKey: 'AIzaSyB9MVmCPLBachZm1Yfc3r1IaguL6Ps2NdM',
  authDomain: 'bhajans-588f5.firebaseapp.com',
  databaseURL: 'https://bhajans-588f5.firebaseio.com',
  projectId: 'bhajans-588f5',
  storageBucket: 'bhajans-588f5.appspot.com',
  messagingSenderId: '20248152848',
};

//the root app just in case we need it
export const firebaseApp = firebase.initializeApp(config);
export const db = firebaseApp.database(); //the real-time database
export const auth = firebase.auth(); //the firebase auth namespace
export const messaging = firebase.messaging();

export { firebase };
if (window.location.host.includes('localhost')) window.firebase = firebase;

// export const doOnce = async function(firebasePromiseCallback) {
//   return new Promise(async function(resolve, reject) {
//     db.goOnline();
//     await firebasePromiseCallback();
//     db.goOffline();
//   });
// };

export const checkRefOnce = ref => {
  return new Promise(function(resolve, reject) {
    db.goOnline();
    db.ref(ref).once('value').then(function(snapshot) {
      db.goOffline();
      resolve(snapshot.val());
    });
  });
};

export const setRefOnce = (ref, value) => {
  return new Promise(resolve => {
    db.goOnline();
    db.ref(ref).set(value, () => {
      db.goOffline();
      resolve();
    });
  });
};

export const removeRefOnce = (ref, value) => {
  return new Promise(resolve => {
    db.goOnline();
    db.ref(ref).remove(() => {
      db.goOffline();
      resolve();
    });
  });
};

export const whenUser = (timeout = 5000) => {
  // TODO: find out if db needs to be online to get user
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  return new Promise((resolve, reject) => {
    auth.onAuthStateChanged(user => {
      if (user) {
        resolve(user);
      }
    });
    timeout &&
      setTimeout(function() {
        reject('Timeout');
      }, timeout);
  });
};

async function getMessageID() {
  if (!localStorage.newGcmToken) {
    await messaging.requestPermission();
    const token = await messaging.getToken();
    if (token) {
      await whenUser(null);
      db.goOffline();
      db.goOnline();
      db
        .ref(`messages/${auth.currentUser.uid}`)
        .update({ tokens: { [token]: 1 }, displayName: auth.currentUser.displayName, email: auth.currentUser.email }, () => {
          localStorage.newGcmToken = token;
          console.log('updated token');
        });
    }
  }
}
getMessageID();

messaging.onTokenRefresh(async function() {
  db.goOnline();
  await whenUser(null);
  await db.ref(`messages/${auth.currentUser.uid}/tokens/${localStorage.newGcmToken}`).remove();
  delete localStorage.newGcmToken;
  getMessageID();
});

messaging.onMessage(payload => {
  console.log(payload);
  alert({ text: payload.notification.body });
});
