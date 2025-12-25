// Global types for Toki app

export type WeightGoal = 'maintenance' | 'lose-1lb' | 'lose-2lb' | 'lose-3lb';

export type ActivityLevel = 'sedentary' | 'moderate' | 'active';

export type UserProfile = {
  // Firebase user info
  userId?: string; // Firebase UID
  displayName?: string; // User's display name
  email?: string; // User's email
  
  // Onboarding inputs
  weightGoal?: WeightGoal;
  currentWeight?: number; // kg, optional
  activityLevel?: ActivityLevel;
  
  // Calculated values
  tdeeEstimate?: number; // Total Daily Energy Expenditure in kcal/day
  weeklyCalorieTarget: number; // Weekly calorie budget
  dailyPointsBudget: number; // Points earned per day
  maxPointsCap?: number; // Maximum accumulated points
  
  // Metadata
  onboardingCompleted: boolean;
  createdAt: string; // ISO date
};

// Weekly calorie targets based on goal
export const GOAL_WEEKLY_CALORIES: Record<WeightGoal, (tdee: number) => number> = {
  maintenance: (tdee) => tdee * 7,
  'lose-1lb': (tdee) => tdee * 7 - 3500, // 1 lb = 3500 cal deficit per week
  'lose-2lb': (tdee) => tdee * 7 - 7000,
  'lose-3lb': (tdee) => tdee * 7 - 10500,
};

// Activity multipliers for TDEE estimation
export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 30, // kcal per kg body weight
  moderate: 33,
  active: 37,
};
