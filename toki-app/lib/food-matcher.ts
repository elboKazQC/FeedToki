// Fuzzy matching des aliments contre la base de données
// Utilise une recherche simple pour matcher les noms d'aliments

import { FOOD_DB, FoodItem, FoodTag } from './food-db';
import { FoodItemRef } from './stats';
import { getDefaultPortion, PortionReference } from './portions';

/**
 * Score de similarité entre deux chaînes (algorithme amélioré)
 */
function similarityScore(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  // Match exact
  if (s1 === s2) return 1.0;
  
  // Normaliser les variations communes
  const normalize = (s: string) => s
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[ç]/g, 'c');
  
  const n1 = normalize(s1);
  const n2 = normalize(s2);
  
  if (n1 === n2) return 0.95;
  
  // Liste de mots-outils à ignorer complètement dans le matching
  const stopWords = ['a', 'au', 'aux', 'de', 'du', 'des', 'la', 'le', 'les', 'un', 'une', 'et', 'ou', 'avec', 'pour', 'en'];
  
  // Extraire mots significatifs (> 2 lettres ET pas dans stopWords)
  const extractWords = (s: string) => 
    s.split(/\s+/).filter(w => w.length > 2 && !stopWords.includes(w));
  
  // Contient l'un ou l'autre (mais seulement si significatif)
  // IMPORTANT: Ne pas matcher si un terme est beaucoup plus court que l'autre
  // (ex: "beurre de peanut" ne doit PAS matcher avec "toast au beurre de peanut")
  if (n1.length >= 5 && n2.length >= 5) {
    const lengthRatio = Math.min(n1.length, n2.length) / Math.max(n1.length, n2.length);
    // Si la différence de longueur est trop grande (> 40% de différence), ne pas matcher
    if (lengthRatio < 0.6) return 0;
    
    if (n1.includes(n2) || n2.includes(n1)) {
      // Pénaliser si l'un contient l'autre mais avec des mots supplémentaires significatifs
      const words1 = extractWords(n1);
      const words2 = extractWords(n2);
      const diff = Math.abs(words1.length - words2.length);
      // Si différence de 2+ mots, réduire le score
      if (diff >= 2) return 0.6;
      return 0.8;
    }
  }
  
  // Mots significatifs communs (au moins 2 mots doivent matcher pour éviter faux positifs)
  const words1 = extractWords(n1);
  const words2 = extractWords(n2);
  const commonWords = words1.filter(w => words2.includes(w));
  const missingWords = words1.filter(w => !words2.includes(w));
  
  // Si des mots importants manquent dans une requête courte, c'est probablement pas un match
  // Ex: "viande fondu" a "fondu" qui manque dans "macaroni viande" → pas un match
  if (missingWords.length > 0 && words1.length <= 3) {
    // Requête courte avec mots manquants = probablement pas un match
    // Exception: si tous les mots de la requête sont présents, accepter
    if (commonWords.length < words1.length) {
      return 0;
    }
  }
  
  if (commonWords.length >= 2) {
    // Au moins 2 mots en commun
    const coverageScore = commonWords.length / words1.length; // % de couverture de la requête
    const totalWordsDiff = Math.abs(words1.length - words2.length);
    
    let score = 0.5 + coverageScore * 0.4;
    
    // Pénaliser si différence de taille importante
    if (totalWordsDiff >= 2) score *= 0.7;
    
    return score;
  } else if (commonWords.length === 1 && words1.length <= 2 && words2.length <= 2) {
    // Un seul mot en commun mais les deux sont courts (ex: "poulet" vs "poulet grillé")
    return 0.7;
  }
  
  // Pas de match
  return 0;
}

/**
 * Trouver le meilleur match dans la base de données
 */
export function findBestMatch(
  searchTerm: string,
  threshold: number = 0.7  // Plus strict pour éviter faux positifs
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

