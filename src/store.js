import { createStore, combineReducers, compose } from "redux";
import { reactReduxFirebase, firebaseReducer } from "react-redux-firebase";
import firebase from "firebase";
// import 'firebase/firestore' // <- needed if using firestore

const firebaseConfig = {};

// react-redux-firebase config
const rrfConfig = {
  userProfile: "users"
  // useFirestoreForProfile: true // Firestore for Profile instead of Realtime DB
};

// initialize firebase instance
firebase.initializeApp(rrfConfig); // <- new to v2.*.*

// initialize firestore
// firebase.firestore() // <- needed if using firestore

// Add reduxReduxFirebase enhancer when making store creator
const createStoreWithFirebase = compose(
  reactReduxFirebase(firebase, rrfConfig) // firebase instance as first argument
  // reduxFirestore(firebase) // <- needed if using firestore
)(createStore);

// Add Firebase to reducers
const rootReducer = combineReducers({
  firebase: firebaseReducer
  // firestore: firestoreReducer // <- needed if using firestore
});

// Create store with reducers and initial state
const initialState = {};
const store = createStoreWithFirebase(rootReducer, initialState);
