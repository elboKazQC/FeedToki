// Script pour mettre à jour les objectifs nutritionnels de tous les utilisateurs existants

import { db } from './firebase-config';
import { collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { FIREBASE_ENABLED } from './firebase-config';
import { calculateNutritionTargets } from './nutrition-calculator';
import { UserProfile } from './types';
import { syncTargetsToFirestore } from './data-sync';

/**
 * Mettre à jour les objectifs nutritionnels pour tous les utilisateurs existants
 */
export async function updateAllUsersNutritionTargets(): Promise<{
  updated: number;
  errors: number;
}> {
  if (!FIREBASE_ENABLED || !db) {
    console.warn('[Update Targets] Firebase non disponible');
    return { updated: 0, errors: 0 };
  }

  let updated = 0;
  let errors = 0;

  try {
    // Obtenir tous les utilisateurs
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      
      try {
        // Charger le profil utilisateur
        const profileDoc = await getDoc(doc(db, 'users', userId));
        if (!profileDoc.exists()) continue;

        const profileData = profileDoc.data() as UserProfile;
        
        // Calculer les nouveaux objectifs
        const newTargets = calculateNutritionTargets(profileData);
        
        // Sauvegarder dans Firestore
        await syncTargetsToFirestore(userId, newTargets);
        
        console.log(`[Update Targets] Utilisateur ${userId}: ${newTargets.protein_g}g protéines, ${newTargets.carbs_g}g glucides`);
        updated++;
      } catch (error) {
        console.error(`[Update Targets] Erreur pour ${userId}:`, error);
        errors++;
      }
    }

    console.log(`[Update Targets] Terminé: ${updated} mis à jour, ${errors} erreurs`);
    return { updated, errors };
  } catch (error) {
    console.error('[Update Targets] Erreur générale:', error);
    return { updated, errors: 1 };
  }
}




