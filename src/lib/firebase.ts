import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAL22EtARQ8jFynCD5xkeUTVQgCJHIWn14",
  authDomain: "my-knitting-log.firebaseapp.com",
  projectId: "my-knitting-log",
  storageBucket: "my-knitting-log.firebasestorage.app",
  messagingSenderId: "270728801613",
  appId: "1:270728801613:web:90fab5ade52a96d699db04",
  measurementId: "G-25VWMEM071"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const firestore = getFirestore(app);
export const storage = getStorage(app);

