import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { getTodayLocal } from '../lib/stats';

interface CaloriesChartProps {
  dayCaloriesMap: Record<string, number>;
  targetCalories?: number;
}

const CHART_HEIGHT = 200;
const PADDING = 16;

/**
 * Graphique des calories des 7 derniers jours
 * Montre:
 * - Barres de calories pour chaque jour
 * - Ligne d'objectif
 * - Labels des jours
 */
export function CaloriesChart({ dayCaloriesMap, targetCalories = 1800 }: CaloriesChartProps) {
  // Calculer les 7 derniers jours (inclus aujourd'hui)
  const last7Days = useMemo(() => {
    const today = new Date(getTodayLocal());
    const days = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const calories = dayCaloriesMap[dateStr] || 0;
      days.push({
        date: dateStr,
        day: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][date.getDay()],
        calories,
        isToday: dateStr === getTodayLocal(),
      });
    }
    return days;
  }, [dayCaloriesMap]);

  // Trouver max pour l'échelle
  const maxCalories = Math.max(
    targetCalories * 1.2,
    Math.max(...last7Days.map(d => d.calories), targetCalories)
  );

  const windowWidth = Dimensions.get('window').width;
  const chartWidth = windowWidth - 2 * PADDING;
  const pixelsPerCalorie = (CHART_HEIGHT - 40) / maxCalories;
  const targetLineY = CHART_HEIGHT - 20 - targetCalories * pixelsPerCalorie;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>��� Calories cette semaine</Text>
      
      {/* Graphique */}
      <View style={[styles.chartContainer, { height: CHART_HEIGHT }]}>
        {/* Barres */}
        <View style={styles.barsContainer}>
          {last7Days.map((day) => {
            const barHeight = Math.max(5, day.calories * pixelsPerCalorie);
            const isAboveTarget = day.calories > targetCalories;

            return (
              <View key={day.date} style={styles.barGroup}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: barHeight,
                      backgroundColor: day.isToday
                        ? '#3b82f6'
                        : isAboveTarget
                        ? '#ef4444'
                        : '#10b981',
                    },
                  ]}
                />
                <Text style={[styles.dayLabel, day.isToday && styles.dayLabelToday]}>
                  {day.day}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Ligne d'objectif (en avant) */}
        <View
          style={[
            styles.targetLine,
            {
              top: targetLineY,
              width: chartWidth,
              zIndex: 10,
            },
          ]}
        />
        <Text style={[styles.targetLabel, { top: targetLineY - 10, zIndex: 10 }]}>
          Obj: {targetCalories}
        </Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Moyenne</Text>
          <Text style={styles.statValue}>
            {Math.round(
              last7Days.reduce((sum, d) => sum + d.calories, 0) / last7Days.length
            )}
          </Text>
          <Text style={styles.statUnit}>cal</Text>
        </View>
        
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Total</Text>
          <Text style={styles.statValue}>
            {(last7Days.reduce((sum, d) => sum + d.calories, 0) / 1000).toFixed(1)}k
          </Text>
          <Text style={styles.statUnit}>cal</Text>
        </View>

        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Jours {'>'} cible</Text>
          <Text style={styles.statValue}>
            {last7Days.filter(d => d.calories > targetCalories).length}
          </Text>
          <Text style={styles.statUnit}>jours</Text>
        </View>
      </View>

      {/* Prédiction de perte de poids */}
      <View style={styles.predictionContainer}>
        <Text style={styles.predictionTitle}>📉 Prédiction de perte de poids</Text>
        {(() => {
          const avgCalories = Math.round(
            last7Days.reduce((sum, d) => sum + d.calories, 0) / last7Days.length
          );
          // TDEE estimé pour une personne modérément active (peut varier selon profil)
          const estimatedTDEE = 2300;
          const dailyDeficit = estimatedTDEE - avgCalories;
          const weeklyLoss = (dailyDeficit * 7) / 3500; // 3500 cal = 1 kg
          const monthlyLoss = weeklyLoss * 4.33;
          // Convertir en lbs (1 kg = 2.20462 lbs)
          const weeklyLossLbs = weeklyLoss * 2.20462;
          const monthlyLossLbs = monthlyLoss * 2.20462;

          return (
            <View style={styles.predictionContent}>
              <Text style={styles.predictionText}>
                Si tu maintiens {avgCalories} cal/jour (en supposant TDEE ~{estimatedTDEE}):
              </Text>
              <Text style={styles.predictionValue}>
                📉 {weeklyLossLbs.toFixed(2)} lbs/semaine
              </Text>
              <Text style={styles.predictionValue}>
                📉 {monthlyLossLbs.toFixed(1)} lbs/mois
              </Text>
              <Text style={styles.predictionNote}>
                *Estimation basée sur un déficit de {Math.round(dailyDeficit)} cal/jour
              </Text>
            </View>
          );
        })()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
    paddingHorizontal: PADDING,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e2e8f0',
    marginBottom: 12,
  },
  chartContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  targetLine: {
    position: 'absolute',
    height: 1,
    backgroundColor: '#f59e0b',
    opacity: 0.7,
  },
  targetLabel: {
    position: 'absolute',
    right: 0,
    fontSize: 11,
    color: '#f59e0b',
    fontWeight: '600',
  },
  barsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    height: '100%',
    gap: 4,
    paddingHorizontal: PADDING,
    paddingBottom: 20,
  },
  barGroup: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  bar: {
    width: '100%',
    borderRadius: 4,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 2,
    minHeight: 20,
  },
  barLabel: {
    fontSize: 8,
    color: '#fff',
    fontWeight: '600',
  },
  dayLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
  dayLabelToday: {
    color: '#3b82f6',
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  statUnit: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  predictionContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  predictionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#10b981',
    marginBottom: 8,
  },
  predictionContent: {
    gap: 6,
  },
  predictionText: {
    fontSize: 12,
    color: '#cbd5e1',
  },
  predictionValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10b981',
  },
  predictionNote: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 4,
    fontStyle: 'italic',
  },
});
