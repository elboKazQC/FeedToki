// Smart food recommendations based on remaining daily targets

import { FOOD_DB, FoodItem } from './food-db';
import { DailyNutritionTotals, NutritionTargets } from './nutrition';
import { getDefaultPortion, PortionReference } from './portions';

export type SmartRecommendation = {
  item: FoodItem;
  reason: string;
  priority: number; // 1-5, higher = better match
  suggestedGrams: number; // Portion suggérée en grammes
  suggestedVisualRef: string; // Référence visuelle
  portion: PortionReference; // Objet portion complet
};

/**
 * Get smart food suggestions filtered by taste preference (sweet or salty)
 * Takes into account: calories, protein, carbs, fat remaining
 */
export function getSmartRecommendationsByTaste(
  currentTotals: DailyNutritionTotals,
  targets: NutritionTargets,
  tastePreference: 'sweet' | 'salty' | null,
  timeOfDay: 'morning' | 'afternoon' | 'evening' = 'afternoon'
): SmartRecommendation[] {
  // Calculate what's remaining
  const remaining = {
    calories: Math.max(0, targets.calories_kcal - currentTotals.calories_kcal),
    protein: Math.max(0, targets.protein_g - currentTotals.protein_g),
    carbs: Math.max(0, targets.carbs_g - currentTotals.carbs_g),
    fat: Math.max(0, targets.fat_g - currentTotals.fat_g),
  };

  // Calculate percentages
  const proteinPct = currentTotals.protein_g / targets.protein_g;
  const caloriesPct = currentTotals.calories_kcal / targets.calories_kcal;
  const carbsPct = currentTotals.carbs_g / targets.carbs_g;

  const needsProtein = proteinPct < 0.7;
  const nearCalorieLimit = caloriesPct > 0.9;
  const tooManyCarbs = carbsPct > 0.9; // Si trop de glucides, éviter les aliments riches en glucides

  const recommendations: SmartRecommendation[] = [];

  // Filter items by taste preference
  const filteredItems = tastePreference 
    ? FOOD_DB.filter(item => {
        if (tastePreference === 'sweet') {
          // Sweet: desserts, fruits, shakes, anything with sugar tag
          return item.tags.includes('dessert_sante') || 
                 item.tags.includes('sucre') || 
                 item.id.includes('shake') ||
                 item.id.includes('baies') ||
                 item.id.includes('fruit') ||
                 item.name.toLowerCase().includes('chocolat') ||
                 item.name.toLowerCase().includes('vanille');
        } else {
          // Salty: proteins, vegetables, grains, savory items
          return item.tags.includes('proteine_maigre') ||
                 item.tags.includes('legume') ||
                 item.tags.includes('feculent_simple') ||
                 item.tags.includes('grain_complet') ||
                 (!item.tags.includes('sucre') && !item.tags.includes('dessert_sante'));
        }
      })
    : FOOD_DB;

  filteredItems.forEach((item) => {
    const itemProtein = item.protein_g || 0;
    const itemCalories = item.calories_kcal || 0;
    const itemCarbs = item.carbs_g || 0;

    // Skip if item would exceed remaining calories significantly
    if (itemCalories > remaining.calories * 1.2 && !nearCalorieLimit) {
      return;
    }

    // Skip if too many carbs and item is high in carbs
    if (tooManyCarbs && itemCarbs > 20 && !item.tags.includes('proteine_maigre')) {
      return;
    }

    let priority = 0;
    let reasons: string[] = [];

    

    // Priority boost for items that fit remaining budget perfectly
    if (itemCalories <= remaining.calories && itemCalories >= remaining.calories * 0.3) {
      priority += 2;
      reasons.push(`Parfait pour ${Math.round(remaining.calories)} cal restantes`);
    }

    // High-protein items when protein is needed (especially for sweet desserts)
    if (needsProtein && itemProtein > 15) {
      priority += 3;
      reasons.push(`Boost protéines (+${itemProtein}g)`);
    }

    // Protein desserts are great when craving sweet
    if (tastePreference === 'sweet' && item.tags.includes('proteine_maigre') && itemProtein > 20) {
      priority += 4;
      reasons.push(`Dessert protéiné sain!`);
    }


    // Vegetables are always recommended (for salty)
    if (tastePreference === 'salty' && item.tags.includes('legume')) {
      priority += 2;
      reasons.push('Légumes nutritifs');
    }

    // Match remaining macros
    if (itemProtein <= remaining.protein * 1.2 && itemProtein > 0) {
      priority += 1;
    }
    if (itemCarbs <= remaining.carbs * 1.2 && !tooManyCarbs && itemCarbs > 0) {
      priority += 1;
    }

    // Healthy desserts when craving sweet
    if (tastePreference === 'sweet' && item.tags.includes('dessert_sante')) {
      priority += 3;
      reasons.push('Dessert santé');
    }

    // Penalize ultra-processed (unless it's a real cheat)
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
        suggestedGrams: defaultPortion.grams,
        suggestedVisualRef: defaultPortion.visualRef,
        portion: defaultPortion,
      });
    }
  });

  // Sort by priority (highest first)
  return recommendations
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 8); // Return top 8 suggestions
}

/**
 * Get smart food suggestions when user is hungry
 * Analyzes what's missing (protein, calories, etc.) and suggests accordingly
 */
export function getSmartRecommendations(
  currentTotals: DailyNutritionTotals,
  targets: NutritionTargets,
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

  const recommendations: SmartRecommendation[] = [];

  // Strategy: prioritize protein if low, then balance calories/carbs
  const needsProtein = proteinPct < 0.7; // Less than 70% of protein target
  const needsCalories = caloriesPct < 0.8; // Less than 80% of calorie target
  const nearCalorieLimit = caloriesPct > 0.9; // Close to calorie limit

  FOOD_DB.forEach((item) => {
    const itemProtein = item.protein_g || 0;
    const itemCalories = item.calories_kcal || 0;

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


    // Vegetables are always recommended, boost at lunch and dinner
    if (item.tags.includes('legume')) {
      priority += 2;
      reasons.push('Légumes nutritifs');
      if (timeOfDay !== 'morning' && (item.id === 'brocoli' || item.id === 'chou_fleur')) {
        priority += 2;
        reasons.push('Favoriser brocoli/chou-fleur');
      }
    }

    // Match time of day: carbs at lunch
    if (timeOfDay === 'afternoon' && (item.id === 'riz' || item.id === 'patate' || item.tags.includes('grain_complet'))) {
      priority += 2;
      reasons.push('Bon glucides pour le dîner');
    }
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
        suggestedGrams: defaultPortion.grams,
        suggestedVisualRef: defaultPortion.visualRef,
        portion: defaultPortion,
      });
    }
  });

  // Daily protein shake suggestion if protein is still missing significantly
  if (needsProtein && !nearCalorieLimit) {
    const shake = FOOD_DB.find((i) => i.id === 'shake_protein');
    if (shake) {
      const defaultPortion = getDefaultPortion(shake.tags);
      recommendations.push({
        item: shake,
        reason: 'Shake de protéine quotidien recommandé',
        priority: 5,
        suggestedGrams: defaultPortion.grams,
        suggestedVisualRef: defaultPortion.visualRef,
        portion: defaultPortion,
      });
    }
  }

  // Healthy dessert ideas if protein met but still hungry
  if (!needsProtein && caloriesPct < 0.9) {
    const dessertCandidates = FOOD_DB.filter((i) => i.tags.includes('dessert_sante') || i.id === 'baies');
    dessertCandidates.forEach((item) => {
      const defaultPortion = getDefaultPortion(item.tags);
      recommendations.push({
        item,
        reason: 'Dessert santé si encore faim',
        priority: 3,
        suggestedGrams: defaultPortion.grams,
        suggestedVisualRef: defaultPortion.visualRef,
        portion: defaultPortion,
      });
    });
  }

  // Sort by priority (highest first)
  return recommendations
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 8); // Return top 8 suggestions
}

/**
 * Get a single "best recommendation" for quick decision
 */
export function getBestRecommendation(
  currentTotals: DailyNutritionTotals,
  targets: NutritionTargets,
  timeOfDay: 'morning' | 'afternoon' | 'evening' = 'afternoon'
): SmartRecommendation | null {
  const recs = getSmartRecommendations(currentTotals, targets, timeOfDay);
  return recs[0] || null;
}


/**
 * Get explanation of what user needs most right now
 */
export function getHungerAnalysis(
  currentTotals: DailyNutritionTotals,
  targets: NutritionTargets,
  timeOfDay: 'morning' | 'afternoon' | 'evening' = 'afternoon'
): string {
  const remaining = {
    calories: Math.max(0, targets.calories_kcal - currentTotals.calories_kcal),
    protein: Math.max(0, targets.protein_g - currentTotals.protein_g),
    carbs: Math.max(0, targets.carbs_g - currentTotals.carbs_g),
  };

  const proteinPct = currentTotals.protein_g / targets.protein_g;
  const caloriesPct = currentTotals.calories_kcal / targets.calories_kcal;
  
  // Déterminer le type de repas selon l'heure
  const hour = new Date().getHours();
  const mealType = timeOfDay === 'morning' ? 'petit-déjeuner' : 
                   timeOfDay === 'afternoon' ? 'déjeuner' : 'souper';
  const isSnackTime = (timeOfDay === 'afternoon' && hour >= 15 && hour < 17) ||
                      (timeOfDay === 'evening' && hour >= 20);

  // Build analysis message avec contexte de l'heure
  let timeContext = '';
  if (isSnackTime) {
    timeContext = 'C\'est l\'heure d\'une collation. ';
  } else {
    timeContext = `C'est l'heure du ${mealType}. `;
  }

  if (caloriesPct > 0.95) {
    return `${timeContext}Tu es proche de ton objectif calorique! Choisis des légumes ou protéines légères pour compléter sans dépasser. 🥗`;
  }

  if (proteinPct < 0.6) {
    return `${timeContext}Il te manque ${Math.round(remaining.protein)}g de protéines (tu as ${currentTotals.protein_g.toFixed(0)}g sur ${targets.protein_g}g). Focus sur poulet, poisson ou œufs pour compléter tes besoins! 💪`;
  }

  if (proteinPct < 0.8 && caloriesPct < 0.7) {
    return `${timeContext}Tu as encore ${Math.round(remaining.calories)} cal de budget. Ajoute des protéines et féculents pour un repas équilibré! 🍽️`;
  }

  if (caloriesPct < 0.5) {
    return `${timeContext}Tu es à ${Math.round(caloriesPct * 100)}% de ton objectif. Tu peux manger un bon repas complet pour compléter tes besoins nutritionnels! 🍴`;
  }

  return `${timeContext}Il te reste ${Math.round(remaining.calories)} cal. Choisis ce qui te fait envie! 😊`;
}

/**
 * Recommandations simples basées sur le Guide alimentaire canadien (fallback)
 */
export function getCanadaGuideRecommendations(): {
  group: string;
  title: string;
  examples: string[];
}[] {
  return [
    {
      group: 'proteines',
      title: 'Ajoute des protéines',
      examples: ['Poulet', 'Dinde', 'Poisson', 'Oeufs'],
    },
    {
      group: 'legumes_fruits',
      title: 'Remplis la moitié avec légumes/fruits',
      examples: ['Légumes', 'Salade verte', 'Brocoli'],
    },
    {
      group: 'grains_entiers',
      title: 'Complète avec grains entiers',
      examples: ['Riz', 'Pâtes', 'Quinoa'],
    },
    {
      group: 'eau',
      title: 'Bois de l\'eau',
      examples: ['Verre d\'eau'],
    },
  ];
}
