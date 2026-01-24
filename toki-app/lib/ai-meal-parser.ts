// Parsing IA des descriptions de repas
// Utilise des règles améliorées pour extraire les aliments depuis une description textuelle

export type ParsedFoodItem = {
  name: string;
  quantity?: string; // Ex: "200g", "1 tasse", "2 portions"
  quantityNumber?: number; // Nombre extrait (ex: 2 pour "2 toasts")
  category?: string; // Ex: "PROTEINE_MAIGRE", "LEGUME", "FECULENT_SIMPLE"
  calories_kcal?: number; // Calories (pour 100g ou portion standard)
  protein_g?: number; // Protéines en grammes (pour 100g ou portion standard)
  carbs_g?: number; // Glucides en grammes (pour 100g ou portion standard)
  fat_g?: number; // Lipides en grammes (pour 100g ou portion standard)
  confidence?: number; // 0-1, confiance du parsing
  isComposite?: boolean; // true si c'est un plat composé, false si c'est un ingrédient simple
};

export type ParsedMealResult = {
  items: ParsedFoodItem[];
  rawResponse?: string;
  error?: string;
};

/**
 * Extraire une quantité depuis une description
 * Détecte: nombres, unités (g, kg, ml, tasse, portion, pc, piece, tranche, etc.)
 */
function extractQuantity(text: string, foodName: string): { quantity?: string; quantityNumber?: number } {
  const lowerText = text.toLowerCase();
  const lowerFoodName = foodName.toLowerCase();
  
  // Mots français pour nombres
  const frenchNumbers: Record<string, number> = {
    'un': 1, 'une': 1, 'deux': 2, 'trois': 3, 'quatre': 4, 'cinq': 5,
    'six': 6, 'sept': 7, 'huit': 8, 'neuf': 9, 'dix': 10,
  };

  // Patterns pour détecter les quantités (ordre important - plus spécifique d'abord)
  const quantityPatterns = [
    // "2 toasts", "3 portions de riz", "1 tasse de quinoa"
    {
      pattern: new RegExp(`(\\d+(?:\\.\\d+)?)\\s+(toast|toasts|portion|portions|tasse|tasses|tranche|tranches|pc|pieces|piece)\\s*(?:de|du|des|au|avec)?\\s*${lowerFoodName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'),
      extractUnit: (match: RegExpMatchArray) => match[2] || 'portions',
    },
    // "200g de poulet", "1 kg de riz", "500ml de bière"
    {
      pattern: new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(g|kg|ml|l|tasse|tasses|portion|portions|pc|pieces|tranche|tranches)\\s*(?:de|du|des)?\\s*${lowerFoodName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'),
      extractUnit: (match: RegExpMatchArray) => match[2] || 'g',
    },
    // "poulet 200g", "riz 1 tasse", "toasts 2"
    {
      pattern: new RegExp(`${lowerFoodName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+(\\d+(?:\\.\\d+)?)\\s*(g|kg|ml|l|tasse|tasses|portion|portions|pc|pieces|tranche|tranches|toast|toasts)?`, 'i'),
      extractUnit: (match: RegExpMatchArray) => match[2] || 'portions',
    },
    // "2x poulet", "3x riz"
    {
      pattern: new RegExp(`(\\d+)\\s*x\\s*${lowerFoodName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'),
      extractUnit: () => 'portions',
    },
  ];

  // Essayer les patterns avec nombres
  for (const { pattern, extractUnit } of quantityPatterns) {
    const match = text.match(pattern);
    if (match) {
      const number = parseFloat(match[1]);
      if (number && number > 0) {
        const unit = extractUnit(match);
        return {
          quantity: unit ? `${number} ${unit}` : `${number} ${number === 1 ? 'portion' : 'portions'}`,
          quantityNumber: number,
        };
      }
    }
  }

  // Chercher nombres français avant le nom de l'aliment
  for (const [word, num] of Object.entries(frenchNumbers)) {
    const pattern = new RegExp(`\\b${word}\\s+(?:de|du|des)?\\s*${lowerFoodName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
    if (pattern.test(lowerText)) {
      return {
        quantity: `${num} ${num === 1 ? 'portion' : 'portions'}`,
        quantityNumber: num,
      };
    }
  }

  // Chercher nombres français après le nom de l'aliment
  for (const [word, num] of Object.entries(frenchNumbers)) {
    const pattern = new RegExp(`${lowerFoodName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+${word}`, 'i');
    if (pattern.test(lowerText)) {
      return {
        quantity: `${num} ${num === 1 ? 'portion' : 'portions'}`,
        quantityNumber: num,
      };
    }
  }

  return {};
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isNegated(part: string, keywords: string[]): boolean {
  return keywords.some((keyword) => {
    const escaped = escapeRegex(keyword.toLowerCase());
    const pattern = new RegExp(
      `\\b(?:sans|pas de|pas d'|no|without)\\s+(?:la\\s+|le\\s+|les\\s+|du\\s+|de\\s+la\\s+|des\\s+)?${escaped}\\b`,
      'i'
    );
    return pattern.test(part);
  });
}

/**
 * Normaliser un nom d'aliment pour le dédoublonnage
 * Enlève accents, pluriels simples, et trim
 */
function normalizeForDeduplication(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[ç]/g, 'c')
    .replace(/s$/, ''); // Pluriel simple
}

/**
 * Parser une description de repas avec IA améliorée
 * Utilise OpenAI si disponible, sinon utilise des règles améliorées pour détecter aliments, quantités et plats composés
 */
export async function parseMealDescription(
  description: string,
  userId?: string,
  userEmailVerified?: boolean
): Promise<ParsedMealResult> {
  // 🔍 LOG: Mode de parsing utilisé
  const hasOpenAIKey = !!process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  console.log('[AI Parser] 🔍 Mode:', hasOpenAIKey ? 'OpenAI disponible' : 'Fallback (règles)', { description, hasOpenAIKey });
  
  // Essayer d'abord avec OpenAI si disponible
  if (hasOpenAIKey) {
    try {
      console.log('[AI Parser] 🤖 Tentative avec OpenAI...');
      const { parseMealWithOpenAI } = await import('./openai-parser');
      const result = await parseMealWithOpenAI(description, userId, userEmailVerified);
      if (result.items.length > 0 && !result.error) {
        console.log('[AI Parser] ✅ OpenAI succès:', result.items.length, 'items');
        return result; // Utiliser le résultat OpenAI si disponible
      }
      console.log('[AI Parser] ⚠️ OpenAI sans résultats, fallback aux règles');
      // Si OpenAI échoue mais qu'il n'y a pas d'erreur critique, continuer avec le parser basique
    } catch (error) {
      console.warn('[AI Parser] ❌ Erreur OpenAI, utilisation du parser basique:', error);
      // Continuer avec le parser basique en cas d'erreur
    }
  }

  // Parser basique (règles améliorées)
  console.log('[AI Parser] 📋 Utilisation du parser basique (règles)');
  if (!description || description.trim().length === 0) {
    return {
      items: [],
      error: 'Description vide',
    };
  }

  try {
    const items: ParsedFoodItem[] = [];
    const lowerDesc = description.toLowerCase();
    const originalDesc = description;
    
    // Liste étendue de mots-clés avec synonymes
    const foodKeywords = [
      // Protéines
      { keywords: ['poulet', 'chicken'], name: 'Poulet' },
      { keywords: ['boeuf', 'beef', 'bœuf'], name: 'Boeuf' }, // Corrigé: Boeuf (sera estimé si pas en DB)
      { keywords: ['dinde', 'turkey'], name: 'Dinde' },
      { keywords: ['poisson', 'fish'], name: 'Poisson' },
      { keywords: ['saumon', 'salmon'], name: 'Poisson' },
      { keywords: ['oeuf', 'oeufs', 'egg', 'eggs'], name: 'Oeufs' },
      { keywords: ['tofu'], name: 'Tofu' },
      { keywords: ['yaourt', 'yogourt', 'yogurt'], name: 'Yogourt' },
      { keywords: ['fromage', 'cheese'], name: 'Fromage' },
      { keywords: ['mayo', 'mayonnaise', 'mayonaise'], name: 'Mayonnaise' },
      { keywords: ['sandwich', 'sandwiche', 'panini'], name: 'Sandwich' },
      
      // Féculents
      { keywords: ['riz', 'rice'], name: 'Riz' },
      { keywords: ['pate', 'pasta', 'pâtes', 'macaroni'], name: 'Pâtes' },
      { keywords: ['patate', 'pomme de terre', 'potato'], name: 'Patate' },
      { keywords: ['toast', 'toasts', 'pain', 'bread'], name: 'Toasts' },
      { keywords: ['quinoa'], name: 'Quinoa' },
      { keywords: ['avoine', 'oatmeal', 'flocons'], name: "Flocons d'avoine" },
      
      // Légumes
      { keywords: ['legume', 'vegetable', 'légumes'], name: 'Légumes' },
      { keywords: ['salade', 'salad'], name: 'Salade verte' },
      { keywords: ['brocoli', 'broccoli'], name: 'Brocoli' },
      { keywords: ['chou-fleur', 'choufleur', 'cauliflower'], name: 'Chou-fleur' },
      { keywords: ['carotte', 'carottes', 'carrot'], name: 'Carottes' },
      { keywords: ['epinard', 'épinard', 'epinards', 'épinards', 'spinach'], name: 'Épinards' },
      { keywords: ['tomate', 'tomates', 'tomato'], name: 'Tomates' },
      { keywords: ['poivron', 'poivrons', 'pepper'], name: 'Poivrons' },
      { keywords: ['banane', 'banana'], name: 'Banane' },
      { keywords: ['pomme', 'apple'], name: 'Pomme' },
      { keywords: ['baie', 'baies', 'berry', 'berries'], name: 'Baies' },
      
      // Fast food / Cheats
      { keywords: ['pizza'], name: 'Pizza' },
      { keywords: ['burger', 'hamburger'], name: 'Burger' },
      { keywords: ['frite', 'frites', 'fries'], name: 'Frites' },
      { keywords: ['poutine'], name: 'Poutine moyenne (cassecroûte)' },
      { keywords: ['beigne', 'donut', 'doughnut'], name: 'Beigne (standard)' },
      { keywords: ['chips'], name: 'Chips' },
      
      // Boissons
      { keywords: ['biere', 'beer'], name: 'Bière blonde (355 ml)' },
      { keywords: ['vin', 'wine'], name: 'Alcool fort (45 ml, shot)' }, // Approximation
      
      // Plats libanais
      { keywords: ['cigare', 'cigar'], name: 'Cigare au chou' },
      { keywords: ['dolma'], name: 'Dolma (feuille de vigne)' },
      
      // Beurre et spreads
      { keywords: ['beurre', 'butter'], name: 'Toast au beurre' },
      { keywords: ['confiture', 'jam', 'marmelade', 'gelée'], name: 'Confiture' },
      { keywords: ['peanut', 'arachide', 'peanut butter', 'beurre de peanut', 'beurre de cacahuète'], name: 'Toast au beurre de peanut' },
    ];

    // Plats composés avec patterns améliorés (détection de quantités)
    const composedDishes = [
      { 
        pattern: /(\d+)?\s*(?:cigare|cigar)\s+au\s+chou/i, 
        name: 'Cigare au chou',
        extractQuantity: (text: string) => {
          const match = text.match(/(\d+)\s*(?:cigare|cigar)/i);
          return match ? { quantity: `${match[1]} ${match[1] !== '1' ? 'portions' : 'portion'}`, quantityNumber: parseInt(match[1]) } : {};
        }
      },
      { 
        pattern: /(\d+)?\s*dolma/i, 
        name: 'Dolma (feuille de vigne)',
        extractQuantity: (text: string) => {
          const match = text.match(/(\d+)\s*dolma/i);
          return match ? { quantity: `${match[1]} ${match[1] !== '1' ? 'portions' : 'portion'}`, quantityNumber: parseInt(match[1]) } : {};
        }
      },
      { 
        pattern: /(\d+)?\s*poutine\s+au\s+poulet/i, 
        name: 'Poutine au poulet frit',
        extractQuantity: (text: string) => {
          const match = text.match(/(\d+)\s*poutine/i);
          return match ? { quantity: `${match[1]} ${match[1] !== '1' ? 'portions' : 'portion'}`, quantityNumber: parseInt(match[1]) } : {};
        }
      },
      { 
        pattern: /(\d+)?\s*poutine\s+complète/i, 
        name: 'Poutine complète (bacon/œuf)',
        extractQuantity: (text: string) => {
          const match = text.match(/(\d+)\s*poutine/i);
          return match ? { quantity: `${match[1]} ${match[1] !== '1' ? 'portions' : 'portion'}`, quantityNumber: parseInt(match[1]) } : {};
        }
      },
      { 
        pattern: /(\d+)?\s*pâté\s+chinois/i, 
        name: 'Pâté Chinois',
        extractQuantity: (text: string) => {
          const match = text.match(/(\d+)\s*pâté/i);
          return match ? { quantity: `${match[1]} ${match[1] !== '1' ? 'portions' : 'portion'}`, quantityNumber: parseInt(match[1]) } : {};
        }
      },
      { 
        pattern: /(\d+)?\s*pate\s+chinois/i, 
        name: 'Pâté Chinois',
        extractQuantity: (text: string) => {
          const match = text.match(/(\d+)\s*pate/i);
          return match ? { quantity: `${match[1]} ${match[1] !== '1' ? 'portions' : 'portion'}`, quantityNumber: parseInt(match[1]) } : {};
        }
      },
      { 
        pattern: /(\d+|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)?\s*toasts?\s+(?:au|avec|de)\s+beurre\s+(?:de\s+)?(?:peanut|arachide|peanut butter)/i, 
        name: 'Toast au beurre de peanut',
        extractQuantity: (text: string) => {
          // Chercher nombre en chiffres
          const match = text.match(/(\d+)\s*toasts?/i);
          if (match) {
            const num = parseInt(match[1]);
            return { quantity: `${num} ${num !== 1 ? 'toasts' : 'toast'}`, quantityNumber: num };
          }
          // Chercher nombres français
          const frenchMatch = text.match(/(deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\s*toasts?/i);
          if (frenchMatch) {
            const nums: Record<string, number> = { 'deux': 2, 'trois': 3, 'quatre': 4, 'cinq': 5, 'six': 6, 'sept': 7, 'huit': 8, 'neuf': 9, 'dix': 10 };
            const num = nums[frenchMatch[1].toLowerCase()];
            if (num) {
              return { quantity: `${num} toasts`, quantityNumber: num };
            }
          }
          // Chercher "2x toast" ou similaire
          const xMatch = text.match(/(\d+)\s*x\s*toasts?/i);
          if (xMatch) {
            const num = parseInt(xMatch[1]);
            return { quantity: `${num} ${num !== 1 ? 'toasts' : 'toast'}`, quantityNumber: num };
          }
          return {};
        }
      },
      { 
        pattern: /(\d+|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)?\s*toasts?\s+(?:au|avec|de)\s+peanut/i, 
        name: 'Toast au beurre de peanut',
        extractQuantity: (text: string) => {
          const match = text.match(/(\d+)\s*toasts?/i);
          if (match) {
            const num = parseInt(match[1]);
            return { quantity: `${num} ${num !== 1 ? 'toasts' : 'toast'}`, quantityNumber: num };
          }
          const frenchMatch = text.match(/(deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\s*toasts?/i);
          if (frenchMatch) {
            const nums: Record<string, number> = { 'deux': 2, 'trois': 3, 'quatre': 4, 'cinq': 5, 'six': 6, 'sept': 7, 'huit': 8, 'neuf': 9, 'dix': 10 };
            const num = nums[frenchMatch[1].toLowerCase()];
            if (num) {
              return { quantity: `${num} toasts`, quantityNumber: num };
            }
          }
          const xMatch = text.match(/(\d+)\s*x\s*toasts?/i);
          if (xMatch) {
            const num = parseInt(xMatch[1]);
            return { quantity: `${num} ${num !== 1 ? 'toasts' : 'toast'}`, quantityNumber: num };
          }
          return {};
        }
      },
      { 
        pattern: /(\d+|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)?\s*toasts?\s+(?:au|avec|de)\s+beurre/i, 
        name: 'Toast au beurre',
        extractQuantity: (text: string) => {
          const match = text.match(/(\d+)\s*toasts?/i);
          if (match) {
            const num = parseInt(match[1]);
            return { quantity: `${num} ${num !== 1 ? 'toasts' : 'toast'}`, quantityNumber: num };
          }
          const frenchMatch = text.match(/(deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\s*toasts?/i);
          if (frenchMatch) {
            const nums: Record<string, number> = { 'deux': 2, 'trois': 3, 'quatre': 4, 'cinq': 5, 'six': 6, 'sept': 7, 'huit': 8, 'neuf': 9, 'dix': 10 };
            const num = nums[frenchMatch[1].toLowerCase()];
            if (num) {
              return { quantity: `${num} toasts`, quantityNumber: num };
            }
          }
          return {};
        }
      },
    ];

    // Diviser la description par connecteurs FR/EN (haute recall)
    // Connecteurs: et, and, puis, then, after, avec, with, virgule, point-virgule, saut de ligne
    const segmentPattern = /\s+(?:et|and|puis|then|after|avec|with|ensuite)\s+|\s*[,;]\s*|\n+/gi;
    const parts = originalDesc.split(segmentPattern).map(p => p.trim()).filter(p => p.length > 0);
    
    // Map pour dédoublonnage (clé normalisée -> item)
    const itemsMap = new Map<string, ParsedFoodItem>();
    
    for (const part of parts.length > 1 ? parts : [originalDesc]) {
      // 1. Chercher plats composés dans cette partie (priorité)
      let foundComposedDishInPart = false;
      for (const dish of composedDishes) {
        if (dish.pattern.test(part)) {
          const qty = dish.extractQuantity ? dish.extractQuantity(part) : {};
          const normalizedKey = normalizeForDeduplication(dish.name);
          
          // Ajouter si pas déjà présent
          if (!itemsMap.has(normalizedKey)) {
            itemsMap.set(normalizedKey, {
              name: dish.name,
              quantity: qty.quantity,
              quantityNumber: qty.quantityNumber,
              confidence: 0.9,
              isComposite: true,
            });
          }
          foundComposedDishInPart = true;
          // Ne pas break ici: continuer à chercher d'autres plats composés dans le même segment
        }
      }
      
      // 2. Chercher aliments simples dans cette partie (extraire TOUS, pas juste 1)
      // Si un plat composé a été trouvé, on cherche quand même d'autres aliments (ex: "pizza et salade")
      for (const foodGroup of foodKeywords) {
        const hasKeyword = foodGroup.keywords.some(kw => 
          part.toLowerCase().includes(kw.toLowerCase())
        );
        
        if (hasKeyword) {
          if (isNegated(part, foodGroup.keywords)) {
            continue;
          }
          const normalizedKey = normalizeForDeduplication(foodGroup.name);
          
          // Ajouter si pas déjà présent
          if (!itemsMap.has(normalizedKey)) {
            const qty = extractQuantity(part, foodGroup.name);
            itemsMap.set(normalizedKey, {
              name: foodGroup.name,
              quantity: qty.quantity,
              quantityNumber: qty.quantityNumber,
              confidence: 0.7,
              isComposite: false,
            });
          }
        }
      }
    }
    
    // Convertir la map en array
    items.push(...Array.from(itemsMap.values()));

    // === DÉCOMPOSITION DES PLATS COMPOSITES (ex: sandwich) ===
    // Si "sandwich au X avec Y et Z" est détecté, remplacer par ingrédients
    // IMPORTANT: Chercher dans la description ORIGINALE (avant segmentation) pour capturer tous les ingrédients
    const decomposedItems: ParsedFoodItem[] = [];
    const hasSandwich = items.some(item => item.name.toLowerCase().includes('sandwich'));
    
    if (hasSandwich) {
      // Chercher les ingrédients mentionnés dans la description ORIGINALE (pas segmentée)
      const sandwichIngredients = [
        { pattern: /\b(oeuf|œuf|egg)s?\b/i, name: 'Oeufs' },
        { pattern: /\b(mayo|mayonnaise)\b/i, name: 'Mayonnaise' },
        { pattern: /\b(fromage|cheese)\b/i, name: 'Fromage' },
        { pattern: /\b(tomate|tomato)s?\b/i, name: 'Tomates' },
        { pattern: /\b(laitue|salade verte|lettuce)\b/i, name: 'Salade verte' },
        { pattern: /\b(bacon)\b/i, name: 'Bacon' },
        { pattern: /\b(poulet|chicken)\b/i, name: 'Poulet' },
      ];
      
      const ingredientsList: ParsedFoodItem[] = [];
      for (const { pattern, name } of sandwichIngredients) {
        if (pattern.test(lowerDesc)) {
          ingredientsList.push({
            name,
            confidence: 0.85,
            isComposite: false,
          });
        }
      }
      
      // Si des ingrédients ont été trouvés, les utiliser au lieu du sandwich
      if (ingredientsList.length > 0) {
        // Ajouter pain automatiquement (toujours dans un sandwich)
        ingredientsList.push({
          name: 'Toasts',
          confidence: 0.8,
          isComposite: false,
        });
        
        // Remplacer tous les items "sandwich" par les ingrédients
        for (const item of items) {
          if (!item.name.toLowerCase().includes('sandwich')) {
            // Garder les items non-sandwich (déjà détectés)
            const normalized = normalizeForDeduplication(item.name);
            const isDuplicate = ingredientsList.some(ing => 
              normalizeForDeduplication(ing.name) === normalized
            );
            if (!isDuplicate) {
              decomposedItems.push(item);
            }
          }
        }
        
        // Ajouter les ingrédients du sandwich
        decomposedItems.push(...ingredientsList);
      } else {
        // Pas d'ingrédients détectés, garder tous les items tels quels
        decomposedItems.push(...items);
      }
    } else {
      // Pas de sandwich, garder tous les items
      decomposedItems.push(...items);
    }

    // Dédoublonnage (maintenant appliqué après décomposition)
    const deduped: ParsedFoodItem[] = [];
    const seen = new Set<string>();
    for (const item of decomposedItems) {
      const normalized = normalizeForDeduplication(item.name);
      if (!seen.has(normalized)) {
        seen.add(normalized);
        deduped.push(item);
      }
    }

    // Si aucun aliment détecté, retourner le texte complet comme un seul item
    if (deduped.length === 0) {
      deduped.push({
        name: originalDesc.trim(),
        confidence: 0.5,
      });
    }

    return {
      items: deduped,
      rawResponse: `Parsed ${deduped.length} items using fallback parser (with sandwich decomposition)`,
    };
  } catch (error: any) {
    return {
      items: [],
      error: error.message || 'Erreur lors du parsing',
    };
  }
}

/**
 * Parser avec OpenAI API (à implémenter quand API key disponible)
 */
export async function parseMealDescriptionWithOpenAI(
  description: string,
  apiKey?: string
): Promise<ParsedMealResult> {
  if (!apiKey) {
    // Fallback vers parsing simple
    return parseMealDescription(description);
  }

  try {
    // TODO: Implémenter appel OpenAI API
    // const response = await fetch('https://api.openai.com/v1/chat/completions', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${apiKey}`,
    //   },
    //   body: JSON.stringify({
    //     model: 'gpt-4o-mini',
    //     messages: [{
    //       role: 'system',
    //       content: 'Tu es un assistant nutritionnel. Extrais les aliments mentionnés dans la description. Retourne un JSON avec un tableau "items" contenant {name, quantity, category}.',
    //     }, {
    //       role: 'user',
    //       content: description,
    //     }],
    //   }),
    // });
    
    // Pour l'instant, fallback
    return parseMealDescription(description);
  } catch (error: any) {
    return {
      items: [],
      error: error.message || 'Erreur API OpenAI',
    };
  }
}

/**
 * Estimer les macros et points pour un aliment inconnu
 * (Réexport depuis nutrition-estimator pour cohérence)
 */
export { estimateNutritionForUnknownFood, createEstimatedFoodItem } from './nutrition-estimator';


