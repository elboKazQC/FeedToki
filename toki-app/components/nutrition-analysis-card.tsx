import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from './ui/Button';
import { spacing } from '../constants/design-tokens';
import { FoodItem, FOOD_DB } from '../lib/food-db';
import { NutritionTargets } from '../lib/nutrition';
import { MealEntry, MIN_CALORIES_FOR_COMPLETE_DAY, normalizeDate, StreakStats } from '../lib/stats';
import { PaywallModal } from './paywall-modal';
import { UserProfile } from '../lib/types';
import { WeightEntry } from '../lib/weight';

type JournalPeriodDays = 7 | 14 | 30;

type NutritionAnalysisCardProps = {
  entries: MealEntry[];
  customFoods: FoodItem[];
  targets: NutritionTargets;
  userId: string;
  hasSubscription: boolean;
  profile?: UserProfile | null;
  weights?: WeightEntry[];
  streak?: StreakStats;
  cheatDays?: Record<string, boolean>;
};

type DayTotals = {
  date: string;
  mealsCount: number;
  itemsCount: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  missingFoodItems: number;
};

type MealTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  missingFoodItems: number;
};

const PERIOD_OPTIONS: JournalPeriodDays[] = [7, 14, 30];

export function NutritionAnalysisCard({
  entries,
  customFoods,
  hasSubscription,
  cheatDays = {},
}: NutritionAnalysisCardProps) {
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
    border: '#374151',
  };
  const colors = darkColors;
  const colorValue = (c: any): string => (
    typeof c === 'string' ? c : c && typeof c.primary === 'string' ? c.primary : String(c)
  );

  const [selectedPeriod, setSelectedPeriod] = useState<JournalPeriodDays>(7);
  const [showPaywall, setShowPaywall] = useState(false);

  const availableDays = useMemo(() => {
    const uniqueDates = new Set(entries.map((e) => normalizeDate(e.createdAt)));
    return uniqueDates.size;
  }, [entries]);

  const foodIndex = useMemo(() => {
    const index: Record<string, FoodItem> = {};
    for (const food of FOOD_DB) {
      index[food.id] = food;
    }
    for (const food of customFoods) {
      index[food.id] = food;
    }
    return index;
  }, [customFoods]);

  const periodDates = useMemo(() => {
    const today = normalizeDate(new Date().toISOString());
    const base = new Date(`${today}T12:00:00`);
    const dates: string[] = [];
    for (let i = selectedPeriod - 1; i >= 0; i--) {
      const d = new Date(base);
      d.setDate(d.getDate() - i);
      dates.push(normalizeDate(d.toISOString()));
    }
    return dates;
  }, [selectedPeriod]);

  const completeDaysOverall = useMemo(() => {
    const caloriesByDate: Record<string, number> = {};
    for (const entry of entries) {
      const dateKey = normalizeDate(entry.createdAt);
      const items = entry.items || [];
      let mealCalories = 0;

      for (const ref of items) {
        const food = foodIndex[ref.foodId];
        if (!food) continue;
        const multiplier = ref.multiplier || 1;
        mealCalories += (food.calories_kcal || 0) * multiplier;
      }

      caloriesByDate[dateKey] = (caloriesByDate[dateKey] || 0) + mealCalories;
    }

    return Object.values(caloriesByDate).filter((cal) => cal >= MIN_CALORIES_FOR_COMPLETE_DAY).length;
  }, [entries, foodIndex]);

  const periodData = useMemo(() => {
    const datesSet = new Set(periodDates);
    const entriesByDate: Record<string, MealEntry[]> = {};
    const dayTotals: Record<string, DayTotals> = {};
    const mealTotalsById: Record<string, MealTotals> = {};

    for (const date of periodDates) {
      entriesByDate[date] = [];
      dayTotals[date] = {
        date,
        mealsCount: 0,
        itemsCount: 0,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        missingFoodItems: 0,
      };
    }

    for (const entry of entries) {
      const dateKey = normalizeDate(entry.createdAt);
      if (!datesSet.has(dateKey)) continue;

      entriesByDate[dateKey].push(entry);

      const items = entry.items || [];
      const day = dayTotals[dateKey];
      day.mealsCount += 1;
      day.itemsCount += items.length;

      const mealTotals: MealTotals = {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        missingFoodItems: 0,
      };

      for (const ref of items) {
        const food = foodIndex[ref.foodId];
        if (!food) {
          mealTotals.missingFoodItems += 1;
          day.missingFoodItems += 1;
          continue;
        }

        const multiplier = ref.multiplier || 1;
        const calories = (food.calories_kcal || 0) * multiplier;
        const protein = (food.protein_g || 0) * multiplier;
        const carbs = (food.carbs_g || 0) * multiplier;
        const fat = (food.fat_g || 0) * multiplier;

        mealTotals.calories += calories;
        mealTotals.protein += protein;
        mealTotals.carbs += carbs;
        mealTotals.fat += fat;

        day.calories += calories;
        day.protein += protein;
        day.carbs += carbs;
        day.fat += fat;
      }

      mealTotalsById[entry.id] = mealTotals;
    }

    for (const date of periodDates) {
      entriesByDate[date].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }

    const completeDates = periodDates.filter(
      (date) => dayTotals[date].calories >= MIN_CALORIES_FOR_COMPLETE_DAY
    );
    const daysComplete = completeDates.length;

    let completeMeals = 0;
    let completeMealsWithItems = 0;
    let completeMissingFoodItems = 0;
    let completeCalories = 0;
    let completeProtein = 0;

    for (const date of completeDates) {
      const dayEntries = entriesByDate[date] || [];
      completeMeals += dayEntries.length;
      completeMealsWithItems += dayEntries.filter((entry) => (entry.items || []).length > 0).length;
      completeMissingFoodItems += dayTotals[date].missingFoodItems;
      completeCalories += dayTotals[date].calories;
      completeProtein += dayTotals[date].protein;
    }

    return {
      entriesByDate,
      dayTotals,
      mealTotalsById,
      completeDates,
      summary: {
        daysInPeriod: periodDates.length,
        daysComplete,
        totalMeals: completeMeals,
        mealsWithItems: completeMealsWithItems,
        missingFoodItems: completeMissingFoodItems,
        avgCalories: daysComplete > 0 ? completeCalories / daysComplete : 0,
        avgProtein: daysComplete > 0 ? completeProtein / daysComplete : 0,
        avgMealsPerDay: daysComplete > 0 ? completeMeals / daysComplete : 0,
      },
    };
  }, [entries, foodIndex, periodDates]);

  if (availableDays === 0) {
    return (
      <>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🍽️</Text>
            <Text style={[styles.emptyTitle, { color: colorValue(colors.text) }]}>Journal alimentaire</Text>
            <Text style={[styles.emptySubtitle, { color: colors.icon }]}>Commence à enregistrer tes repas.</Text>
            <Text style={[styles.emptyDescription, { color: colors.icon }]}>Chaque repas alimente ta future analyse IA.</Text>
            <View style={styles.emptyActions}>
              <Button label="Ajouter un repas" onPress={() => router.push('/(tabs)')} fullWidth />
              {!hasSubscription && (
                <Button
                  label="Débloquer l'analyse IA"
                  onPress={() => setShowPaywall(true)}
                  variant="secondary"
                  fullWidth
                  style={styles.secondaryButton}
                />
              )}
            </View>
          </View>
        </View>
        <PaywallModal visible={showPaywall} onClose={() => setShowPaywall(false)} />
      </>
    );
  }

  const progressTo7 = Math.min(completeDaysOverall / 7, 1);
  const progressTo14 = Math.min(completeDaysOverall / 14, 1);
  const progressTo30 = Math.min(completeDaysOverall / 30, 1);
  const remainingFor7 = Math.max(0, 7 - completeDaysOverall);
  const progressHint =
    completeDaysOverall >= 7
      ? 'Analyse 7 jours disponible.'
      : `Encore ${remainingFor7} jours complets pour débloquer l'analyse 7j.`;
  const displayDates = periodData.completeDates;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colorValue(colors.text) }]}>Journal alimentaire</Text>
          <Text style={[styles.subtitle, { color: colors.icon }]}>Collecte des données simples et fiables.</Text>
        </View>
        <Button
          label="Ajouter un repas"
          onPress={() => router.push('/(tabs)')}
          variant="secondary"
          size="small"
        />
      </View>

      <View style={[styles.summaryCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colorValue(colors.text) }]}>Résumé de la période</Text>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: colors.icon }]}>Jours complets</Text>
            <Text style={[styles.summaryValue, { color: colorValue(colors.text) }]}>
              {periodData.summary.daysComplete}/{periodData.summary.daysInPeriod}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: colors.icon }]}>Repas (jours complets)</Text>
            <Text style={[styles.summaryValue, { color: colorValue(colors.text) }]}>
              {periodData.summary.totalMeals}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: colors.icon }]}>Moy kcal / jour (complet)</Text>
            <Text style={[styles.summaryValue, { color: colorValue(colors.text) }]}>
              {Math.round(periodData.summary.avgCalories)}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: colors.icon }]}>Moy prot / jour (complet)</Text>
            <Text style={[styles.summaryValue, { color: colorValue(colors.text) }]}>
              {Math.round(periodData.summary.avgProtein)} g
            </Text>
          </View>
        </View>
        <Text style={[styles.summaryMeta, { color: colors.icon }]}>
          Repas avec aliments (jours complets): {periodData.summary.mealsWithItems}/{periodData.summary.totalMeals || 0}
        </Text>
        <Text style={[styles.summaryMeta, { color: colors.icon }]}>
          Jours complets (global): {completeDaysOverall}/{availableDays}
        </Text>
        <Text style={[styles.summaryMeta, { color: colors.icon }]}>
          Repas moyen par jour (complet): {periodData.summary.avgMealsPerDay.toFixed(1)}
        </Text>
        {periodData.summary.missingFoodItems > 0 && (
          <Text style={[styles.summaryWarning, { color: colors.warning }]}>
            Aliments inconnus (jours complets): {periodData.summary.missingFoodItems}
          </Text>
        )}
      </View>

      <View style={[styles.progressCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colorValue(colors.text) }]}>Progression IA</Text>
        <Text style={[styles.progressHint, { color: colors.icon }]}>{progressHint}</Text>

        <View style={styles.progressItem}>
          <View style={styles.progressHeader}>
            <Text style={[styles.progressLabel, { color: colors.icon }]}>7 jours</Text>
            <Text style={[styles.progressValue, { color: colors.icon }]}>{Math.min(completeDaysOverall, 7)}/7</Text>
          </View>
          <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
            <View style={[styles.progressFill, { width: `${Math.round(progressTo7 * 100)}%`, backgroundColor: colors.primary }]} />
          </View>
        </View>

        <View style={styles.progressItem}>
          <View style={styles.progressHeader}>
            <Text style={[styles.progressLabel, { color: colors.icon }]}>14 jours</Text>
            <Text style={[styles.progressValue, { color: colors.icon }]}>{Math.min(completeDaysOverall, 14)}/14</Text>
          </View>
          <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
            <View style={[styles.progressFill, { width: `${Math.round(progressTo14 * 100)}%`, backgroundColor: colors.primary }]} />
          </View>
        </View>

        <View style={styles.progressItem}>
          <View style={styles.progressHeader}>
            <Text style={[styles.progressLabel, { color: colors.icon }]}>30 jours</Text>
            <Text style={[styles.progressValue, { color: colors.icon }]}>{Math.min(completeDaysOverall, 30)}/30</Text>
          </View>
          <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
            <View style={[styles.progressFill, { width: `${Math.round(progressTo30 * 100)}%`, backgroundColor: colors.primary }]} />
          </View>
        </View>
      </View>

      <View style={styles.periodSelector}>
        {PERIOD_OPTIONS.map((period) => (
          <TouchableOpacity
            key={period}
            style={[
              styles.periodButton,
              { borderColor: colors.border },
              selectedPeriod === period && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => setSelectedPeriod(period)}
          >
            <Text
              style={[
                styles.periodButtonText,
                { color: colors.text.primary },
                selectedPeriod === period && { color: '#fff', fontWeight: '600' },
              ]}
            >
              {period} jours
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={[styles.aiCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colorValue(colors.text) }]}>Analyse IA</Text>
        <Text style={[styles.aiDescription, { color: colors.icon }]}>
          L'analyse arrive quand tu as assez de données fiables.
        </Text>
        {!hasSubscription ? (
          <Button label="Débloquer l'analyse IA" onPress={() => setShowPaywall(true)} variant="secondary" />
        ) : (
          <Text style={[styles.aiStatus, { color: colors.success }]}>
            Abonnement actif. Analyse IA disponible après 7 jours complets.
          </Text>
        )}
      </View>
      <PaywallModal visible={showPaywall} onClose={() => setShowPaywall(false)} />

      <ScrollView style={styles.results} showsVerticalScrollIndicator={false}>
        {displayDates.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.icon }]}>
            Aucun jour complet sur la période sélectionnée.
          </Text>
        ) : (
          displayDates.map((date) => {
          const dayEntries = periodData.entriesByDate[date] || [];
          const dayTotals = periodData.dayTotals[date];
          const dayCalories = Math.round(dayTotals.calories);
          const dayProtein = Math.round(dayTotals.protein);
          const isComplete = dayTotals.calories >= MIN_CALORIES_FOR_COMPLETE_DAY;

          return (
            <View key={date} style={[styles.dayBlock, { backgroundColor: colors.background, borderColor: colors.border }]}
            >
              <View style={styles.dayHeader}>
                <Text style={[styles.dayTitle, { color: colorValue(colors.text) }]}>
                  {new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: '2-digit',
                    month: '2-digit',
                    year: '2-digit',
                  })}
                </Text>
                <View style={styles.badgesRow}>
                  {cheatDays[date] && (
                    <View style={[styles.badge, { backgroundColor: colors.warning }]}>
                      <Text style={styles.badgeText}>Cheat</Text>
                    </View>
                  )}
                  {dayTotals.mealsCount === 0 ? (
                    <View style={[styles.badge, { backgroundColor: colors.border }]}>
                      <Text style={styles.badgeText}>Vide</Text>
                    </View>
                  ) : isComplete ? (
                    <View style={[styles.badge, { backgroundColor: colors.success }]}>
                      <Text style={styles.badgeText}>Complet</Text>
                    </View>
                  ) : (
                    <View style={[styles.badge, { backgroundColor: colors.warning }]}>
                      <Text style={styles.badgeText}>Partiel</Text>
                    </View>
                  )}
                </View>
              </View>
              <Text style={[styles.dayMeta, { color: colors.icon }]}>
                {dayTotals.mealsCount} repas · {dayCalories} kcal · {dayProtein} g protéines
              </Text>
              {dayTotals.missingFoodItems > 0 && (
                <Text style={[styles.dayMetaWarning, { color: colors.warning }]}>
                  {dayTotals.missingFoodItems} aliments inconnus
                </Text>
              )}

              {dayEntries.length > 0 ? (
                dayEntries.map((meal, idx) => {
                  const mealTotals = periodData.mealTotalsById[meal.id] || {
                    calories: 0,
                    protein: 0,
                    carbs: 0,
                    fat: 0,
                    missingFoodItems: 0,
                  };
                  const mealTime = new Date(meal.createdAt);
                  const mealTimeLabel = Number.isNaN(mealTime.getTime())
                    ? ''
                    : mealTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

                  return (
                    <View key={meal.id || idx} style={[styles.mealCard, { borderColor: colors.border }]}
                    >
                      <View style={styles.mealHeader}>
                        <Text style={[styles.mealTitle, { color: colorValue(colors.text) }]}>
                          {meal.label || 'Repas'}
                        </Text>
                        <Text style={[styles.mealTime, { color: colors.icon }]}>{mealTimeLabel}</Text>
                      </View>
                      <Text style={[styles.mealTotals, { color: colors.icon }]}>
                        {Math.round(mealTotals.calories)} kcal · {Math.round(mealTotals.protein)} g prot · {Math.round(mealTotals.carbs)} g gluc · {Math.round(mealTotals.fat)} g lip
                      </Text>
                      {meal.items && meal.items.length > 0 ? (
                        meal.items.map((item, itemIndex) => {
                          const food = foodIndex[item.foodId];
                          const multiplier = item.multiplier || 1;
                          const calories = food ? Math.round((food.calories_kcal || 0) * multiplier) : null;
                          const portionLabel = item.portionGrams
                            ? `${Math.round(item.portionGrams)} g`
                            : item.quantityHint || '';
                          const multiplierLabel = multiplier !== 1 ? `x${multiplier.toFixed(1)}` : '';

                          return (
                            <Text key={itemIndex} style={[styles.itemText, { color: colorValue(colors.text) }]}>
                              • {food?.name || 'Aliment inconnu'}
                              {portionLabel ? ` (${portionLabel})` : ''}
                              {multiplierLabel ? ` ${multiplierLabel}` : ''}
                              {calories !== null ? ` - ${calories} kcal` : ''}
                            </Text>
                          );
                        })
                      ) : (
                        <Text style={[styles.emptyText, { color: colors.icon }]}>Aucun aliment renseigné</Text>
                      )}
                    </View>
                  );
                })
              ) : (
                <Text style={[styles.emptyText, { color: colors.icon }]}>Aucun repas enregistré</Text>
              )}
            </View>
          );
        })
        )}
        <Text style={[styles.footerHint, { color: colors.icon }]}>Continue à enregistrer pour débloquer les analyses IA.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  summaryCard: {
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  summaryItem: {
    width: '48%',
  },
  summaryLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  summaryMeta: {
    fontSize: 12,
    marginTop: spacing.xs,
  },
  summaryWarning: {
    fontSize: 12,
    marginTop: spacing.xs,
    fontWeight: '600',
  },
  progressCard: {
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  progressHint: {
    fontSize: 12,
    marginBottom: spacing.sm,
  },
  progressItem: {
    marginBottom: spacing.sm,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontSize: 12,
  },
  progressValue: {
    fontSize: 12,
  },
  progressBar: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
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
  periodButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  aiCard: {
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  aiDescription: {
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  aiStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  results: {
    marginTop: spacing.md,
  },
  dayBlock: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  dayTitle: {
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  badgesRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  dayMeta: {
    fontSize: 12,
    marginBottom: spacing.sm,
  },
  dayMetaWarning: {
    fontSize: 12,
    marginBottom: spacing.sm,
    fontWeight: '600',
  },
  mealCard: {
    padding: spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  mealTitle: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginRight: spacing.xs,
  },
  mealTime: {
    fontSize: 12,
  },
  mealTotals: {
    fontSize: 12,
    marginBottom: spacing.xs,
  },
  itemText: {
    fontSize: 13,
    marginBottom: 2,
  },
  emptyText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  footerHint: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: 16,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  emptyActions: {
    width: '100%',
    gap: spacing.sm,
  },
  secondaryButton: {
    marginTop: spacing.xs,
  },
});
