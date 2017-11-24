import { combineReducers } from "redux";
import { firebaseReducer } from "react-redux-firebase";

// Add Firebase to reducers
export default combineReducers({
  firebase: firebaseReducer
  // firestore: firestoreReducer // <- needed if using firestore
});
