import firebase from "firebase/app";
import "firebase/database";
import "firebase/auth";
import "firebase/functions";
import "firebase/messaging";
// import { alert } from "notie";
import wrap from "lodash/wrap";
// this is the perfect place to use mobx or redux to observe an object or dispatch an update event

const {
  firebaseApp,
  db,
  checkRefOnce,
  setRefOnce,
  whenUser,
  removeRefOnce,
  auth,
  messaging,
  goOffline,
  goOnline,
  getUserByEmail,
} = (() => {
  var config = {
    apiKey: "AIzaSyB9MVmCPLBachZm1Yfc3r1IaguL6Ps2NdM",
    authDomain: "bhajans-588f5.firebaseapp.com",
    databaseURL: "https://bhajans-588f5.firebaseio.com",
    projectId: "bhajans-588f5",
    storageBucket: "bhajans-588f5.appspot.com",
    messagingSenderId: "20248152848",
    appId: "1:20248152848:web:3975f2a0d9279841b8b395",
  };

  const doNothing = () => {};

  //the root app just in case we need it
  const firebaseApp = firebase.initializeApp(config);
  const db = firebaseApp.database(); //the real-time database
  var history = [];
  window.dbHistory = history;
  var startTime = +new Date();
  const initialWait = true;
  // don't worry about going online and offline right now
  const goOffline = () => {
    // history.push(["off", +new Date() - startTime]);
    // !initialWait && db.goOffline();
    // console.log("off", history);
  };

  const goOnline = () => {
    // history.push(["on", +new Date() - startTime]);
    // !initialWait && db.goOnline();
    // console.log("on", history);
  };

  !window.localStorage.admin &&
    setTimeout(
      wrap(
        { initialWait, goOffline, startTime, history },
        ({ initialWait, goOffline, startTime, history }) => {
          initialWait = false;
          history.push(["initialWaitOver", +new Date() - startTime]);
          !window.localStorage.admin && goOffline();
        }
      ),
      15 * 1000
    );

  const auth = firebase.auth(); //the firebase auth namespace
  var messaging = null;
  try {
    messaging = firebase.messaging();
  } catch (e) {
    console.error(e);
  }
  if (window.location.host.includes("localhost")) window.firebase = firebase;

  // const doOnce = async function(firebasePromiseCallback) {
  //   return new Promise(async function(resolve, reject) {
  //     goOnline();
  //     await firebasePromiseCallback();
  //     goOffline();
  //   });
  // };

  const checkRefOnce = (ref) => {
    return new Promise(function (resolve, reject) {
      goOnline();
      db.ref(ref)
        .once("value")
        .then(function (snapshot) {
          goOffline();
          resolve(snapshot.val());
        });
    });
  };

  const setRefOnce = (ref, value) => {
    return new Promise((resolve) => {
      goOnline();
      db.ref(ref).set(value, () => {
        goOffline();
        resolve();
      });
    });
  };

  const removeRefOnce = (ref, value) => {
    return new Promise((resolve) => {
      goOnline();
      db.ref(ref).remove(() => {
        goOffline();
        resolve();
      });
    });
  };

  const whenUser = (timeout = 5000) => {
    // TODO: find out if db needs to be online to get user
    if (auth.currentUser) return Promise.resolve(auth.currentUser);
    return new Promise((resolve, reject) => {
      auth.onAuthStateChanged((user) => {
        if (user) {
          resolve(user);
        }
      });
      timeout &&
        setTimeout(function () {
          reject("Timeout");
        }, timeout);
    });
  };

  whenUser().then((user) => {
    checkRefOnce(`satsang/${auth.currentUser.uid}`).then((val) => {
      if (val) localStorage.presenter = true;
    });
    checkRefOnce(`paid/${auth.currentUser.uid}/expiresOn`).then((val) => {
      if (val) {
        localStorage.expiresOn = val;
      } else {
        delete localStorage.expiresOn;
      }
      localStorage.lastOnline = +new Date();
    });
  }, doNothing);

  async function getMessageID() {
    // if (!localStorage.currentToken) {
    //   alert({ text: 'Please allow notifications for website updates and more. Unsubscribe at any time.' })
    // }
    try {
      await messaging.requestPermission();
      const token = await messaging.getToken().then((token) => {
        return token;
      });
      if (token) {
        await whenUser(null);
        const userMessagesRef = db.ref(`messages/${auth.currentUser.uid}`);
        const snap = await userMessagesRef.once("value");
        if (!snap.val() || !snap.val().tokens) {
          await userMessagesRef.set({
            displayName: auth.currentUser.displayName,
            email: auth.currentUser.email,
            tokens: { [token]: 1 },
          });
          localStorage.currentToken = token;
        }
      }
    } catch (error) {
      console.error(error);
    }
  }
  if (messaging) {
    getMessageID();
    messaging.onTokenRefresh(async function () {
      await whenUser(null);
      await db
        .ref(
          `messages/${auth.currentUser.uid}/tokens/${localStorage.currentToken}`
        )
        .remove();
      delete localStorage.currentToken;
      getMessageID();
    });

    messaging.onMessage((payload) => {
      alert({ text: payload.notification.body });
    });
    window.messaging = messaging;
  }

  window.firebase = firebase;
  const getUserByEmail = firebaseApp
    .functions("us-central1")
    .httpsCallable("getUserByEmail");

  return {
    firebaseApp,
    db,
    checkRefOnce,
    setRefOnce,
    whenUser,
    removeRefOnce,
    auth,
    messaging,
    goOnline,
    goOffline,
    getUserByEmail,
  };
})();

export {
  firebaseApp,
  db,
  checkRefOnce,
  setRefOnce,
  whenUser,
  removeRefOnce,
  auth,
  firebase,
  messaging,
  goOffline,
  goOnline,
  getUserByEmail,
};
