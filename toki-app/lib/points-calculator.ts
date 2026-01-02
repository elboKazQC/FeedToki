// Dynamic points calculation based on user's calorie goals

import { UserProfile, GOAL_WEEKLY_CALORIES, ACTIVITY_MULTIPLIERS, WeightGoal, ActivityLevel, Gender } from './types';

// What % of weekly calories can be "indulgences" (higher calorie/point cost items)
const INDULGENCE_RATIO = 0.30; // 30%

// Average calorie cost per point (estimated from food database)
// Ajusté pour être plus réaliste : la plupart des aliments "indulgents" coûtent 2-6 points
// pour 200-500 calories, donc environ 100 cal/point en moyenne
const AVG_CALORIES_PER_POINT = 100; // Augmenté de 80 à 100 pour réduire les points

// Maximum cap regardless of goal (to prevent overeating)
const ABSOLUTE_MAX_CAP = 12;

// Activity factors for Mifflin-St Jeor TDEE calculation
const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  moderate: 1.55,
  active: 1.725,
};

/**
 * Convert feet and inches to centimeters
 */
export function convertFeetInchesToCm(feet: number, inches: number): number {
  const totalInches = feet * 12 + inches;
  return Math.round(totalInches * 2.54);
}

/**
 * Convert centimeters to feet and inches
 */
export function convertCmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return { feet, inches };
}

/**
 * Calculate BMR (Basal Metabolic Rate) using Mifflin-St Jeor equation
 * More accurate than simple weight-based formula
 */
function calculateBMR(weightKg: number, heightCm: number, age: number, gender: Gender): number {
  // Mifflin-St Jeor equation:
  // Men: BMR = 10 × weight(kg) + 6.25 × height(cm) - 5 × age + 5
  // Women: BMR = 10 × weight(kg) + 6.25 × height(cm) - 5 × age - 161
  const baseBMR = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return gender === 'male' ? baseBMR + 5 : baseBMR - 161;
}

/**
 * Estimate TDEE (Total Daily Energy Expenditure) in kcal/day
 * 
 * Uses Mifflin-St Jeor equation if gender and height are provided (more accurate),
 * otherwise falls back to simple weight-based formula for compatibility.
 */
export function estimateTDEE(
  weightKg: number,
  activityLevel: ActivityLevel,
  gender?: Gender,
  heightCm?: number,
  age: number = 30 // Default age for compatibility
): number {
  // If we have gender and height, use Mifflin-St Jeor (more accurate)
  if (gender && heightCm) {
    const bmr = calculateBMR(weightKg, heightCm, age, gender);
    const activityFactor = ACTIVITY_FACTORS[activityLevel];
    return Math.round(bmr * activityFactor);
  }
  
  // Fallback to simple formula for compatibility with existing users
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel];
  return Math.round(weightKg * multiplier);
}

/**
 * Calculate weekly calorie target based on goal and TDEE
 */
export function calculateWeeklyTarget(goal: WeightGoal, tdee: number): number {
  const calculator = GOAL_WEEKLY_CALORIES[goal];
  return Math.round(calculator(tdee));
}

/**
 * Calculate daily points budget from weekly calorie target
 * 
 * Logic:
 * - 30% of weekly calories can be "indulgences" (higher point items)
 * - Divide by 7 days to get daily indulgence budget
 * - Divide by avg calories per point to get points per day
 * - Bonus +1 pt for deficit goals (-2 lbs/sem or more aggressive)
 */
export function calculateDailyPoints(weeklyCalorieTarget: number): number {
  const weeklyIndulgenceBudget = weeklyCalorieTarget * INDULGENCE_RATIO;
  const dailyIndulgenceBudget = weeklyIndulgenceBudget / 7;
  const basePoints = dailyIndulgenceBudget / AVG_CALORIES_PER_POINT;
  
  // Bonus +1 pt for aggressive deficit goals (≤ 12,500 cal/week = -2 lbs/sem or more)
  // This helps users feel less restricted while maintaining weight loss
  const pointsPerDay = weeklyCalorieTarget <= 12500 
    ? Math.round(basePoints) + 1 
    : Math.round(basePoints);
  
  return Math.max(3, pointsPerDay); // Minimum 3 points/day
}

/**
 * Calculate maximum points cap (accumulated over days)
 * Allow 4 days of accumulation, but cap at absolute max
 */
export function calculateMaxCap(dailyPoints: number): number {
  const calculatedCap = dailyPoints * 4;
  return Math.min(calculatedCap, ABSOLUTE_MAX_CAP);
}

/**
 * Main function: compute full user profile from onboarding inputs
 */
export function computeUserProfile(
  weightGoal: WeightGoal,
  currentWeight?: number,
  activityLevel: ActivityLevel = 'moderate',
  gender?: Gender,
  heightCm?: number
): UserProfile {
  // If no weight provided, use average adult weight (75kg)
  const weight = currentWeight || 75;
  
  // Calculate TDEE (uses Mifflin-St Jeor if gender and height provided)
  const tdeeEstimate = estimateTDEE(weight, activityLevel, gender, heightCm);
  
  // Calculate weekly calorie target based on goal
  const weeklyCalorieTarget = calculateWeeklyTarget(weightGoal, tdeeEstimate);
  
  // Calculate daily points budget
  const dailyPointsBudget = calculateDailyPoints(weeklyCalorieTarget);
  
  // Calculate max cap
  const maxPointsCap = calculateMaxCap(dailyPointsBudget);
  
  const profile: UserProfile = {
    weightGoal,
    currentWeight: weight,
    activityLevel,
    tdeeEstimate,
    weeklyCalorieTarget,
    dailyPointsBudget,
    maxPointsCap,
    onboardingCompleted: true,
    createdAt: new Date().toISOString(),
  };
  
  // Add gender and height if provided
  if (gender) {
    profile.gender = gender;
  }
  if (heightCm) {
    profile.heightCm = heightCm;
  }
  
  return profile;
}

/**
 * Get user-friendly description of weekly calorie target
 */
export function getGoalDescription(goal: WeightGoal): string {
  switch (goal) {
    case 'maintenance':
      return 'Maintenir ton poids actuel';
    case 'lose-1lb':
      return 'Perdre ~1 lb par semaine';
    case 'lose-2lb':
      return 'Perdre ~2 lbs par semaine';
    case 'lose-3lb':
      return 'Perdre ~3 lbs par semaine';
  }
}

/**
 * Get daily calorie target (for nutrition tracking)
 */
export function getDailyCalorieTarget(weeklyTarget: number): number {
  return Math.round(weeklyTarget / 7);
}
