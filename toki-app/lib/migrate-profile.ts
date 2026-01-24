// Migration automatique pour corriger les profils avec des poids incorrects
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile } from './types';

/**
 * Détecte et corrige les profils avec des poids erronés (ex: 165 kg au lieu de 75 kg)
 * Ces erreurs surviennent quand un utilisateur entre des lbs mais que le système l'interprète comme kg
 */
export async function migrateIncorrectWeights(): Promise<void> {
  try {
    // Récupérer tous les utilisateurs
    const usersJson = await AsyncStorage.getItem('USERS_KEY');
    if (!usersJson) return;

    const users = JSON.parse(usersJson);

    for (const user of users) {
      const profileKey = `toki_profile_${user.id}`;
      const profileJson = await AsyncStorage.getItem(profileKey);
      
      if (!profileJson) continue;

      const profile: UserProfile = JSON.parse(profileJson);

      // Détection: si le poids est > 150 kg, c'est probablement une erreur (lbs interprété comme kg)
      if (profile.currentWeight && profile.currentWeight > 150) {
        console.log(`🔧 Migration du profil ${user.email}: ${profile.currentWeight} kg détecté`);

        // Convertir de kg erroné vers lbs puis vers kg correct
        // Ex: 165 kg stocké → c'était 165 lbs → 165 * 0.453592 = 74.8 kg
        const correctWeightKg = profile.currentWeight * 0.453592;

        // Recalculer tout le profil
        const activityMultipliers: Record<string, number> = {
          sedentary: 30,
          moderate: 33,
          active: 37,
        };

        const multiplier = activityMultipliers[profile.activityLevel || 'moderate'] || 33;
        const tdee = Math.round(correctWeightKg * multiplier);
        
        // Calculer weekly target selon le goal
        const goalDeficits: Record<string, number> = {
          maintenance: 0,
          'lose-1lb': 3500,
          'lose-2lb': 7000,
          'lose-3lb': 10500,
        };

        const deficit = goalDeficits[profile.weightGoal || 'lose-1lb'] || 0;
        const weeklyCalorieTarget = tdee * 7 - deficit;

        // Mettre à jour le profil
        const updatedProfile: UserProfile = {
          ...profile,
          currentWeight: correctWeightKg,
          tdeeEstimate: tdee,
          weeklyCalorieTarget,
        };

        await AsyncStorage.setItem(profileKey, JSON.stringify(updatedProfile));

        console.log(`✅ Profil migré: ${profile.currentWeight.toFixed(0)} kg → ${correctWeightKg.toFixed(1)} kg`);
        console.log(`   Calories/jour: ${Math.round(weeklyCalorieTarget / 7)} cal`);
      }
    }
  } catch (error) {
    console.error('Erreur lors de la migration des profils:', error);
  }
}
