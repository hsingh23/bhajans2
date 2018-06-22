import { createStore, compose, applyMiddleware } from "redux";
import thunk from "redux-thunk";
import { reactReduxFirebase, getFirebase } from "react-redux-firebase";
import firebase from "firebase";
// import 'firebase/firestore' // <- needed if using firestore
import rootReducer from "./rootReducer";

const firebaseConfig = {
  apiKey: "AIzaSyB9MVmCPLBachZm1Yfc3r1IaguL6Ps2NdM",
  authDomain: "bhajans-588f5.firebaseapp.com",
  databaseURL: "https://bhajans-588f5.firebaseio.com",
  projectId: "bhajans-588f5",
  storageBucket: "bhajans-588f5.appspot.com",
  messagingSenderId: "20248152848"
};

// react-redux-firebase config
const rrfConfig = {
  userProfile: "users",
  enableLogging: false
  // useFirestoreForProfile: true // Firestore for Profile instead of Realtime DB
};

// initialize firebase instance
firebase.initializeApp(firebaseConfig); // <- new to v2.*.*
// initialize firestore
// firebase.firestore() // <- needed if using firestore

const enhancers = [];
if (process.env.NODE_ENV === "development") {
  const devToolsExtension = window.devToolsExtension;

  if (typeof devToolsExtension === "function") {
    enhancers.push(devToolsExtension());
  }
}

const composedEnhancers = compose(
  applyMiddleware(thunk.withExtraArgument({ getFirebase })),
  reactReduxFirebase(firebase, rrfConfig),
  // reduxFirestore(firebase) // <- needed if using firestore
  ...enhancers
);

// Create store with reducers and initial state
export default initialState => createStore(rootReducer, initialState, composedEnhancers);
