import firebase from 'firebase';

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

export { firebase };
if (localStorage.debug) window.firebase = firebase;

export const doOnce = async function(firebasePromiseCallback) {
  return new Promise(async function(resolve, reject) {
    await db.goOnline();
    await firebasePromiseCallback();
    await db.goOffline();
  });
};

export const checkRefOnce = ref => {
  return new Promise(async function(resolve, reject) {
    await db.goOnline();
    db.ref(ref).once('value').then(async function(snapshot) {
      await db.goOffline();
      resolve(snapshot.val());
    });
  });
};

export const setRefOnce = (ref, value) => {
  return new Promise(async function(resolve, reject) {
    await db.goOnline();
    db.ref(ref).set(value, () => db.goOffline());
  });
};

// export const firebaseState = (function() {
//   var state = {
//     isAuthenticated: !!auth.currentUser || localStorage.uid,
//     currentUser: auth.currentUser || {},
//     paid: false,
//   };

//   auth.onAuthStateChanged(function(user) {
//     if (!user) {
//       // logout
//       delete localStorage.uid;
//       delete localStorage.updated;
//       state.isAuthenticated = false;
//       state.currentUser = {};
//       state.paid = false;
//       db.goOffline();
//     } else {
//       // just authenticated
//       localStorage.updated = +new Date();
//       localStorage.uid = user.uid;
//       state.currentUser = user;
//       state.isAuthenticated = true;
//       const getPaid = () =>
//         db
//           .ref(`/paid/${user.uid}`)
//           .once('value')
//           .then(function(snapshot) {
//             if (snapshot.val() === '1') {
//               state.paid = true;
//             } else {
//               state.paid = false;
//             }
//           })
//           // close the connection once you know if someone has paid or not.
//           .then(() => db.goOffline());
//       db.goOnline().then(getPaid);
//     }
//   });
//   const getState = () => state;

//   return {
//     getState,
//   };
// })();
