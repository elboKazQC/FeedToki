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

