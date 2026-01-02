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

/**
 * Vérifie si un repas a suffisamment de nutriments pour être considéré comme un vrai repas
 * (exclut les boissons comme café, eau, etc.)
 * @param meal Le repas à vérifier
 * @param customFoods Liste des aliments personnalisés
 * @returns true si le repas est valide (a suffisamment de nutriments)
 */
export function isValidMeal(meal: MealEntry, customFoods: FoodItem[] = []): boolean {
  const totals = computeMealTotals(meal, customFoods);
  
  // Un repas valide doit avoir au moins 50 kcal
  // OU au moins 5g de nutriments totaux (protéines + glucides + lipides)
  const totalNutrients = totals.protein_g + totals.carbs_g + totals.fat_g;
  
  return totals.calories_kcal >= 50 || totalNutrients >= 5;
}

/**
 * Calcule les totaux nutritionnels pour un seul repas
 * @param meal Le repas à analyser
 * @param customFoods Liste des aliments personnalisés
 * @returns Totaux nutritionnels du repas
 */
export function computeMealTotals(meal: MealEntry, customFoods: FoodItem[] = []): DailyNutritionTotals {
  // Fusionner FOOD_DB avec customFoods pour chercher dans les deux
  const allFoods = [...FOOD_DB, ...customFoods];

  let protein = 0;
  let carbs = 0;
  let calories = 0;
  let fat = 0;

  const items = meal.items || [];
  
  for (const ref of items) {
    const f = allFoods.find((x) => x.id === ref.foodId);
    if (!f) {
      continue;
    }
    
    // Appliquer le multiplicateur de portion (par défaut 1.0)
    const multiplier = ref.multiplier || 1.0;
    
    protein += (f.protein_g || 0) * multiplier;
    carbs += (f.carbs_g || 0) * multiplier;
    calories += (f.calories_kcal || 0) * multiplier;
    fat += (f.fat_g || 0) * multiplier;
  }

  return { protein_g: protein, carbs_g: carbs, calories_kcal: calories, fat_g: fat };
}

/**
 * Calcule le score d'un repas basé sur la proximité aux objectifs et la densité protéique
 * @param meal Le repas à évaluer
 * @param dailyTargets Objectifs nutritionnels journaliers
 * @param expectedMealsPerDay Nombre de repas attendus par jour (défaut: 3)
 * @param customFoods Liste des aliments personnalisés
 * @returns Score entre 0 et 100
 */
export function computeMealScore(
  meal: MealEntry,
  dailyTargets: NutritionTargets,
  expectedMealsPerDay: number = 3,
  customFoods: FoodItem[] = []
): number {
  // Calculer les totaux nutritionnels du repas
  const mealTotals = computeMealTotals(meal, customFoods);
  
  // Partie 1: Proximité aux objectifs (50 points max)
  const targetPerMeal = {
    calories_kcal: dailyTargets.calories_kcal / expectedMealsPerDay,
    protein_g: dailyTargets.protein_g / expectedMealsPerDay,
    carbs_g: dailyTargets.carbs_g / expectedMealsPerDay,
    fat_g: dailyTargets.fat_g / expectedMealsPerDay,
  };
  
  // Calculer le score pour chaque nutriment
  const calculateNutrientScore = (actual: number, target: number): number => {
    if (target <= 0) return 50; // Si pas d'objectif, score neutre
    const deviation = Math.abs(actual - target) / target * 100;
    return Math.max(0, 100 - deviation);
  };
  
  const scoreCalories = calculateNutrientScore(mealTotals.calories_kcal, targetPerMeal.calories_kcal);
  const scoreProtein = calculateNutrientScore(mealTotals.protein_g, targetPerMeal.protein_g);
  const scoreCarbs = calculateNutrientScore(mealTotals.carbs_g, targetPerMeal.carbs_g);
  const scoreFat = calculateNutrientScore(mealTotals.fat_g, targetPerMeal.fat_g);
  
  // Moyenne des 4 scores
  const avgProximityScore = (scoreCalories + scoreProtein + scoreCarbs + scoreFat) / 4;
  const proximityScore = avgProximityScore * 0.5; // 50% du score total
  
  // Partie 2: Rapport protéines/calories - Densité protéique (50 points max)
  let proteinDensityScore = 0;
  if (mealTotals.calories_kcal > 0) {
    const proteinDensity = (mealTotals.protein_g * 4) / mealTotals.calories_kcal * 100;
    
    if (proteinDensity >= 20 && proteinDensity <= 30) {
      // Zone idéale : 20-30%
      proteinDensityScore = 50;
    } else if (proteinDensity < 20) {
      // Trop faible : score proportionnel
      proteinDensityScore = 50 * (proteinDensity / 20);
    } else {
      // Trop élevé : pénalité progressive
      const excess = proteinDensity - 30;
      proteinDensityScore = Math.max(0, 50 * (1 - excess / 30));
    }
  } else {
    // Pas de calories = score neutre
    proteinDensityScore = 25;
  }
  
  // Score final
  const finalScore = proximityScore + proteinDensityScore;
  return Math.max(0, Math.min(100, Math.round(finalScore)));
}

/**
 * Calcule le score d'une journée basé uniquement sur la proximité aux objectifs nutritionnels
 * Le score = pourcentage d'atteinte des objectifs (moyenne des 4 nutriments)
 * @param meals Liste des repas de la journée
 * @param dailyTargets Objectifs nutritionnels journaliers
 * @param customFoods Liste des aliments personnalisés
 * @param expectedMealsPerDay Nombre de repas attendus par jour (défaut: 3) - non utilisé mais gardé pour compatibilité
 * @returns Score entre 0 et 100 (pourcentage d'atteinte des objectifs)
 */
export function computeDayScore(
  meals: MealEntry[],
  dailyTargets: NutritionTargets,
  customFoods: FoodItem[] = [],
  expectedMealsPerDay: number = 3
): number {
  if (meals.length === 0) return 0;
  
  // Calculer les totaux nutritionnels de la journée
  const dayTotals = computeDailyTotals(meals, meals[0]?.createdAt || new Date().toISOString(), customFoods);
  
  // Calculer le pourcentage d'atteinte pour chaque nutriment
  const calculateNutrientScore = (actual: number, target: number): number => {
    if (target <= 0) return 0; // Pas d'objectif = 0%
    const ratio = actual / target;
    
    if (ratio <= 1.0) {
      // Atteint ou sous l'objectif : score = pourcentage d'atteinte
      return ratio * 100;
    } else {
      // Dépassement : pénalité progressive
      // Si ratio = 1.1 (110%), score = 100 - (1.1 - 1.0) * 50 = 95%
      // Si ratio = 1.2 (120%), score = 100 - (1.2 - 1.0) * 50 = 90%
      return Math.max(0, 100 - (ratio - 1.0) * 50);
    }
  };
  
  const scoreCalories = calculateNutrientScore(dayTotals.calories_kcal, dailyTargets.calories_kcal);
  const scoreProtein = calculateNutrientScore(dayTotals.protein_g, dailyTargets.protein_g);
  const scoreCarbs = calculateNutrientScore(dayTotals.carbs_g, dailyTargets.carbs_g);
  const scoreFat = calculateNutrientScore(dayTotals.fat_g, dailyTargets.fat_g);
  
  // Score final = moyenne des 4 pourcentages
  const finalScore = (scoreCalories + scoreProtein + scoreCarbs + scoreFat) / 4;
  return Math.max(0, Math.min(100, Math.round(finalScore)));
}

export function percentageOfTarget(total: number, target: number): number {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((total / target) * 100)));
}
