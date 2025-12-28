// Firebase Configuration for Toki App
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// Firebase activé - Configuration du projet feed-toki
export const FIREBASE_ENABLED = true;

// Configuration Firebase - Projet feed-toki
// Source: Firebase Console > Project Settings > General > Web App
const firebaseConfig = {
  apiKey: "AIzaSyDpRzpFR-i_6MCP5dMpvXtzxjrmYxdKRTM",
  authDomain: "feed-toki.firebaseapp.com",
  projectId: "feed-toki",
  storageBucket: "feed-toki.firebasestorage.app",
  messagingSenderId: "936904189160",
  appId: "1:936904189160:web:6d8504e13e67a9300e555d",
  measurementId: "G-3G8CEV84ZM"
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
