import { DailyNutritionTotals, NutritionTargets } from './nutrition';

export type NutritionPeriodDays = 7 | 14 | 30;

export type DailySummary = {
  date: string; // YYYY-MM-DD
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  mealsCount: number;
};

export type NutritionInsight = {
  type: 'positive' | 'challenge' | 'pattern';
  icon: string;
  title: string;
  message: string;
};

export type NutritionRecommendation = {
  priority: number; // 1-3 (1 = highest)
  icon: string;
  action: string;
  reason: string;
  impact: string; // e.g., "Pourrait réduire 200 cal/jour"
};

export type NutritionAnalysisResult = {
  periodDays: NutritionPeriodDays;
  periodStart: string; // ISO date
  periodEnd: string; // ISO date
  dailySummaries: DailySummary[];
  insights: NutritionInsight[];
  recommendations: NutritionRecommendation[];
  overallScore: number; // 0-100
  averages: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    mealsPerDay: number;
    consistency: number; // % of days with meals logged
  };
};

export type AnalyzeNutritionInput = {
  dailySummaries: DailySummary[];
  targets: NutritionTargets;
  periodDays: NutritionPeriodDays;
  signal?: AbortSignal;
};

/**
 * Analyzes nutrition patterns over a multi-day period using AI coaching
 * @param input - Daily summaries, targets, and period configuration
 * @returns AI-generated insights, recommendations, and overall nutrition score
 */
export async function analyzeNutritionPeriod({
  dailySummaries,
  targets,
  periodDays,
  signal,
}: AnalyzeNutritionInput): Promise<NutritionAnalysisResult> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key non configurée');
  }

  // Calculate averages
  const daysWithMeals = dailySummaries.filter((d) => d.mealsCount > 0);
  const totalDays = dailySummaries.length;
  const consistency = totalDays > 0 ? (daysWithMeals.length / totalDays) * 100 : 0;

  const avgCalories = daysWithMeals.length > 0 
    ? daysWithMeals.reduce((sum, d) => sum + d.calories, 0) / daysWithMeals.length 
    : 0;
  const avgProtein = daysWithMeals.length > 0
    ? daysWithMeals.reduce((sum, d) => sum + d.protein_g, 0) / daysWithMeals.length
    : 0;
  const avgCarbs = daysWithMeals.length > 0
    ? daysWithMeals.reduce((sum, d) => sum + d.carbs_g, 0) / daysWithMeals.length
    : 0;
  const avgFat = daysWithMeals.length > 0
    ? daysWithMeals.reduce((sum, d) => sum + d.fat_g, 0) / daysWithMeals.length
    : 0;
  const avgMealsPerDay = totalDays > 0
    ? dailySummaries.reduce((sum, d) => sum + d.mealsCount, 0) / totalDays
    : 0;

  const periodContext = periodDays === 7 
    ? 'une semaine'
    : periodDays === 14 
    ? 'deux semaines'
    : 'un mois';

  const system = `Tu es un coach nutrition expert et bienveillant qui analyse les habitudes alimentaires. Tu dois fournir une analyse personnalisée et ACTIOABLE basée sur ${periodContext} de données nutritionnelles.

CONTEXTE: La nutrition représente 80% du succès en fitness. Ton rôle est d'identifier:
1. Les PATTERNS POSITIFS à célébrer et maintenir
2. Les DÉFIS RÉCURRENTS qui bloquent les progrès
3. Les ACTIONS CONCRÈTES et FACILES à implémenter

PRINCIPES D'ANALYSE:
- Cherche les patterns (weekends vs semaine, jours manqués, variabilité)
- Identifie les déséquilibres macro (trop de glucides, pas assez de protéines, etc.)
- Compare aux objectifs pour trouver les écarts systématiques
- Donne des conseils PRÉCIS et QUANTIFIÉS ("Ajoute 20g protéines au déjeuner")
- Reste positif et motivant, jamais critique ou culpabilisant

PÉRIODE D'ANALYSE: ${periodContext}
${periodDays === 7 ? '→ Focus sur patterns hebdomadaires (weekend vs semaine)' : ''}
${periodDays === 14 ? '→ Focus sur consistance et tendances à moyen terme' : ''}
${periodDays === 30 ? '→ Focus sur habits établis et cycles mensuels' : ''}

FORMAT DE RÉPONSE: JSON strict
{
  "insights": [
    {
      "type": "positive" | "challenge" | "pattern",
      "icon": "emoji unicode",
      "title": "Titre court (3-5 mots)",
      "message": "Explication détaillée avec données chiffrées"
    }
  ],
  "recommendations": [
    {
      "priority": 1 | 2 | 3,
      "icon": "emoji unicode",
      "action": "Action spécifique à prendre",
      "reason": "Pourquoi c'est important",
      "impact": "Impact estimé (ex: -200 cal/jour, +15g protéines)"
    }
  ],
  "overallScore": 0-100
}

RÈGLES:
- Génère 3-5 insights (mélange de positifs, défis, patterns)
- Génère 2-4 recommandations PRIORISÉES (priority 1 = action #1 à faire)
- overallScore basé sur: consistance (30%), équilibre macros (40%), atteinte objectifs (30%)
- Utilise des emojis pertinents et motivants
- Mentionne toujours des CHIFFRES précis issus des données
- Si consistance <70%, c'est le défi #1 à adresser`;

  const userData = {
    periodDays,
    periodContext,
    targets: {
      calories_kcal: targets.calories_kcal,
      protein_g: targets.protein_g,
      carbs_g: targets.carbs_g,
      fat_g: targets.fat_g,
    },
    averages: {
      calories: Math.round(avgCalories),
      protein_g: Math.round(avgProtein),
      carbs_g: Math.round(avgCarbs),
      fat_g: Math.round(avgFat),
      mealsPerDay: Math.round(avgMealsPerDay * 10) / 10,
    },
    consistency: Math.round(consistency),
    totalDays,
    daysWithMeals: daysWithMeals.length,
    dailyData: dailySummaries.map((d) => ({
      date: d.date,
      cal: d.calories,
      pro: d.protein_g,
      carbs: d.carbs_g,
      fat: d.fat_g,
      meals: d.mealsCount,
    })),
  };

  const body = {
    model: 'gpt-4o-mini',
    temperature: 0.7,
    max_tokens: 1200,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: JSON.stringify(userData) },
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
    const errorText = await res.text();
    throw new Error(`OpenAI API error: ${res.status} - ${errorText}`);
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
    throw new Error('Réponse IA invalide - impossible de parser le JSON');
  }

  // Validate response structure
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Réponse IA invalide - format incorrect');
  }

  const insights: NutritionInsight[] = Array.isArray(parsed.insights)
    ? parsed.insights
        .filter((i: any) => i && typeof i === 'object' && i.type && i.title && i.message)
        .map((i: any) => ({
          type: ['positive', 'challenge', 'pattern'].includes(i.type) ? i.type : 'pattern',
          icon: typeof i.icon === 'string' ? i.icon : '💡',
          title: String(i.title).slice(0, 100),
          message: String(i.message).slice(0, 500),
        }))
    : [];

  const recommendations: NutritionRecommendation[] = Array.isArray(parsed.recommendations)
    ? parsed.recommendations
        .filter((r: any) => r && typeof r === 'object' && r.action && r.reason)
        .map((r: any) => ({
          priority: typeof r.priority === 'number' && r.priority >= 1 && r.priority <= 3 ? r.priority : 2,
          icon: typeof r.icon === 'string' ? r.icon : '🎯',
          action: String(r.action).slice(0, 200),
          reason: String(r.reason).slice(0, 300),
          impact: typeof r.impact === 'string' ? String(r.impact).slice(0, 100) : '',
        }))
        .sort((a: NutritionRecommendation, b: NutritionRecommendation) => a.priority - b.priority)
    : [];

  const overallScore = typeof parsed.overallScore === 'number' && parsed.overallScore >= 0 && parsed.overallScore <= 100
    ? Math.round(parsed.overallScore)
    : Math.round((consistency * 0.3) + ((avgCalories / targets.calories_kcal) * 100 * 0.4) + 30); // Fallback calculation

  const periodStart = dailySummaries.length > 0 ? dailySummaries[0].date : new Date().toISOString().split('T')[0];
  const periodEnd = dailySummaries.length > 0 
    ? dailySummaries[dailySummaries.length - 1].date 
    : new Date().toISOString().split('T')[0];

  return {
    periodDays,
    periodStart,
    periodEnd,
    dailySummaries,
    insights,
    recommendations,
    overallScore,
    averages: {
      calories: Math.round(avgCalories),
      protein_g: Math.round(avgProtein),
      carbs_g: Math.round(avgCarbs),
      fat_g: Math.round(avgFat),
      mealsPerDay: Math.round(avgMealsPerDay * 10) / 10,
      consistency: Math.round(consistency),
    },
  };
}
