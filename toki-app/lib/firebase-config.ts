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
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

// Initialiser Firebase une seule fois (seulement si activé)
if (FIREBASE_ENABLED) {
  try {
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }

    authInstance = getAuth(app);
    dbInstance = getFirestore(app);
    
    console.log('[Firebase] Initialisé avec succès');
  } catch (error: any) {
    console.error('[Firebase] Erreur d\'initialisation:', error);
    // Ne pas throw - on continue en mode local si Firebase échoue
  }
} else {
  console.log('[Firebase] Désactivé - mode local');
}

// Exporter avec des noms différents pour éviter les conflits
export { app };
export const auth = authInstance;
export const db = dbInstance;
