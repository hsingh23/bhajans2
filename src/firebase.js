import firebase from "firebase";
import { alert } from "notie";
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
  goOnline
} = (() => {
  var config = {
    apiKey: "AIzaSyB9MVmCPLBachZm1Yfc3r1IaguL6Ps2NdM",
    authDomain: "bhajans-588f5.firebaseapp.com",
    databaseURL: "https://bhajans-588f5.firebaseio.com",
    projectId: "bhajans-588f5",
    storageBucket: "bhajans-588f5.appspot.com",
    messagingSenderId: "20248152848"
  };

  //the root app just in case we need it
  const firebaseApp = firebase.initializeApp(config);
  const db = firebaseApp.database(); //the real-time database
  var history = [];
  window.dbHistory = history;
  var startTime = +new Date();
  const initialWait = true;
  // don't worry about going online and offline right now
  const goOffline = () => {
    history.push(["off", +new Date() - startTime]);
    // !initialWait && db.goOffline();
    console.log("off", history);
  };

  const goOnline = () => {
    history.push(["on", +new Date() - startTime]);
    // !initialWait && db.goOnline();
    console.log("on", history);
  };

  !window.localStorage.admin &&
    setTimeout(
      wrap({ initialWait, goOffline, startTime, history }, ({ initialWait, goOffline, startTime, history }) => {
        initialWait = false;
        history.push(["initialWaitOver", +new Date() - startTime]);
        !window.localStorage.admin && goOffline();
      }),
      15 * 1000
    );

  const auth = firebase.auth(); //the firebase auth namespace
  const messaging = firebase.messaging();
  if (window.location.host.includes("localhost")) window.firebase = firebase;

  // const doOnce = async function(firebasePromiseCallback) {
  //   return new Promise(async function(resolve, reject) {
  //     goOnline();
  //     await firebasePromiseCallback();
  //     goOffline();
  //   });
  // };

  const checkRefOnce = ref => {
    return new Promise(function(resolve, reject) {
      goOnline();
      db.ref(ref).once("value").then(function(snapshot) {
        goOffline();
        resolve(snapshot.val());
      });
    });
  };

  const setRefOnce = (ref, value) => {
    return new Promise(resolve => {
      goOnline();
      db.ref(ref).set(value, () => {
        goOffline();
        resolve();
      });
    });
  };

  const removeRefOnce = (ref, value) => {
    return new Promise(resolve => {
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
      auth.onAuthStateChanged(user => {
        if (user) {
          resolve(user);
        }
      });
      timeout &&
        setTimeout(function() {
          reject("Timeout");
        }, timeout);
    });
  };

  whenUser().then(user => {
    checkRefOnce(`satsang/${auth.currentUser.uid}`).then(val => {
      if (val) localStorage.presenter = true;
    });
  });

  async function getMessageID() {
    // if (!localStorage.currentToken) {
    //   alert({ text: 'Please allow notifications for website updates and more. Unsubscribe at any time.' })
    // }
    try {
      console.log("requesting permissions to notify");
      await messaging.requestPermission();
      console.log("got permission");
      const token = await messaging.getToken().then(token => {
        console.log("token returned: ", token);
        return token;
      });
      console.log("Token: ", token);
      if (token) {
        await whenUser(null);
        goOnline();
        console.log("have user and are online");
        const userMessagesRef = db.ref(`messages/${auth.currentUser.uid}`);
        console.log("awaiting messages");
        goOnline();
        const snap = await userMessagesRef.once("value");
        console.log("got messages");
        if (!snap.val() || !snap.val().tokens) {
          console.log("about to set metadata");
          goOnline();
          await userMessagesRef.set({
            displayName: auth.currentUser.displayName,
            email: auth.currentUser.email,
            tokens: {}
          });
          console.log("set metadata");
        }
        if (!snap.val().tokens[token]) {
          console.log("about to set token");
          goOnline();
          await userMessagesRef.child(`tokens/${token}`).set("1");
          console.log("set token");
          localStorage.currentToken = token;
        }
      }
    } catch (error) {
      console.error(error);
    }
  }
  getMessageID();

  messaging.onTokenRefresh(async function() {
    goOnline();
    console.log("onTokenRefresh");
    await whenUser(null);
    await db.ref(`messages/${auth.currentUser.uid}/tokens/${localStorage.currentToken}`).remove();
    delete localStorage.currentToken;
    getMessageID();
  });

  messaging.onMessage(payload => {
    console.log(payload);
    alert({ text: payload.notification.body });
  });
  window.firebase = firebase;
  window.messaging = messaging;
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
    goOffline
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
  goOnline
};
