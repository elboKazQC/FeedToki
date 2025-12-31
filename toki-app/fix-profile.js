// Script pour corriger le profil avec le bon poids (210 lbs = 95.25 kg)
// const AsyncStorage = require('@react-native-async-storage/async-storage').default;

// Conversion: 210 lbs = 95.25 kg
const weightLbs = 210;
const weightKg = weightLbs * 0.453592;

// Paramètres
const goal = 'lose-3lb';
const activityLevel = 'moderate';

// Calculs
const activityMultiplier = 33; // moderate
const tdee = Math.round(weightKg * activityMultiplier);
const weeklyCalorieTarget = tdee * 7 - 10500; // lose-3lb = -10500 cal/semaine

// Points
const INDULGENCE_RATIO = 0.30;
const AVG_CALORIES_PER_POINT = 80;
const weeklyIndulgence = weeklyCalorieTarget * INDULGENCE_RATIO;
const dailyIndulgence = weeklyIndulgence / 7;
const dailyPoints = Math.max(3, Math.round(dailyIndulgence / AVG_CALORIES_PER_POINT));
const maxCap = Math.min(dailyPoints * 4, 12);

const newProfile = {
  userId: 'casaubonvincent@gmail.com',
  displayName: 'Vincent',
  email: 'casaubonvincent@gmail.com',
  weightGoal: goal,
  currentWeight: weightKg,
  activityLevel: activityLevel,
  tdeeEstimate: tdee,
  weeklyCalorieTarget: weeklyCalorieTarget,
  dailyPointsBudget: dailyPoints,
  maxPointsCap: maxCap,
  onboardingCompleted: true,
  createdAt: new Date().toISOString(),
};

console.log('=== NOUVEAU PROFIL ===');
console.log('Poids: 210 lbs =', weightKg.toFixed(1), 'kg');
console.log('TDEE:', tdee, 'cal/jour');
console.log('Objectif hebdo:', weeklyCalorieTarget, 'cal');
console.log('Objectif quotidien:', Math.round(weeklyCalorieTarget / 7), 'cal/jour');
console.log('Points quotidiens:', dailyPoints, 'pts');
console.log('Cap maximum:', maxCap, 'pts');
console.log('\nProfil:', JSON.stringify(newProfile, null, 2));
