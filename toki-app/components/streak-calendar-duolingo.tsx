import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { normalizeDate } from '../lib/stats';

type StreakCalendarDuolingoProps = {
  currentStreakDays: number;
  dayFeeds: Record<string, { date: string; mealIds: string[] }>;
  dayCaloriesMap: Record<string, number>;
  minCalories?: number;
  daysToShow?: number;
};

export function StreakCalendarDuolingo({
  currentStreakDays,
  dayFeeds,
  dayCaloriesMap,
  minCalories = 800,
  daysToShow = 10,
}: StreakCalendarDuolingoProps) {
  // Calculer les jours une seule fois avec useMemo pour éviter l'erreur d'hydratation
  const { today, days } = useMemo(() => {
    const now = new Date();
    const todayStr = normalizeDate(now.toISOString());
    
    // Générer les jours à afficher (du plus ancien au plus récent)
    const daysArray: Array<{
      date: string;
      isComplete: boolean;
      isToday: boolean;
      dayNumber: number;
    }> = [];
    
    for (let i = daysToShow - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = normalizeDate(date.toISOString());
      const calories = dayCaloriesMap[dateStr] || 0;
      const hasMeals = !!dayFeeds[dateStr];
      const isComplete = hasMeals && calories >= minCalories;
      const isToday = dateStr === todayStr;
      
      daysArray.push({
        date: dateStr,
        isComplete,
        isToday,
        dayNumber: daysToShow - i,
      });
    }
    
    return { today: todayStr, days: daysArray };
  }, [dayFeeds, dayCaloriesMap, minCalories, daysToShow]);
  
  // Trouver le premier jour complet dans la séquence (pour le streak)
  let streakStartIndex = -1;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].isComplete) {
      streakStartIndex = i;
      break;
    }
  }
  
  // Calculer quels jours font partie du streak actuel
  const streakDays = new Set<string>();
  if (streakStartIndex >= 0) {
    // Compter depuis le dernier jour complet vers le passé
    let count = 0;
    for (let i = streakStartIndex; i >= 0 && count < currentStreakDays; i--) {
      if (days[i].isComplete) {
        streakDays.add(days[i].date);
        count++;
      } else {
        break; // Streak cassé
      }
    }
  }
  
  const formatDayLabel = (day: typeof days[0]) => {
    if (day.isToday) return 'Auj.';
    const date = new Date(day.date);
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔥 Ton Streak</Text>
      <Text style={styles.streakCount}>{currentStreakDays} jour{currentStreakDays !== 1 ? 's' : ''}</Text>
      
      <View style={styles.calendarContainer}>
        {days.map((day, index) => {
          const isInStreak = streakDays.has(day.date);
          const showLine = index < days.length - 1 && isInStreak && streakDays.has(days[index + 1].date);
          
          return (
            <View key={day.date} style={styles.dayContainer}>
              <View style={styles.dayContent}>
                {/* Point du jour */}
                <View
                  style={[
                    styles.dayPoint,
                    day.isComplete && styles.dayPointComplete,
                    isInStreak && styles.dayPointInStreak,
                    day.isToday && styles.dayPointToday,
                  ]}
                >
                  {day.isComplete && <View style={styles.dayPointInner} />}
                </View>
                
                {/* Ligne de connexion vers le jour suivant */}
                {showLine && <View style={styles.connectionLine} />}
              </View>
              
              {/* Label du jour */}
              <Text style={[styles.dayLabel, day.isToday && styles.dayLabelToday]}>
                {formatDayLabel(day)}
              </Text>
              
              {/* Indicateur de complétion */}
              {day.isComplete && (
                <Text style={styles.dayComplete}>✓</Text>
              )}
            </View>
          );
        })}
      </View>
      
      {currentStreakDays > 0 && (
        <Text style={styles.streakMessage}>
          Continue comme ça ! 🔥
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#0b1220',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e5e7eb',
    marginBottom: 4,
    textAlign: 'center',
  },
  streakCount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fbbf24',
    textAlign: 'center',
    marginBottom: 16,
  },
  calendarContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  dayContainer: {
    alignItems: 'center',
    flex: 1,
  },
  dayContent: {
    alignItems: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  dayPoint: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#374151',
    backgroundColor: '#1f2937',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  dayPointComplete: {
    backgroundColor: '#22c55e',
    borderColor: '#16a34a',
  },
  dayPointInStreak: {
    backgroundColor: '#fbbf24',
    borderColor: '#f59e0b',
    borderWidth: 3,
  },
  dayPointToday: {
    borderColor: '#3b82f6',
    borderWidth: 3,
  },
  dayPointInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  connectionLine: {
    position: 'absolute',
    top: 11,
    left: 24,
    width: '100%',
    height: 2,
    backgroundColor: '#fbbf24',
    zIndex: 1,
  },
  dayLabel: {
    fontSize: 10,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 4,
  },
  dayLabelToday: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  dayComplete: {
    fontSize: 12,
    color: '#22c55e',
    marginTop: 2,
  },
  streakMessage: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 8,
  },
});

