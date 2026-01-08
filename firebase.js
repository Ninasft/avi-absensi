import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

let app;
let auth;
let db;

export const initFirebase = () => {
  if (typeof window === "undefined") return false;

  if (app && auth && db) return true;

  try {
    console.log("🔥 Initializing Firebase (Next.js)...");

    const firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };

    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
      console.error("❌ Firebase env variables are missing");
      console.table(firebaseConfig);
      return false;
    }

    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    console.log("🎉 Firebase initialized successfully");
    return true;
  } catch (err) {
    console.error("❌ Firebase init failed:", err);
    return false;
  }
};

export const getFirebaseAuth = () => {
  if (!auth) initFirebase();
  return auth;
};

export const getFirebaseDB = () => {
  if (!db) initFirebase();
  return db;
};
