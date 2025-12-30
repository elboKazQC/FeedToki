// Client Open Food Facts pour récupération de nutriments réels
// https://world.openfoodfacts.org/data

import AsyncStorage from '@react-native-async-storage/async-storage';
import { FoodItem, FoodTag } from './food-db';
import { logger } from './logger';

const OFF_API_BASE = 'https://world.openfoodfacts.org/api/v2';
const CACHE_PREFIX = 'feedtoki_off_cache_';
const CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

/**
 * Produit Open Food Facts (structure simplifiée)
 */
export type OffProduct = {
  code: string;
  product_name?: string;
  product_name_fr?: string;
  brands?: string;
  nutriments?: {
    'energy-kcal_100g'?: number;
    'proteins_100g'?: number;
    'carbohydrates_100g'?: number;
    'fat_100g'?: number;
  };
  nutriscore_grade?: string;
  nova_group?: number;
  image_url?: string;
};

export type OffSearchResult = {
  products: OffProduct[];
  count: number;
  page: number;
  page_size: number;
};

/**
 * Options de recherche
 */
export type SearchOptions = {
  page?: number;
  page_size?: number;
  lang?: string;
};

/**
 * Récupérer un produit par code-barres
 * @param barcode Code-barres du produit
 * @param useCache Utiliser le cache local (défaut: true)
 */
export async function fetchProductByBarcode(
  barcode: string,
  useCache = true
): Promise<OffProduct | null> {
  if (!barcode || barcode.trim().length === 0) {
    return null;
  }

  const cacheKey = `${CACHE_PREFIX}${barcode}`;

  // Vérifier le cache si activé
  if (useCache) {
    try {
      const cachedRaw = await AsyncStorage.getItem(cacheKey);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        const age = Date.now() - cached.timestamp;
        if (age < CACHE_DURATION_MS) {
          logger.debug('[OFF] Produit trouvé en cache:', barcode);
          return cached.product;
        }
        // Cache expiré
        logger.debug('[OFF] Cache expiré pour:', barcode);
      }
    } catch (cacheError) {
      logger.warn('[OFF] Erreur lecture cache:', cacheError);
    }
  }

  // Fetch depuis l'API
  try {
    logger.info('[OFF] Fetch produit:', barcode);
    const url = `${OFF_API_BASE}/product/${barcode}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'FeedToki/1.0 (Nutrition Tracker)',
      },
    });

    if (!response.ok) {
      logger.warn('[OFF] Produit non trouvé:', barcode, response.status);
      return null;
    }

    const data = await response.json();
    
    if (data.status !== 1 || !data.product) {
      logger.warn('[OFF] Produit non trouvé dans la réponse:', barcode);
      return null;
    }

    const product = data.product as OffProduct;

    // Sauvegarder en cache
    try {
      await AsyncStorage.setItem(
        cacheKey,
        JSON.stringify({
          product,
          timestamp: Date.now(),
        })
      );
    } catch (cacheError) {
      logger.warn('[OFF] Erreur sauvegarde cache:', cacheError);
    }

    return product;
  } catch (error: any) {
    logger.error('[OFF] Erreur fetch produit:', error);
    return null;
  }
}

/**
 * Rechercher des produits par nom/marque
 * @param query Termes de recherche
 * @param options Options de pagination et langue
 */
export async function searchProducts(
  query: string,
  options: SearchOptions = {}
): Promise<OffSearchResult | null> {
  if (!query || query.trim().length === 0) {
    return null;
  }

  try {
    const { page = 1, page_size = 20, lang = 'fr' } = options;
    
    // URL de recherche
    const searchUrl = new URL(`${OFF_API_BASE}/search`);
    searchUrl.searchParams.set('search_terms', query);
    searchUrl.searchParams.set('page', page.toString());
    searchUrl.searchParams.set('page_size', page_size.toString());
    searchUrl.searchParams.set('fields', 'code,product_name,product_name_fr,brands,nutriments,nutriscore_grade,nova_group,image_url');
    if (lang) {
      searchUrl.searchParams.set('lang', lang);
    }

    logger.info('[OFF] Recherche:', query);
    const response = await fetch(searchUrl.toString(), {
      headers: {
        'User-Agent': 'FeedToki/1.0 (Nutrition Tracker)',
      },
    });

    if (!response.ok) {
      logger.warn('[OFF] Erreur recherche:', response.status);
      return null;
    }

    const data = await response.json();
    return data as OffSearchResult;
  } catch (error: any) {
    logger.error('[OFF] Erreur recherche:', error);
    return null;
  }
}

/**
 * Détecter les tags depuis un produit OFF
 */
function detectTagsFromOffProduct(product: OffProduct): FoodTag[] {
  const tags: FoodTag[] = [];
  
  const name = (product.product_name_fr || product.product_name || '').toLowerCase();
  const brands = (product.brands || '').toLowerCase();
  const nova = product.nova_group;
  const nutriscore = product.nutriscore_grade;

  // Utiliser Nova group (transformation industrielle)
  if (nova === 4) {
    tags.push('ultra_transforme');
  }
  
  // Utiliser Nutriscore pour estimer le type d'aliment
  if (nutriscore === 'a' || nutriscore === 'b') {
    // Bon score: probablement légumes, fruits, protéines
    if (name.includes('légume') || name.includes('vegetable') || name.includes('fruit')) {
      tags.push('legume');
    } else if (name.includes('poulet') || name.includes('chicken') || name.includes('poisson') || name.includes('fish')) {
      tags.push('proteine_maigre');
    }
  } else if (nutriscore === 'd' || nutriscore === 'e') {
    // Mauvais score: probablement transformé
    if (!tags.includes('ultra_transforme')) {
      tags.push('ultra_transforme');
    }
  }

  // Heuristiques basées sur le nom
  if (name.includes('sucre') || name.includes('sugar') || name.includes('bonbon') || name.includes('candy')) {
    tags.push('sucre');
  }
  if (name.includes('frit') || name.includes('fried') || name.includes('chips')) {
    tags.push('gras_frit');
  }
  if (name.includes('bière') || name.includes('beer') || name.includes('vin') || name.includes('wine') || name.includes('alcool')) {
    tags.push('alcool');
  }

  // Si aucun tag, utiliser feculent_simple par défaut
  if (tags.length === 0) {
    tags.push('feculent_simple');
  }

  return tags;
}

/**
 * Calculer la similarité entre deux chaînes (simple, basée sur les mots communs)
 */
function calculateNameSimilarity(query: string, productName: string): number {
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const productWords = productName.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  
  if (queryWords.length === 0 || productWords.length === 0) {
    return 0;
  }
  
  // Compter les mots communs
  const commonWords = queryWords.filter(qw => 
    productWords.some(pw => pw.includes(qw) || qw.includes(pw))
  );
  
  // Similarité basée sur le ratio de mots communs
  return commonWords.length / Math.max(queryWords.length, productWords.length);
}

/**
 * Valider un produit OFF avant de l'utiliser
 * @param product Produit à valider
 * @param query Requête de recherche originale
 * @returns true si le produit est valide, false sinon
 */
function isValidOffProduct(product: OffProduct, query: string): boolean {
  // 1. Vérifier les valeurs nutritionnelles
  const nutriments = product.nutriments || {};
  const calories = nutriments['energy-kcal_100g'] || 0;
  const protein = nutriments['proteins_100g'] || 0;
  const carbs = nutriments['carbohydrates_100g'] || 0;
  const fat = nutriments['fat_100g'] || 0;
  
  // Le produit doit avoir au moins des calories > 0 OU (protéines + glucides + lipides) > 0
  const hasValidNutrition = calories > 0 || (protein + carbs + fat) > 0;
  
  if (!hasValidNutrition) {
    logger.debug('[OFF] Produit rejeté: valeurs nutritionnelles invalides (tout à 0)', {
      productName: product.product_name_fr || product.product_name,
      query,
    });
    return false;
  }
  
  // 2. Vérifier la pertinence du nom
  const productName = product.product_name_fr || product.product_name || '';
  if (!productName) {
    logger.debug('[OFF] Produit rejeté: nom manquant', { query });
    return false;
  }
  
  // Calculer la similarité entre la requête et le nom du produit
  const similarity = calculateNameSimilarity(query, productName);
  
  // Seuil de similarité: au moins 30% des mots doivent correspondre
  // Pour les aliments génériques simples (1-2 mots), être plus strict
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const minSimilarity = queryWords.length <= 2 ? 0.5 : 0.3;
  
  if (similarity < minSimilarity) {
    logger.debug('[OFF] Produit rejeté: nom non pertinent', {
      query,
      productName,
      similarity: similarity.toFixed(2),
      minSimilarity,
    });
    return false;
  }
  
  // 3. Filtrer les produits avec des noms complètement différents
  // Ex: "sidi Ali" pour "pâte" ne devrait pas passer
  const productNameLower = productName.toLowerCase();
  const productWords = productNameLower.split(/\s+/).filter(w => w.length > 2);
  
  // Si la requête est très courte (1-2 mots) et le nom du produit est très différent, rejeter
  if (queryWords.length <= 2) {
    const hasCommonRoot = queryWords.some(qw => {
      // Vérifier si au moins un mot de la requête apparaît dans le nom du produit
      return productNameLower.includes(qw) || 
             productWords.some(pw => pw.includes(qw) || qw.includes(pw));
    });
    
    if (!hasCommonRoot) {
      logger.debug('[OFF] Produit rejeté: aucun mot commun avec la requête', {
        query,
        productName,
      });
      return false;
    }
  }
  
  return true;
}

/**
 * Calculer baseScore depuis les tags et nutriscore
 */
function calculateBaseScore(product: OffProduct, tags: FoodTag[]): number {
  const nutriscore = product.nutriscore_grade;
  
  // Utiliser Nutriscore comme base
  let score = 50; // Par défaut
  
  if (nutriscore === 'a') score = 85;
  else if (nutriscore === 'b') score = 70;
  else if (nutriscore === 'c') score = 50;
  else if (nutriscore === 'd') score = 30;
  else if (nutriscore === 'e') score = 15;
  
  // Ajustements selon tags
  if (tags.includes('proteine_maigre') || tags.includes('legume')) {
    score = Math.max(score, 70);
  } else if (tags.includes('ultra_transforme') || tags.includes('gras_frit')) {
    score = Math.min(score, 30);
  } else if (tags.includes('sucre')) {
    score = Math.min(score, 20);
  }

  return score;
}

/**
 * Mapper un produit OFF vers FoodItem
 * @param product Produit Open Food Facts
 * @returns FoodItem compatible avec la DB
 */
export function mapOffProductToFoodItem(product: OffProduct): FoodItem {
  const name = product.product_name_fr || product.product_name || `Produit ${product.code}`;
  const brandSuffix = product.brands ? ` (${product.brands})` : '';
  
  const tags = detectTagsFromOffProduct(product);
  const baseScore = calculateBaseScore(product, tags);
  
  // Nutriments (pour 100g)
  const nutriments = product.nutriments || {};
  const calories_kcal = nutriments['energy-kcal_100g'] || 0;
  const protein_g = nutriments['proteins_100g'] || 0;
  const carbs_g = nutriments['carbohydrates_100g'] || 0;
  const fat_g = nutriments['fat_100g'] || 0;

  // Calculer points basé sur les tags
  let points = 0;
  if (tags.includes('feculent_simple') || tags.includes('grain_complet')) {
    points = 2;
  } else if (tags.includes('ultra_transforme') || tags.includes('gras_frit')) {
    points = 4;
  } else if (tags.includes('sucre') || tags.includes('alcool')) {
    points = 5;
  } else if (tags.includes('proteine_maigre') || tags.includes('legume')) {
    points = 0;
  } else {
    points = 1;
  }

  return {
    id: `off_${product.code}`,
    name: `${name}${brandSuffix}`,
    tags,
    baseScore,
    protein_g: Math.round(protein_g * 10) / 10,
    carbs_g: Math.round(carbs_g * 10) / 10,
    fat_g: Math.round(fat_g * 10) / 10,
    calories_kcal: Math.round(calories_kcal),
    points,
  };
}

/**
 * Rechercher et mapper le meilleur produit correspondant
 * @param query Termes de recherche
 * @returns FoodItem du produit le plus pertinent et valide, ou null
 */
export async function searchAndMapBestProduct(query: string): Promise<FoodItem | null> {
  const searchResult = await searchProducts(query, { page_size: 10 });
  
  if (!searchResult || searchResult.products.length === 0) {
    logger.debug('[OFF] Aucun résultat de recherche pour:', query);
    return null;
  }

  // Parcourir les résultats et trouver le premier produit valide
  for (const product of searchResult.products) {
    if (isValidOffProduct(product, query)) {
      logger.info('[OFF] Produit valide trouvé:', {
        query,
        productName: product.product_name_fr || product.product_name,
        calories: product.nutriments?.['energy-kcal_100g'] || 0,
      });
      return mapOffProductToFoodItem(product);
    }
  }

  // Aucun produit valide trouvé
  logger.warn('[OFF] Aucun produit valide trouvé pour:', query, {
    totalResults: searchResult.products.length,
  });
  return null;
}

/**
 * Nettoyer le cache expiré
 */
export async function cleanExpiredCache(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter(key => key.startsWith(CACHE_PREFIX));
    
    let cleanedCount = 0;
    for (const key of cacheKeys) {
      try {
        const cachedRaw = await AsyncStorage.getItem(key);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          const age = Date.now() - cached.timestamp;
          if (age >= CACHE_DURATION_MS) {
            await AsyncStorage.removeItem(key);
            cleanedCount++;
          }
        }
      } catch (error) {
        // Ignorer les erreurs individuelles
      }
    }
    
    if (cleanedCount > 0) {
      logger.info(`[OFF] Cache nettoyé: ${cleanedCount} entrée(s) expirée(s)`);
    }
  } catch (error) {
    logger.warn('[OFF] Erreur nettoyage cache:', error);
  }
}
