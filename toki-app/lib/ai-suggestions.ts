import { DailyNutritionTotals, NutritionTargets } from './nutrition';
import { SmartRecommendation } from './smart-recommendations';
import { FoodItem, FoodTag } from './food-db';
import { getDefaultPortion } from './portions';

export type AiSuggestionInput = {
  totals: DailyNutritionTotals;
  targets: NutritionTargets;
  tastePreference: 'sweet' | 'salty';
  timeOfDay: 'morning' | 'afternoon' | 'evening';
  consumedItems?: string[];
  caloriesRemaining?: number;
  caloriesPct?: number;
  signal?: AbortSignal;
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

function mapCategoryToTags(category?: string): FoodTag[] {
  if (!category) return [];
  const cat = category.toLowerCase();
  if (cat.includes('protein') || cat.includes('proteine') || cat.includes('lean')) return ['proteine_maigre'];
  if (cat.includes('legume') || cat.includes('veggie') || cat.includes('salad')) return ['legume'];
  if (cat.includes('grain') || cat.includes('feculent') || cat.includes('carb')) return ['feculent_simple'];
  if (cat.includes('dessert') || cat.includes('sweet')) return ['dessert_sante'];
  return [];
}

export async function fetchSmartMealSuggestions({
  totals,
  targets,
  tastePreference,
  timeOfDay,
  consumedItems = [],
  caloriesRemaining,
  caloriesPct,
  signal,
}: AiSuggestionInput): Promise<SmartRecommendation[]> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key non configurée');
  }

  const system = `Tu es un coach nutrition enthousiaste et creatif. Tu proposes 5 a 8 suggestions variees et savoureuses qui rendent l'alimentation saine agreable.

OBJECTIFS:
- Proposer des options a differents niveaux de calories (leger, moyen, plus complet) pour donner du choix
- Inclure des recettes et combinaisons creatives, pas juste des aliments isoles
- Rendre la nourriture excitante et appetissante, pas une punition
- Equilibrer sante ET plaisir

REGLES:
1. Propose 5-8 suggestions diverses (pas toutes des legumes!)
2. Inclus AU MOINS:
   - 1-2 options legeres (legumes, fruits, proteines maigres)
   - 2-3 options proteinees savoureuses (poulet grille, poisson, tofu marine, shakes)
   - 1-2 options glucides sains (quinoa, patate douce, avoine, riz brun)
   - 1 dessert/collation sante si le moment s'y prete
3. Pour chaque suggestion, propose une PORTION realiste et appetissante
4. Si shake proteine deja consomme, ne pas en reproposer
5. Si calories >=100%, suggere eau/the/boissons zero calorie seulement
6. Respecte preference gout (sucre/sale) et moment de la journee (matin/midi/soir)
7. Reste dans le budget calorique disponible

EXEMPLES DE SUGGESTIONS CREATIVES:
- "Poulet grille epice cajun avec brocoli roti a l'ail" (280 cal)
- "Bol Buddha arc-en-ciel: quinoa + edamame + carottes + vinaigrette citron" (420 cal)
- "Smoothie proteine mangue-ananas avec graines de chia" (200 cal)
- "Omelette aux legumes colores avec fromage leger" (220 cal)
- "Patate douce rotie au four avec cannelle et un filet de miel" (180 cal)

FORMAT DE REPONSE: JSON uniquement
{"suggestions":[{"name":"Nom appetissant","reason":"Pourquoi c'est delicieux ET nutritif","type":"meal|snack","taste":"sweet|salty","calories":250,"protein_g":30,"carbs_g":20,"fat_g":5,"category":"protein|veggie|carb|dessert","portion":"Description visuelle","grams":150}]}
`;



  const user = {
    calories: totals.calories_kcal,
    protein_g: totals.protein_g,
    carbs_g: totals.carbs_g,
    fat_g: totals.fat_g,
    targets,
    caloriesRemaining: caloriesRemaining ?? Math.max(0, targets.calories_kcal - totals.calories_kcal),
    caloriesPct: caloriesPct ?? (targets.calories_kcal > 0 ? totals.calories_kcal / targets.calories_kcal : 0),
    tastePreference,
    timeOfDay,
    consumedItems,
  };

  const body = {
    model: 'gpt-4o-mini',
    temperature: 0.6,
    max_tokens: 2000,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: JSON.stringify(user) },
    ],
  } as const;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`OpenAI API error: ${res.status}`);
  }

  const json = await res.json();
  const content: string = json?.choices?.[0]?.message?.content || '';
  const finishReason = json?.choices?.[0]?.finish_reason;

  let parsed: any;
  try {
    // Try to extract JSON if wrapped in markdown code blocks
    let jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || content.match(/(\{[\s\S]*\})/);
    let jsonStr = jsonMatch ? jsonMatch[1] : content;

    // If truncated (missing closing brace), try to recover by closing the JSON
    if (finishReason === 'length' || !jsonStr.trim().endsWith('}')) {
      console.warn('⚠️ AI response seems truncated, attempting to recover...');
      // Count opening vs closing braces to determine how many to add
      const openBraces = (jsonStr.match(/\{/g) || []).length;
      const closeBraces = (jsonStr.match(/\}/g) || []).length;
      const missingBraces = openBraces - closeBraces;
      
      // Remove any incomplete final entry (after last complete "}")
      const lastCompleteObjectIdx = jsonStr.lastIndexOf('}');
      if (lastCompleteObjectIdx > 0) {
        jsonStr = jsonStr.substring(0, lastCompleteObjectIdx + 1);
      }
      
      // Add missing closing braces
      for (let i = 0; i < missingBraces; i++) {
        jsonStr += '}';
      }
      
      console.log('🔧 Attempted recovery, trying parse again...');
    }

    parsed = JSON.parse(jsonStr);
  } catch (err) {
    console.error('❌ Failed to parse AI response:', content.substring(0, 500));
    console.error('Parse error:', err);
    throw new Error('Réponse IA invalide - augmentation des tokens recommandée');
  }

  const suggestions = Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];
  if (!suggestions.length) return [];

  // Map AI suggestions to SmartRecommendation objects
  const mappedSuggestions = suggestions.slice(0, 8).map((s: any, idx: number) => {
    const tags = mapCategoryToTags(s.category);
    const portion = getDefaultPortion(tags);
    const name = typeof s.name === 'string' && s.name.trim().length > 0 ? s.name.trim() : `Suggestion ${idx + 1}`;
    const item: FoodItem = {
      id: `ai_${slugify(name)}_${idx}`,
      name,
      tags: tags.length ? tags : ['proteine_maigre'],
      baseScore: 80,
      calories_kcal: Number.isFinite(s.calories) ? s.calories : 0,
      protein_g: Number.isFinite(s.protein_g) ? s.protein_g : 0,
      carbs_g: Number.isFinite(s.carbs_g) ? s.carbs_g : 0,
      fat_g: Number.isFinite(s.fat_g) ? s.fat_g : 0,
    };

    const suggestedGrams = Number.isFinite(s.grams) ? s.grams : portion.grams;

    return {
      item,
      reason: s.reason || 'Suggestion personnalisée IA',
      priority: 5 - idx,
      suggestedGrams,
      suggestedVisualRef: s.portion || portion.visualRef,
      portion,
      aiTaste: s.taste, // Conserver le goût suggéré par l'IA pour validation
    } as SmartRecommendation;
  });

  // CORRECTION 1: Filtrer les suggestions qui ne correspondent pas au goût demandé
  const filteredByTaste = mappedSuggestions.filter((rec: SmartRecommendation & { aiTaste?: string }) => {
    const aiTaste = rec.aiTaste;
    
    // Si l'IA n'a pas spécifié le goût, vérifier les tags
    if (!aiTaste || aiTaste === tastePreference) {
      // Vérifier si les tags correspondent au goût demandé
      const item = rec.item;
      if (tastePreference === 'sweet') {
        const isSweet = item.tags.includes('dessert_sante') || 
                       item.tags.includes('sucre') || 
                       item.id.includes('shake') ||
                       item.id.includes('fruit') ||
                       item.name.toLowerCase().includes('chocolat') ||
                       item.name.toLowerCase().includes('vanille');
        return aiTaste === 'sweet' || (!aiTaste && isSweet);
      } else if (tastePreference === 'salty') {
        const isSalty = item.tags.includes('proteine_maigre') ||
                       item.tags.includes('legume') ||
                       item.tags.includes('feculent_simple') ||
                       item.tags.includes('grain_complet') ||
                       (!item.tags.includes('sucre') && !item.tags.includes('dessert_sante'));
        return aiTaste === 'salty' || (!aiTaste && isSalty);
      }
    }
    return aiTaste === tastePreference;
  });

  return filteredByTaste;
}
