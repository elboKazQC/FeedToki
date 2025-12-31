// Service d'authentification Firebase
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendEmailVerification,
  User,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase-config';
import { UserProfile } from './types';

export type AuthUser = User;

/**
 * Créer un nouveau compte utilisateur
 */
export async function signUp(email: string, password: string, displayName: string): Promise<AuthUser> {
  if (!auth || !db) {
    throw new Error('Firebase n\'est pas correctement initialisé. Vérifiez que Authentication et Firestore sont activés dans Firebase Console.');
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // Mettre à jour le nom d'affichage
    await updateProfile(userCredential.user, { displayName });
    
    // Envoyer l'email de vérification
    try {
      // Attendre un peu pour s'assurer que le profil utilisateur est bien créé dans Firebase
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Option url pour rediriger après vérification (web seulement)
      const actionCodeSettings = typeof window !== 'undefined' 
        ? { url: window.location.origin + '/?verified=true' }
        : undefined;
      
      await sendEmailVerification(userCredential.user, actionCodeSettings);
      console.log('[Firebase Auth] ✅ Email de vérification envoyé à:', email);
    } catch (verifyError: any) {
      console.error('[Firebase Auth] ❌ Erreur envoi email de vérification:', verifyError);
      console.error('[Firebase Auth] Code erreur:', verifyError?.code);
      console.error('[Firebase Auth] Message erreur:', verifyError?.message);
      // Ne pas bloquer la création du compte si l'envoi d'email échoue
      // L'utilisateur pourra demander un renvoi plus tard
      // Mais on log l'erreur pour débugger
    }
    
    // Créer le profil par défaut dans Firestore
    // Utiliser le calcul de points au lieu d'une valeur hardcodée
    const defaultWeeklyTarget = 10500; // Maintenance par défaut (~1500 cal/jour)
    const defaultDailyPoints = Math.max(3, Math.round((defaultWeeklyTarget * 0.30 / 7) / 80)); // ~6 points
    
    const defaultProfile: UserProfile = {
      userId: userCredential.user.uid,
      displayName,
      email: userCredential.user.email || email,
      weeklyCalorieTarget: defaultWeeklyTarget,
      dailyPointsBudget: defaultDailyPoints,
      maxPointsCap: Math.min(defaultDailyPoints * 4, 12),
      createdAt: new Date().toISOString(),
      onboardingCompleted: false,
    };
    
    await setDoc(doc(db, 'users', userCredential.user.uid), defaultProfile);
    
    return userCredential.user;
  } catch (error: any) {
    // Messages d'erreur plus clairs
    let errorMessage = error.message || 'Erreur lors de la création du compte';
    
    if (error.code === 'auth/email-already-in-use') {
      errorMessage = 'Cet email est déjà utilisé. Essayez de vous connecter.';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Email invalide. Vérifiez votre adresse email.';
    } else if (error.code === 'auth/weak-password') {
      errorMessage = 'Mot de passe trop faible. Utilisez au moins 6 caractères.';
    } else if (error.code === 'auth/network-request-failed') {
      errorMessage = 'Erreur de connexion. Vérifiez votre connexion internet.';
    } else if (error.code === 'auth/too-many-requests') {
      errorMessage = 'Trop de tentatives. Réessayez plus tard.';
    } else if (error.message?.includes('identitytoolkit') || error.message?.includes('400')) {
      errorMessage = 'Erreur Firebase: Authentication n\'est peut-être pas activé. Vérifiez Firebase Console > Authentication > Sign-in method et activez Email/Password.';
    }
    
    console.error('[Firebase Auth] Erreur signUp:', error.code, error.message);
    throw new Error(errorMessage);
  }
}

/**
 * Se connecter avec email/mot de passe
 */
export async function signIn(email: string, password: string): Promise<AuthUser> {
  if (!auth) {
    throw new Error('Firebase n\'est pas correctement initialisé. Vérifiez que Authentication est activé dans Firebase Console.');
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    // Ne pas bloquer la connexion - on laissera l'UI gérer l'affichage
    return userCredential.user;
  } catch (error: any) {
    // Messages d'erreur plus clairs
    let errorMessage = error.message || 'Erreur lors de la connexion';
    
    if (error.code === 'auth/user-not-found') {
      errorMessage = 'Aucun compte trouvé avec cet email. Créez un compte d\'abord.';
    } else if (error.code === 'auth/wrong-password') {
      errorMessage = 'Mot de passe incorrect.';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Email invalide. Vérifiez votre adresse email.';
    } else if (error.code === 'auth/network-request-failed') {
      errorMessage = 'Erreur de connexion. Vérifiez votre connexion internet.';
    } else if (error.code === 'auth/too-many-requests') {
      errorMessage = 'Trop de tentatives. Réessayez plus tard.';
    } else if (error.message?.includes('identitytoolkit') || error.message?.includes('400')) {
      errorMessage = 'Erreur Firebase: Authentication n\'est peut-être pas activé. Vérifiez Firebase Console > Authentication > Sign-in method et activez Email/Password.';
    }
    
    console.error('[Firebase Auth] Erreur signIn:', error.code, error.message);
    throw new Error(errorMessage);
  }
}

/**
 * Se déconnecter
 */
export async function signOut(): Promise<void> {
  if (!auth) {
    console.warn('[Firebase Auth] signOut called but auth not initialized');
    return;
  }

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
  if (!auth) {
    console.warn('[Firebase Auth] onAuthChange called but auth not initialized');
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

/**
 * Récupérer le profil utilisateur depuis Firestore
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  if (!db) {
    console.warn('[Firebase Auth] getUserProfile called but Firestore not initialized');
    return null;
  }

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
  if (!db) {
    throw new Error('Firestore not initialized');
  }

  try {
    // Filtrer les valeurs undefined pour Firestore (Firestore n'accepte pas undefined)
    const cleanUpdates: any = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        cleanUpdates[key] = value;
      }
    }
    // S'assurer que userId est toujours défini
    cleanUpdates.userId = userId;

    const docRef = doc(db, 'users', userId);
    await setDoc(docRef, cleanUpdates, { merge: true });
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
}

/**
 * Obtenir l'utilisateur actuellement connecté
 */
export function getCurrentUser(): AuthUser | null {
  return auth?.currentUser ?? null;
}
export async function resendEmailVerification(user: AuthUser): Promise<void> {
  if (!auth || !user) {
    throw new Error('Firebase n\'est pas correctement initialisé ou utilisateur non connecté.');
  }

  try {
    // Option url pour rediriger après vérification (web seulement)
    const actionCodeSettings = typeof window !== 'undefined' 
      ? { url: window.location.origin + '/?verified=true' }
      : undefined;
    
    await sendEmailVerification(user, actionCodeSettings);
    console.log('[Firebase Auth] ✅ Email de vérification renvoyé à:', user.email);
  } catch (error: any) {
    console.error('[Firebase Auth] ❌ Erreur renvoi email de vérification:', error);
    let errorMessage = error.message || 'Erreur lors de l\'envoi de l\'email de vérification';
    
    if (error.code === 'auth/too-many-requests') {
      errorMessage = 'Trop de demandes. Veuillez attendre quelques minutes avant de réessayer.';
    }
    
    throw new Error(errorMessage);
  }
}
