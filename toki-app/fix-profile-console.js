// Script à copier-coller dans la console du navigateur (F12)
// Pour corriger le profil avec 210 lbs

(async function() {
  // Nouveau profil calculé pour 210 lbs
  const newProfile = {
    userId: 'user_' + Date.now(), // Remplacé automatiquement
    displayName: 'Vincent',
    email: 'casaubonvincent@gmail.com',
    weightGoal: 'lose-3lb',
    currentWeight: 95.3, // 210 lbs
    activityLevel: 'moderate',
    tdeeEstimate: 3143,
    weeklyCalorieTarget: 11501,
    dailyPointsBudget: 6,
    maxPointsCap: 12,
    onboardingCompleted: true,
    createdAt: new Date().toISOString(),
  };

  // Récupérer l'utilisateur actuel
  const currentUserKey = await AsyncStorage.getItem('CURRENT_USER_KEY');
  if (!currentUserKey) {
    console.log('❌ Aucun utilisateur connecté');
    return;
  }

  const userId = currentUserKey;
  const profileKey = `toki_profile_${userId}`;
  
  // Sauvegarder le nouveau profil
  await AsyncStorage.setItem(profileKey, JSON.stringify(newProfile));
  
  console.log('✅ Profil mis à jour avec succès!');
  console.log('📊 Nouvelles valeurs:');
  console.log('  - Poids: 210 lbs (95.3 kg)');
  console.log('  - Calories/jour: 1643 cal');
  console.log('  - Points/jour: 6 pts');
  console.log('  - Cap maximum: 12 pts');
  console.log('\n🔄 Recharge la page pour voir les changements');
})();
