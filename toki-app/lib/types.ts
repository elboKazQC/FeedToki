// Global types for Toki app

export type WeightGoal = 'maintenance' | 'lose-1lb' | 'lose-2lb' | 'lose-3lb';

export type ActivityLevel = 'sedentary' | 'moderate' | 'active';

export type Gender = 'male' | 'female';

export type SubscriptionTier = 'beta' | 'paid' | 'expired';
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled';

export type UserSubscription = {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  subscriptionStartDate?: string; // ISO date
  subscriptionEndDate?: string; // ISO date
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  createdAt: string; // ISO date
};

export type UserProfile = {
  // Firebase user info
  userId?: string; // Firebase UID
  displayName?: string; // User's display name
  email?: string; // User's email
  
  // Onboarding inputs
  weightGoal?: WeightGoal;
  currentWeight?: number; // kg, optional
  activityLevel?: ActivityLevel;
  gender?: Gender; // Genre pour calculs TDEE plus précis
  heightCm?: number; // Taille en cm (pour calculs)
  heightFeet?: number; // Taille en pieds (pour affichage)
  heightInches?: number; // Taille en pouces (pour affichage)
  
  // Calculated values
  tdeeEstimate?: number; // Total Daily Energy Expenditure in kcal/day
  weeklyCalorieTarget: number; // Weekly calorie budget
  
  // Metadata
  onboardingCompleted: boolean;
  createdAt: string; // ISO date
  
  // Subscription
  subscription?: UserSubscription;
  userRank?: number; // Position dans l'ordre d'inscription (1-10 = beta)
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

// KPI Types for Admin Dashboard
export type UserDetailedStats = {
  userId: string;
  email?: string;
  displayName?: string;
  createdAt: string;
  onboardingCompleted: boolean;
  weightGoal?: WeightGoal;
  currentWeight?: number;
  activityLevel?: ActivityLevel;
  subscription?: UserSubscription;
  userRank?: number;
  
  // Engagement stats
  totalMeals: number;
  activeDays: number; // Jours avec au moins un repas
  currentStreak: number;
  longestStreak: number;
  lastActivityDate?: string; // Date du dernier repas
  
  // Usage stats
  customFoodsCount: number;
  aiLogsCount: number; // Nombre de logs avec context 'ai-logger'

  // Points system (legacy - kept optional for compatibility)
  currentPointsBalance?: number;
  totalPointsEarned?: number;
  lastClaimDate?: string;
  
  // Calculated metrics
  mealsPerDay: number; // Moyenne de repas par jour actif
  daysSinceLastActivity: number; // Jours depuis dernière activité
  isActive7d: boolean; // Actif dans les 7 derniers jours
  isActive30d: boolean; // Actif dans les 30 derniers jours
  
  // Parsing performance
  averageParsingTimeMs?: number; // Temps moyen de parsing en ms
  totalParsingTimeMs?: number; // Temps total cumulé de parsing
  
  // Session stats
  averageSessionsPerDay?: number; // Moyenne de sessions par jour (30 derniers jours)
  totalSessions?: number; // Nombre total de sessions
};

export type GlobalKPIs = {
  // Users metrics
  totalUsers: number;
  activeUsers7d: number;
  activeUsers30d: number;
  newUsers7d: number;
  newUsers30d: number;
  retentionRate7d: number; // % utilisateurs actifs à J7
  retentionRate30d: number; // % utilisateurs actifs à J30
  
  // Engagement metrics
  averageStreak: number;
  totalMeals: number;
  averageActiveDays: number;
  averageMealsPerDay: number;
  
  // Subscription metrics
  activeSubscriptions: number; // status === 'active' || 'trialing'
  paidSubscriptions: number; // tier === 'paid' && status === 'active'
  betaUsers: number; // tier === 'beta' ou userRank <= 10
  mrr: number; // Monthly Recurring Revenue (en dollars)
  conversionRate: number; // % utilisateurs avec abonnement payant

  // Legacy points metrics (optional)
  averagePointsBalance?: number;
  
  // Usage metrics
  totalCustomFoods: number;
  totalAiLogs: number;
  
  // Parsing performance
  averageParsingTimeMs: number; // Temps moyen global de parsing en ms
  
  // Session metrics
  averageSessionsPerDay: number; // Moyenne globale de sessions/jour
  
  // Time series data for graphs
  usersOverTime: Array<{ date: string; count: number }>; // Évolution du nombre d'utilisateurs
  newUsersByDay: Array<{ date: string; count: number }>; // Nouveaux utilisateurs par jour
  mealsByDay: Array<{ date: string; count: number }>; // Repas par jour
};

export type UserKPI = {
  user: UserProfile;
  stats: UserDetailedStats;
};

export type KPIFilter = {
  dateRange?: {
    start: string; // ISO date
    end: string; // ISO date
  };
  subscriptionStatus?: SubscriptionStatus[];
  subscriptionTier?: SubscriptionTier[];
  weightGoal?: WeightGoal[];
  activityLevel?: ActivityLevel[];
  searchQuery?: string; // Recherche par email/displayName
  minStreak?: number;
  minMeals?: number;
  isActive?: boolean; // Actif dans les 7 derniers jours
};
