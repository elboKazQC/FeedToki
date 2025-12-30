// Parser OpenAI pour améliorer l'analyse des repas
// Utilise l'API OpenAI pour extraire les aliments d'une description textuelle

import { ParsedFoodItem, ParsedMealResult } from './ai-meal-parser';
import { checkUserAPILimit, incrementAPICall } from './api-rate-limit';
import { logger } from './logger';

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Rate limiting côté client (première ligne de défense)
const MAX_REQUESTS_PER_MINUTE = 10;
let requestCountInWindow = 0;
let lastRequestTime = Date.now();
let lastCallTimestamp = 0; // Timestamp du dernier appel (pour délai minimum)

// Log au chargement du module pour vérifier si la clé est détectée (dev seulement)
if (typeof window !== 'undefined' && __DEV__) {
  if (OPENAI_API_KEY) {
    console.log('[OpenAI] Clé API détectée (longueur:', OPENAI_API_KEY.length, 'caractères)');
  } else {
    console.warn('[OpenAI] Clé API non configurée. Le parser basique sera utilisé.');
  }
}

/**
 * Attendre si nécessaire pour respecter le rate limiting côté client
 */
async function waitForClientRateLimit(): Promise<void> {
  const now = Date.now();
  const timeElapsed = now - lastRequestTime;

  // Réinitialiser le compteur si plus d'une minute s'est écoulée
  if (timeElapsed > 60000) {
    requestCountInWindow = 0;
    lastRequestTime = now;
  }

  // Vérifier la limite par minute
  if (requestCountInWindow >= MAX_REQUESTS_PER_MINUTE) {
    const timeToWait = 60000 - timeElapsed;
    logger.warn(`[OpenAI] Limite côté client atteinte. Attente de ${Math.ceil(timeToWait / 1000)}s.`);
    await new Promise(resolve => setTimeout(resolve, timeToWait + 1000));
    requestCountInWindow = 0;
    lastRequestTime = Date.now();
  }

  // Vérifier le délai minimum entre appels (2 secondes)
  const timeSinceLastCall = now - lastCallTimestamp;
  if (lastCallTimestamp > 0 && timeSinceLastCall < 2000) {
    const waitTime = 2000 - timeSinceLastCall;
    logger.warn(`[OpenAI] Délai minimum entre appels: ${Math.ceil(waitTime / 1000)}s`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  requestCountInWindow++;
  lastCallTimestamp = Date.now();
}

/**
 * Parser une description de repas avec OpenAI
 * Retourne une liste structurée d'aliments avec quantités
 * 
 * @param description Description du repas à parser
 * @param userId ID de l'utilisateur (optionnel, requis pour rate limiting)
 * @param userEmailVerified Vérification que l'email est vérifié (optionnel, requis pour utilisation)
 */
export async function parseMealWithOpenAI(
  description: string,
  userId?: string,
  userEmailVerified?: boolean
): Promise<ParsedMealResult> {
  if (!OPENAI_API_KEY) {
    logger.warn('[OpenAI] Appel bloqué: clé API non configurée');
    return {
      items: [],
      error: 'Clé API OpenAI non configurée. Utilisation du parser basique.',
    };
  }

  if (!description || description.trim().length === 0) {
    return {
      items: [],
      error: 'Description vide',
    };
  }

  // Vérifier que l'email est vérifié (si userId fourni)
  if (userId && userId !== 'guest' && userEmailVerified === false) {
    return {
      items: [],
      error: 'Veuillez vérifier votre adresse email avant d\'utiliser l\'analyse IA. Consultez vos emails pour le lien de vérification.',
    };
  }

  // Rate limiting côté client (première ligne de défense)
  await waitForClientRateLimit();

  // Rate limiting par utilisateur dans Firestore (si userId fourni)
  if (userId && userId !== 'guest') {
    const limitCheck = await checkUserAPILimit(userId);
    if (!limitCheck.allowed) {
      return {
        items: [],
        error: limitCheck.reason || 'Limite d\'appels API atteinte. Réessayez plus tard.',
      };
    }
  }

  try {
    logger.info('[OpenAI] Envoi de la requête pour:', description.substring(0, 50) + '...');
    
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Modèle rapide et économique
        messages: [
          {
            role: 'system',
            content: `Tu es un expert en nutrition et classification d'aliments. Analyse une description de repas et extrais les aliments avec leurs quantités ET leurs catégories nutritionnelles.

SYSTÈME DE POINTS (très important pour classification):
- Protéines maigres (0 points): poulet, dinde, poisson, saumon, oeufs, tofu, boeuf, steak, viande rouge maigre, steak haché, hamburger (la viande seule), bâtonnets de viande
- Légumes et fruits (0 points): tous les légumes, salade, brocoli, carottes, tomates, pommes, bananes, baies, etc.
- Féculents simples (coûtent des points): riz, pâtes, patates, pain, quinoa (environ 1-2 points par portion)
- Ultra-transformés (coûtent plus): pizza, frites, chips, saucisses industrielles, plats préparés
- Aliments frits ou gras (coûtent plus): frites, aliments panés/frits
- Sucreries (coûtent plus): desserts, bonbons, gâteaux, boissons sucrées

RÈGLES DE CLASSIFICATION:
1. Le steak, boeuf, steak haché, viande hachée = PROTEINE_MAIGRE (0 points)
2. Tous les légumes et fruits = LEGUME (0 points)
3. Riz, pâtes, patates = FECULENT_SIMPLE (coûtent des points)
4. Aliments transformés/frits = ULTRA_TRANSFORME ou GRAS_FRIT (coûtent plus)

Retourne UNIQUEMENT un JSON valide avec cette structure:
{
  "items": [
    {
      "name": "nom de l'aliment en français (utilise le nom EXACT tel que mentionné par l'utilisateur)",
      "quantity": "quantité avec unité (ex: '200g', '1 tasse', '2 portions', '1/3 sachet')",
      "quantityNumber": nombre (convertir les fractions, ex: 0.33 pour 1/3),
      "category": "PROTEINE_MAIGRE | LEGUME | FECULENT_SIMPLE | ULTRA_TRANSFORME | GRAS_FRIT | SUCRE",
      "calories_kcal": nombre (calories pour 100g ou pour la portion standard),
      "protein_g": nombre (protéines en grammes pour 100g ou portion standard),
      "carbs_g": nombre (glucides en grammes pour 100g ou portion standard),
      "fat_g": nombre (lipides en grammes pour 100g ou portion standard),
      "isComposite": boolean (true si c'est un plat composé comme "toast au beurre de peanut", false si c'est un ingrédient simple comme "beurre de peanut")
    }
  ]
}

RÈGLES CRITIQUES pour "name":
- Si l'utilisateur dit "beurre de peanut", le nom doit être EXACTEMENT "beurre de peanut" (PAS "toast au beurre de peanut")
- Si l'utilisateur dit "toast au beurre de peanut", le nom doit être EXACTEMENT "toast au beurre de peanut"
- Si l'utilisateur dit "pain carbone", le nom doit être EXACTEMENT "pain carbone" (PAS "toast au pain carbone")
- NE PAS ajouter de mots qui ne sont pas dans la description originale de l'utilisateur
- NE PAS modifier le nom original sauf pour corriger les fautes d'orthographe mineures
- isComposite = true uniquement si l'aliment mentionné est un PLAT COMPOSÉ contenant plusieurs ingrédients assemblés (ex: "toast au beurre de peanut", "pizza", "burger")
- isComposite = false pour les ingrédients simples ou aliments de base (ex: "beurre de peanut", "pain", "poulet", "riz")

IMPORTANT - Valeurs nutritionnelles:
- Fournis TOUJOURS les valeurs nutritionnelles (calories, protéines, glucides, lipides)
- Les valeurs doivent être réalistes et cohérentes avec le type d'aliment
- Pour les portions, ajuste les valeurs selon la quantité mentionnée (ex: 1/3 sachet de riz = environ 67g de riz cuit)
- Utilise des valeurs standards pour 100g d'aliment cru/brut quand possible

EXEMPLES:
- "steak haché" → {
    "name": "steak haché",
    "quantity": "1 portion",
    "quantityNumber": 1,
    "category": "PROTEINE_MAIGRE",
    "calories_kcal": 250,
    "protein_g": 26,
    "carbs_g": 0,
    "fat_g": 15
  }
- "riz" → {
    "name": "riz",
    "quantity": "1/3 sachet",
    "quantityNumber": 0.33,
    "category": "FECULENT_SIMPLE",
    "calories_kcal": 130,
    "protein_g": 3,
    "carbs_g": 28,
    "fat_g": 0.3
  }
- "poulet 200g" → {
    "name": "poulet",
    "quantity": "200g",
    "quantityNumber": 200,
    "category": "PROTEINE_MAIGRE",
    "calories_kcal": 330,
    "protein_g": 60,
    "carbs_g": 0,
    "fat_g": 7
  }
- "brocoli" → {
    "name": "brocoli",
    "quantity": "1 portion",
    "quantityNumber": 1,
    "category": "LEGUME",
    "calories_kcal": 55,
    "protein_g": 3,
    "carbs_g": 6,
    "fat_g": 0.4
  }
- "2 toast au beurre de peanut" → {
    "name": "toast au beurre de peanut",
    "quantity": "2 toasts",
    "quantityNumber": 2,
    "category": "FECULENT_SIMPLE",
    "calories_kcal": 390,
    "protein_g": 16,
    "carbs_g": 46,
    "fat_g": 20
  }
- "2 toast du pain carbone au beurre de peanut kraft" → {
    "items": [
      {
        "name": "pain carbone",
        "quantity": "2 toasts",
        "quantityNumber": 2,
        "category": "FECULENT_SIMPLE",
        "calories_kcal": 80,
        "protein_g": 8,
        "carbs_g": 30,
        "fat_g": 2,
        "isComposite": false
      },
      {
        "name": "beurre de peanut",
        "quantity": "1 portion",
        "quantityNumber": 1,
        "category": "FECULENT_SIMPLE",
        "calories_kcal": 190,
        "protein_g": 8,
        "carbs_g": 6,
        "fat_g": 16,
        "isComposite": false
      }
    ]
  }
- "beurre de peanut kraft" → {
    "items": [
      {
        "name": "beurre de peanut",
        "quantity": "1 portion",
        "quantityNumber": 1,
        "category": "FECULENT_SIMPLE",
        "calories_kcal": 190,
        "protein_g": 8,
        "carbs_g": 6,
        "fat_g": 16,
        "isComposite": false
      }
    ]
  }
- "beurre de peanut" → {
    "items": [
      {
        "name": "beurre de peanut",
        "quantity": "1 portion",
        "quantityNumber": 1,
        "category": "FECULENT_SIMPLE",
        "calories_kcal": 190,
        "protein_g": 8,
        "carbs_g": 6,
        "fat_g": 16,
        "isComposite": false
      }
    ]
  }
- "toast au beurre de peanut" → {
    "items": [
      {
        "name": "toast au beurre de peanut",
        "quantity": "1 portion",
        "quantityNumber": 1,
        "category": "FECULENT_SIMPLE",
        "calories_kcal": 390,
        "protein_g": 16,
        "carbs_g": 46,
        "fat_g": 20,
        "isComposite": true
      }
    ]
  }
- "toast au beurre" → {
    "name": "toast au beurre",
    "quantity": "1 toast",
    "quantityNumber": 1,
    "category": "FECULENT_SIMPLE",
    "calories_kcal": 180,
    "protein_g": 4,
    "carbs_g": 25,
    "fat_g": 8
  }

Règles importantes:
- Extrais TOUS les aliments mentionnés dans la description
- Pour les quantités, utilise des unités standard: g, kg, ml, tasse, portion, pc, piece, tranche, sachet
- Si aucune quantité n'est mentionnée, utilise "1 portion" et quantityNumber: 1
- Pour les plats composés (ex: "steak et riz"), liste chaque composant séparément
- CLASSIFIE CORRECTEMENT selon le système de points ci-dessus
- Retourne UNIQUEMENT le JSON, sans texte supplémentaire`,
          },
          {
            role: 'user',
            content: description,
          },
        ],
        temperature: 0.3, // Faible température pour plus de consistance
        max_tokens: 500,
      }),
    });

    // Incrémenter le compteur d'appels après l'appel réussi (si userId fourni)
    if (userId && userId !== 'guest') {
      await incrementAPICall(userId).catch(err => {
        logger.warn('[OpenAI] Erreur incrément compteur:', err);
      });
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error('[OpenAI] Erreur API:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      });
      
      // Gestion d'erreurs spécifiques avec retry pour 429
      let errorMessage = `Erreur API OpenAI: ${response.status} ${response.statusText}`;
      
      if (response.status === 401) {
        errorMessage = 'Erreur d\'authentification: Clé API OpenAI invalide ou expirée.';
      } else if (response.status === 429) {
        // Gérer les rate limits avec backoff exponentiel
        const retryAfter = response.headers.get('Retry-After');
        if (retryAfter) {
          const delay = parseInt(retryAfter) * 1000;
          errorMessage = `Limite de taux dépassée. Réessayez dans ${Math.ceil(delay / 1000)} seconde(s).`;
        } else {
          errorMessage = 'Limite de taux dépassée: Trop de requêtes à l\'API OpenAI. Réessayez dans quelques instants.';
        }
      } else if (response.status >= 500) {
        errorMessage = 'Erreur serveur OpenAI: Le service est temporairement indisponible.';
      } else if (errorData?.error?.message) {
        errorMessage = `Erreur OpenAI: ${errorData.error.message}`;
      }
      
      return {
        items: [],
        error: errorMessage,
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      logger.error('[OpenAI] Réponse invalide: pas de contenu dans choices[0].message');
      return {
        items: [],
        error: 'Réponse OpenAI invalide: aucun contenu retourné',
      };
    }

    if (__DEV__) {
      logger.debug('[OpenAI] Réponse reçue, longueur:', content.length, 'caractères');
    }

    // Extraire le JSON de la réponse (au cas où il y aurait du texte autour)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.error('[OpenAI] Format invalide: aucun JSON trouvé dans la réponse');
      logger.error('[OpenAI] Contenu reçu:', content.substring(0, 200));
      return {
        items: [],
        error: 'Format de réponse OpenAI invalide: aucun JSON détecté',
      };
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseError: any) {
      logger.error('[OpenAI] Erreur parsing JSON:', parseError);
      logger.error('[OpenAI] JSON extrait:', jsonMatch[0].substring(0, 200));
      return {
        items: [],
        error: `Erreur parsing JSON OpenAI: ${parseError.message}`,
      };
    }
    
    if (!parsed.items || !Array.isArray(parsed.items)) {
      logger.error('[OpenAI] Format JSON invalide: items manquant ou n\'est pas un tableau');
      logger.error('[OpenAI] Objet parsé:', parsed);
      return {
        items: [],
        error: 'Format JSON OpenAI invalide: items manquant ou invalide',
      };
    }

    if (__DEV__) {
      logger.debug('[OpenAI] ✅ Parsing réussi:', parsed.items.length, 'aliment(s) détecté(s)');
    }

    // Convertir les items en format ParsedFoodItem
    const items: ParsedFoodItem[] = parsed.items.map((item: any) => ({
      name: item.name || '',
      quantity: item.quantity || '1 portion',
      quantityNumber: item.quantityNumber || 1,
      confidence: 0.9, // Haute confiance pour OpenAI
      category: item.category || undefined, // Catégorie retournée par OpenAI
      calories_kcal: typeof item.calories_kcal === 'number' ? item.calories_kcal : undefined,
      protein_g: typeof item.protein_g === 'number' ? item.protein_g : undefined,
      carbs_g: typeof item.carbs_g === 'number' ? item.carbs_g : undefined,
      fat_g: typeof item.fat_g === 'number' ? item.fat_g : undefined,
      isComposite: typeof item.isComposite === 'boolean' ? item.isComposite : undefined,
    }));

    return {
      items,
      rawResponse: content,
    };
  } catch (error: any) {
    // Distinguer les types d'erreurs
    if (error instanceof TypeError && error.message.includes('fetch')) {
      logger.error('[OpenAI] Erreur réseau:', error);
      return {
        items: [],
        error: 'Erreur réseau: Impossible de contacter l\'API OpenAI. Vérifiez votre connexion internet.',
      };
    }
    
    logger.error('[OpenAI] Erreur inattendue:', error);
    return {
      items: [],
      error: `Erreur lors de l'appel OpenAI: ${error.message || 'Erreur inconnue'}`,
    };
  }
}

/**
 * Parser une photo de repas avec OpenAI (vision)
 * - photoBase64: base64 JPEG/PNG sans préfixe
 */
export async function parseMealPhotoWithOpenAI(
  photoBase64: string,
  userId?: string,
  userEmailVerified?: boolean
): Promise<ParsedMealResult> {
  if (!OPENAI_API_KEY) {
    logger.warn('[OpenAI] Appel photo bloqué: clé API non configurée');
    return {
      items: [],
      error: 'Clé API OpenAI non configurée. Utilisation du parser texte uniquement.',
    };
  }

  if (!photoBase64 || photoBase64.trim().length === 0) {
    return {
      items: [],
      error: 'Photo vide',
    };
  }

  // Vérifier que l'email est vérifié (si userId fourni)
  if (userId && userId !== 'guest' && userEmailVerified === false) {
    return {
      items: [],
      error: 'Veuillez vérifier votre adresse email avant d\'utiliser l\'analyse IA. Consultez vos emails pour le lien de vérification.',
    };
  }

  // Rate limiting côté client
  await waitForClientRateLimit();

  // Rate limiting Firestore par utilisateur
  if (userId && userId !== 'guest') {
    const limitCheck = await checkUserAPILimit(userId);
    if (!limitCheck.allowed) {
      return {
        items: [],
        error: limitCheck.reason || 'Limite d\'appels API atteinte. Réessayez plus tard.',
      };
    }
  }

  try {
    logger.info('[OpenAI] Envoi requête photo (vision)');

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Tu es un expert en nutrition. Analyse une PHOTO de repas et extrais tous les aliments visibles/identifiables avec leurs quantités estimées.\n\nRetourne UNIQUEMENT un JSON valide avec cette structure:\n{\n  \"items\": [\n    {\n      \"name\": \"nom de l'aliment en français\",\n      \"quantity\": \"quantité avec unité (ex: '200g', '1 portion', '2 oeufs')\",\n      \"quantityNumber\": nombre,\n      \"category\": \"PROTEINE_MAIGRE | LEGUME | FECULENT_SIMPLE | ULTRA_TRANSFORME | GRAS_FRIT | SUCRE\",\n      \"calories_kcal\": nombre,\n      \"protein_g\": nombre,\n      \"carbs_g\": nombre,\n      \"fat_g\": nombre,\n      \"isComposite\": boolean\n    }\n  ]\n}\n\nRÈGLES:\n- JSON seulement (pas de texte, pas de markdown)\n- Sois conservateur si l'image est floue: préfère moins d'items plutôt que d'inventer\n- Si la quantité est inconnue: utilise \"1 portion\" et quantityNumber=1\n- Toujours fournir calories/protéines/glucides/lipides (estimations réalistes)\n`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyse cette photo de repas et retourne le JSON demandé.',
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${photoBase64}`,
                },
              },
            ],
          },
        ],
        temperature: 0.2,
      }),
    });

    // Incrémenter compteur Firestore si userId
    if (userId && userId !== 'guest') {
      try {
        await incrementAPICall(userId);
      } catch (e) {
        logger.warn('[OpenAI] Impossible d\'incrémenter le compteur API:', e);
      }
    }

    if (!response.ok) {
      let errorData: any = null;
      try {
        errorData = await response.json();
      } catch {}

      let errorMessage = `Erreur OpenAI (photo): ${response.status}`;
      if (response.status === 401) {
        errorMessage = 'Erreur d\'authentification: Clé API OpenAI invalide ou expirée.';
      } else if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        if (retryAfter) {
          const delay = parseInt(retryAfter) * 1000;
          errorMessage = `Limite de taux dépassée. Réessayez dans ${Math.ceil(delay / 1000)} seconde(s).`;
        } else {
          errorMessage = 'Limite de taux dépassée: Trop de requêtes à l\'API OpenAI. Réessayez dans quelques instants.';
        }
      } else if (response.status >= 500) {
        errorMessage = 'Erreur serveur OpenAI: Le service est temporairement indisponible.';
      } else if (errorData?.error?.message) {
        errorMessage = `Erreur OpenAI: ${errorData.error.message}`;
      }

      return {
        items: [],
        error: errorMessage,
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      logger.error('[OpenAI] Réponse invalide (photo): pas de contenu');
      return { items: [], error: 'Réponse OpenAI invalide: aucun contenu retourné' };
    }

    if (__DEV__) {
      logger.debug('[OpenAI] Réponse photo reçue, longueur:', content.length, 'caractères');
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.error('[OpenAI] Format invalide (photo): aucun JSON trouvé');
      return { items: [], error: 'Format de réponse OpenAI invalide: aucun JSON détecté' };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseError: any) {
      logger.error('[OpenAI] Erreur parsing JSON (photo):', parseError);
      return { items: [], error: `Erreur parsing JSON OpenAI: ${parseError.message}` };
    }

    if (!parsed.items || !Array.isArray(parsed.items)) {
      logger.error('[OpenAI] Format JSON invalide (photo): items manquant');
      return { items: [], error: 'Format JSON OpenAI invalide: items manquant ou invalide' };
    }

    const items: ParsedFoodItem[] = parsed.items.map((item: any) => ({
      name: item.name || '',
      quantity: item.quantity || '1 portion',
      quantityNumber: item.quantityNumber || 1,
      confidence: 0.9,
      category: item.category || undefined,
      calories_kcal: typeof item.calories_kcal === 'number' ? item.calories_kcal : undefined,
      protein_g: typeof item.protein_g === 'number' ? item.protein_g : undefined,
      carbs_g: typeof item.carbs_g === 'number' ? item.carbs_g : undefined,
      fat_g: typeof item.fat_g === 'number' ? item.fat_g : undefined,
      isComposite: typeof item.isComposite === 'boolean' ? item.isComposite : undefined,
    }));

    return { items, rawResponse: content };
  } catch (error: any) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      logger.error('[OpenAI] Erreur réseau (photo):', error);
      return {
        items: [],
        error: 'Erreur réseau: Impossible de contacter l\'API OpenAI. Vérifiez votre connexion internet.',
      };
    }

    logger.error('[OpenAI] Erreur inattendue (photo):', error);
    return {
      items: [],
      error: `Erreur lors de l'appel OpenAI (photo): ${error.message || 'Erreur inconnue'}`,
    };
  }
}

