// Fix: Use firebase/compat/ to be compatible with older firebase versions and fix import errors.
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/analytics";
import "firebase/compat/firestore";
import "firebase/compat/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCG-nUBhOl0i_ZYi-KsRet6fLWCDli-loQ",
  authDomain: "autonomia-fdef1.firebaseapp.com",
  projectId: "autonomia-fdef1",
  storageBucket: "autonomia-fdef1.firebasestorage.app",
  messagingSenderId: "583881735650",
  appId: "1:583881735650:web:7ff43b50a400bd80f04dbb",
  measurementId: "G-6CTMKGR05T"
};

// Fix: Initialize app using the compat/v8 style.
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Fix: Export services using the compat/v8 style.
export const auth = firebase.auth();
export const db = firebase.firestore();
export const storage = firebase.storage();
export const analytics = firebase.analytics();
