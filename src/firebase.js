import firebase from 'firebase';
import { alert, confirm } from 'notie';
// this is the perfect place to use mobx or redux to observe an object or dispatch an update event

var config = {
  apiKey: 'AIzaSyB9MVmCPLBachZm1Yfc3r1IaguL6Ps2NdM',
  authDomain: 'bhajans-588f5.firebaseapp.com',
  databaseURL: 'https://bhajans-588f5.firebaseio.com',
  projectId: 'bhajans-588f5',
  storageBucket: 'bhajans-588f5.appspot.com',
  messagingSenderId: '20248152848'
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
  // if (!localStorage.currentToken) {
  //   alert({ text: 'Please allow notifications for website updates and more. Unsubscribe at any time.' })
  // }
  try {
    await messaging.requestPermission();
    const token = await messaging.getToken().then(token => {
      console.log('token returned: ', token);
      return token;
    });
    console.log('Token: ', token);
    if (token) {
      await whenUser(null);
      db.goOnline();
      console.log('have user and are online');
      const userMessagesRef = db.ref(`messages/${auth.currentUser.uid}`);
      console.log('awaiting messages');
      db.goOnline();
      const snap = await userMessagesRef.once('value');
      console.log('got messages');
      if (!snap.val() || !snap.val().tokens) {
        console.log('about to set metadata');
        db.goOnline();
        await userMessagesRef.set({ displayName: auth.currentUser.displayName, email: auth.currentUser.email, tokens: {} });
        console.log('set metadata');
      }
      if (!snap.val().tokens[token]) {
        console.log('about to set token');
        db.goOnline();
        await userMessagesRef.child(`tokens/${token}`).set('1');
        console.log('set token');
        localStorage.currentToken = token;
      }
    }
  } catch (error) {
    console.error(error);
  }
}
getMessageID();

messaging.onTokenRefresh(async function() {
  db.goOnline();
  console.log('onTokenRefresh');
  await whenUser(null);
  await db.ref(`messages/${auth.currentUser.uid}/tokens/${localStorage.currentToken}`).remove();
  delete localStorage.currentToken;
  getMessageID();
});

messaging.onMessage(payload => {
  console.log(payload);
  alert({ text: payload.notification.body });
});
