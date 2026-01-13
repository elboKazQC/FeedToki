import { DailyNutritionTotals, NutritionTargets } from './nutrition';
import { WeightGoal, ActivityLevel, Gender } from './types';

export type NutritionPeriodDays = 7 | 14 | 30;

export type DailySummary = {
  date: string; // YYYY-MM-DD
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  mealsCount: number;
  isCheatDay?: boolean; // Si c'est une journée cheat
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

// Données du profil utilisateur pour personnalisation
export type UserProfileData = {
  weightGoal?: WeightGoal; // 'maintenance', 'lose-1lb', 'lose-2lb', 'lose-3lb'
  currentWeight?: number; // kg
  activityLevel?: ActivityLevel; // 'sedentary', 'moderate', 'active'
  gender?: Gender; // 'male', 'female'
  heightCm?: number;
  tdeeEstimate?: number; // Dépense calorique quotidienne estimée
  dailyPointsBudget?: number; // Budget points quotidien
};

// Données de poids pour analyse de tendance
export type WeightTrendData = {
  startWeight?: number; // Poids au début de la période (kg)
  currentWeight?: number; // Poids actuel (kg)
  weightChange?: number; // Changement en kg (positif = prise, négatif = perte)
  trend: 'down' | 'up' | 'stable' | 'unknown'; // Tendance générale
  weeklyRate?: number; // Taux de changement par semaine (kg)
};

// Données de streak et gamification
export type StreakData = {
  currentStreak: number; // Jours consécutifs avec données
  longestStreak: number;
  totalFedDays: number; // Jours totaux avec données
};

// Données de cheat days
export type CheatDayData = {
  totalCheatDays: number; // Nombre de cheat days sur la période
  cheatDayDates: string[]; // Dates des cheat days
  avgCaloriesOnCheatDays: number; // Moyenne calories cheat days
  avgCaloriesOnNormalDays: number; // Moyenne calories jours normaux
};

// Patterns weekend vs semaine
export type WeekPatternData = {
  avgCaloriesWeekdays: number; // Lun-Ven moyenne
  avgCaloriesWeekends: number; // Sam-Dim moyenne
  consistencyWeekdays: number; // % jours loggés semaine
  consistencyWeekends: number; // % jours loggés weekend
  weekendCalorieDiff: number; // Différence weekend vs semaine (%)
};

// Patterns de timing des repas
export type MealTimingData = {
  avgMealsPerDay: number;
  daysWithSingleMeal: number; // Jours avec 1 seul repas (risque)
  daysWithManyMeals: number; // Jours avec 4+ repas
};

// Aliments fréquemment consommés (pour suggestions de swaps)
export type FrequentFoodItem = {
  name: string;
  count: number; // Nombre de fois consommé sur la période
  totalCalories: number; // Calories totales apportées
  avgCaloriesPerServing: number; // Calories moyennes par portion
  avgProteinPerServing: number; // Protéines moyennes par portion
  category: 'healthy' | 'moderate' | 'indulgent'; // Classification basée sur ratio protéines/calories
};

export type FrequentFoodsData = {
  topFoods: FrequentFoodItem[]; // Top 10-15 aliments les plus fréquents
  highCalorieFoods: FrequentFoodItem[]; // Aliments à haute densité calorique fréquents
  lowProteinHighCalorie: FrequentFoodItem[]; // Aliments à optimiser (beaucoup cal, peu protéines)
};

export type AnalyzeNutritionInput = {
  dailySummaries: DailySummary[];
  targets: NutritionTargets;
  periodDays: NutritionPeriodDays;
  signal?: AbortSignal;
  // Nouvelles données de personnalisation
  userProfile?: UserProfileData;
  weightTrend?: WeightTrendData;
  streakData?: StreakData;
  cheatDayData?: CheatDayData;
  weekPattern?: WeekPatternData;
  mealTiming?: MealTimingData;
  frequentFoods?: FrequentFoodsData; // Aliments fréquents pour suggestions de swaps
};

/**
 * Analyzes nutrition patterns over a multi-day period using AI coaching
 * @param input - Daily summaries, targets, period configuration, and personalization data
 * @returns AI-generated insights, recommendations, and overall nutrition score
 */
export async function analyzeNutritionPeriod({
  dailySummaries,
  targets,
  periodDays,
  signal,
  userProfile,
  weightTrend,
  streakData,
  cheatDayData,
  weekPattern,
  mealTiming,
  frequentFoods,
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

  // Build goal-specific context
  const goalLabels: Record<string, string> = {
    'maintenance': 'maintenir son poids',
    'lose-1lb': 'perdre 0.5 kg/semaine',
    'lose-2lb': 'perdre 1 kg/semaine',
    'lose-3lb': 'perdre 1.5 kg/semaine',
  };
  const activityLabels: Record<string, string> = {
    'sedentary': 'sédentaire',
    'moderate': 'modérément actif',
    'active': 'très actif',
  };
  
  const userGoalLabel = userProfile?.weightGoal ? goalLabels[userProfile.weightGoal] || userProfile.weightGoal : null;
  const userActivityLabel = userProfile?.activityLevel ? activityLabels[userProfile.activityLevel] || userProfile.activityLevel : null;
  
  // Build weight trend narrative
  let weightNarrative = '';
  if (weightTrend && weightTrend.trend !== 'unknown') {
    const changeKg = weightTrend.weightChange || 0;
    const absChange = Math.abs(changeKg);
    if (weightTrend.trend === 'down') {
      weightNarrative = `En perte de poids: -${absChange.toFixed(1)} kg sur la période analysée.`;
    } else if (weightTrend.trend === 'up') {
      weightNarrative = `En prise de poids: +${absChange.toFixed(1)} kg sur la période analysée.`;
    } else {
      weightNarrative = `Poids stable sur la période.`;
    }
    if (weightTrend.weeklyRate) {
      weightNarrative += ` (${weightTrend.weeklyRate > 0 ? '+' : ''}${weightTrend.weeklyRate.toFixed(2)} kg/semaine)`;
    }
  }

  // Build cheat day analysis
  let cheatDayNarrative = '';
  if (cheatDayData && cheatDayData.totalCheatDays > 0) {
    const extraCalories = cheatDayData.avgCaloriesOnCheatDays - cheatDayData.avgCaloriesOnNormalDays;
    cheatDayNarrative = `${cheatDayData.totalCheatDays} jour(s) cheat sur la période. `;
    if (extraCalories > 0) {
      cheatDayNarrative += `En moyenne +${Math.round(extraCalories)} cal de plus les jours cheat vs jours normaux.`;
    }
  }

  // Build weekend pattern analysis
  let weekendNarrative = '';
  if (weekPattern && weekPattern.avgCaloriesWeekends > 0) {
    const diff = weekPattern.weekendCalorieDiff;
    if (Math.abs(diff) > 10) {
      weekendNarrative = diff > 0 
        ? `Les weekends = +${Math.round(diff)}% de calories vs semaine (${Math.round(weekPattern.avgCaloriesWeekends)} vs ${Math.round(weekPattern.avgCaloriesWeekdays)} cal).`
        : `Les weekends = ${Math.round(diff)}% de calories vs semaine.`;
    }
  }

  // Build streak motivation
  let streakNarrative = '';
  if (streakData && streakData.currentStreak > 0) {
    if (streakData.currentStreak >= 30) {
      streakNarrative = `🔥 Streak impressionnant de ${streakData.currentStreak} jours! Consistance exceptionnelle.`;
    } else if (streakData.currentStreak >= 7) {
      streakNarrative = `Bon streak de ${streakData.currentStreak} jours consécutifs.`;
    } else {
      streakNarrative = `Streak actuel: ${streakData.currentStreak} jours.`;
    }
  }

  // Build frequent foods narrative for smart swaps
  let frequentFoodsNarrative = '';
  let foodSwapOpportunities = '';
  if (frequentFoods) {
    if (frequentFoods.topFoods.length > 0) {
      const topFoodsList = frequentFoods.topFoods
        .slice(0, 5)
        .map(f => `${f.name} (${f.count}x, ~${Math.round(f.avgCaloriesPerServing)} cal, ${Math.round(f.avgProteinPerServing)}g prot)`)
        .join(', ');
      frequentFoodsNarrative = `Aliments les plus fréquents: ${topFoodsList}`;
    }
    
    if (frequentFoods.lowProteinHighCalorie.length > 0) {
      const swapCandidates = frequentFoods.lowProteinHighCalorie
        .slice(0, 3)
        .map(f => `"${f.name}" (${Math.round(f.avgCaloriesPerServing)} cal, seulement ${Math.round(f.avgProteinPerServing)}g prot)`)
        .join(', ');
      foodSwapOpportunities = `🔄 OPPORTUNITÉS DE SWAP: ${swapCandidates} - propose des alternatives moins caloriques ou plus protéinées!`;
    }
    
    if (frequentFoods.highCalorieFoods.length > 0) {
      const highCalList = frequentFoods.highCalorieFoods
        .slice(0, 3)
        .map(f => `"${f.name}" = ${Math.round(f.totalCalories)} cal totales sur la période`)
        .join(', ');
      foodSwapOpportunities += foodSwapOpportunities ? `\n🔥 GROS CONTRIBUTEURS CALORIQUES: ${highCalList}` : `🔥 GROS CONTRIBUTEURS CALORIQUES: ${highCalList}`;
    }
  }

  const system = `Tu es un coach nutrition EXPERT et PERSONNEL qui analyse les habitudes alimentaires. Tu connais très bien cet utilisateur et tu fournis une analyse ULTRA-PERSONNALISÉE basée sur ${periodContext} de données.

🎯 PROFIL UTILISATEUR:
${userGoalLabel ? `- Objectif: ${userGoalLabel}` : ''}
${userProfile?.currentWeight ? `- Poids actuel: ${userProfile.currentWeight.toFixed(1)} kg` : ''}
${userActivityLabel ? `- Niveau d'activité: ${userActivityLabel}` : ''}
${userProfile?.tdeeEstimate ? `- Dépense calorique estimée: ${Math.round(userProfile.tdeeEstimate)} cal/jour` : ''}
${weightNarrative ? `- Évolution poids: ${weightNarrative}` : ''}
${streakNarrative ? `- ${streakNarrative}` : ''}

📊 PATTERNS DÉTECTÉS:
${weekendNarrative ? `- ${weekendNarrative}` : '- Pas assez de données weekend/semaine'}
${cheatDayNarrative ? `- ${cheatDayNarrative}` : ''}
${mealTiming?.daysWithSingleMeal && mealTiming.daysWithSingleMeal > 0 ? `- ⚠️ ${mealTiming.daysWithSingleMeal} jour(s) avec un seul repas (risque de fringales/surcompensation)` : ''}

🍽️ ALIMENTS FRÉQUENTS & SWAPS INTELLIGENTS:
${frequentFoodsNarrative ? `- ${frequentFoodsNarrative}` : '- Pas assez de données sur les aliments fréquents'}
${foodSwapOpportunities ? `${foodSwapOpportunities}` : ''}

TON RÔLE:
1. CÉLÉBRER les victoires et patterns positifs (renforce la motivation)
2. IDENTIFIER les obstacles SPÉCIFIQUES qui bloquent l'objectif
3. PROPOSER des FOOD SWAPS CONCRETS basés sur ses aliments fréquents (ex: "Remplace tes biscuits Oreo par des biscuits maison à l'avoine = -150 cal")
4. PROPOSER des actions CONCRÈTES, FACILES et PERSONNALISÉES à cet utilisateur

🔄 STRATÉGIE FOOD SWAP (TRÈS IMPORTANT):
- Analyse les aliments qu'il mange SOUVENT et propose des alternatives SIMILAIRES mais meilleures
- Pour les aliments à haute calorie/faible protéine: propose une version plus protéinée
- Pour les snacks sucrés: propose des alternatives maison ou moins caloriques
- Sois SPÉCIFIQUE: "Au lieu de X, essaie Y" avec les économies de calories
- Exemples de swaps: chips → pop-corn nature, biscuits → fruits, soda → eau pétillante, pain blanc → pain complet

ANALYSE INTELLIGENTE:
${userProfile?.weightGoal === 'maintenance' ? '→ Focus sur la stabilité et l\'équilibre, pas sur le déficit' : ''}
${userProfile?.weightGoal?.includes('lose') ? '→ Focus sur le déficit calorique durable sans frustration' : ''}
${weightTrend?.trend === 'down' && userProfile?.weightGoal?.includes('lose') ? '→ ✅ La perte de poids est en cours! Renforcer ce qui fonctionne.' : ''}
${weightTrend?.trend === 'up' && userProfile?.weightGoal?.includes('lose') ? '→ ⚠️ Prise de poids malgré objectif de perte. Identifier les obstacles.' : ''}
${weekPattern && weekPattern.weekendCalorieDiff > 20 ? '→ Les weekends sont le défi principal. Proposer des stratégies weekend.' : ''}
${mealTiming?.avgMealsPerDay && mealTiming.avgMealsPerDay < 2 ? '→ Trop peu de repas par jour. Risque de faim excessive.' : ''}

PÉRIODE: ${periodContext}
${periodDays === 7 ? '→ Analyse hebdomadaire: patterns weekend vs semaine, cohérence jour par jour' : ''}
${periodDays === 14 ? '→ Analyse 2 semaines: tendances émergentes, ajustements à faire' : ''}
${periodDays === 30 ? '→ Analyse mensuelle: habits établis, cycles à long terme, prédictions' : ''}

FORMAT DE RÉPONSE: JSON strict
{
  "insights": [
    {
      "type": "positive" | "challenge" | "pattern",
      "icon": "emoji unicode",
      "title": "Titre court et percutant (3-5 mots)",
      "message": "Explication PERSONNALISÉE avec DONNÉES CHIFFRÉES de cet utilisateur"
    }
  ],
  "recommendations": [
    {
      "priority": 1 | 2 | 3,
      "icon": "emoji unicode", 
      "action": "Action SPÉCIFIQUE et FACILE à implémenter",
      "reason": "Pourquoi c'est important pour CET utilisateur et SON objectif",
      "impact": "Impact estimé quantifié (ex: -200 cal/jour, atteindre objectif X semaines plus tôt)"
    }
  ],
  "overallScore": 0-100
}

RÈGLES IMPÉRATIVES:
- Génère 3-5 insights (mélange de positifs, défis, patterns, et SWAPS alimentaires)
- Génère 2-4 recommandations PRIORISÉES (priority 1 = action #1 à faire)
- AU MOINS UNE recommandation doit être un FOOD SWAP basé sur les aliments fréquents
- overallScore basé sur: consistance (30%), équilibre macros (30%), atteinte objectifs (30%), progression poids (10%)
- Utilise des emojis pertinents et motivants
- Mentionne TOUJOURS des CHIFFRES précis issus des données de CET utilisateur
- Si consistance <70%, c'est le défi #1 à adresser
- Personnalise chaque message à l'objectif de l'utilisateur (perte vs maintenance)
- Si perte de poids en cours et alignée avec objectif: CÉLÉBRER et ENCOURAGER
- Si weekends problématiques: proposer des stratégies CONCRÈTES pour les weekends
- FOOD SWAPS: sois spécifique avec le nom de l'aliment qu'il mange et propose une alternative concrète
- Jamais de conseils génériques - tout doit être basé sur SES données et SES aliments`;

  const userData = {
    periodDays,
    periodContext,
    // Objectifs nutritionnels
    targets: {
      calories_kcal: targets.calories_kcal,
      protein_g: targets.protein_g,
      carbs_g: targets.carbs_g,
      fat_g: targets.fat_g,
    },
    // Moyennes calculées sur la période
    averages: {
      calories: Math.round(avgCalories),
      protein_g: Math.round(avgProtein),
      carbs_g: Math.round(avgCarbs),
      fat_g: Math.round(avgFat),
      mealsPerDay: Math.round(avgMealsPerDay * 10) / 10,
    },
    // Consistance du tracking
    consistency: Math.round(consistency),
    totalDays,
    daysWithMeals: daysWithMeals.length,
    // Données quotidiennes détaillées
    dailyData: dailySummaries.map((d) => ({
      date: d.date,
      dayOfWeek: new Date(d.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short' }),
      cal: d.calories,
      pro: d.protein_g,
      carbs: d.carbs_g,
      fat: d.fat_g,
      meals: d.mealsCount,
      isCheat: d.isCheatDay || false,
    })),
    // Profil utilisateur (si disponible)
    ...(userProfile && {
      userProfile: {
        goal: userProfile.weightGoal,
        weight: userProfile.currentWeight,
        activity: userProfile.activityLevel,
        tdee: userProfile.tdeeEstimate,
      },
    }),
    // Tendance de poids (si disponible)
    ...(weightTrend && weightTrend.trend !== 'unknown' && {
      weightTrend: {
        trend: weightTrend.trend,
        change: weightTrend.weightChange,
        weeklyRate: weightTrend.weeklyRate,
      },
    }),
    // Patterns weekend (si disponible)
    ...(weekPattern && weekPattern.avgCaloriesWeekends > 0 && {
      weekPattern: {
        avgWeekdays: Math.round(weekPattern.avgCaloriesWeekdays),
        avgWeekends: Math.round(weekPattern.avgCaloriesWeekends),
        weekendDiff: Math.round(weekPattern.weekendCalorieDiff),
        consistencyWeekdays: Math.round(weekPattern.consistencyWeekdays),
        consistencyWeekends: Math.round(weekPattern.consistencyWeekends),
      },
    }),
    // Cheat days (si disponible)
    ...(cheatDayData && cheatDayData.totalCheatDays > 0 && {
      cheatDays: {
        count: cheatDayData.totalCheatDays,
        avgCalories: Math.round(cheatDayData.avgCaloriesOnCheatDays),
        dates: cheatDayData.cheatDayDates,
      },
    }),
    // Streak (si disponible)
    ...(streakData && {
      streak: {
        current: streakData.currentStreak,
        longest: streakData.longestStreak,
      },
    }),
    // Timing repas (si disponible)
    ...(mealTiming && {
      mealTiming: {
        avgMealsPerDay: mealTiming.avgMealsPerDay,
        daysWithSingleMeal: mealTiming.daysWithSingleMeal,
      },
    }),
    // Aliments fréquents pour food swaps (si disponible)
    ...(frequentFoods && frequentFoods.topFoods.length > 0 && {
      frequentFoods: {
        top: frequentFoods.topFoods.slice(0, 10).map(f => ({
          name: f.name,
          count: f.count,
          avgCal: Math.round(f.avgCaloriesPerServing),
          avgProt: Math.round(f.avgProteinPerServing),
          totalCal: Math.round(f.totalCalories),
          category: f.category,
        })),
        swapOpportunities: frequentFoods.lowProteinHighCalorie.slice(0, 5).map(f => ({
          name: f.name,
          count: f.count,
          avgCal: Math.round(f.avgCaloriesPerServing),
          avgProt: Math.round(f.avgProteinPerServing),
          reason: f.avgProteinPerServing < 5 ? 'low-protein' : 'high-calorie',
        })),
        highCalorieContributors: frequentFoods.highCalorieFoods.slice(0, 5).map(f => ({
          name: f.name,
          totalCal: Math.round(f.totalCalories),
          count: f.count,
        })),
      },
    }),
  };

  const body = {
    model: 'gpt-4o-mini',
    temperature: 0.7,
    max_tokens: 2500,
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
  const finishReason = json?.choices?.[0]?.finish_reason;

  let parsed: any;
  try {
    // Try to extract JSON if wrapped in markdown code blocks
    let jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || content.match(/(\{[\s\S]*\})/);
    let jsonStr = jsonMatch ? jsonMatch[1] : content;

    // If truncated (missing closing brace), try to recover by closing the JSON
    if (finishReason === 'length' || !jsonStr.trim().endsWith('}')) {
      console.warn('⚠️ Nutrition coach AI response seems truncated, attempting to recover...');
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
      
      console.log('🔧 Nutrition coach: Attempted recovery, trying parse again...');
    }

    parsed = JSON.parse(jsonStr);
  } catch (err) {
    console.error('❌ Failed to parse AI response:', content.substring(0, 500));
    console.error('Parse error:', err);
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
