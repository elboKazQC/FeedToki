/**
 * Profile utility functions for onboarding and user profile management
 * Extracted from the points system - these are profile/calorie utilities only
 */

import { WeightGoal, ActivityLevel, Gender, UserProfile, GOAL_WEEKLY_CALORIES, ACTIVITY_MULTIPLIERS } from './types';

/**
 * Convert feet and inches to centimeters
 */
export function convertFeetInchesToCm(feet: number, inches: number): number {
  const totalInches = feet * 12 + inches;
  return Math.round(totalInches * 2.54);
}

/**
 * Get a human-readable description of the weight goal
 */
export function getGoalDescription(goal: WeightGoal): string {
  switch (goal) {
    case 'lose-2lb':
      return 'Perdre ~1kg/semaine';
    case 'lose-1lb':
      return 'Perdre ~0.5kg/semaine';
    case 'lose-3lb':
      return 'Perdre ~1.5kg/semaine';
    case 'maintenance':
      return 'Maintenir mon poids';
    default:
      return goal;
  }
}

/**
 * Calculate daily calorie target from weekly target
 */
export function getDailyCalorieTarget(weeklyTarget: number): number {
  return Math.round(weeklyTarget / 7);
}

/**
 * Calculate Total Daily Energy Expenditure (TDEE)
 */
function calculateTDEE(weightKg: number, activityLevel: ActivityLevel): number {
  return Math.round(weightKg * ACTIVITY_MULTIPLIERS[activityLevel]);
}

/**
 * Compute user profile with calorie targets
 */
export function computeUserProfile(
  weightGoal: WeightGoal,
  currentWeight: number, // in kg
  activityLevel: ActivityLevel,
  gender?: Gender,
  heightCm?: number,
  age: number = 30 // Default age if not provided
): Partial<UserProfile> & { weeklyCalorieTarget: number; tdeeEstimate: number } {
  // Calculate TDEE using the simplified formula from types.ts
  const tdee = calculateTDEE(currentWeight, activityLevel);
  
  // Calculate weekly calorie target based on goal
  const weeklyCalorieTarget = GOAL_WEEKLY_CALORIES[weightGoal](tdee);
  
  return {
    weightGoal,
    currentWeight,
    activityLevel,
    gender,
    heightCm,
    tdeeEstimate: tdee,
    weeklyCalorieTarget,
    onboardingCompleted: true,
  };
}
