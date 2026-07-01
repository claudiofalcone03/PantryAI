import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence, indexedDBLocalPersistence } from "firebase/auth";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Evita crash di Firebase durante i refresh di Next.js
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const auth = getAuth(app);
if (typeof window !== "undefined") {
  setPersistence(auth, browserLocalPersistence).catch(console.error);
}
const googleProvider = new GoogleAuthProvider();

// Inizializza Firestore con CACHE OFFLINE per rendere il caricamento istantaneo
let db: Firestore;
if (typeof window !== "undefined" && !getApps().length) {
  // Solo lato client e alla prima inizializzazione attiviamo la cache
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
} else {
  // Fallback se siamo lato server o in un refresh
  db = getFirestore(app);
}

export { app, auth, googleProvider, db };
