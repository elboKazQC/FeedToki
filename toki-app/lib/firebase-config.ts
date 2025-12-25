// Firebase Configuration for Toki App
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// Active/désactive Firebase (mettre à true quand tu auras configuré Firebase)
export const FIREBASE_ENABLED = false;

// Configuration Firebase - À remplacer avec tes vraies clés
// Tu devras créer un projet Firebase sur console.firebase.google.com
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "toki-app.firebaseapp.com",
  projectId: "toki-app",
  storageBucket: "toki-app.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890abcdef"
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

// Initialiser Firebase une seule fois (seulement si activé)
if (FIREBASE_ENABLED) {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }

  auth = getAuth(app);
  db = getFirestore(app);
}

export { app, auth, db };
