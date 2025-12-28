// Fuzzy matching des aliments contre la base de données
// Utilise une recherche simple pour matcher les noms d'aliments

import { FOOD_DB, FoodItem, FoodTag } from './food-db';
import { FoodItemRef } from './stats';
import { getDefaultPortion, PortionReference } from './portions';

/**
 * Score de similarité entre deux chaînes (algorithme simple)
 */
function similarityScore(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  // Match exact
  if (s1 === s2) return 1.0;
  
  // Contient l'un ou l'autre
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;
  
  // Mots communs
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  const commonWords = words1.filter(w => words2.includes(w));
  if (commonWords.length > 0) {
    return 0.5 + (commonWords.length / Math.max(words1.length, words2.length)) * 0.3;
  }
  
  // Pas de match
  return 0;
}

/**
 * Trouver le meilleur match dans la base de données
 */
export function findBestMatch(
  searchTerm: string,
  threshold: number = 0.6
): FoodItem | null {
  if (!searchTerm || searchTerm.trim().length === 0) {
    return null;
  }

  let bestMatch: FoodItem | null = null;
  let bestScore = 0;

  for (const item of FOOD_DB) {
    const score = similarityScore(searchTerm, item.name);
    if (score > bestScore && score >= threshold) {
      bestScore = score;
      bestMatch = item;
    }
  }

  return bestMatch;
}

/**
 * Trouver plusieurs matches possibles (pour affichage de choix)
 */
export function findMultipleMatches(
  searchTerm: string,
  maxResults: number = 5,
  threshold: number = 0.4
): Array<{ item: FoodItem; score: number }> {
  if (!searchTerm || searchTerm.trim().length === 0) {
    return [];
  }

  const matches: Array<{ item: FoodItem; score: number }> = [];

  for (const item of FOOD_DB) {
    const score = similarityScore(searchTerm, item.name);
    if (score >= threshold) {
      matches.push({ item, score });
    }
  }

  // Trier par score décroissant
  matches.sort((a, b) => b.score - a.score);

  return matches.slice(0, maxResults);
}

/**
 * Créer un FoodItemRef depuis un match ou un item estimé
 */
export function createFoodItemRef(
  item: FoodItem,
  portion?: PortionReference
): FoodItemRef {
  const finalPortion = portion || getDefaultPortion(item.tags);

  return {
    foodId: item.id,
    portionSize: finalPortion.size,
    portionGrams: finalPortion.grams,
    multiplier: finalPortion.multiplier,
    quantityHint: `${finalPortion.grams}g (${finalPortion.visualRef})`,
  };
}

/**
 * Essayer de matcher plusieurs termes (pour parsing de repas complets)
 */
export function matchMultipleFoods(
  foodNames: string[],
  threshold: number = 0.5
): Array<{ name: string; matchedItem: FoodItem | null; score: number }> {
  return foodNames.map((name) => {
    const match = findBestMatch(name, threshold);
    const score = match ? similarityScore(name, match.name) : 0;
    return {
      name,
      matchedItem: match,
      score,
    };
  });
}

