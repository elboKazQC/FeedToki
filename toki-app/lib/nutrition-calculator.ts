// Calcul des objectifs nutritionnels personnalisés basés sur le poids et les objectifs de l'utilisateur

import { NutritionTargets } from './nutrition';
import { UserProfile } from './types';

/**
 * Calculer les objectifs nutritionnels personnalisés basés sur le profil utilisateur
 * 
 * Recommandations basées sur la science nutritionnelle:
 * - Protéines: 1.8-2.2g/kg pour perte de poids (préserve la masse musculaire)
 * - Glucides: 30-40% des calories totales
 * - Lipides: 20-30% des calories totales
 * - Calories: Déjà calculées via weeklyCalorieTarget
 */
export function calculateNutritionTargets(profile: UserProfile | null): NutritionTargets {
  if (!profile || !profile.currentWeight) {
    // Valeurs par défaut si pas de profil
    return {
      protein_g: 100,
      carbs_g: 250,
      calories_kcal: 2000,
      fat_g: 65,
    };
  }

  const weightKg = profile.currentWeight;
  const dailyCalories = profile.weeklyCalorieTarget / 7;

  // Protéines: 1.8-2.2g/kg pour perte de poids (préserve la masse musculaire)
  // Pour perte de poids, on vise 2.0-2.2g/kg pour maximiser la préservation musculaire
  let proteinPerKg = 1.8; // Par défaut pour maintenance
  
  if (profile.weightGoal) {
    if (profile.weightGoal.includes('lose-3lb') || profile.weightGoal.includes('lose-2lb')) {
      proteinPerKg = 2.2; // Perte de poids agressive = plus de protéines (2.2g/kg)
    } else if (profile.weightGoal.includes('lose-1lb')) {
      proteinPerKg = 2.0; // Perte de poids modérée (2.0g/kg)
    } else if (profile.weightGoal.includes('lose')) {
      proteinPerKg = 2.0; // Autre perte de poids
    } else if (profile.weightGoal.includes('gain')) {
      proteinPerKg = 1.7; // Gain de poids = un peu moins de protéines
    }
  }

  const protein_g = Math.round(weightKg * proteinPerKg);

  // Glucides: 35% des calories (4 cal/g)
  const carbsCalories = dailyCalories * 0.35;
  const carbs_g = Math.round(carbsCalories / 4);

  // Lipides: 25% des calories (9 cal/g)
  const fatCalories = dailyCalories * 0.25;
  const fat_g = Math.round(fatCalories / 9);

  return {
    protein_g,
    carbs_g,
    calories_kcal: Math.round(dailyCalories),
    fat_g,
  };
}

/**
 * Mettre à jour les objectifs nutritionnels pour un utilisateur existant
 */
export async function updateUserNutritionTargets(
  userId: string,
  profile: UserProfile
): Promise<NutritionTargets> {
  const targets = calculateNutritionTargets(profile);
  
  // Sauvegarder dans AsyncStorage
  const targetsKey = `feedtoki_targets_${userId}_v1`;
  const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
  await AsyncStorage.setItem(targetsKey, JSON.stringify(targets));
  
  // Sauvegarder dans Firestore (import dynamique pour éviter dépendance circulaire)
  try {
    const { syncTargetsToFirestore } = await import('./data-sync');
    await syncTargetsToFirestore(userId, targets);
  } catch (error) {
    console.error('[Nutrition Calculator] Erreur sync Firestore:', error);
    // Continue même si Firestore échoue
  }
  
  return targets;
}

