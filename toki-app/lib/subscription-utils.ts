// Utilitaires pour la gestion des abonnements et beta users
import { doc, getDoc, setDoc, collection, query, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { db } from './firebase-config';
import { UserSubscription, SubscriptionTier } from './types';

const BETA_USER_LIMIT = 10; // Les 10 premiers utilisateurs sont beta gratuits

/**
 * Obtenir le rang d'un utilisateur dans l'ordre d'inscription
 * @param userId ID de l'utilisateur
 * @returns Rang (1 = premier, 2 = deuxième, etc.)
 */
export async function getUserRank(userId: string): Promise<number> {
  if (!db) {
    console.warn('[Subscription Utils] Firestore non disponible');
    return 999; // Retourner un rang élevé si Firestore non disponible
  }

  try {
    // Charger le profil utilisateur - le userRank est déjà stocké lors de l'inscription
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      console.warn('[Subscription Utils] Utilisateur non trouvé:', userId);
      return 999;
    }

    const userData = userDoc.data();
    
    // Si userRank est déjà stocké, l'utiliser (c'est le cas pour les nouveaux utilisateurs)
    if (userData.userRank && typeof userData.userRank === 'number') {
      return userData.userRank;
    }

    // Fallback: pour les anciens utilisateurs qui n'ont pas de userRank
    // Ne pas logger en warning répétitif - seulement une fois par session
    // Le userRank sera calculé et stocké lors de la prochaine migration
    // Pour l'instant, retourner un rang élevé pour qu'ils ne soient pas considérés comme beta
    if (__DEV__) {
      console.warn('[Subscription Utils] userRank manquant pour utilisateur:', userId, '- considéré comme non-beta');
    }
    return 999;
  } catch (error) {
    console.error('[Subscription Utils] Erreur calcul rank:', error);
    return 999; // Retourner un rang élevé en cas d'erreur
  }
}

/**
 * Vérifier si un utilisateur est un beta user
 * @param userId ID de l'utilisateur
 * @returns true si beta user (subscription.tier === 'beta' && status === 'active'), false sinon
 */
export async function isBetaUser(userId: string): Promise<boolean> {
  try {
    const subscription = await getUserSubscription(userId);
    return subscription?.tier === 'beta' && subscription?.status === 'active';
  } catch (error) {
    console.error('[Subscription Utils] Erreur vérification beta:', error);
    return false;
  }
}

/**
 * Obtenir la subscription d'un utilisateur
 * @param userId ID de l'utilisateur
 * @returns Subscription ou null
 */
export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
  if (!db) {
    console.warn('[Subscription Utils] Firestore non disponible');
    return null;
  }

  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      return null;
    }

    const userData = userDoc.data();
    return userData.subscription || null;
  } catch (error) {
    console.error('[Subscription Utils] Erreur chargement subscription:', error);
    return null;
  }
}

/**
 * Vérifier si un utilisateur a un abonnement actif
 * @param userId ID de l'utilisateur
 * @returns true si actif, false sinon
 */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  if (!userId || userId === 'guest') {
    return false;
  }

  try {
    // Vérifier si beta user (via subscription uniquement, pas userRank)
    const isBeta = await isBetaUser(userId);
    if (isBeta) {
      console.log(`[Subscription Utils] Utilisateur ${userId} est beta - accès gratuit`);
      return true;
    }

    // Charger la subscription
    const subscription = await getUserSubscription(userId);
    if (!subscription) {
      console.log(`[Subscription Utils] Utilisateur ${userId} n'a pas de subscription`);
      return false;
    }

    // Vérifier que c'est un abonnement payant actif
    if (subscription.tier !== 'paid' || subscription.status !== 'active') {
      console.log(`[Subscription Utils] Utilisateur ${userId} subscription tier: ${subscription.tier}, status: ${subscription.status}`);
      return false;
    }

    // Vérifier la date d'expiration
    if (subscription.subscriptionEndDate) {
      const endDate = new Date(subscription.subscriptionEndDate);
      const now = new Date();
      if (endDate < now) {
        console.log(`[Subscription Utils] Utilisateur ${userId} subscription expirée`);
        return false;
      }
    }

    console.log(`[Subscription Utils] Utilisateur ${userId} a un abonnement actif`);
    return true;
  } catch (error) {
    console.error('[Subscription Utils] Erreur vérification subscription:', error);
    return false; // En cas d'erreur, refuser l'accès par sécurité
  }
}

/**
 * Créer une subscription pour un utilisateur
 * @param userId ID de l'utilisateur
 * @param tier Tier de subscription (beta, paid, expired)
 * @param status Status de subscription
 */
export async function createSubscription(
  userId: string,
  tier: SubscriptionTier,
  status: 'active' | 'trialing' | 'past_due' | 'canceled' = 'active'
): Promise<void> {
  if (!db) {
    throw new Error('Firestore non disponible');
  }

  try {
    const subscription: UserSubscription = {
      tier,
      status,
      createdAt: new Date().toISOString(),
    };

    // Si c'est un abonnement payant, initialiser les dates
    if (tier === 'paid' && status === 'active') {
      const now = new Date();
      subscription.subscriptionStartDate = now.toISOString();
      // Ajouter 1 mois
      const endDate = new Date(now);
      endDate.setMonth(endDate.getMonth() + 1);
      subscription.subscriptionEndDate = endDate.toISOString();
    }

    // Mettre à jour le profil utilisateur avec la subscription
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, { subscription }, { merge: true });

    console.log(`[Subscription Utils] Subscription créée pour ${userId}: tier=${tier}, status=${status}`);
  } catch (error) {
    console.error('[Subscription Utils] Erreur création subscription:', error);
    throw error;
  }
}

/**
 * Mettre à jour la subscription d'un utilisateur
 * @param userId ID de l'utilisateur
 * @param updates Mises à jour partielles de la subscription
 */
export async function updateSubscription(
  userId: string,
  updates: Partial<UserSubscription>
): Promise<void> {
  if (!db) {
    throw new Error('Firestore non disponible');
  }

  try {
    const userRef = doc(db, 'users', userId);
    const currentDoc = await getDoc(userRef);
    
    if (!currentDoc.exists()) {
      throw new Error('Utilisateur non trouvé');
    }

    const currentData = currentDoc.data();
    const currentSubscription = currentData.subscription || {};
    
    const updatedSubscription: UserSubscription = {
      ...currentSubscription,
      ...updates,
      createdAt: currentSubscription.createdAt || new Date().toISOString(),
    };

    await setDoc(userRef, { subscription: updatedSubscription }, { merge: true });
    console.log(`[Subscription Utils] Subscription mise à jour pour ${userId}`);
  } catch (error) {
    console.error('[Subscription Utils] Erreur mise à jour subscription:', error);
    throw error;
  }
}
