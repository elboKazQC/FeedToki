// Smart food recommendations based on remaining daily targets

import { FOOD_DB, FoodItem } from './food-db';
import { NutritionTotals, NutritionTargets } from './nutrition';
import { getDefaultPortion, PortionSize } from './portions';

export type SmartRecommendation = {
  item: FoodItem;
  reason: string;
  priority: number; // 1-5, higher = better match
  pointsCost: number;
  suggestedGrams: number; // Portion suggérée en grammes
  suggestedVisualRef: string; // Référence visuelle
  portion: PortionSize; // Objet portion complet
};

/**
 * Get smart food suggestions when user is hungry
 * Analyzes what's missing (protein, calories, etc.) and suggests accordingly
 */
export function getSmartRecommendations(
  currentTotals: NutritionTotals,
  targets: NutritionTargets,
  availablePoints: number,
  timeOfDay: 'morning' | 'afternoon' | 'evening' = 'afternoon'
): SmartRecommendation[] {
  // Calculate what's remaining
  const remaining = {
    calories: Math.max(0, targets.calories_kcal - currentTotals.calories_kcal),
    protein: Math.max(0, targets.protein_g - currentTotals.protein_g),
    carbs: Math.max(0, targets.carbs_g - currentTotals.carbs_g),
  };

  // Calculate percentages
  const proteinPct = currentTotals.protein_g / targets.protein_g;
  const caloriesPct = currentTotals.calories_kcal / targets.calories_kcal;
  const carbsPct = currentTotals.carbs_g / targets.carbs_g;

  const recommendations: SmartRecommendation[] = [];

  // Strategy: prioritize protein if low, then balance calories/carbs
  const needsProtein = proteinPct < 0.7; // Less than 70% of protein target
  const needsCalories = caloriesPct < 0.8; // Less than 80% of calorie target
  const nearCalorieLimit = caloriesPct > 0.9; // Close to calorie limit

  FOOD_DB.forEach((item) => {
    const itemProtein = item.protein_g || 0;
    const itemCalories = item.calories_kcal || 0;
    const itemCarbs = item.carbs_g || 0;

    // Skip if item would exceed remaining calories significantly
    if (itemCalories > remaining.calories * 1.2 && !nearCalorieLimit) {
      return;
    }

    let priority = 0;
    let reasons: string[] = [];

    // High-protein items when protein is needed
    if (needsProtein && item.tags.includes('proteine_maigre')) {
      priority += 3;
      reasons.push(`Boost protéines (+${itemProtein}g)`);
    }

    // Free/low-cost items are always good
    const estimatedCost = estimatePointsCost(item);
    if (estimatedCost === 0) {
      priority += 2;
      reasons.push('Gratuit en points!');
    } else if (estimatedCost > availablePoints) {
      // Can't afford it
      return;
    }

    // Vegetables are always recommended
    if (item.tags.includes('legume')) {
      priority += 2;
      reasons.push('Légumes nutritifs');
    }

    // Match time of day
    if (timeOfDay === 'morning' && item.tags.includes('feculent_simple')) {
      priority += 1;
      reasons.push('Bon pour le matin');
    }

    // Filling items when calories needed
    if (needsCalories && itemCalories >= 200) {
      priority += 1;
      reasons.push('Rassasiant');
    }

    // Penalize ultra-processed
    if (item.tags.includes('ultra_transforme')) {
      priority -= 1;
    }

    // Penalize high-calorie items if near limit
    if (nearCalorieLimit && itemCalories > 300) {
      priority -= 2;
    }

    // Only recommend if priority > 0
    if (priority > 0 && reasons.length > 0) {
      const defaultPortion = getDefaultPortion(item.tags);
      recommendations.push({
        item,
        reason: reasons.join(' · '),
        priority,
        pointsCost: estimatedCost,
        suggestedGrams: defaultPortion.grams,
        suggestedVisualRef: defaultPortion.visualRef,
        portion: defaultPortion,
      });
    }
  });

  // Sort by priority (highest first), then by points cost (lowest first)
  return recommendations
    .sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return a.pointsCost - b.pointsCost;
    })
    .slice(0, 8); // Return top 8 suggestions
}

/**
 * Get a single "best recommendation" for quick decision
 */
export function getBestRecommendation(
  currentTotals: NutritionTotals,
  targets: NutritionTargets,
  availablePoints: number,
  timeOfDay: 'morning' | 'afternoon' | 'evening' = 'afternoon'
): SmartRecommendation | null {
  const recs = getSmartRecommendations(currentTotals, targets, availablePoints, timeOfDay);
  return recs[0] || null;
}

/**
 * Estimate points cost for an item (simplified version)
 */
function estimatePointsCost(item: FoodItem): number {
  if (typeof item.points === 'number') return item.points;

  const cal = item.calories_kcal || 150;

  // Free items
  if (item.tags.includes('proteine_maigre') || item.tags.includes('legume')) {
    return 0;
  }

  let baseCost = cal / 100;

  if (item.tags.includes('ultra_transforme')) baseCost *= 1.5;
  if (item.tags.includes('gras_frit')) baseCost *= 1.3;
  if (item.tags.includes('sucre') && cal > 100) baseCost *= 1.2;
  if (item.tags.includes('grain_complet')) baseCost *= 0.8;

  return Math.max(0, Math.round(baseCost));
}

/**
 * Get explanation of what user needs most right now
 */
export function getHungerAnalysis(
  currentTotals: NutritionTotals,
  targets: NutritionTargets
): string {
  const remaining = {
    calories: Math.max(0, targets.calories_kcal - currentTotals.calories_kcal),
    protein: Math.max(0, targets.protein_g - currentTotals.protein_g),
    carbs: Math.max(0, targets.carbs_g - currentTotals.carbs_g),
  };

  const proteinPct = currentTotals.protein_g / targets.protein_g;
  const caloriesPct = currentTotals.calories_kcal / targets.calories_kcal;

  if (caloriesPct > 0.95) {
    return "Tu es proche de ton objectif calorique! Choisis des légumes ou protéines légères. 🥗";
  }

  if (proteinPct < 0.6) {
    return `Il te manque ${Math.round(remaining.protein)}g de protéines. Focus sur poulet, poisson ou œufs! 💪`;
  }

  if (proteinPct < 0.8 && caloriesPct < 0.7) {
    return `Tu as encore ${Math.round(remaining.calories)} cal de budget. Ajoute des protéines et féculents! 🍽️`;
  }

  if (caloriesPct < 0.5) {
    return `Tu es à ${Math.round(caloriesPct * 100)}% de ton objectif. Tu peux manger un bon repas complet! 🍴`;
  }

  return `Il te reste ${Math.round(remaining.calories)} cal. Choisis ce qui te fait envie! 😊`;
}
