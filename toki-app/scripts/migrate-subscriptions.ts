// Script pour migrer les utilisateurs existants vers le système de subscription
// Calcule le rank de chaque utilisateur et crée la subscription appropriée

import { collection, getDocs, doc, setDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase-config';
import { getUserRank, createSubscription } from '../lib/subscription-utils';
import { FIREBASE_ENABLED } from '../lib/firebase-config';

/**
 * Migrer tous les utilisateurs existants vers le système de subscription
 */
export async function migrateExistingUsers(): Promise<{
  total: number;
  migrated: number;
  errors: number;
  betaUsers: number;
  paidUsers: number;
}> {
  if (!FIREBASE_ENABLED || !db) {
    console.error('[Migration] Firebase non disponible');
    return { total: 0, migrated: 0, errors: 0, betaUsers: 0, paidUsers: 0 };
  }

  console.log('[Migration] Démarrage migration des subscriptions...');

  try {
    // Obtenir tous les utilisateurs triés par createdAt
    const usersRef = collection(db, 'users');
    const usersQuery = query(usersRef, orderBy('createdAt', 'asc'));
    const usersSnapshot = await getDocs(usersQuery);

    const total = usersSnapshot.size;
    let migrated = 0;
    let errors = 0;
    let betaUsers = 0;
    let paidUsers = 0;

    console.log(`[Migration] ${total} utilisateurs trouvés`);

    // Traiter chaque utilisateur
    for (let i = 0; i < usersSnapshot.docs.length; i++) {
      const userDoc = usersSnapshot.docs[i];
      const userId = userDoc.id;
      const userData = userDoc.data();

      try {
        // Vérifier si l'utilisateur a déjà une subscription
        if (userData.subscription) {
          console.log(`[Migration] Utilisateur ${userId} a déjà une subscription, skip`);
          continue;
        }

        // Calculer le rank (i + 1 car index commence à 0)
        const rank = i + 1;
        
        // Créer la subscription selon le rank
        if (rank <= 10) {
          // Beta user - gratuit à vie
          await createSubscription(userId, 'beta', 'active');
          await setDoc(doc(db, 'users', userId), { userRank: rank }, { merge: true });
          betaUsers++;
          console.log(`[Migration] ✅ Utilisateur ${userId} (rank ${rank}) → Beta`);
        } else {
          // Utilisateur normal - pas d'accès jusqu'à paiement
          await createSubscription(userId, 'expired', 'canceled');
          await setDoc(doc(db, 'users', userId), { userRank: rank }, { merge: true });
          paidUsers++;
          console.log(`[Migration] ✅ Utilisateur ${userId} (rank ${rank}) → Expired`);
        }

        migrated++;
      } catch (error: any) {
        console.error(`[Migration] ❌ Erreur pour utilisateur ${userId}:`, error);
        errors++;
      }
    }

    console.log(`[Migration] Terminé: ${migrated}/${total} migrés, ${errors} erreurs`);
    console.log(`[Migration] Beta users: ${betaUsers}, Paid users: ${paidUsers}`);

    return {
      total,
      migrated,
      errors,
      betaUsers,
      paidUsers,
    };
  } catch (error: any) {
    console.error('[Migration] Erreur générale:', error);
    return { total: 0, migrated: 0, errors: 1, betaUsers: 0, paidUsers: 0 };
  }
}

// Exécuter la migration si le script est appelé directement
if (require.main === module) {
  migrateExistingUsers()
    .then((result) => {
      console.log('Résultat migration:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Erreur migration:', error);
      process.exit(1);
    });
}
