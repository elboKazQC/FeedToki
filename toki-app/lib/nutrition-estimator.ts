// Estimation des macros nutritionnels pour aliments inconnus
// Utilise des moyennes par catégorie et des heuristiques basées sur le nom

import { FoodItem, FoodTag } from './food-db';
import { computeFoodPoints } from './points-utils';

/**
 * Catégories de référence pour estimation
 */
const CATEGORY_AVERAGES: Record<string, { protein_g: number; carbs_g: number; fat_g: number; calories_kcal: number }> = {
  proteine_maigre: { protein_g: 25, carbs_g: 0, fat_g: 3, calories_kcal: 160 },
  legume: { protein_g: 2, carbs_g: 8, fat_g: 0.3, calories_kcal: 40 },
  feculent_simple: { protein_g: 5, carbs_g: 40, fat_g: 1, calories_kcal: 200 },
  grain_complet: { protein_g: 6, carbs_g: 45, fat_g: 2, calories_kcal: 220 },
  ultra_transforme: { protein_g: 15, carbs_g: 30, fat_g: 15, calories_kcal: 300 },
  gras_frit: { protein_g: 10, carbs_g: 20, fat_g: 20, calories_kcal: 350 },
  sucre: { protein_g: 0, carbs_g: 25, fat_g: 0, calories_kcal: 100 },
  alcool: { protein_g: 0, carbs_g: 3, fat_g: 0, calories_kcal: 120 },
  dessert_sante: { protein_g: 5, carbs_g: 15, fat_g: 5, calories_kcal: 120 },
};

/**
 * Mots-clés pour identifier les catégories
 */
const KEYWORD_MAPPING: Record<string, FoodTag[]> = {
  // Protéines
  'beef': ['proteine_maigre'],
  'boeuf': ['proteine_maigre'],
  'poulet': ['proteine_maigre'],
  'chicken': ['proteine_maigre'],
  'dinde': ['proteine_maigre'],
  'turkey': ['proteine_maigre'],
  'poisson': ['proteine_maigre'],
  'fish': ['proteine_maigre'],
  'saumon': ['proteine_maigre'],
  'salmon': ['proteine_maigre'],
  'oeuf': ['proteine_maigre'],
  'egg': ['proteine_maigre'],
  'tofu': ['proteine_maigre'],
  'jerky': ['proteine_maigre'],
  'beef stick': ['proteine_maigre'],
  'bâtonnet': ['proteine_maigre'],
  
  // Légumes
  'legume': ['legume'],
  'vegetable': ['legume'],
  'salade': ['legume'],
  'salad': ['legume'],
  'brocoli': ['legume'],
  'broccoli': ['legume'],
  'carotte': ['legume'],
  'carrot': ['legume'],
  'tomate': ['legume'],
  'tomato': ['legume'],
  
  // Féculents
  'riz': ['feculent_simple'],
  'rice': ['feculent_simple'],
  'pate': ['feculent_simple'],
  'pasta': ['feculent_simple'],
  'patate': ['feculent_simple'],
  'potato': ['feculent_simple'],
  'quinoa': ['feculent_simple'],
  
  // Ultra-transformés
  'pizza': ['ultra_transforme', 'gras_frit'],
  'burger': ['ultra_transforme', 'gras_frit'],
  'frite': ['ultra_transforme', 'gras_frit'],
  'fries': ['ultra_transforme', 'gras_frit'],
  'poutine': ['ultra_transforme', 'gras_frit'],
  'chips': ['ultra_transforme', 'gras_frit'],
  'saucisse': ['ultra_transforme'],
  'sausage': ['ultra_transforme'],
  'smoked': ['ultra_transforme'],
  'fumé': ['ultra_transforme'],
  'cigare': ['proteine_maigre', 'legume'],
  'cigar': ['proteine_maigre', 'legume'],
  'chou': ['legume'],
  'choux': ['legume'],
  'cabbage': ['legume'],
  'dolma': ['proteine_maigre', 'legume'],
  
  // Sucres
  'sucre': ['sucre'],
  'sugar': ['sucre'],
  'soda': ['sucre'],
  'jus': ['sucre'],
  'juice': ['sucre'],
  'dessert': ['sucre'],
  'beigne': ['ultra_transforme', 'sucre'],
  'donut': ['ultra_transforme', 'sucre'],
  
  // Alcool
  'biere': ['alcool'],
  'beer': ['alcool'],
  'vin': ['alcool'],
  'wine': ['alcool'],
  'cocktail': ['alcool'],
};

/**
 * Détecter les tags depuis le nom de l'aliment
 */
function detectTagsFromName(foodName: string): FoodTag[] {
  const lowerName = foodName.toLowerCase();
  const tags: Set<FoodTag> = new Set();

  for (const [keyword, tagList] of Object.entries(KEYWORD_MAPPING)) {
    if (lowerName.includes(keyword)) {
      tagList.forEach(tag => tags.add(tag));
    }
  }

  // Si aucun tag détecté, utiliser une catégorie par défaut
  if (tags.size === 0) {
    tags.add('feculent_simple'); // Par défaut, considérer comme féculent
  }

  return Array.from(tags);
}

/**
 * Estimer les macros nutritionnels pour un aliment inconnu
 */
export function estimateNutritionForUnknownFood(
  foodName: string,
  context?: string
): Omit<FoodItem, 'id' | 'name' | 'baseScore' | 'points'> {
  const tags = detectTagsFromName(foodName);
  
  // Utiliser la moyenne de la première catégorie détectée
  const primaryTag = tags[0] || 'feculent_simple';
  const baseMacros = CATEGORY_AVERAGES[primaryTag] || CATEGORY_AVERAGES.feculent_simple;

  // Ajustements selon le contexte ou mots-clés supplémentaires
  let protein = baseMacros.protein_g;
  let carbs = baseMacros.carbs_g;
  let fat = baseMacros.fat_g;
  let calories = baseMacros.calories_kcal;

  const lowerName = foodName.toLowerCase();
  const lowerContext = context?.toLowerCase() || '';

  // Ajustements pour portions ou descriptions
  if (lowerName.includes('gros') || lowerName.includes('large') || lowerName.includes('big')) {
    protein *= 1.5;
    carbs *= 1.5;
    fat *= 1.5;
    calories *= 1.5;
  } else if (lowerName.includes('petit') || lowerName.includes('small') || lowerName.includes('mini')) {
    protein *= 0.7;
    carbs *= 0.7;
    fat *= 0.7;
    calories *= 0.7;
  }

  // Ajustements pour aliments frits
  if (tags.includes('gras_frit') || lowerName.includes('frit') || lowerName.includes('fried')) {
    fat *= 1.3;
    calories *= 1.2;
  }

  return {
    tags,
    protein_g: Math.round(protein),
    carbs_g: Math.round(carbs),
    fat_g: Math.round(fat * 10) / 10,
    calories_kcal: Math.round(calories),
  };
}

/**
 * Créer un FoodItem temporaire depuis une estimation
 */
export function createEstimatedFoodItem(
  foodName: string,
  context?: string
): FoodItem {
  const estimated = estimateNutritionForUnknownFood(foodName, context);
  
  // Calculer baseScore basé sur les tags (simplifié)
  let baseScore = 50; // Par défaut
  if (estimated.tags.includes('proteine_maigre') || estimated.tags.includes('legume')) {
    baseScore = 80;
  } else if (estimated.tags.includes('ultra_transforme') || estimated.tags.includes('gras_frit')) {
    baseScore = 20;
  } else if (estimated.tags.includes('sucre')) {
    baseScore = 15;
  }

  // Calculer points en utilisant la fonction existante
  const tempItem: FoodItem = {
    ...estimated,
    id: `estimated_${Date.now()}`,
    name: foodName,
    tags: estimated.tags,
    baseScore,
  };

  // Calculer points (utiliser la logique existante)
  const points = computeFoodPoints(tempItem);

  return {
    ...tempItem,
    points,
  };
}

