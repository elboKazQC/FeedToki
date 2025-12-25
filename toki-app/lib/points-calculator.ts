// Dynamic points calculation based on user's calorie goals

import { UserProfile, GOAL_WEEKLY_CALORIES, ACTIVITY_MULTIPLIERS, WeightGoal, ActivityLevel } from './types';

// What % of weekly calories can be "indulgences" (higher calorie/point cost items)
const INDULGENCE_RATIO = 0.30; // 30%

// Average calorie cost per point (estimated from food database)
const AVG_CALORIES_PER_POINT = 80;

// Maximum cap regardless of goal (to prevent overeating)
const ABSOLUTE_MAX_CAP = 12;

/**
 * Estimate TDEE (Total Daily Energy Expenditure) in kcal/day
 * Simple formula: body weight (kg) × activity multiplier
 */
export function estimateTDEE(weightKg: number, activityLevel: ActivityLevel): number {
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
 */
export function calculateDailyPoints(weeklyCalorieTarget: number): number {
  const weeklyIndulgenceBudget = weeklyCalorieTarget * INDULGENCE_RATIO;
  const dailyIndulgenceBudget = weeklyIndulgenceBudget / 7;
  const pointsPerDay = dailyIndulgenceBudget / AVG_CALORIES_PER_POINT;
  
  return Math.max(3, Math.round(pointsPerDay)); // Minimum 3 points/day
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
  activityLevel: ActivityLevel = 'moderate'
): UserProfile {
  // If no weight provided, use average adult weight (75kg)
  const weight = currentWeight || 75;
  
  // Calculate TDEE
  const tdeeEstimate = estimateTDEE(weight, activityLevel);
  
  // Calculate weekly calorie target based on goal
  const weeklyCalorieTarget = calculateWeeklyTarget(weightGoal, tdeeEstimate);
  
  // Calculate daily points budget
  const dailyPointsBudget = calculateDailyPoints(weeklyCalorieTarget);
  
  // Calculate max cap
  const maxPointsCap = calculateMaxCap(dailyPointsBudget);
  
  return {
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
