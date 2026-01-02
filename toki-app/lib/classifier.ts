// Meal auto-classification from food items
import { FOOD_DB, FoodItem } from './food-db';
import { FoodItemRef, MealCategory, MealEntry } from './stats';
import { NutritionTargets, computeMealScore } from './nutrition';

export type { FoodItemRef, MealCategory };

/**
 * Classification basée sur baseScore (ancien système - rétrocompatibilité)
 */
export function classifyMealByItems(items: FoodItemRef[]): { score: number; category: MealCategory } {
  if (!items || items.length === 0) {
    return { score: 50, category: 'ok' }; // neutral fallback
  }

  const scores = items.map((ref) => FOOD_DB.find((f) => f.id === ref.foodId)?.baseScore ?? 50);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const score = Math.max(0, Math.min(100, Math.round(avg)));

  let category: MealCategory = 'sain';
  if (score < 40) category = 'cheat';
  else if (score < 70) category = 'ok';

  return { score, category };
}

/**
 * Classification basée sur la nutrition (nouveau système)
 * Utilise computeMealScore pour calculer le score basé sur les objectifs et la densité protéique
 */
export function classifyMealByNutrition(
  meal: MealEntry,
  dailyTargets: NutritionTargets,
  expectedMealsPerDay: number = 3,
  customFoods: FoodItem[] = []
): { score: number; category: MealCategory } {
  const score = computeMealScore(meal, dailyTargets, expectedMealsPerDay, customFoods);

  // Nouveaux seuils : 80/60 au lieu de 70/40
  let category: MealCategory = 'sain';
  if (score < 60) category = 'cheat';
  else if (score < 80) category = 'ok';

  return { score, category };
}
