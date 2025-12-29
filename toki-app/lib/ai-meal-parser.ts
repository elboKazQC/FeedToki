// Parsing IA des descriptions de repas
// Utilise des règles améliorées pour extraire les aliments depuis une description textuelle

export type ParsedFoodItem = {
  name: string;
  quantity?: string; // Ex: "200g", "1 tasse", "2 portions"
  quantityNumber?: number; // Nombre extrait (ex: 2 pour "2 toasts")
  category?: string; // Ex: "protein", "starch", "vegetable"
  confidence?: number; // 0-1, confiance du parsing
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

/**
 * Parser une description de repas avec IA améliorée
 * Utilise des règles améliorées pour détecter aliments, quantités et plats composés
 */
export async function parseMealDescription(
  description: string
): Promise<ParsedMealResult> {
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
      { keywords: ['boeuf', 'beef', 'bœuf'], name: 'Poulet' }, // Fallback, devrait être "Boeuf" si ajouté à DB
      { keywords: ['dinde', 'turkey'], name: 'Dinde' },
      { keywords: ['poisson', 'fish'], name: 'Poisson' },
      { keywords: ['saumon', 'salmon'], name: 'Poisson' },
      { keywords: ['oeuf', 'oeufs', 'egg', 'eggs'], name: 'Oeufs' },
      { keywords: ['tofu'], name: 'Tofu' },
      { keywords: ['yaourt', 'yogourt', 'yogurt'], name: 'Yogourt' },
      { keywords: ['fromage', 'cheese'], name: 'Fromage' },
      
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

    // Détecter les plats composés d'abord (priorité)
    let foundComposedDish = false;
    for (const dish of composedDishes) {
      if (dish.pattern.test(originalDesc)) {
        const qty = dish.extractQuantity ? dish.extractQuantity(originalDesc) : {};
        items.push({
          name: dish.name,
          quantity: qty.quantity,
          quantityNumber: qty.quantityNumber,
          confidence: 0.9,
        });
        foundComposedDish = true;
        // Ne pas chercher d'autres aliments si on a trouvé un plat composé unique
        // Sauf si la description contient "et" ou "," (plusieurs plats)
        if (!originalDesc.match(/\s+et\s+|\s*,\s*/i)) {
          return { items };
        }
      }
    }

    // Si pas de plat composé unique, chercher plusieurs aliments
    if (!foundComposedDish || originalDesc.match(/\s+et\s+|\s*,\s*/i)) {
      // Diviser la description par "et" ou ","
      const parts = originalDesc.split(/\s+et\s+|\s*,\s*/i).map(p => p.trim()).filter(p => p.length > 0);
      
      for (const part of parts.length > 1 ? parts : [originalDesc]) {
        // Chercher plats composés dans cette partie
        let partHasComposedDish = false;
        for (const dish of composedDishes) {
          if (dish.pattern.test(part)) {
            const qty = dish.extractQuantity ? dish.extractQuantity(part) : {};
            items.push({
              name: dish.name,
              quantity: qty.quantity,
              quantityNumber: qty.quantityNumber,
              confidence: 0.9,
            });
            partHasComposedDish = true;
            break;
          }
        }
        
        if (!partHasComposedDish) {
          // Chercher aliments simples dans cette partie
          for (const foodGroup of foodKeywords) {
            const hasKeyword = foodGroup.keywords.some(kw => 
              part.toLowerCase().includes(kw.toLowerCase())
            );
            
            if (hasKeyword) {
              // Vérifier qu'on ne l'a pas déjà ajouté
              const alreadyAdded = items.some(item => item.name === foodGroup.name);
              if (!alreadyAdded) {
                const qty = extractQuantity(part, foodGroup.name);
                items.push({
                  name: foodGroup.name,
                  quantity: qty.quantity,
                  quantityNumber: qty.quantityNumber,
                  confidence: 0.7,
                });
                break; // Un aliment par partie
              }
            }
          }
        }
      }
    }

    // Si aucun aliment détecté, retourner le texte complet comme un seul item
    if (items.length === 0) {
      items.push({
        name: originalDesc.trim(),
        confidence: 0.5,
      });
    }

    return {
      items,
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


