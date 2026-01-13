/**
 * Utilitaires pour la gestion des administrateurs
 */

// Liste des emails admin (doit correspondre aux autres fichiers admin)
const ADMIN_EMAILS = [
  'vcasaubon@noovelia.com',
  'casaubonvincent@gmail.com', // Email principal de l'utilisateur
  // Ajouter d'autres emails admin ici
];

/**
 * Vérifier si un utilisateur est admin basé sur son email
 */
export function isAdminUser(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase().trim());
}

/**
 * Vérifier si un utilisateur est admin basé sur son profil ou user object
 */
export function checkIsAdmin(user: any, profile: any): boolean {
  const email = profile?.email || user?.email || '';
  return isAdminUser(email);
}

/**
 * Définir le flag isAdmin dans le profil Firestore de l'utilisateur
 * Permet à un admin (vérifié par email) de s'auto-définir comme admin
 */
export async function setAdminFlag(userId: string): Promise<void> {
  if (!userId) {
    throw new Error('userId est requis');
  }

  try {
    const { db, getDb } = await import('./firebase-config');
    const { doc, setDoc } = await import('firebase/firestore');
    
    if (!db) {
      throw new Error('Firestore non initialisé');
    }

    const userRef = doc(getDb(), 'users', userId);
    await setDoc(userRef, { isAdmin: true }, { merge: true });
    
    console.log('[Admin Utils] ✅ Flag isAdmin défini pour', userId);
  } catch (error) {
    console.error('[Admin Utils] ❌ Erreur lors de la définition du flag isAdmin:', error);
    throw error;
  }
}

