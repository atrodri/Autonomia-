
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCG-nUBhOl0i_ZYi-KsRet6fLWCDli-loQ",
  authDomain: "autonomia-fdef1.firebaseapp.com",
  projectId: "autonomia-fdef1",
  storageBucket: "autonomia-fdef1.firebasestorage.app",
  messagingSenderId: "583881735650",
  appId: "1:583881735650:web:7ff43b50a400bd80f04dbb",
  measurementId: "G-6CTMKGR05T"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const analytics = getAnalytics(app);