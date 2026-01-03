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

  const system = `Tu es un coach nutrition. Tu proposes 3 à 5 suggestions adaptées au contexte.
Règles critiques:
- Si les calories du jour sont déjà au plafond (>=100%), ne suggère PAS de nourriture, propose uniquement de boire de l'eau.
- Pas de doublon protéine: si un shake protéiné ou protéine a déjà été pris, évite d'en reproposer.
- Respecte la préférence goût (sucré/salé) et l'heure (matin/après-midi/soir) pour repas vs collation.
- Reste dans le budget de points disponible.
- INCLUS au moins 1-2 aliments à 0 points (légumes verts, concombre, salade, tomates, céleri, courgettes, épinards, etc.) pour donner des options sans impact sur les points.
- Réponds UNIQUEMENT en JSON compact: {"suggestions":[{...}]}
Champ suggestion: name, reason, type (meal|snack), taste (sweet|salty), calories, protein_g, carbs_g, fat_g, points, category (protein|veggie|carb|dessert), portion.
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
    max_tokens: 400,
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
    parsed = JSON.parse(content);
  } catch (err) {
    throw new Error('Réponse IA invalide');
  }

  const suggestions = Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];
  if (!suggestions.length) return [];

  return suggestions.slice(0, 5).map((s: any, idx: number) => {
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
