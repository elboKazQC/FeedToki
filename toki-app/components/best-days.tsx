import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { MealEntry, normalizeDate } from '../lib/stats';
import { computeDailyTotals, computeDayScore, NutritionTargets } from '../lib/nutrition';
import { FoodItem } from '../lib/food-db';

export type DaySummary = {
  date: string;
  score: number;
  meals: MealEntry[];
  totals: ReturnType<typeof computeDailyTotals>;
};

type ScoreGroup = {
  score: number;
  days: DaySummary[];
};

type BestDaysProps = {
  entries: MealEntry[];
  customFoods?: FoodItem[];
  targets?: NutritionTargets; // Objectifs nutritionnels pour calculer le score
  expectedMealsPerDay?: number; // Nombre de repas attendus par jour (défaut: 3)
  daysToShow?: number;
  excludedDays?: string[]; // Jours exclus du classement (mais données conservées)
  onExcludeDay?: (date: string) => void; // Callback pour exclure un jour du classement
  onDayPress?: (day: DaySummary) => void; // Callback pour cliquer sur une journée
};

// Date par défaut pour éviter les erreurs d'hydratation SSR
const DEFAULT_NOW = new Date('2026-01-01T12:00:00.000Z');

export function BestDays({ entries, customFoods = [], targets, expectedMealsPerDay = 3, daysToShow = 3, excludedDays = [], onExcludeDay, onDayPress }: BestDaysProps) {
  // État pour la date côté client (évite erreur d'hydratation)
  const [clientNow, setClientNow] = useState<Date>(DEFAULT_NOW);
  
  useEffect(() => {
    setClientNow(new Date());
  }, []);
  
  // Calculer les dates de référence une seule fois (évite l'erreur d'hydratation)
  const dateRefs = useMemo(() => {
    const now = clientNow;
    const today = normalizeDate(now.toISOString());
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = normalizeDate(yesterday.toISOString());
    return { today, yesterday: yesterdayStr };
  }, [clientNow]);
  
  // Grouper les entrées par jour et calculer le score pour chaque jour
  const scoreGroups = useMemo(() => {
    const dayMap = new Map<string, MealEntry[]>();
    
    // Grouper les entrées par date
    entries.forEach(entry => {
      const date = normalizeDate(entry.createdAt);
      if (!dayMap.has(date)) {
        dayMap.set(date, []);
      }
      dayMap.get(date)!.push(entry);
    });
    
    // Calculer le score pour chaque jour
    const summaries: DaySummary[] = [];
    
    dayMap.forEach((dayEntries, date) => {
      // Ignorer les jours exclus du classement
      if (excludedDays.includes(date)) {
        return;
      }
      
      // Utiliser computeDayScore si targets disponibles, sinon moyenne simple (rétrocompatibilité)
      let dayScore: number;
      if (targets) {
        dayScore = computeDayScore(dayEntries, targets, customFoods || [], expectedMealsPerDay);
      } else {
        // Fallback: moyenne simple des scores des repas
        const scores = dayEntries.map(e => e.score);
        dayScore = scores.length > 0 
          ? scores.reduce((sum, s) => sum + s, 0) / scores.length 
          : 0;
      }
      
      const totals = computeDailyTotals(dayEntries, dayEntries[0]?.createdAt || new Date().toISOString(), customFoods || []);
      
      summaries.push({
        date,
        score: Math.round(dayScore),
        meals: dayEntries.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
        totals,
      });
    });
    
    // Grouper par score (arrondi)
    const groupsMap = new Map<number, DaySummary[]>();
    summaries.forEach(summary => {
      const scoreKey = summary.score;
      if (!groupsMap.has(scoreKey)) {
        groupsMap.set(scoreKey, []);
      }
      groupsMap.get(scoreKey)!.push(summary);
    });
    
    // Convertir en array et trier par score décroissant
    const groups: ScoreGroup[] = Array.from(groupsMap.entries())
      .map(([score, days]) => ({
        score,
        days: days.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), // Plus récentes en premier
      }))
      .sort((a, b) => b.score - a.score);
    
    // Limiter à 6 journées par groupe et aux top 5 groupes
    return groups
      .slice(0, 5)
      .map(group => ({
        ...group,
        days: group.days.slice(0, 6), // Maximum 6 journées par groupe
      }));
  }, [entries, customFoods, targets, expectedMealsPerDay, excludedDays]);
  
  // Fonctions helper utilisant les références de date stables
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    
    if (dateStr === dateRefs.today) return "Aujourd'hui";
    if (dateStr === dateRefs.yesterday) return "Hier";
    
    return date.toLocaleDateString('fr-FR', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long' 
    });
  };
  
  const getScoreColor = (score: number) => {
    if (score >= 80) return '#22c55e'; // Vert
    if (score >= 60) return '#f59e0b'; // Orange
    return '#ef4444'; // Rouge
  };
  
  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Bon';
    return 'À améliorer';
  };
  
  if (scoreGroups.length === 0) {
    return null;
  }
  
  // Calculer l'index global pour toutes les journées (pour la numérotation)
  let globalDayIndex = 0;
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🏆 Tes meilleurs jours par score</Text>
      <Text style={styles.subtitle}>Plusieurs exemples pour chaque score</Text>
      
      <ScrollView 
        style={styles.horizontalScrollView} 
        horizontal 
        showsHorizontalScrollIndicator={false}
      >
        {scoreGroups.map((group, groupIndex) => {
          return (
            <View key={group.score} style={styles.scoreGroupHorizontal}>
              {/* Titre du groupe */}
              <View style={styles.groupHeaderHorizontal}>
                <Text style={styles.groupTitleHorizontal}>
                  Score {group.score}
                </Text>
                <Text style={styles.groupSubtitleHorizontal}>
                  ({group.days.length} jour{group.days.length > 1 ? 's' : ''})
                </Text>
              </View>
              
              {/* Cartes du groupe */}
              {group.days.map((day) => {
                const currentIndex = globalDayIndex++;
                return (
                  <TouchableOpacity
                    key={day.date}
                    style={styles.dayCard}
                    onPress={() => onDayPress?.(day)}
                    activeOpacity={0.7}
                    disabled={!onDayPress}
                  >
                    <View style={styles.dayHeader}>
                      <Text style={styles.dayRank}>#{currentIndex + 1}</Text>
                      <View style={styles.dayInfo}>
                        <Text style={styles.dayDate}>{formatDate(day.date)}</Text>
                        <View style={[styles.scoreBadge, { backgroundColor: getScoreColor(day.score) }]}>
                          <Text style={styles.scoreText}>{day.score}%</Text>
                        </View>
                      </View>
                      {onExcludeDay && (
                        <TouchableOpacity
                          style={styles.excludeButton}
                          onPress={() => {
                            if (Platform.OS === 'web' && typeof window !== 'undefined' && window.confirm) {
                              const confirmed = window.confirm(`Exclure le ${formatDate(day.date)} du classement ?\n\n(Les données ne seront pas supprimées, juste masquées du top)`);
                              if (confirmed) {
                                onExcludeDay(day.date);
                              }
                            } else {
                              Alert.alert(
                                'Exclure ce jour du classement',
                                `Exclure le ${formatDate(day.date)} du top des meilleurs jours ?\n\nLes données ne seront pas supprimées, juste masquées.`,
                                [
                                  { text: 'Annuler', style: 'cancel' },
                                  {
                                    text: 'Exclure',
                                    onPress: () => onExcludeDay(day.date),
                                  },
                                ]
                              );
                            }
                          }}
                        >
                          <Text style={styles.excludeButtonText}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    
                    <Text style={styles.scoreLabel}>{getScoreLabel(day.score)}</Text>
                    
                    {/* Totaux nutritionnels */}
                    <View style={styles.nutritionSummary}>
                      <View style={styles.nutritionItem}>
                        <Text style={styles.nutritionLabel}>🔥 Calories</Text>
                        <Text style={styles.nutritionValue}>{Math.round(day.totals.calories_kcal)}</Text>
                      </View>
                      <View style={styles.nutritionItem}>
                        <Text style={styles.nutritionLabel}>💪 Protéines</Text>
                        <Text style={styles.nutritionValue}>{Math.round(day.totals.protein_g)}g</Text>
                      </View>
                    </View>
                    
                    {/* Liste des repas */}
                    <View style={styles.mealsList}>
                      <Text style={styles.mealsTitle}>Repas ({day.meals.length})</Text>
                      {day.meals.map((meal, mealIndex) => (
                        <View key={meal.id} style={styles.mealItem}>
                          <Text style={styles.mealCategory}>[{meal.category}]</Text>
                          <Text style={styles.mealLabel} numberOfLines={2}>{meal.label}</Text>
                        </View>
                      ))}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e5e7eb',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 12,
  },
  horizontalScrollView: {
    flexDirection: 'row',
  },
  scoreGroupHorizontal: {
    marginRight: 16,
  },
  groupHeaderHorizontal: {
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  groupTitleHorizontal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e5e7eb',
  },
  groupSubtitleHorizontal: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  dayCard: {
    width: 280,
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  dayRank: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fbbf24',
    marginRight: 12,
  },
  dayInfo: {
    flex: 1,
  },
  dayDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e5e7eb',
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  scoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  scoreText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  scoreLabel: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  nutritionSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#374151',
    marginBottom: 12,
  },
  nutritionItem: {
    alignItems: 'center',
  },
  nutritionLabel: {
    fontSize: 11,
    color: '#9ca3af',
    marginBottom: 4,
  },
  nutritionValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#e5e7eb',
  },
  mealsList: {
    marginTop: 8,
  },
  mealsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#d1d5db',
    marginBottom: 8,
  },
  mealItem: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingVertical: 4,
  },
  mealCategory: {
    fontSize: 11,
    color: '#9ca3af',
    marginRight: 8,
    width: 50,
  },
  mealLabel: {
    fontSize: 12,
    color: '#e5e7eb',
    flex: 1,
  },
  excludeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#6b7280', // Gris au lieu de rouge (moins alarmant car pas de suppression)
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    zIndex: 10,
  },
  excludeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

