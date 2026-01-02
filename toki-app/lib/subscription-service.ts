// Service pour gérer les abonnements Stripe
import { getFunctions, httpsCallable } from 'firebase/functions';
import { FIREBASE_ENABLED } from './firebase-config';

/**
 * Créer une session Stripe Checkout pour un utilisateur
 * @param userId ID de l'utilisateur
 * @returns URL de la session Stripe Checkout
 */
export async function createCheckoutSession(userId: string): Promise<string> {
  if (!FIREBASE_ENABLED) {
    throw new Error('Firebase n\'est pas activé');
  }

  try {
    const functions = getFunctions();
    const createCheckout = httpsCallable(functions, 'createCheckoutSession');
    
    const result = await createCheckout({ 
      userId,
      successUrl: typeof window !== 'undefined' ? `${window.location.origin}/subscription?success=true` : undefined,
      cancelUrl: typeof window !== 'undefined' ? `${window.location.origin}/subscription?canceled=true` : undefined,
    });
    
    const data = result.data as any;
    if (!data.url) {
      throw new Error('URL de checkout non retournée');
    }
    
    return data.url;
  } catch (error: any) {
    console.error('[Subscription Service] Erreur création checkout session:', error);
    throw new Error(error.message || 'Erreur lors de la création de la session de paiement');
  }
}

/**
 * Rediriger l'utilisateur vers Stripe Checkout
 * @param userId ID de l'utilisateur
 */
export async function redirectToCheckout(userId: string): Promise<void> {
  try {
    const checkoutUrl = await createCheckoutSession(userId);
    
    // Rediriger vers l'URL Stripe Checkout
    if (typeof window !== 'undefined') {
      window.location.href = checkoutUrl;
    } else {
      throw new Error('Redirection non disponible dans cet environnement');
    }
  } catch (error: any) {
    console.error('[Subscription Service] Erreur redirection checkout:', error);
    throw error;
  }
}

/**
 * Obtenir l'URL du Customer Portal Stripe pour gérer l'abonnement
 * @param userId ID de l'utilisateur
 * @returns URL du Customer Portal
 */
export async function getCustomerPortalUrl(userId: string): Promise<string> {
  try {
    // TODO: Appeler Firebase Function getCustomerPortalUrl
    // Pour l'instant, retourner une URL placeholder
    
    console.warn('[Subscription Service] Stripe Customer Portal non encore configuré');
    throw new Error('La gestion d\'abonnement n\'est pas encore disponible. Veuillez contacter le support.');
  } catch (error: any) {
    console.error('[Subscription Service] Erreur récupération Customer Portal:', error);
    throw new Error(error.message || 'Erreur lors de la récupération du portail client');
  }
}
