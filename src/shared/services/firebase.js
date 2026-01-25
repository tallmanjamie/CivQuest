// src/shared/services/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBPiMgjC3dOGCbw3h5gDLXZdsOo-lHI_YY",
  authDomain: "civquest-notify.firebaseapp.com",
  projectId: "civquest-notify",
  storageBucket: "civquest-notify.firebasestorage.app",
  messagingSenderId: "126930260374",
  appId: "1:126930260374:web:30571ee0ec9068399c0db7"
};

// Initialize Firebase (singleton)
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;