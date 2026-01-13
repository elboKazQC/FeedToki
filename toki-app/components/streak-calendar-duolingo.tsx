import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { normalizeDate } from '../lib/stats';

type StreakCalendarDuolingoProps = {
  currentStreakDays: number;
  dayFeeds: Record<string, { date: string; mealIds: string[] }>;
  dayCaloriesMap: Record<string, number>;
  minCalories?: number;
  daysToShow?: number;
  cheatDays?: Record<string, boolean>; // Dates des jours cheat
};

// Date par défaut pour éviter les erreurs d'hydratation SSR
const DEFAULT_NOW = new Date('2026-01-01T12:00:00.000Z');

export function StreakCalendarDuolingo({
  currentStreakDays,
  dayFeeds,
  dayCaloriesMap,
  minCalories = 800,
  daysToShow = 10,
  cheatDays = {},
}: StreakCalendarDuolingoProps) {
  // État pour forcer le re-render côté client avec la vraie date
  const [clientNow, setClientNow] = useState<Date>(DEFAULT_NOW);
  
  useEffect(() => {
    setClientNow(new Date());
  }, []);
  
  // Calculer les jours une seule fois avec useMemo pour éviter l'erreur d'hydratation
  const { today, days } = useMemo(() => {
    const now = clientNow;
    const todayStr = normalizeDate(now.toISOString());
    
    // Générer les jours à afficher (du plus ancien au plus récent)
    const daysArray: Array<{
      date: string;
      isComplete: boolean;
      isToday: boolean;
      dayNumber: number;
    }> = [];
    
    for (let i = daysToShow - 1; i >= 0; i--) {
      // Créer la date en temps local pour éviter les décalages
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
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
  }, [clientNow, dayFeeds, dayCaloriesMap, minCalories, daysToShow]);
  
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
    // Parser la date comme temps local, pas UTC
    // new Date("2026-01-05") est interprété comme UTC minuit, causant un décalage
    const [year, month, dayNum] = day.date.split('-').map(Number);
    const date = new Date(year, month - 1, dayNum);
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
          const isCheatDay = cheatDays[day.date] === true;
          
          return (
            <View key={day.date} style={styles.dayContainer}>
              <View style={styles.dayContent}>
                {/* Point du jour */}
                <View
                  style={[
                    styles.dayPoint,
                    day.isComplete && !isCheatDay && styles.dayPointComplete,
                    isInStreak && !isCheatDay && styles.dayPointInStreak,
                    day.isToday && !isCheatDay && styles.dayPointToday,
                    isCheatDay && styles.dayPointCheat,
                  ]}
                >
                  {day.isComplete && !isCheatDay && <View style={styles.dayPointInner} />}
                  {isCheatDay && <Text style={styles.cheatDayIcon}>🎉</Text>}
                </View>
                
                {/* Ligne de connexion vers le jour suivant */}
                {showLine && <View style={styles.connectionLine} />}
              </View>
              
              {/* Label du jour */}
              <Text style={[
                styles.dayLabel, 
                day.isToday && styles.dayLabelToday,
                isCheatDay && styles.dayLabelCheat,
              ]}>
                {formatDayLabel(day)}
              </Text>
              
              {/* Indicateur de complétion */}
              {day.isComplete && !isCheatDay && (
                <Text style={styles.dayComplete}>✓</Text>
              )}
              {isCheatDay && (
                <Text style={styles.cheatDayLabel}>Cheat</Text>
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
    width: '100%',
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
    top: 10,
    left: '50%',
    width: '100%',
    height: 3,
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
  dayPointCheat: {
    backgroundColor: '#ef4444',
    borderColor: '#dc2626',
    borderWidth: 3,
  },
  cheatDayIcon: {
    fontSize: 12,
  },
  dayLabelCheat: {
    color: '#ef4444',
    fontWeight: '600',
  },
  cheatDayLabel: {
    fontSize: 10,
    color: '#ef4444',
    marginTop: 2,
    fontWeight: '600',
  },
  streakMessage: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 8,
  },
});

