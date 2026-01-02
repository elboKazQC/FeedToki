// Script pour appeler la function migrateUserRanks depuis l'app
// Usage: Copier ce code dans la console du navigateur quand vous êtes connecté en tant qu'admin

import { getFunctions, httpsCallable } from 'firebase/functions';

async function migrateUserRanks() {
  try {
    const functions = getFunctions();
    const migrateUserRanksFunction = httpsCallable(functions, 'migrateUserRanks');
    
    console.log('🔄 Appel de la migration userRank...');
    const result = await migrateUserRanksFunction({});
    
    console.log('✅ Migration terminée:', result.data);
    return result.data;
  } catch (error: any) {
    console.error('❌ Erreur migration:', error);
    throw error;
  }
}

// Exporter pour utilisation dans la console
if (typeof window !== 'undefined') {
  (window as any).migrateUserRanks = migrateUserRanks;
  console.log('✅ Fonction migrateUserRanks disponible. Appelez: migrateUserRanks()');
}

export { migrateUserRanks };
