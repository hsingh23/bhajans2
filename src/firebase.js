// @ts-nocheck
import { initializeApp } from "firebase/app";
import {
  getDatabase,
  ref,
  get,
  set,
  remove,
} from "firebase/database";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";

// this is the perfect place to use mobx or redux to observe an object or dispatch an update event

const {
  firebaseApp,
  db,
  checkRefOnce,
  setRefOnce,
  whenUser,
  removeRefOnce,
  auth,

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
      // initialWait = false;
      history.push(["initialWaitOver", +new Date() - startTime]);
      if (!window.localStorage.admin) goOffline();
    }, 15 * 1000);
  }

  const auth = getAuth(firebaseApp);
  // window.firebase shim defined later for dev debugging

  // const doOnce = async function(firebasePromiseCallback) {
  //   return new Promise(async function(resolve, reject) {
  //     goOnline();
  //     await firebasePromiseCallback();
  //     goOffline();
  //   });
  // };

  const checkRefOnce = (refPath, { timeoutMs = 5000, fallback = null } = {}) => {
    return new Promise(function (resolve, reject) {
      const timer = setTimeout(() => {
        goOffline();
        resolve(fallback);
      }, timeoutMs);

      goOnline();
      get(ref(db, refPath))
        .then(function (snapshot) {
          clearTimeout(timer);
          goOffline();
          resolve(snapshot.val());
        })
        .catch((err) => {
          clearTimeout(timer);
          goOffline();
          reject(err);
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
          if (timerId) clearTimeout(timerId);
          unsub && unsub();
          resolve(user);
        }
      });

      const timerId = timeout
        ? setTimeout(function () {
            unsub && unsub();
            reject("Timeout");
          }, timeout)
        : null;
    });
  };

  // Three months in milliseconds for offline grace period
  const THREE_MONTHS_MS = 90 * 24 * 60 * 60 * 1000;

  const syncUserData = () => {
    checkRefOnce(`satsang/${auth.currentUser.uid}`).then((val) => {
      if (val) localStorage.presenter = true;
    }).catch(console.error);

    checkRefOnce(`paid/${auth.currentUser.uid}/expiresOn`).then((val) => {
      if (val) {
        localStorage.expiresOn = val;
        // Calculate offline grace period: 3 months OR until subscription expires, whichever is sooner
        const threeMonthsFromNow = Date.now() + THREE_MONTHS_MS;
        const offlineValidUntil = Math.min(threeMonthsFromNow, +val);
        localStorage.offlineValidUntil = offlineValidUntil;
      } else {
        delete localStorage.expiresOn;
        delete localStorage.offlineValidUntil;
      }
      localStorage.lastOnline = +new Date();
    }).catch((err) => {
      console.warn("Failed to sync user data, likely offline:", err);
      // Don't update lastOnline on failure, so we rely on the last successful sync
    });
  };

  whenUser().then(() => {
    syncUserData();
    window.addEventListener('online', syncUserData);
  }, doNothing);


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

  goOffline,
  goOnline,
  getUserByEmail,
};
