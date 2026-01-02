// Service d'authentification Firebase
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  User,
  updateProfile,
  reload
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase-config';
import { UserProfile } from './types';

export type AuthUser = User;

/**
 * Envoyer l'email de vérification avec logique de retry
 */
async function sendEmailVerificationWithRetry(user: AuthUser, email: string, maxRetries = 3): Promise<boolean> {
  const actionCodeSettings = typeof window !== 'undefined' 
    ? { url: window.location.origin + '/?verified=true' }
    : undefined;
  
  console.log(`[Firebase Auth] 📧 Tentative d'envoi email de vérification à ${email}`);
  console.log(`[Firebase Auth] User ID: ${user.uid}, EmailVerified: ${user.emailVerified}`);
  console.log(`[Firebase Auth] ActionCodeSettings:`, actionCodeSettings);
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await sendEmailVerification(user, actionCodeSettings);
      console.log(`[Firebase Auth] ✅ Email de vérification envoyé avec succès à ${email} (tentative ${attempt})`);
      console.log(`[Firebase Auth] ⚠️ Note: Si vous ne recevez pas l'email, vérifiez votre dossier SPAM/COURRIER INDÉSIRABLE`);
      console.log(`[Firebase Auth] ⚠️ Vérifiez aussi Firebase Console > Authentication > Templates pour la configuration des emails`);
      return true;
    } catch (error: any) {
      console.error(`[Firebase Auth] ❌ Tentative ${attempt}/${maxRetries} échouée pour ${email}`);
      console.error(`[Firebase Auth] Code d'erreur:`, error.code);
      console.error(`[Firebase Auth] Message d'erreur:`, error.message);
      console.error(`[Firebase Auth] Erreur complète:`, error);
      
      // Codes d'erreur Firebase spécifiques
      if (error.code === 'auth/too-many-requests') {
        console.error(`[Firebase Auth] ⚠️ Trop de requêtes - Firebase limite l'envoi d'emails. Attendez quelques minutes.`);
        throw new Error('Trop de tentatives d\'envoi d\'email. Veuillez attendre quelques minutes avant de réessayer.');
      }
      
      if (error.code === 'auth/user-not-found') {
        console.error(`[Firebase Auth] ⚠️ Utilisateur non trouvé - Le compte n'existe peut-être pas encore`);
        throw new Error('Utilisateur non trouvé. Le compte n\'a peut-être pas été créé correctement.');
      }
      
      if (attempt < maxRetries) {
        // Délai exponentiel : 1s, 2s, 4s (augmenté pour donner plus de temps)
        const delay = 1000 * Math.pow(2, attempt - 1);
        console.log(`[Firebase Auth] ⏳ Attente de ${delay}ms avant nouvelle tentative...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error(`[Firebase Auth] ❌ ÉCHEC FINAL: Impossible d'envoyer l'email après ${maxRetries} tentatives`);
        throw error; // Propager l'erreur après tous les retries
      }
    }
  }
  return false;
}

/**
 * Retry avec backoff exponentiel pour les erreurs réseau
 */
async function withNetworkRetry<T>(
  fn: () => Promise<T>,
  operation: string,
  maxRetries: number = 3
): Promise<T> {
  let lastError: any = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Si ce n'est pas une erreur réseau, ne pas retry
      if (error.code !== 'auth/network-request-failed' && 
          error.code !== 'auth/too-many-requests' &&
          !error.message?.includes('network') &&
          !error.message?.includes('NetworkError')) {
        throw error;
      }
      
      // Si c'est la dernière tentative, throw l'erreur
      if (attempt === maxRetries) {
        console.error(`[Firebase Auth] ❌ ${operation} échoué après ${maxRetries} tentatives:`, error.code, error.message);
        throw error;
      }
      
      // Attendre avant de réessayer (backoff exponentiel: 1s, 2s, 4s)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 4000);
      console.warn(`[Firebase Auth] ⚠️ ${operation} échoué (tentative ${attempt}/${maxRetries}), retry dans ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error(`${operation} a échoué`);
}

/**
 * Créer un nouveau compte utilisateur
 */
export async function signUp(email: string, password: string, displayName: string): Promise<AuthUser> {
  if (!auth || !db) {
    throw new Error('Firebase n\'est pas correctement initialisé. Vérifiez que Authentication et Firestore sont activés dans Firebase Console.');
  }

  try {
    const userCredential = await withNetworkRetry(
      () => createUserWithEmailAndPassword(auth!, email, password),
      'signUp (createUserWithEmailAndPassword)'
    );
    
    // Mettre à jour le nom d'affichage
    await updateProfile(userCredential.user, { displayName });
    
    // Créer le profil par défaut dans Firestore D'ABORD
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
    
    // Calculer le rank de l'utilisateur et créer la subscription
    try {
      const { getUserRank, createSubscription } = await import('./subscription-utils');
      // Calculer le rank (l'API ne prend qu'un seul argument, userId)
      const userRank = await getUserRank(userCredential.user.uid);
      
      // Créer la subscription selon le rank
      if (userRank <= 10) {
        // Beta user - gratuit à vie
        await createSubscription(userCredential.user.uid, 'beta', 'active');
        console.log(`[Firebase Auth] ✅ Utilisateur ${userCredential.user.uid} est beta user (rank ${userRank})`);
      } else {
        // Utilisateur normal - pas d'accès jusqu'à paiement
        await createSubscription(userCredential.user.uid, 'expired', 'canceled');
        console.log(`[Firebase Auth] Utilisateur ${userCredential.user.uid} rank ${userRank} - paiement requis`);
      }
      
      // Sauvegarder le rank dans le profil
      await setDoc(doc(db, 'users', userCredential.user.uid), { userRank }, { merge: true });
    } catch (error) {
      console.error('[Firebase Auth] Erreur création subscription:', error);
      // Ne pas bloquer la création du compte si la subscription échoue
    }
    
    // Attendre que tout soit bien créé
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Recharger l'utilisateur pour s'assurer qu'il est à jour
    await reload(userCredential.user);
    
    // Envoyer l'email de vérification avec retry (ne bloque pas la création du compte)
    let emailSent = false;
    try {
      emailSent = await sendEmailVerificationWithRetry(userCredential.user, email);
      if (emailSent) {
        console.log('[Firebase Auth] ✅ Email de vérification envoyé automatiquement à:', email);
      } else {
        console.warn('[Firebase Auth] ⚠️ Email de vérification retourné false (pas d\'erreur mais pas d\'envoi confirmé)');
      }
    } catch (error: any) {
      // Logger mais ne pas bloquer la création du compte
      console.error('[Firebase Auth] ❌ ÉCHEC ENVOI EMAIL APRÈS RETRIES');
      console.error('[Firebase Auth] Code erreur Firebase:', error?.code);
      console.error('[Firebase Auth] Message erreur Firebase:', error?.message);
      console.error('[Firebase Auth] Stack trace:', error?.stack);
      console.warn('[Firebase Auth] ⚠️ L\'utilisateur devra renvoyer l\'email manuellement');
      console.warn('[Firebase Auth] ⚠️ Vérifiez Firebase Console > Authentication > Templates');
      console.warn('[Firebase Auth] ⚠️ Vérifiez aussi les quotas Firebase (trop d\'emails envoyés?)');
      // Ne pas throw - permettre la création du compte quand même
      emailSent = false;
    }
    
    if (!emailSent) {
      console.warn('[Firebase Auth] ⚠️ L\'email de vérification n\'a pas pu être envoyé. Le compte a été créé mais l\'utilisateur devra utiliser le bouton "Renvoyer l\'email"');
    }
    
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
  console.log('[Firebase Auth] signIn appelé pour:', email);
  if (!auth) {
    const error = 'Firebase n\'est pas correctement initialisé. Vérifiez que Authentication est activé dans Firebase Console.';
    console.error('[Firebase Auth]', error);
    throw new Error(error);
  }

  try {
    console.log('[Firebase Auth] Tentative signInWithEmailAndPassword...');
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log('[Firebase Auth] signInWithEmailAndPassword réussi, user ID:', userCredential.user.uid);
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

  const email = user.email || 'unknown';
  console.log('[Firebase Auth] 📧 Renvoi email de vérification demandé pour:', email);
  console.log('[Firebase Auth] User ID:', user.uid);
  console.log('[Firebase Auth] EmailVerified:', user.emailVerified);

  try {
    // Option url pour rediriger après vérification (web seulement)
    const actionCodeSettings = typeof window !== 'undefined' 
      ? { url: window.location.origin + '/?verified=true' }
      : undefined;
    
    console.log('[Firebase Auth] ActionCodeSettings:', actionCodeSettings);
    console.log('[Firebase Auth] Appel de sendEmailVerification...');
    
    await sendEmailVerification(user, actionCodeSettings);
    
    console.log('[Firebase Auth] ✅ Email de vérification renvoyé avec succès à:', email);
    console.log('[Firebase Auth] ⚠️ IMPORTANT: Si vous ne recevez pas l\'email:');
    console.log('[Firebase Auth]   1. Vérifiez votre dossier SPAM/COURRIER INDÉSIRABLE');
    console.log('[Firebase Auth]   2. Vérifiez Firebase Console > Authentication > Templates');
    console.log('[Firebase Auth]   3. Vérifiez les quotas Firebase (limite d\'emails/jour)');
    console.log('[Firebase Auth]   4. Attendez quelques minutes (les emails peuvent être retardés)');
    
  } catch (error: any) {
    console.error('[Firebase Auth] ❌ ERREUR lors du renvoi de l\'email de vérification');
    console.error('[Firebase Auth] Email:', email);
    console.error('[Firebase Auth] Code d\'erreur Firebase:', error.code);
    console.error('[Firebase Auth] Message d\'erreur:', error.message);
    console.error('[Firebase Auth] Erreur complète:', error);
    
    let errorMessage = error.message || 'Erreur lors de l\'envoi de l\'email de vérification';
    
    if (error.code === 'auth/too-many-requests') {
      errorMessage = 'Trop de demandes. Firebase limite l\'envoi d\'emails pour éviter le spam. Veuillez attendre quelques minutes avant de réessayer.';
      console.error('[Firebase Auth] ⚠️ RATE LIMIT: Firebase a atteint la limite d\'emails pour cette période');
    } else if (error.code === 'auth/user-not-found') {
      errorMessage = 'Utilisateur non trouvé. Veuillez vous reconnecter.';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Adresse email invalide.';
    }
    
    throw new Error(errorMessage);
  }
}

/**
 * Envoyer un email de réinitialisation de mot de passe
 */
export async function sendPasswordResetEmailToUser(email: string): Promise<void> {
  if (!auth) {
    throw new Error('Firebase n\'est pas correctement initialisé. Vérifiez que Authentication est activé dans Firebase Console.');
  }

  try {
    // Option url pour rediriger vers l'app après réinitialisation (web seulement)
    const actionCodeSettings = typeof window !== 'undefined' 
      ? { url: window.location.origin + '/auth' }
      : undefined;
    
    await sendPasswordResetEmail(auth, email, actionCodeSettings);
    console.log('[Firebase Auth] ✅ Email de réinitialisation envoyé à:', email);
  } catch (error: any) {
    console.error('[Firebase Auth] ❌ Erreur envoi email de réinitialisation:', error);
    let errorMessage = error.message || 'Erreur lors de l\'envoi de l\'email de réinitialisation';
    
    if (error.code === 'auth/user-not-found') {
      errorMessage = 'Aucun compte trouvé avec cet email.';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Email invalide. Vérifiez votre adresse email.';
    } else if (error.code === 'auth/too-many-requests') {
      errorMessage = 'Trop de demandes. Veuillez attendre quelques minutes avant de réessayer.';
    } else if (error.code === 'auth/network-request-failed') {
      errorMessage = 'Erreur de connexion. Vérifiez votre connexion internet.';
    }
    
    throw new Error(errorMessage);
  }
}
