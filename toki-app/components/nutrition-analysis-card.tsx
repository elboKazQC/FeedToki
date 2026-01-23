import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { Button } from './ui/Button';
// No changes required
import { useTheme } from '../lib/theme-context';
import { Colors } from '../constants/theme';
import { spacing } from '../constants/design-tokens';
import { MealEntry, StreakStats, computeStreak } from '../lib/stats';
import { FoodItem, FOOD_DB } from '../lib/food-db';
import { computeDailyTotals, NutritionTargets } from '../lib/nutrition';
import {
  analyzeNutritionPeriod,
  NutritionPeriodDays,
  NutritionAnalysisResult,
  DailySummary,
  UserProfileData,
  WeightTrendData,
  StreakData,
  CheatDayData,
  WeekPatternData,
  MealTimingData,
  FrequentFoodsData,
  FrequentFoodItem,
} from '../lib/ai-nutrition-coach';
import { PaywallModal } from './paywall-modal';
import { UserProfile } from '../lib/types';
import { WeightEntry } from '../lib/weight';

type NutritionAnalysisCardProps = {
  entries: MealEntry[];
  customFoods: FoodItem[];
  targets: NutritionTargets;
  userId: string;
  hasSubscription: boolean;
  // Nouvelles props pour personnalisation
  profile?: UserProfile | null;
  weights?: WeightEntry[];
  streak?: StreakStats;
  cheatDays?: Record<string, boolean>;
};

export function NutritionAnalysisCard({
  entries,
  customFoods,
  targets,
  userId,
  hasSubscription,
  profile,
  weights = [],
  streak,
  cheatDays = {},
}: NutritionAnalysisCardProps) {
  // Force dark theme colors for consistency with stats page
  const darkColors = {
    surface: '#1f2937',
    background: '#111827',
    text: {
      primary: '#e5e7eb',
      secondary: '#9ca3af',
      tertiary: '#6b7280',
      inverse: '#111827',
    },
    icon: '#9ca3af',
    primary: '#f59e0b',
    warning: '#f59e0b',
    success: '#22c55e',
    error: '#ef4444',
    border: '#374151', // Added for period selector buttons
  };
  const colors = darkColors;
  const colorValue = (c: any): string => (typeof c === 'string' ? c : (c && typeof c.primary === 'string' ? c.primary : String(c)) );

  console.log('[NutritionAnalysisCard] Rendering with:', { 
    entriesCount: entries.length,
    hasSubscription,
    userId,
    hasProfile: !!profile,
    weightsCount: weights.length,
  });

  const [selectedPeriod, setSelectedPeriod] = useState<NutritionPeriodDays>(7);
  const [analysis, setAnalysis] = useState<NutritionAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);

  // Calculate available days of data
  const uniqueDates = new Set(entries.map((e) => e.createdAt.split('T')[0]));
  const availableDays = uniqueDates.size;

  // Check which periods are available
  const canAnalyze7 = availableDays >= 7;
  const canAnalyze14 = availableDays >= 14;
  const canAnalyze30 = availableDays >= 30;

  // Adjust selected period if data insufficient
  useEffect(() => {
    if (selectedPeriod === 30 && !canAnalyze30) {
      setSelectedPeriod(canAnalyze14 ? 14 : 7);
    } else if (selectedPeriod === 14 && !canAnalyze14) {
      setSelectedPeriod(7);
    }
  }, [selectedPeriod, canAnalyze7, canAnalyze14, canAnalyze30]);

  // If no data at all, show waiting message
  if (availableDays === 0) {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <View style={styles.waitingOverlay}>
          <Text style={[styles.waitingIcon]}>📊</Text>
          <Text style={[styles.waitingTitle, { color: colorValue(colors.text) }]}>Coach Nutrition IA</Text>
          <Text style={[styles.waitingSubtitle, { color: colors.icon }]}>
            En attente de données...
          </Text>
          <Text style={[styles.waitingDescription, { color: colors.icon }]}>
            Commence à logger tes repas pour débloquer l&apos;analyse IA.{'\n\n'}
            ⏳ Besoin de 7 jours de données pour démarrer
          </Text>
        </View>
      </View>
    );
  }

  const handleAnalyze = async () => {
    if (!hasSubscription) {
      setShowPaywall(true);
      return;
    }

    if (availableDays < selectedPeriod) {
      setError(`Besoin de ${selectedPeriod} jours de données. Tu en as ${availableDays}.`);
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      // Get the last N days EXCLUDING today (today is incomplete)
      const today = new Date();
      const dates: string[] = [];
      for (let i = selectedPeriod; i >= 1; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().split('T')[0]);
      }

      // Compute daily summaries with cheat day info
      const dailySummaries: DailySummary[] = dates.map((date) => {
        const totals = computeDailyTotals(entries, date, customFoods);
        const dayEntries = entries.filter((e) => e.createdAt.split('T')[0] === date);
        return {
          date,
          calories: totals.calories_kcal,
          protein_g: totals.protein_g,
          carbs_g: totals.carbs_g,
          fat_g: totals.fat_g,
          mealsCount: dayEntries.length,
          isCheatDay: cheatDays[date] === true,
        };
      });

      // === CALCUL DES DONNÉES PERSONNALISÉES ===

      // 1. User Profile Data
      const userProfileData: UserProfileData | undefined = profile ? {
        weightGoal: profile.weightGoal,
        currentWeight: profile.currentWeight,
        activityLevel: profile.activityLevel,
        gender: profile.gender,
        heightCm: profile.heightCm,
        tdeeEstimate: profile.tdeeEstimate,
      } : undefined;

      // 2. Weight Trend Data (analyser les poids sur la période)
      let weightTrendData: WeightTrendData | undefined;
      if (weights.length >= 2) {
        const periodStart = dates[0];
        const periodEnd = dates[dates.length - 1];
        
        // Filtrer les poids dans la période (ou prendre les plus proches)
        const weightsInPeriod = weights.filter(w => w.date >= periodStart && w.date <= periodEnd);
        const sortedWeights = [...weights].sort((a, b) => a.date.localeCompare(b.date));
        
        // Poids de départ (le premier dans la période ou le plus récent avant)
        const startWeight = weightsInPeriod.length > 0 
          ? weightsInPeriod[0].weightKg
          : sortedWeights.filter(w => w.date < periodStart).pop()?.weightKg;
        
        // Poids actuel (le dernier enregistré)
        const currentWeight = sortedWeights[sortedWeights.length - 1]?.weightKg;
        
        if (startWeight && currentWeight) {
          const change = currentWeight - startWeight;
          const weeks = selectedPeriod / 7;
          const weeklyRate = change / weeks;
          
          weightTrendData = {
            startWeight,
            currentWeight,
            weightChange: change,
            trend: Math.abs(change) < 0.3 ? 'stable' : change < 0 ? 'down' : 'up',
            weeklyRate,
          };
        } else {
          weightTrendData = { trend: 'unknown' };
        }
      }

      // 3. Streak Data
      const streakData: StreakData | undefined = streak ? {
        currentStreak: streak.currentStreakDays,
        longestStreak: streak.longestStreakDays,
        totalFedDays: streak.totalFedDays,
      } : undefined;

      // 4. Cheat Day Analysis
      let cheatDayAnalysis: CheatDayData | undefined;
      const cheatDaysInPeriod = dates.filter(d => cheatDays[d] === true);
      if (cheatDaysInPeriod.length > 0) {
        const cheatDaySummaries = dailySummaries.filter(d => d.isCheatDay && d.mealsCount > 0);
        const normalDaySummaries = dailySummaries.filter(d => !d.isCheatDay && d.mealsCount > 0);
        
        const avgCheatCal = cheatDaySummaries.length > 0
          ? cheatDaySummaries.reduce((sum, d) => sum + d.calories, 0) / cheatDaySummaries.length
          : 0;
        const avgNormalCal = normalDaySummaries.length > 0
          ? normalDaySummaries.reduce((sum, d) => sum + d.calories, 0) / normalDaySummaries.length
          : 0;
        
        cheatDayAnalysis = {
          totalCheatDays: cheatDaysInPeriod.length,
          cheatDayDates: cheatDaysInPeriod,
          avgCaloriesOnCheatDays: avgCheatCal,
          avgCaloriesOnNormalDays: avgNormalCal,
        };
      }

      // 5. Weekend vs Weekday Pattern
      const weekdays: DailySummary[] = [];
      const weekends: DailySummary[] = [];
      for (const summary of dailySummaries) {
        const dayOfWeek = new Date(summary.date + 'T12:00:00').getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          weekends.push(summary);
        } else {
          weekdays.push(summary);
        }
      }
      
      const weekdaysWithData = weekdays.filter(d => d.mealsCount > 0);
      const weekendsWithData = weekends.filter(d => d.mealsCount > 0);
      
      let weekPatternData: WeekPatternData | undefined;
      if (weekdaysWithData.length > 0 && weekendsWithData.length > 0) {
        const avgWeekdays = weekdaysWithData.reduce((sum, d) => sum + d.calories, 0) / weekdaysWithData.length;
        const avgWeekends = weekendsWithData.reduce((sum, d) => sum + d.calories, 0) / weekendsWithData.length;
        
        weekPatternData = {
          avgCaloriesWeekdays: avgWeekdays,
          avgCaloriesWeekends: avgWeekends,
          consistencyWeekdays: (weekdaysWithData.length / weekdays.length) * 100,
          consistencyWeekends: (weekendsWithData.length / weekends.length) * 100,
          weekendCalorieDiff: avgWeekdays > 0 ? ((avgWeekends - avgWeekdays) / avgWeekdays) * 100 : 0,
        };
      }

      // 6. Meal Timing Data
      const daysWithSingleMeal = dailySummaries.filter(d => d.mealsCount === 1).length;
      const daysWithManyMeals = dailySummaries.filter(d => d.mealsCount >= 4).length;
      const totalMeals = dailySummaries.reduce((sum, d) => sum + d.mealsCount, 0);
      
      const mealTimingData: MealTimingData = {
        avgMealsPerDay: dailySummaries.length > 0 ? totalMeals / dailySummaries.length : 0,
        daysWithSingleMeal,
        daysWithManyMeals,
      };

      // 7. Analyse des aliments fréquents pour FOOD SWAPS 🔄
      // Filtrer les entrées de la période sélectionnée
      const periodEntries = entries.filter(e => {
        const entryDate = e.createdAt.split('T')[0];
        return dates.includes(entryDate);
      });
      
      // Compter la fréquence de chaque aliment
      const foodCounts: Record<string, { 
        count: number; 
        totalCal: number; 
        totalProt: number;
        name: string;
      }> = {};
      
      // Créer un index des foods pour lookup rapide
      const allFoods = [...FOOD_DB, ...customFoods];
      const foodIndex: Record<string, FoodItem> = {};
      for (const food of allFoods) {
        foodIndex[food.id] = food;
      }
      
      for (const entry of periodEntries) {
        if (entry.items && entry.items.length > 0) {
          for (const item of entry.items) {
            const food = foodIndex[item.foodId];
            if (food) {
              const multiplier = item.multiplier || 1;
              const calories = (food.calories_kcal || 0) * multiplier;
              const protein = (food.protein_g || 0) * multiplier;
              
              if (!foodCounts[food.id]) {
                foodCounts[food.id] = {
                  count: 0,
                  totalCal: 0,
                  totalProt: 0,
                  name: food.name,
                };
              }
              
              foodCounts[food.id].count += 1;
              foodCounts[food.id].totalCal += calories;
              foodCounts[food.id].totalProt += protein;
            }
          }
        }
      }
      
      // Convertir en array et trier
      const foodArray = Object.entries(foodCounts)
        .map(([id, data]) => ({
          name: data.name,
          count: data.count,
          totalCalories: data.totalCal,
          avgCaloriesPerServing: data.count > 0 ? data.totalCal / data.count : 0,
          avgProteinPerServing: data.count > 0 ? data.totalProt / data.count : 0,
          // Catégoriser par ratio protéines/calories (plus sain = plus de protéines par calorie)
          category: data.totalProt / data.totalCal > 0.1 ? 'healthy' as const : 
                   data.totalProt / data.totalCal > 0.05 ? 'moderate' as const : 'indulgent' as const,
        }));
      
      // Top aliments par fréquence
      const topFoods = [...foodArray]
        .sort((a, b) => b.count - a.count)
        .slice(0, 15);
      
      // Aliments à haute calorie (gros contributeurs)
      const highCalorieFoods = [...foodArray]
        .filter(f => f.count >= 2) // Au moins 2 fois pour être significatif
        .sort((a, b) => b.totalCalories - a.totalCalories)
        .slice(0, 5);
      
      // Aliments à optimiser: haute calorie, faible protéine (ratio cal/prot élevé)
      const lowProteinHighCalorie = [...foodArray]
        .filter(f => f.count >= 2 && f.avgCaloriesPerServing > 100)
        .map(f => ({
          ...f,
          calProtRatio: f.avgProteinPerServing > 0 ? f.avgCaloriesPerServing / f.avgProteinPerServing : 999,
        }))
        .sort((a, b) => b.calProtRatio - a.calProtRatio)
        .slice(0, 5);
      
      let frequentFoodsData: FrequentFoodsData | undefined;
      if (topFoods.length > 0) {
        frequentFoodsData = {
          topFoods,
          highCalorieFoods,
          lowProteinHighCalorie,
        };
      }

      // === APPEL À L'IA AVEC TOUTES LES DONNÉES ===
      const result = await analyzeNutritionPeriod({
        dailySummaries,
        targets,
        periodDays: selectedPeriod,
        userProfile: userProfileData,
        weightTrend: weightTrendData,
        streakData,
        cheatDayData: cheatDayAnalysis,
        weekPattern: weekPatternData,
        mealTiming: mealTimingData,
        frequentFoods: frequentFoodsData,
      });

      setAnalysis(result);
    } catch (err) {
      console.error('[NutritionAnalysis] Error:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'analyse');
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!hasSubscription) {
    return (
      <>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.lockedOverlay}>
            <Text style={[styles.lockedIcon]}>🔒</Text>
            <Text style={[styles.lockedTitle, { color: colorValue(colors.text) }]}>Coach Nutrition IA</Text>
            <Text style={[styles.lockedSubtitle, { color: colors.icon }]}>
              Analyse personnalisée de tes habitudes alimentaires
            </Text>
            <Text style={[styles.lockedDescription, { color: colors.icon }]}>
              • Identifie où couper les calories facilement{'\n'}
              • Conseils d&apos;expert en nutrition{'\n'}
              • Analyse sur 7, 14 ou 30 jours{'\n'}
              • La nutrition = 80% du succès fitness
            </Text>
            <Button
              label="🚀 Débloquer le Coach IA"
              onPress={() => setShowPaywall(true)}
              style={styles.unlockButton}
            />
          </View>
        </View>
        <PaywallModal visible={showPaywall} onClose={() => setShowPaywall(false)} />
      </>
    );
  }

  // Journal alimentaire simple, sans score ni analyse IA immédiate
  // On affiche les repas par jour, du plus récent au plus ancien, sur la période sélectionnée
  // Prépare la structure pour une future analyse IA
  // Sélection de la période (7, 14, 30 jours) conservée
  // On affiche un message d'encouragement si pas de repas

  // Générer la liste des dates à afficher (du plus récent au plus ancien)
  const today = new Date();
  const dates: string[] = [];
  for (let i = selectedPeriod; i >= 1; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }

  // Regrouper les repas par date
  const mealsByDate: Record<string, MealEntry[]> = {};
  for (const date of dates) {
    mealsByDate[date] = entries.filter(e => e.createdAt.split('T')[0] === date);
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}> 
      <View style={styles.header}>
        <Text style={[styles.title, { color: colorValue(colors.text) }]}>🍽️ Journal alimentaire</Text>
        <Text style={[styles.subtitle, { color: colors.icon }]}> 
          Saisis tes repas chaque jour pour un meilleur suivi. L’analyse IA détaillée arrive bientôt !
        </Text>
      </View>

      {/* Sélecteur de période */}
      <View style={styles.periodSelector}>
        <TouchableOpacity
          style={[ 
            styles.periodButton,
            { borderColor: colors.border },
            selectedPeriod === 7 && { backgroundColor: colors.primary, borderColor: colors.primary },
            !canAnalyze7 && styles.periodButtonDisabled,
          ]}
          onPress={() => canAnalyze7 && setSelectedPeriod(7)}
          disabled={!canAnalyze7}
        >
          <Text
            style={[ 
              styles.periodButtonText,
              { color: colors.text.primary },
              selectedPeriod === 7 && { color: '#fff', fontWeight: '600' },
            !canAnalyze7 && { color: colors.icon },
            ]}
          >
            7 jours
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[ 
            styles.periodButton,
            { borderColor: colors.border },
            selectedPeriod === 14 && { backgroundColor: colors.primary, borderColor: colors.primary },
            !canAnalyze14 && styles.periodButtonDisabled,
          ]}
          onPress={() => canAnalyze14 && setSelectedPeriod(14)}
          disabled={!canAnalyze14}
        >
          <Text
            style={[ 
              styles.periodButtonText,
              { color: colors.text.primary },
              selectedPeriod === 14 && { color: '#fff', fontWeight: '600' },
            !canAnalyze14 && { color: colors.icon },
            ]}
          >
            14 jours
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[ 
            styles.periodButton,
            { borderColor: colors.border },
            selectedPeriod === 30 && { backgroundColor: colors.primary, borderColor: colors.primary },
            !canAnalyze30 && styles.periodButtonDisabled,
          ]}
          onPress={() => canAnalyze30 && setSelectedPeriod(30)}
          disabled={!canAnalyze30}
        >
          <Text
            style={[ 
              styles.periodButtonText,
              { color: colors.text.primary },
              selectedPeriod === 30 && { color: '#fff', fontWeight: '600' },
            !canAnalyze30 && { color: colors.icon },
            ]}
          >
            30 jours
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.results}>
        {dates.map(date => (
          <View key={date} style={{ marginBottom: spacing.md }}>
            <Text style={{ color: colorValue(colors.text), fontWeight: '600', fontSize: 16, marginBottom: 4 }}>
              {new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: '2-digit', year: '2-digit' })}
            </Text>
            {mealsByDate[date] && mealsByDate[date].length > 0 ? (
              mealsByDate[date].map((meal, idx) => (
                <View key={meal.id || idx} style={{ marginBottom: 8, padding: 8, borderRadius: 8, backgroundColor: colors.background }}>
                  <Text style={{ color: colors.icon, fontWeight: '500', marginBottom: 2 }}>
                    {meal.type ? meal.type : 'Repas'}{meal.time ? ` à ${meal.time}` : ''}
                  </Text>
                  {meal.items && meal.items.length > 0 ? (
                    meal.items.map((item, i) => (
                      <Text key={i} style={{ color: colorValue(colors.text), fontSize: 14 }}>
                        • {item.name} {item.quantity ? `(${item.quantity})` : ''} {item.calories ? `- ${item.calories} kcal` : ''}
                      </Text>
                    ))
                  ) : (
                    <Text style={{ color: colors.icon, fontSize: 13 }}>Aucun aliment renseigné</Text>
                  )}
                </View>
              ))
            ) : (
              <Text style={{ color: colors.icon, fontSize: 13, fontStyle: 'italic' }}>Aucun repas enregistré</Text>
            )}
          </View>
        ))}
        <Text style={{ color: colors.icon, fontSize: 13, textAlign: 'center', marginTop: spacing.lg }}>
          Continue à enregistrer tes repas pour une analyse IA personnalisée bientôt disponible !
        </Text>
      </ScrollView>
    </View>
  );
}


// Gamification, points, badge, score, and recommendation UI fully removed. Only food journal and nutrition tracking remain.

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  header: {
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
  },
  periodSelector: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  periodButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  periodButtonDisabled: {
    opacity: 0.4,
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  analyzeButton: {
    marginTop: spacing.sm,
  },
  warningText: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  errorBox: {
    padding: spacing.md,
    borderRadius: 8,
    marginTop: spacing.md,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  results: {
    marginTop: spacing.md,
  },
  // Suppression des styles liés à la gamification, score, badge, insight, recommandations
  lockedOverlay: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  lockedIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  lockedTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  lockedSubtitle: {
    fontSize: 16,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  lockedDescription: {
    fontSize: 14,
    lineHeight: 24,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  unlockButton: {
    minWidth: 250,
  },
  waitingOverlay: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  waitingIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  waitingTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  waitingSubtitle: {
    fontSize: 16,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  waitingDescription: {
    fontSize: 14,
    lineHeight: 24,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
});
