// Meal auto-classification from food items
import { FOOD_DB } from './food-db';
import { FoodItemRef, MealCategory } from './stats';

export type { FoodItemRef, MealCategory };

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
