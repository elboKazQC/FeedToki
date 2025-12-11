import { MealEntry, normalizeDate } from './stats';
import { FOOD_DB } from './food-db';

export type DailyNutritionTotals = {
  protein_g: number;
  carbs_g: number;
  calories_kcal: number;
};

export type NutritionTargets = {
  protein_g: number;
  carbs_g: number;
  calories_kcal: number;
};

export const DEFAULT_TARGETS: NutritionTargets = {
  protein_g: 100,
  carbs_g: 250,
  calories_kcal: 2000,
};

export function computeDailyTotals(entries: MealEntry[], dateIso: string): DailyNutritionTotals {
  const dayKey = normalizeDate(dateIso);
  const meals = entries.filter((e) => normalizeDate(e.createdAt) === dayKey);

  let protein = 0;
  let carbs = 0;
  let calories = 0;

  for (const m of meals) {
    const items = m.items || [];
    for (const ref of items) {
      const f = FOOD_DB.find((x) => x.id === ref.foodId);
      if (!f) continue;
      protein += f.protein_g || 0;
      carbs += f.carbs_g || 0;
      calories += f.calories_kcal || 0;
    }
  }

  return { protein_g: protein, carbs_g: carbs, calories_kcal: calories };
}

export function percentageOfTarget(total: number, target: number): number {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((total / target) * 100)));
}
