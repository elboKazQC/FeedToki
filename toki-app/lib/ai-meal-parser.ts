// Parsing IA des descriptions de repas
// Utilise OpenAI API pour extraire les aliments depuis une description textuelle

export type ParsedFoodItem = {
  name: string;
  quantity?: string; // Ex: "200g", "1 tasse", "2 portions"
  category?: string; // Ex: "protein", "starch", "vegetable"
  confidence?: number; // 0-1, confiance du parsing
};

export type ParsedMealResult = {
  items: ParsedFoodItem[];
  rawResponse?: string;
  error?: string;
};

/**
 * Parser une description de repas avec IA
 * Pour l'instant, utilise un parsing simple basé sur des règles
 * TODO: Intégrer OpenAI API quand nécessaire
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
    // Pour l'instant, parsing simple basé sur des règles
    // TODO: Remplacer par appel OpenAI API
    
    // Détecter les aliments mentionnés (mots-clés simples)
    const items: ParsedFoodItem[] = [];
    const lowerDesc = description.toLowerCase();
    
    // Liste de mots-clés communs pour détecter les aliments
    const foodKeywords = [
      'poulet', 'chicken', 'boeuf', 'beef', 'dinde', 'turkey',
      'poisson', 'fish', 'saumon', 'salmon',
      'riz', 'rice', 'pate', 'pasta', 'quinoa',
      'legume', 'vegetable', 'salade', 'salad', 'brocoli', 'broccoli',
      'pizza', 'burger', 'frite', 'fries', 'poutine',
      'beigne', 'donut', 'dessert',
      'biere', 'beer', 'vin', 'wine',
    ];

    // Détecter les mentions d'aliments
    for (const keyword of foodKeywords) {
      if (lowerDesc.includes(keyword)) {
        // Essayer d'extraire une quantité si mentionnée
        const quantityMatch = description.match(new RegExp(`(\\d+\\s*(g|kg|ml|tasse|portion|pc|piece))`, 'i'));
        const quantity = quantityMatch ? quantityMatch[1] : undefined;

        items.push({
          name: keyword,
          quantity,
          confidence: 0.7, // Confiance moyenne pour parsing simple
        });
      }
    }

    // Si aucun aliment détecté, retourner le texte complet comme un seul item
    if (items.length === 0) {
      items.push({
        name: description.trim(),
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

