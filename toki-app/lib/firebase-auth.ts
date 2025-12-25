// Service d'authentification Firebase
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from './firebase-config';
import { UserProfile } from './types';

export type AuthUser = User;

/**
 * Créer un nouveau compte utilisateur
 */
export async function signUp(email: string, password: string, displayName: string): Promise<AuthUser> {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // Mettre à jour le nom d'affichage
    await updateProfile(userCredential.user, { displayName });
    
    // Créer le profil par défaut dans Firestore
    const defaultProfile: UserProfile = {
      userId: userCredential.user.uid,
      displayName,
      email: userCredential.user.email || email,
      weeklyCalorieTarget: 10500, // Maintenance par défaut
      dailyPointsBudget: 45,
      createdAt: new Date().toISOString(),
      onboardingCompleted: false,
    };
    
    await setDoc(doc(db, 'users', userCredential.user.uid), defaultProfile);
    
    return userCredential.user;
  } catch (error: any) {
    throw new Error(error.message);
  }
}

/**
 * Se connecter avec email/mot de passe
 */
export async function signIn(email: string, password: string): Promise<AuthUser> {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error: any) {
    throw new Error(error.message);
  }
}

/**
 * Se déconnecter
 */
export async function signOut(): Promise<void> {
  try {
    await firebaseSignOut(auth);
  } catch (error: any) {
    throw new Error(error.message);
  }
}

/**
 * Écouter les changements d'état d'authentification
 */
export function onAuthChange(callback: (user: AuthUser | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

/**
 * Récupérer le profil utilisateur depuis Firestore
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}

/**
 * Mettre à jour le profil utilisateur
 */
export async function updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<void> {
  try {
    const docRef = doc(db, 'users', userId);
    await setDoc(docRef, updates, { merge: true });
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
}

/**
 * Obtenir l'utilisateur actuellement connecté
 */
export function getCurrentUser(): AuthUser | null {
  return auth.currentUser;
}
