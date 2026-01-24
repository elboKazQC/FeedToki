// Parser OpenAI pour améliorer l'analyse des repas
// Utilise l'API OpenAI pour extraire les aliments d'une description textuelle

import { ParsedFoodItem, ParsedMealResult } from './ai-meal-parser';
import { checkUserAPILimit, incrementAPICall } from './api-rate-limit';
import { logger } from './logger';

/**
 * Extraire le code-barres (chiffres) d'une photo en utilisant OpenAI Vision
 * Fallback ultime quand les bibliothèques de décodage échouent
 */
export async function extractBarcodeWithOpenAI(
  photoBase64: string,
  userId?: string,
  userEmailVerified?: boolean
): Promise<string | null> {
  const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  
  try {
    logger.info('[OpenAI Parser] Tentative extraction code-barres avec OpenAI Vision...');
    
    if (!OPENAI_API_KEY) {
      logger.error('[OpenAI Parser] Clé API OpenAI manquante');
      return null;
    }

    // Vérifier que l'email est vérifié (si userId fourni)
    if (userId && userId !== 'guest' && userEmailVerified === false) {
      logger.warn('[OpenAI Parser] Email non vérifié, extraction bloquée');
      return null;
    }

    // Rate limiting côté client
    await waitForClientRateLimit();

    // Rate limiting par utilisateur dans Firestore (si userId fourni)
    if (userId && userId !== 'guest') {
      const canUse = await checkUserAPILimit(userId);
      if (!canUse) {
        logger.warn('[OpenAI Parser] Limite quotidienne atteinte pour extraction code-barres');
        return null;
      }
    }

    const prompt = `Tu es un expert en lecture de codes-barres. Analyse cette image et extrais UNIQUEMENT les chiffres du code-barres (EAN-13, EAN-8, UPC, etc.).

INSTRUCTIONS CRITIQUES:
1. Cherche une série de chiffres (généralement 8, 12, ou 13 chiffres)
2. Les chiffres sont souvent sous des barres verticales noires et blanches
3. Retourne UNIQUEMENT les chiffres, sans espaces ni tirets
4. Si tu vois plusieurs séries de chiffres, prends la plus longue (code-barres principal)
5. Si aucun code-barres n'est visible, réponds "AUCUN"

EXEMPLES:
- Si tu vois "3 017620 422003" → réponds "3017620422003"
- Si tu vois "8712100..." → réponds "8712100..."
- Si pas de code-barres → réponds "AUCUN"

Réponds UNIQUEMENT avec les chiffres ou "AUCUN", rien d'autre.`;

    logger.info('[OpenAI Parser] Envoi de la requête à OpenAI Vision...');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${photoBase64}`,
                  detail: 'high', // Haute résolution pour mieux lire les chiffres
                },
              },
            ],
          },
        ],
        max_tokens: 100,
        temperature: 0, // Température 0 pour réponse déterministe
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[OpenAI Parser] Erreur API OpenAI:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    const result = data.choices[0]?.message?.content?.trim() || '';
    logger.info('[OpenAI Parser] Réponse OpenAI:', result);

    // Incrémenter le compteur d'utilisation si userId fourni
    if (userId && userId !== 'guest') {
      await incrementAPICall(userId);
    }

    // Vérifier si c'est un code-barres valide (uniquement des chiffres)
    if (result === 'AUCUN' || result === '') {
      logger.warn('[OpenAI Parser] Aucun code-barres détecté par OpenAI');
      return null;
    }

    // Nettoyer la réponse (enlever espaces, tirets, etc.)
    const cleanedBarcode = result.replace(/[^0-9]/g, '');
    
    // Vérifier que c'est une longueur valide pour un code-barres (8, 12, ou 13 chiffres généralement)
    if (cleanedBarcode.length < 8 || cleanedBarcode.length > 14) {
      logger.warn('[OpenAI Parser] Code-barres invalide (longueur incorrecte):', cleanedBarcode.length);
      return null;
    }

    // Normaliser le code-barres (enlever zéros de tête si nécessaire)
    let normalized = cleanedBarcode;
    if (normalized.length === 14 && normalized.startsWith('0')) {
      normalized = normalized.substring(1);
    }
    if (normalized.length === 13 && normalized.startsWith('0')) {
      normalized = normalized.substring(1);
    }
    
    logger.info('[OpenAI Parser] ✅ Code-barres extrait avec succès:', { 
      original: cleanedBarcode, 
      normalized 
    });
    return normalized;
  } catch (error: any) {
    logger.error('[OpenAI Parser] Erreur extraction code-barres:', error?.message || String(error));
    return null;
  }
}

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
        model: 'gpt-4o', // GPT-4o pour des estimations caloriques plus précises
        messages: [
          {
            role: 'system',
            content: `Tu es un nutritionniste expert en estimation calorique. Analyse une description de repas et extrais les aliments avec leurs VALEURS NUTRITIONNELLES PRÉCISES.

MISSION PRINCIPALE: Fournir des estimations caloriques PRÉCISES pour un journal alimentaire de perte de poids.

EXTRACTION EXHAUSTIVE - RÈGLE CRITIQUE:
- Tu DOIS extraire TOUS les aliments mentionnés dans la description, sans exception
- Même si la description est longue et contient beaucoup d'aliments, tu dois tous les lister
- Les boissons (bières, vins, cocktails, jus, sodas, etc.) sont aussi des aliments à extraire avec leurs calories exactes
- Ne saute AUCUN aliment, même s'il est mentionné de manière implicite

ALIMENTS COMPOSÉS / GARNITURES:
- Si un aliment est décrit avec "avec", "au", "à la", "tartiné de", sépare les composants en items distincts
- Exemple: "2 toast à la confiture de fraise" → 2 items: "toast" + "confiture de fraise"
- Exemple: "pain beurre" → 2 items: "pain" + "beurre"
- Ne regroupe pas "toast à la confiture" en un seul item
- isComposite = true seulement si l'item est un plat composé (ex: sandwich, burger, poutine), pas pour les composants
- Si un nombre est donné pour la base, applique-le à la base; pour la garniture sans quantité, utilise une portion standard réaliste (ex: 1 c. à soupe par toast)

NEGATIONS:
- Si l'utilisateur dit "sans X", "pas de X", "no X", n'inclus pas X


ALIMENTS COMESTIBLES UNIQUEMENT:
- Ignore les objets non comestibles (pneus, clous, vis, etc.)
- Retourne UNIQUEMENT des aliments et boissons comestibles
- Si la description ne contient que des objets non comestibles, retourne: {"items": []}

BOISSONS ALCOOLISÉES - ESTIMATIONS PRÉCISES OBLIGATOIRES:
Tu DOIS connaître les calories exactes des boissons populaires:
- Bière standard (341ml/12oz): ~150 kcal
- Bière légère (341ml): ~100 kcal
- Bière forte/IPA (341ml): ~200 kcal
- Bière grande (500ml): ~220 kcal
- Vin rouge/blanc (150ml): ~125 kcal
- Vin rosé (150ml): ~120 kcal
- Vodka/Gin/Rhum (45ml shot): ~100 kcal
- Whisky/Cognac (45ml): ~105 kcal
- Cocktail moyen: ~200-300 kcal
- Margarita: ~280 kcal
- Piña Colada: ~490 kcal
- Mojito: ~220 kcal
- Sangria (200ml): ~150 kcal

MARQUES DE BIÈRES CONNUES:
- Budweiser (341ml): 145 kcal
- Heineken (341ml): 150 kcal
- Corona (341ml): 148 kcal
- Molson Canadian (341ml): 145 kcal
- Labatt Blue (341ml): 140 kcal
- Stella Artois (341ml): 154 kcal
- Guinness (500ml): 210 kcal
- Coors Light (341ml): 102 kcal
- Bud Light (341ml): 110 kcal

CATÉGORIES D'ALIMENTS:
1. PROTEINE_MAIGRE: Viandes maigres, poissons, oeufs, tofu, yaourt grec
2. LEGUME: Tous légumes et fruits
3. FECULENT_SIMPLE: Riz, pâtes, pain, patates, céréales
4. ULTRA_TRANSFORME: Fast-food, plats préparés, snacks industriels
5. GRAS_FRIT: Fritures, aliments panés/frits
6. SUCRE: Desserts, bonbons, boissons sucrées
7. ALCOOL: Bières, vins, spiritueux, cocktails

Retourne UNIQUEMENT un JSON valide avec cette structure:
{
  "items": [
    {
      "name": "nom de l'aliment (nom EXACT mentionné par l'utilisateur)",
      "quantity": "quantité avec unité (ex: '200g', '1 tasse', '341ml', '2 bouteilles')",
      "quantityNumber": nombre,
      "category": "PROTEINE_MAIGRE | LEGUME | FECULENT_SIMPLE | ULTRA_TRANSFORME | GRAS_FRIT | SUCRE | ALCOOL",
      "calories_kcal": nombre (CALORIES PRÉCISES pour la quantité indiquée),
      "protein_g": nombre,
      "carbs_g": nombre,
      "fat_g": nombre,
      "isComposite": boolean
    }
  ]
}

RÈGLES CRITIQUES:
- Le nom doit être EXACTEMENT ce que l'utilisateur a dit (pour les composants: réutilise les mots exacts présents, ex: "toast", "confiture de fraise")
- calories_kcal doit être pour LA QUANTITÉ TOTALE, pas pour 100g
- Si l'utilisateur dit "3 bières", calcule 3 x calories d'une bière
- Si l'utilisateur dit "un verre de vin", utilise une portion standard (150ml ≈ 125 kcal)
- Pour les quantités non spécifiées, utilise des portions standards réalistes

PORTIONS STANDARDS:
- Viande/poisson: 150g
- Légumes: 150g
- Riz/pâtes (cuit): 150g
- Pain: 1 tranche = 30g
- Bière standard: 341ml
- Vin: 150ml
- Spiritueux: 45ml

EXEMPLES:
- "3 bières" → calories_kcal: 450 (3 × 150)
- "verre de vin rouge" → calories_kcal: 125
- "2 shots de vodka" → calories_kcal: 200 (2 × 100)
- "poulet et riz" → 2 items: poulet (250 kcal) + riz (195 kcal)
- "2 toast à la confiture de fraise" → 2 items: toast (2 toasts) + confiture de fraise (1-2 c. à soupe)`,
          },
          {
            role: 'user',
            content: description,
          },
        ],
        temperature: 0.2, // Très faible température pour des estimations consistantes
        max_tokens: 3000,
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

