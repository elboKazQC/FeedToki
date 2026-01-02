import * as admin from 'firebase-admin';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Charger les variables d'environnement
dotenv.config({ path: path.join(__dirname, '../.env.test') });

// Initialiser Firebase Admin SDK si pas déjà fait
if (!admin.apps.length) {
  try {
    // Note: Pour utiliser Firebase Admin SDK, vous devez avoir un fichier de service account
    // Pour les tests, on peut utiliser les credentials depuis les variables d'environnement
    // ou un fichier JSON (à ne PAS commiter)
    
    const projectId = process.env.FIREBASE_PROJECT_ID || 'feed-toki';
    
    // Essayer d'initialiser avec les credentials depuis les variables d'env
    if (process.env.FIREBASE_ADMIN_CREDENTIALS) {
      const credentials = JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS);
      admin.initializeApp({
        credential: admin.credential.cert(credentials),
        projectId,
      });
    } else {
      // Initialiser sans credentials (utilisera Application Default Credentials)
      // Cela fonctionne si on est sur Google Cloud ou avec gcloud auth
      try {
        admin.initializeApp({
          projectId,
        });
      } catch (e) {
        console.warn('[Auth Fixtures] Impossible d\'initialiser Firebase Admin SDK:', e);
        console.warn('[Auth Fixtures] Les tests de cleanup devront être désactivés');
      }
    }
  } catch (error) {
    console.warn('[Auth Fixtures] Erreur initialisation Firebase Admin:', error);
  }
}

/**
 * Génère un email unique pour les tests
 */
export function generateTestEmail(): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  const prefix = process.env.TEST_USER_EMAIL_PREFIX || 'test+e2e';
  return `${prefix}+${timestamp}+${random}@example.com`;
}

/**
 * Créer un compte de test dans Firebase
 * Note: Cette fonction utilise l'API Firebase côté client via le navigateur
 * Pour la création via Admin SDK, voir createTestAccountWithAdmin
 */
export async function createTestAccount(
  email: string,
  password: string,
  displayName: string
): Promise<{ userId: string; email: string }> {
  // Cette fonction sera appelée depuis le navigateur via page.evaluate
  // ou via une API si nécessaire
  return { userId: '', email };
}

/**
 * Supprimer un compte de test via Firebase Admin SDK
 */
export async function deleteTestAccount(userId: string): Promise<void> {
  if (!admin.apps.length) {
    console.warn('[Auth Fixtures] Firebase Admin non initialisé, skip suppression compte:', userId);
    return;
  }

  try {
    await admin.auth().deleteUser(userId);
    console.log(`[Auth Fixtures] ✅ Compte supprimé: ${userId}`);
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      console.log(`[Auth Fixtures] Compte déjà supprimé: ${userId}`);
    } else {
      console.error(`[Auth Fixtures] Erreur suppression compte ${userId}:`, error);
      throw error;
    }
  }
}

/**
 * Supprimer les données Firestore d'un utilisateur de test
 */
export async function deleteTestUserData(userId: string): Promise<void> {
  if (!admin.apps.length) {
    console.warn('[Auth Fixtures] Firebase Admin non initialisé, skip suppression données:', userId);
    return;
  }

  try {
    const db = admin.firestore();
    
    // Supprimer le profil utilisateur
    await db.collection('users').doc(userId).delete();
    
    // Supprimer les repas (entries)
    const mealsRef = db.collection(`users/${userId}/meals`);
    const mealsSnapshot = await mealsRef.get();
    const batch = db.batch();
    mealsSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    
    // Supprimer les points
    const pointsRef = db.collection(`users/${userId}/points`);
    const pointsSnapshot = await pointsRef.get();
    const batch2 = db.batch();
    pointsSnapshot.docs.forEach((doc) => {
      batch2.delete(doc.ref);
    });
    await batch2.commit();
    
    console.log(`[Auth Fixtures] ✅ Données supprimées pour: ${userId}`);
  } catch (error: any) {
    console.error(`[Auth Fixtures] Erreur suppression données ${userId}:`, error);
    // Ne pas throw - on continue même si la suppression échoue partiellement
  }
}

/**
 * Nettoyer complètement un compte de test (compte + données)
 */
export async function cleanupTestAccount(userId: string): Promise<void> {
  await deleteTestUserData(userId);
  await deleteTestAccount(userId);
}

/**
 * Supprimer tous les comptes de test (ceux avec le préfixe d'email)
 */
export async function cleanupAllTestAccounts(): Promise<void> {
  if (!admin.apps.length) {
    console.warn('[Auth Fixtures] Firebase Admin non initialisé, skip cleanup');
    return;
  }

  try {
    const prefix = process.env.TEST_USER_EMAIL_PREFIX || 'test+e2e';
    const listUsersResult = await admin.auth().listUsers(1000);
    
    const testUsers = listUsersResult.users.filter((user) =>
      user.email?.includes(prefix)
    );
    
    console.log(`[Auth Fixtures] Suppression de ${testUsers.length} comptes de test...`);
    
    for (const user of testUsers) {
      await cleanupTestAccount(user.uid);
    }
    
    console.log(`[Auth Fixtures] ✅ Cleanup terminé: ${testUsers.length} comptes supprimés`);
  } catch (error) {
    console.error('[Auth Fixtures] Erreur cleanup:', error);
    throw error;
  }
}
