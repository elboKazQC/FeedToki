// Service Analytics pour tracking d'événements
// Utilise Firebase Analytics comme backend principal (web uniquement)
// Sur mobile, les événements sont loggés dans la console pour debugging

import { app, FIREBASE_ENABLED } from './firebase-config';

// Types d'événements à tracker
export type AnalyticsEvent =
  | 'meal_logged'
  | 'dragon_evolved'
  | 'streak_milestone'
  | 'onboarding_completed'
  | 'target_updated'
  | 'food_item_added'
  | 'points_spent'
  | 'points_earned'
  | 'screen_view'
  | 'ai_parser_used'
  | 'barcode_scan_success'
  | 'barcode_scan_failure';

// Paramètres pour événements
export interface AnalyticsEventParams {
  [key: string]: string | number | boolean | undefined;
}

// Instance Analytics (web uniquement)
let analyticsInstance: any = null;

// Initialiser Firebase Analytics (web uniquement)
if (FIREBASE_ENABLED && app && typeof window !== 'undefined') {
  try {
    const analytics = require('firebase/analytics');
    analyticsInstance = analytics.getAnalytics(app);
    console.log('[Analytics] Firebase Analytics initialisé (web)');
  } catch (error) {
    // Analytics non disponible (mobile ou autre)
    console.log('[Analytics] Firebase Analytics non disponible (mobile ou autre)');
  }
}

/**
 * Logger un événement analytics
 */
export function trackEvent(event: AnalyticsEvent, params?: AnalyticsEventParams): void {
  // Logger dans la console en mode dev
  if (__DEV__) {
    console.log(`[Analytics] Event: ${event}`, params);
  }

  // Firebase Analytics (web uniquement)
  if (analyticsInstance && typeof window !== 'undefined') {
    try {
      const analytics = require('firebase/analytics');
      analytics.logEvent(analyticsInstance, event, params);
    } catch (error) {
      // Ignorer les erreurs
    }
  }
}

/**
 * Définir l'ID utilisateur pour Firebase Analytics
 */
export function setUserId(userId: string | null): void {
  if (!analyticsInstance || typeof window === 'undefined') return;

  try {
    const analytics = require('firebase/analytics');
    if (userId) {
      analytics.setUserId(analyticsInstance, userId);
    } else {
      analytics.setUserId(analyticsInstance, null);
    }
  } catch (error) {
    // Ignorer les erreurs
  }
}

/**
 * Définir des propriétés utilisateur
 */
export function setUserProps(properties: Record<string, string | number | boolean | null>): void {
  if (!analyticsInstance || typeof window === 'undefined') return;

  try {
    const analytics = require('firebase/analytics');
    analytics.setUserProperties(analyticsInstance, properties);
  } catch (error) {
    // Ignorer les erreurs
  }
}

/**
 * Tracker un repas logué
 */
export function trackMealLogged(params: {
  mealId: string;
  category: string;
  itemsCount: number;
  score?: number;
  pointsCost?: number;
  hasAiParser?: boolean;
}): void {
  trackEvent('meal_logged', {
    meal_id: params.mealId,
    category: params.category,
    items_count: params.itemsCount,
    score: params.score,
    points_cost: params.pointsCost,
    has_ai_parser: params.hasAiParser,
  });
}

/**
 * Tracker une évolution du dragon
 */
export function trackDragonEvolved(params: {
  level: number;
  streakDays: number;
}): void {
  trackEvent('dragon_evolved', {
    level: params.level,
    streak_days: params.streakDays,
  });
}

/**
 * Tracker un milestone de streak
 */
export function trackStreakMilestone(params: {
  streakDays: number;
  milestoneType: 'daily' | 'weekly' | 'monthly' | 'special';
}): void {
  trackEvent('streak_milestone', {
    streak_days: params.streakDays,
    milestone_type: params.milestoneType,
  });
}

/**
 * Tracker la complétion de l'onboarding
 */
export function trackOnboardingCompleted(params: {
  weightGoal: string;
  weightKg?: number;
  activityLevel: string;
}): void {
  trackEvent('onboarding_completed', {
    weight_goal: params.weightGoal,
    weight_kg: params.weightKg,
    activity_level: params.activityLevel,
  });
}

/**
 * Tracker une mise à jour des objectifs
 */
export function trackTargetUpdated(params: {
  targetType: 'nutrition' | 'weight' | 'points';
  oldValue?: number;
  newValue?: number;
}): void {
  trackEvent('target_updated', {
    target_type: params.targetType,
    old_value: params.oldValue,
    new_value: params.newValue,
  });
}

/**
 * Tracker un ajout d'aliment personnalisé
 */
export function trackFoodItemAdded(params: {
  foodId: string;
  foodName: string;
  isEstimated: boolean;
}): void {
  trackEvent('food_item_added', {
    food_id: params.foodId,
    food_name: params.foodName,
    is_estimated: params.isEstimated,
  });
}

/**
 * Tracker l'utilisation du parser IA
 */
export function trackAIParserUsed(params: {
  description: string;
  itemsDetected: number;
  success: boolean;
}): void {
  trackEvent('ai_parser_used', {
    items_detected: params.itemsDetected,
    success: params.success ? 1 : 0,
    description_length: params.description.length,
  });
}

/**
 * Tracker une vue d'écran
 */
export function trackScreenView(screenName: string, params?: AnalyticsEventParams): void {
  trackEvent('screen_view', {
    screen_name: screenName,
    ...params,
  });
}
