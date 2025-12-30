import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { MealEntry, normalizeDate } from '../lib/stats';
import { computeDailyTotals } from '../lib/nutrition';
import { FoodItem } from '../lib/food-db';

type BestDaysProps = {
  entries: MealEntry[];
  customFoods?: FoodItem[];
  daysToShow?: number;
  excludedDays?: string[]; // Jours exclus du classement (mais données conservées)
  onExcludeDay?: (date: string) => void; // Callback pour exclure un jour du classement
};

type DaySummary = {
  date: string;
  score: number;
  meals: MealEntry[];
  totals: ReturnType<typeof computeDailyTotals>;
};

export function BestDays({ entries, customFoods = [], daysToShow = 3, excludedDays = [], onExcludeDay }: BestDaysProps) {
  // Calculer les dates de référence une seule fois (évite l'erreur d'hydratation)
  const dateRefs = useMemo(() => {
    const now = new Date();
    const today = normalizeDate(now.toISOString());
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = normalizeDate(yesterday.toISOString());
    return { today, yesterday: yesterdayStr };
  }, []);
  
  // Grouper les entrées par jour et calculer le score pour chaque jour
  const dailySummaries = useMemo(() => {
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
      
      // Calculer le score moyen des repas de ce jour
      const scores = dayEntries.map(e => e.score);
      const avgScore = scores.length > 0 
        ? scores.reduce((sum, s) => sum + s, 0) / scores.length 
        : 0;
      
      const totals = computeDailyTotals(dayEntries, dayEntries[0]?.createdAt || new Date().toISOString(), customFoods || []);
      
      summaries.push({
        date,
        score: Math.round(avgScore),
        meals: dayEntries.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
        totals,
      });
    });
    
    // Trier par score décroissant et prendre les meilleurs
    return summaries
      .sort((a, b) => b.score - a.score)
      .slice(0, daysToShow);
  }, [entries, customFoods, daysToShow, excludedDays]);
  
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
    if (score >= 70) return '#22c55e'; // Vert
    if (score >= 40) return '#f59e0b'; // Orange
    return '#ef4444'; // Rouge
  };
  
  const getScoreLabel = (score: number) => {
    if (score >= 70) return 'Excellent';
    if (score >= 40) return 'Bon';
    return 'À améliorer';
  };
  
  if (dailySummaries.length === 0) {
    return null;
  }
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🏆 Tes {dailySummaries.length} meilleur{dailySummaries.length > 1 ? 's' : ''} jour{dailySummaries.length > 1 ? 's' : ''}</Text>
      <Text style={styles.subtitle}>Pour t&apos;aider à répliquer tes succès</Text>
      
      <ScrollView style={styles.scrollView} horizontal showsHorizontalScrollIndicator={false}>
        {dailySummaries.map((day, index) => (
          <View key={day.date} style={styles.dayCard}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayRank}>#{index + 1}</Text>
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
          </View>
        ))}
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
  scrollView: {
    flexDirection: 'row',
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

