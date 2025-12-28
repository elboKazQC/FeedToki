import { MealEntry, normalizeDate } from './stats';
import { FOOD_DB, FoodItem } from './food-db';

export type DailyNutritionTotals = {
  protein_g: number;
  carbs_g: number;
  calories_kcal: number;
  fat_g: number;
};

export type NutritionTargets = {
  protein_g: number;
  carbs_g: number;
  calories_kcal: number;
  fat_g: number;
};

export const DEFAULT_TARGETS: NutritionTargets = {
  protein_g: 100,
  carbs_g: 250,
  calories_kcal: 2000,
  fat_g: 65,
};

export function computeDailyTotals(entries: MealEntry[], dateIso: string, customFoods: FoodItem[] = []): DailyNutritionTotals {
  const dayKey = normalizeDate(dateIso);
  const meals = entries.filter((e) => normalizeDate(e.createdAt) === dayKey);

  // Fusionner FOOD_DB avec customFoods pour chercher dans les deux
  const allFoods = [...FOOD_DB, ...customFoods];

  let protein = 0;
  let carbs = 0;
  let calories = 0;
  let fat = 0;

  for (const m of meals) {
    const items = m.items || [];
    for (const ref of items) {
      const f = allFoods.find((x) => x.id === ref.foodId);
      if (!f) {
        console.warn(`[Nutrition] Aliment non trouvé pour foodId: ${ref.foodId} (total foods: ${allFoods.length}, custom: ${customFoods.length})`);
        continue;
      }
      
      // Appliquer le multiplicateur de portion (par défaut 1.0)
      const multiplier = ref.multiplier || 1.0;
      
      protein += (f.protein_g || 0) * multiplier;
      carbs += (f.carbs_g || 0) * multiplier;
      calories += (f.calories_kcal || 0) * multiplier;
      fat += (f.fat_g || 0) * multiplier;
    }
  }

  return { protein_g: protein, carbs_g: carbs, calories_kcal: calories, fat_g: fat };
}

export function percentageOfTarget(total: number, target: number): number {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((total / target) * 100)));
}
