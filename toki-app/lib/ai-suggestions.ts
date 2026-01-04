import { DailyNutritionTotals, NutritionTargets } from './nutrition';
import { SmartRecommendation } from './smart-recommendations';
import { FoodItem, FoodTag } from './food-db';
import { getDefaultPortion } from './portions';

export type AiSuggestionInput = {
  totals: DailyNutritionTotals;
  targets: NutritionTargets;
  availablePoints: number;
  tastePreference: 'sweet' | 'salty';
  timeOfDay: 'morning' | 'afternoon' | 'evening';
  consumedItems?: string[];
  caloriesRemaining?: number;
  caloriesPct?: number;
  pointsRemaining?: number;
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
  if (cat.includes('grain') || cat.includes('feculent')) return ['feculent_simple'];
  if (cat.includes('dessert') || cat.includes('sweet')) return ['dessert_sante'];
  return [];
}

export async function fetchSmartMealSuggestions({
  totals,
  targets,
  availablePoints,
  tastePreference,
  timeOfDay,
  consumedItems = [],
  caloriesRemaining,
  caloriesPct,
  pointsRemaining,
  signal,
}: AiSuggestionInput): Promise<SmartRecommendation[]> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key non configurée');
  }

  const system = `Tu es un coach nutrition enthousiaste et créatif. Tu proposes 5 à 8 suggestions VARIÉES et SAVOUREUSES qui rendent l'alimentation saine AGRÉABLE.

OBJECTIFS:
- Proposer des options à DIFFÉRENTS niveaux de points (0pt, 1-2pts, 3-5pts) pour donner du choix
- Inclure des RECETTES et COMBINAISONS créatives, pas juste des aliments isolés
- Rendre la nourriture EXCITANTE et APPÉTISSANTE, pas une punition
- Équilibrer santé ET plaisir

RÈGLES:
1. Propose 5-8 suggestions DIVERSES (pas toutes des légumes!)
2. Inclus AU MOINS:
   - 1-2 options à 0 points (légumes, fruits, protéines maigres)
   - 2-3 options protéinées savoureuses (poulet grillé, poisson, tofu mariné, shakes)
   - 1-2 options glucides sains (quinoa, patate douce, avoine, riz brun)
   - 1 dessert/collation santé si le moment s'y prête
3. Pour chaque suggestion, propose une PORTION RÉALISTE et APPÉTISSANTE
4. Si shake protéiné déjà consommé, ne pas en reproposer
5. Si calories >=100%, suggère eau/thé/boissons zéro calorie seulement
6. Respecte préférence goût (sucré/salé) et moment de la journée (matin/midi/soir)
7. Reste dans le budget de points disponible

EXEMPLES DE SUGGESTIONS CRÉATIVES:
- "Poulet grillé épicé cajun avec brocoli rôti à l'ail" (0pts, 280 cal)
- "Bol Buddha arc-en-ciel: quinoa + édamame + carottes + vinaigrette citron" (2pts, 420 cal)
- "Smoothie protéiné mangue-ananas avec graines de chia" (0pts, 200 cal)
- "Omelette aux légumes colorés avec fromage léger" (1pt, 220 cal)
- "Patate douce rôtie au four avec cannelle et un filet de miel" (2pts, 180 cal)

FORMAT DE RÉPONSE: JSON uniquement
{"suggestions":[{"name":"Nom appétissant","reason":"Pourquoi c'est délicieux ET nutritif","type":"meal|snack","taste":"sweet|salty","calories":250,"protein_g":30,"carbs_g":20,"fat_g":5,"points":0,"category":"protein|veggie|carb|dessert","portion":"Description visuelle","grams":150}]}
`;

  const user = {
    calories: totals.calories_kcal,
    protein_g: totals.protein_g,
    carbs_g: totals.carbs_g,
    fat_g: totals.fat_g,
    targets,
    caloriesRemaining: caloriesRemaining ?? Math.max(0, targets.calories_kcal - totals.calories_kcal),
    caloriesPct: caloriesPct ?? (targets.calories_kcal > 0 ? totals.calories_kcal / targets.calories_kcal : 0),
    pointsRemaining: pointsRemaining ?? availablePoints,
    tastePreference,
    timeOfDay,
    consumedItems,
  };

  const body = {
    model: 'gpt-4o-mini',
    temperature: 0.6,
    max_tokens: 800,
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

  let parsed: any;
  try {
    // Try to extract JSON if wrapped in markdown code blocks
    const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || content.match(/(\{[\s\S]*\})/);
    const jsonStr = jsonMatch ? jsonMatch[1] : content;
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    console.error('Failed to parse AI response:', content);
    throw new Error('Réponse IA invalide');
  }

  const suggestions = Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];
  if (!suggestions.length) return [];

  return suggestions.slice(0, 8).map((s: any, idx: number) => {
    const tags = mapCategoryToTags(s.category);
    const portion = getDefaultPortion(tags);
    const pointsCost = Number.isFinite(s.points) ? Math.max(0, Math.round(s.points)) : 0;
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
      points: pointsCost,
    };

    return {
      item,
      reason: s.reason || 'Suggestion personnalisée IA',
      priority: 5 - idx,
      pointsCost,
      suggestedGrams: Number.isFinite(s.grams) ? s.grams : portion.grams,
      suggestedVisualRef: s.portion || portion.visualRef,
      portion,
    } as SmartRecommendation;
  });
}
