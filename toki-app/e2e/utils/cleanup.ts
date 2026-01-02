import { cleanupTestAccount, cleanupAllTestAccounts } from '../fixtures/auth-fixtures';

/**
 * Utilitaires de nettoyage pour les tests E2E
 */

/**
 * Nettoyer un compte de test spécifique
 */
export async function cleanupTestUser(userId: string): Promise<void> {
  try {
    await cleanupTestAccount(userId);
  } catch (error) {
    console.error(`[Cleanup] Erreur nettoyage utilisateur ${userId}:`, error);
    // Ne pas throw - on continue même si le cleanup échoue
  }
}

/**
 * Nettoyer tous les comptes de test
 * À appeler après une suite de tests complète
 */
export async function cleanupAllTestUsers(): Promise<void> {
  try {
    await cleanupAllTestAccounts();
  } catch (error) {
    console.error('[Cleanup] Erreur nettoyage complet:', error);
    // Ne pas throw - on continue même si le cleanup échoue
  }
}
