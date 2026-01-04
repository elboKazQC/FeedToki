import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { Button } from './ui/Button';
import { useTheme } from '../lib/theme-context';
import { Colors } from '../constants/theme';
import { spacing } from '../constants/design-tokens';
import { MealEntry } from '../lib/stats';
import { FoodItem } from '../lib/food-db';
import { computeDailyTotals, NutritionTargets } from '../lib/nutrition';
import {
  analyzeNutritionPeriod,
  NutritionPeriodDays,
  NutritionAnalysisResult,
  DailySummary,
} from '../lib/ai-nutrition-coach';
import { PaywallModal } from './paywall-modal';

type NutritionAnalysisCardProps = {
  entries: MealEntry[];
  customFoods: FoodItem[];
  targets: NutritionTargets;
  userId: string;
  hasSubscription: boolean;
};

export function NutritionAnalysisCard({
  entries,
  customFoods,
  targets,
  userId,
  hasSubscription,
}: NutritionAnalysisCardProps) {
  const { activeTheme } = useTheme();
  const colors = Colors[activeTheme];

  console.log('[NutritionAnalysisCard] Rendering with:', { 
    entriesCount: entries.length,
    hasSubscription,
    userId
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
          <Text style={[styles.waitingTitle, { color: colors.text }]}>Coach Nutrition IA</Text>
          <Text style={[styles.waitingSubtitle, { color: colors.icon }]}>
            En attente de données...
          </Text>
          <Text style={[styles.waitingDescription, { color: colors.icon }]}>
            Commence à logger tes repas pour débloquer l'analyse IA.{'\n\n'}
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
      // Get the last N days
      const today = new Date();
      const dates: string[] = [];
      for (let i = selectedPeriod - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().split('T')[0]);
      }

      // Compute daily summaries
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
        };
      });

      const result = await analyzeNutritionPeriod({
        dailySummaries,
        targets,
        periodDays: selectedPeriod,
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
            <Text style={[styles.lockedTitle, { color: colors.text }]}>Coach Nutrition IA</Text>
            <Text style={[styles.lockedSubtitle, { color: colors.icon }]}>
              Analyse personnalisée de tes habitudes alimentaires
            </Text>
            <Text style={[styles.lockedDescription, { color: colors.icon }]}>
              • Identifie où couper les calories facilement{'\n'}
              • Conseils d'expert en nutrition{'\n'}
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

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>🧠 Coach Nutrition IA</Text>
        <Text style={[styles.subtitle, { color: colors.icon }]}>
          Analyse personnalisée de tes {selectedPeriod} derniers jours
        </Text>
      </View>

      {/* Period Selector */}
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
              { color: colors.text },
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
              { color: colors.text },
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
              { color: colors.text },
              selectedPeriod === 30 && { color: '#fff', fontWeight: '600' },
            !canAnalyze30 && { color: colors.icon },
            ]}
          >
            30 jours
          </Text>
        </TouchableOpacity>
      </View>

      {!canAnalyze7 && (
        <Text style={[styles.warningText, { color: colors.error }]}>
          ⚠️ Besoin de {7 - availableDays} jours de plus pour analyser
        </Text>
      )}

      {/* Analyze Button */}
      {!analysis && (
        <Button
          label={isAnalyzing ? 'Analyse en cours...' : '🎯 Analyser mon alimentation'}
          onPress={handleAnalyze}
          loading={isAnalyzing}
          disabled={isAnalyzing || !canAnalyze7}
          style={styles.analyzeButton}
        />
      )}

      {error && (
        <View style={[styles.errorBox, { backgroundColor: colors.warning + '20' }]}>
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        </View>
      )}

      {/* Analysis Results */}
      {analysis && !isAnalyzing && (
        <ScrollView style={styles.results}>
          {/* Overall Score */}
          <View style={[styles.scoreCard, { backgroundColor: colors.background }]}>
            <Text style={[styles.scoreLabel, { color: colors.icon }]}>Score Global</Text>
            <Text style={[styles.scoreValue, { color: getScoreColor(analysis.overallScore) }]}>
              {analysis.overallScore}/100
            </Text>
            <Text style={[styles.scoreSubtext, { color: colors.icon }]}>
              {getScoreLabel(analysis.overallScore)}
            </Text>
          </View>

          {/* Averages */}
          <View style={[styles.averagesCard, { backgroundColor: colors.background }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>📊 Moyennes quotidiennes</Text>
            <View style={styles.averageRow}>
              <Text style={[styles.averageLabel, { color: colors.icon }]}>
                Calories: <Text style={{ color: colors.text, fontWeight: '600' }}>{analysis.averages.calories} kcal</Text>
              </Text>
              <Text style={[styles.averageLabel, { color: colors.icon }]}>
                Protéines: <Text style={{ color: colors.text, fontWeight: '600' }}>{analysis.averages.protein_g}g</Text>
              </Text>
            </View>
            <View style={styles.averageRow}>
              <Text style={[styles.averageLabel, { color: colors.icon }]}>
                Glucides: <Text style={{ color: colors.text, fontWeight: '600' }}>{analysis.averages.carbs_g}g</Text>
              </Text>
              <Text style={[styles.averageLabel, { color: colors.icon }]}>
                Lipides: <Text style={{ color: colors.text, fontWeight: '600' }}>{analysis.averages.fat_g}g</Text>
              </Text>
            </View>
            <Text style={[styles.averageLabel, { color: colors.icon }]}>
              Consistance: <Text style={{ color: colors.text, fontWeight: '600' }}>{analysis.averages.consistency}%</Text>
            </Text>
          </View>

          {/* Insights */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>💡 Insights</Text>
            {analysis.insights.map((insight, idx) => (
              <View
                key={idx}
                style={[
                  styles.insightCard,
                  { backgroundColor: colors.background, borderLeftColor: getInsightColor(insight.type) },
                ]}
              >
                <Text style={styles.insightIcon}>{insight.icon}</Text>
                <View style={styles.insightContent}>
                  <Text style={[styles.insightTitle, { color: colors.text }]}>{insight.title}</Text>
                  <Text style={[styles.insightMessage, { color: colors.icon }]}>
                    {insight.message}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Recommendations */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>🎯 Recommandations</Text>
            {analysis.recommendations.map((rec, idx) => (
              <View
                key={idx}
                style={[styles.recommendationCard, { backgroundColor: colors.background }]}
              >
                <View style={styles.recHeader}>
                  <Text style={styles.recIcon}>{rec.icon}</Text>
                  <View
                    style={[
                      styles.priorityBadge,
                      { backgroundColor: getPriorityColor(rec.priority) },
                    ]}
                  >
                    <Text style={styles.priorityText}>Priorité {rec.priority}</Text>
                  </View>
                </View>
                <Text style={[styles.recAction, { color: colors.text }]}>{rec.action}</Text>
                <Text style={[styles.recReason, { color: colors.icon }]}>{rec.reason}</Text>
                {rec.impact && (
                  <Text style={[styles.recImpact, { color: colors.primary }]}>
                    💪 {rec.impact}
                  </Text>
                )}
              </View>
            ))}
          </View>

          <Button
            label="🔄 Nouvelle analyse"
            onPress={() => {
              setAnalysis(null);
              setError(null);
            }}
            style={styles.newAnalysisButton}
          />
        </ScrollView>
      )}
    </View>
  );
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#4ade80'; // green
  if (score >= 60) return '#facc15'; // yellow
  return '#f87171'; // red
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent! 🎉';
  if (score >= 60) return 'Bon travail 👍';
  if (score >= 40) return 'En progression 💪';
  return 'On commence! 🌱';
}

function getInsightColor(type: string): string {
  if (type === 'positive') return '#4ade80';
  if (type === 'challenge') return '#f87171';
  return '#60a5fa';
}

function getPriorityColor(priority: number): string {
  if (priority === 1) return '#ef4444';
  if (priority === 2) return '#f59e0b';
  return '#3b82f6';
}

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
  scoreCard: {
    padding: spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  scoreLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  scoreSubtext: {
    fontSize: 16,
    fontWeight: '500',
  },
  averagesCard: {
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.md,
  },
  averageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  averageLabel: {
    fontSize: 14,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  insightCard: {
    flexDirection: 'row',
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
  },
  insightIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  insightMessage: {
    fontSize: 14,
    lineHeight: 20,
  },
  recommendationCard: {
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.md,
  },
  recHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  recIcon: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  priorityBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  recAction: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  recReason: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
  recImpact: {
    fontSize: 14,
    fontWeight: '600',
  },
  newAnalysisButton: {
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
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
