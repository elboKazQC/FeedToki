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
  
  // Logs de diagnostic pour comprendre pourquoi le filtre ne fonctionne pas
  console.log(`[Nutrition] 🔍 computeDailyTotals appelé pour ${dayKey} (dateIso: ${dateIso}):`, {
    totalEntries: entries.length,
    customFoodsCount: customFoods.length,
  });
  
  // Afficher les dates normalisées de tous les repas pour debug
  if (entries.length > 0) {
    const normalizedDates = entries.map(e => ({
      label: e.label,
      createdAt: e.createdAt,
      normalized: normalizeDate(e.createdAt),
      matches: normalizeDate(e.createdAt) === dayKey,
    }));
    console.log(`[Nutrition] 📅 Dates normalisées des repas (cherchant ${dayKey}):`, normalizedDates.slice(0, 5));
  }
  
  const meals = entries.filter((e) => normalizeDate(e.createdAt) === dayKey);
  
  console.log(`[Nutrition] ✅ Repas filtrés pour ${dayKey}:`, meals.length);

  // Fusionner FOOD_DB avec customFoods pour chercher dans les deux
  const allFoods = [...FOOD_DB, ...customFoods];

  let protein = 0;
  let carbs = 0;
  let calories = 0;
  let fat = 0;
  
  // Logs de diagnostic pour comprendre pourquoi les calories sont à 0
  const missingFoodIds: string[] = [];
  const foundFoodIds: string[] = [];
  let totalItems = 0;

  for (const m of meals) {
    const items = m.items || [];
    totalItems += items.length;
    if (items.length > 0) {
      console.log(`[Nutrition] 📋 Repas "${m.label}" a ${items.length} items:`, items.map(i => i.foodId));
    }
    for (const ref of items) {
      const f = allFoods.find((x) => x.id === ref.foodId);
      if (!f) {
        missingFoodIds.push(ref.foodId);
        continue;
      }
      
      foundFoodIds.push(ref.foodId);
      
      // Appliquer le multiplicateur de portion (par défaut 1.0)
      const multiplier = ref.multiplier || 1.0;
      
      protein += (f.protein_g || 0) * multiplier;
      carbs += (f.carbs_g || 0) * multiplier;
      calories += (f.calories_kcal || 0) * multiplier;
      fat += (f.fat_g || 0) * multiplier;
    }
  }
  
  // Logs de diagnostic (toujours affichés pour le debugging)
  console.log(`[Nutrition] 📊 Résultat calcul calories pour ${dayKey}:`, {
    meals: meals.length,
    totalItems,
    found: foundFoodIds.length,
    missing: missingFoodIds.length,
    calories: Math.round(calories),
    customFoodsCount: customFoods.length,
    allFoodsCount: allFoods.length,
  });
  
  if (missingFoodIds.length > 0) {
    console.log(`[Nutrition] ⚠️ Aliments manquants (${missingFoodIds.length}):`, missingFoodIds.slice(0, 10));
    console.log(`[Nutrition] 📋 IDs disponibles (échantillon):`, allFoods.slice(0, 10).map(f => f.id));
  }
  
  if (totalItems === 0 && meals.length > 0) {
    console.log(`[Nutrition] ⚠️ ATTENTION: ${meals.length} repas mais 0 items au total !`);
    meals.forEach(m => {
      console.log(`[Nutrition]   - "${m.label}": ${(m.items || []).length} items`);
    });
  }

  return { protein_g: protein, carbs_g: carbs, calories_kcal: calories, fat_g: fat };
}

export function percentageOfTarget(total: number, target: number): number {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((total / target) * 100)));
}
