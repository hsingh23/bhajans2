import { initializeApp } from "firebase/app";
import {
  getDatabase,
  ref,
  get,
  set,
  remove,
  goOnline as dbGoOnline,
  goOffline as dbGoOffline,
} from "firebase/database";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
// import { alert } from "notie";
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
  firebaseShim,
} = (() => {
  const config = {
    apiKey: "AIzaSyB9MVmCPLBachZm1Yfc3r1IaguL6Ps2NdM",
    authDomain: "bhajans-588f5.firebaseapp.com",
    databaseURL: "https://bhajans-588f5.firebaseio.com",
    projectId: "bhajans-588f5",
    storageBucket: "bhajans-588f5.appspot.com",
    messagingSenderId: "20248152848",
    appId: "1:20248152848:web:3975f2a0d9279841b8b395",
  };

  const doNothing = () => {};

  // Initialize Firebase (modular)
  const firebaseApp = initializeApp(config);
  const db = getDatabase(firebaseApp); // Realtime Database
  var history = [];
  window.dbHistory = history;
  var startTime = +new Date();
  let initialWait = true;
  // don't worry about going online and offline right now
  const goOffline = () => {
    // history.push(["off", +new Date() - startTime]);
    // !initialWait && dbGoOffline(db);
    // console.log("off", history);
  };

  const goOnline = () => {
    // history.push(["on", +new Date() - startTime]);
    // !initialWait && dbGoOnline(db);
    // console.log("on", history);
  };

  if (!window.localStorage.admin) {
    setTimeout(() => {
      initialWait = false;
      history.push(["initialWaitOver", +new Date() - startTime]);
      if (!window.localStorage.admin) goOffline();
    }, 15 * 1000);
  }

  const auth = getAuth(firebaseApp);
  let messaging = null;
  // window.firebase shim defined later for dev debugging

  // const doOnce = async function(firebasePromiseCallback) {
  //   return new Promise(async function(resolve, reject) {
  //     goOnline();
  //     await firebasePromiseCallback();
  //     goOffline();
  //   });
  // };

  const checkRefOnce = (refPath) => {
    return new Promise(function (resolve, reject) {
      goOnline();
      get(ref(db, refPath)).then(function (snapshot) {
        goOffline();
        resolve(snapshot.val());
      });
    });
  };

  const setRefOnce = (refPath, value) => {
    return new Promise((resolve) => {
      goOnline();
      set(ref(db, refPath), value).then(() => {
        goOffline();
        resolve();
      });
    });
  };

  const removeRefOnce = (refPath) => {
    return new Promise((resolve) => {
      goOnline();
      remove(ref(db, refPath)).then(() => {
        goOffline();
        resolve();
      });
    });
  };

  const whenUser = (timeout = 5000) => {
    // TODO: find out if db needs to be online to get user
    if (auth.currentUser) return Promise.resolve(auth.currentUser);
    return new Promise((resolve, reject) => {
      const unsub = onAuthStateChanged(auth, (user) => {
        if (user) {
          unsub && unsub();
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
      if (!messaging) return;
      if (typeof Notification !== "undefined") {
        await Notification.requestPermission();
      }
      const token = await getToken(messaging).then((t) => t);
      if (token) {
        await whenUser(null);
        const userMessagesRef = ref(db, `messages/${auth.currentUser.uid}`);
        const snap = await get(userMessagesRef);
        if (!snap.val() || !snap.val().tokens) {
          await set(userMessagesRef, {
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
  // Initialize messaging only in production with active service worker and browser support
  if (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    process.env.NODE_ENV === "production"
  ) {
    isSupported()
      .then((supported) => {
        if (!supported) return;
        messaging = getMessaging(firebaseApp);
        navigator.serviceWorker.ready.then(() => {
          getMessageID();
          onMessage(messaging, (payload) => {
            if (payload && payload.notification && payload.notification.body) {
              if (typeof window !== "undefined" && window.alert) {
                window.alert(payload.notification.body);
              }
            }
          });
          window.messaging = messaging;
        });
      })
      .catch(() => {});
  }
  // functions
  const functions = getFunctions(firebaseApp, "us-central1");
  const getUserByEmail = httpsCallable(functions, "getUserByEmail");

  // Minimal shim for dev debugging (kept for compatibility)
  const firebaseShim = {
    app: firebaseApp,
    auth,
    db,
  };
  if (typeof window !== "undefined" && window.location.host.includes("localhost")) {
    window.firebase = firebaseShim;
  }

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
    firebaseShim,
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
  firebaseShim as firebase,
  messaging,
  goOffline,
  goOnline,
  getUserByEmail,
};
