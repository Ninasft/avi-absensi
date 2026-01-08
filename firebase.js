import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

let app;
let auth;
let db;

export const initFirebase = () => {
  if (typeof window === "undefined") return false;

  // Cegah init ulang
  if (app && auth && db) {
    return true;
  }

  try {
    console.log("🔥 Initializing Firebase...");

    const firebaseConfig = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    };

    // VALIDASI ENV (WAJIB ADA)
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
  } catch (error) {
    console.error("❌ Firebase initialization failed:", error);
    return false;
  }
};

// Export getter (aman dipanggil di mana aja)
export const getFirebaseAuth = () => {
  if (!auth) initFirebase();
  return auth;
};

export const getFirebaseDB = () => {
  if (!db) initFirebase();
  return db;
};
