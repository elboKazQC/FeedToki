import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useEffect, useState, useCallback } from 'react';

type DayData = {
  date: string; // YYYY-MM-DD
  hasMeal: boolean;
  score?: number;
};

type StreakCalendarProps = {
  entries: { createdAt: string }[];
  weeksToShow?: number;
  cheatDays?: Record<string, boolean>; // Dates des jours cheat
};

export function StreakCalendar({ entries, weeksToShow = 12, cheatDays = {} }: StreakCalendarProps) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [calendarData, setCalendarData] = useState<DayData[]>([]);

  const generateCalendarData = useCallback(() => {
    const today = new Date();
    const daysToShow = weeksToShow * 7;
    const data: DayData[] = [];

    // Créer un set des dates avec repas
    const datesWithMeals = new Set(
      entries.map(e => {
        const d = new Date(e.createdAt);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })
    );

    // Générer les derniers X jours
    for (let i = daysToShow - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      
      data.push({
        date: dateStr,
        hasMeal: datesWithMeals.has(dateStr),
      });
    }

    setCalendarData(data);
  }, [entries, weeksToShow]);

  useEffect(() => {
    generateCalendarData();
  }, [generateCalendarData]);



  const getIntensityColor = (hasMeal: boolean, date: string) => {
    // Vérifier si c'est un cheat day
    if (cheatDays[date] === true) {
      return '#f59e0b'; // Orange pour les cheat days
    }
    if (!hasMeal) return '#1f2937'; // Gris foncé
    return '#22c55e'; // Vert
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Organiser les jours en semaines (7 jours par ligne)
  const weeks: DayData[][] = [];
  for (let i = 0; i < calendarData.length; i += 7) {
    weeks.push(calendarData.slice(i, i + 7));
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📅 Ton activité ({weeksToShow} dernières semaines)</Text>
      
      {/* Légende des jours de la semaine */}
      <View style={styles.weekdayLabels}>
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, idx) => (
          <Text key={idx} style={styles.weekdayLabel}>{day}</Text>
        ))}
      </View>

      {/* Grille de calendrier */}
      <View style={styles.grid}>
        {weeks.map((week, weekIdx) => (
          <View key={weekIdx} style={styles.week}>
            {week.map((day, dayIdx) => (
              <TouchableOpacity
                key={dayIdx}
                style={[
                  styles.day,
                  { backgroundColor: getIntensityColor(day.hasMeal, day.date) },
                  selectedDay === day.date && styles.daySelected,
                ]}
                onPress={() => setSelectedDay(day.date)}
              />
            ))}
          </View>
        ))}
      </View>

      {/* Info du jour sélectionné */}
      {selectedDay && (() => {
        const dayData = calendarData.find(d => d.date === selectedDay);
        const isCheatDay = cheatDays[selectedDay] === true;
        return (
          <View style={styles.selectedInfo}>
            <Text style={styles.selectedDate}>{formatDate(selectedDay)}</Text>
            <Text style={styles.selectedStatus}>
              {isCheatDay 
                ? '🎉 Journée cheat' 
                : dayData?.hasMeal 
                  ? '✅ Dragon nourri' 
                  : '⭕ Pas d\'activité'}
            </Text>
          </View>
        );
      })()}

      {/* Légende */}
      <View style={styles.legend}>
        <Text style={styles.legendText}>Moins</Text>
        <View style={styles.legendSquares}>
          <View style={[styles.legendSquare, { backgroundColor: '#1f2937' }]} />
          <View style={[styles.legendSquare, { backgroundColor: '#22c55e' }]} />
          <View style={[styles.legendSquare, { backgroundColor: '#f59e0b' }]} />
        </View>
        <Text style={styles.legendText}>Plus</Text>
        <Text style={[styles.legendText, { marginLeft: 8 }]}>🎉 Cheat</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    marginVertical: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e5e7eb',
    marginBottom: 16,
  },
  weekdayLabels: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  weekdayLabel: {
    fontSize: 11,
    color: '#9ca3af',
    width: 28,
    textAlign: 'center',
  },
  grid: {
    gap: 3,
  },
  week: {
    flexDirection: 'row',
    gap: 3,
    justifyContent: 'space-around',
  },
  day: {
    width: 28,
    height: 28,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#374151',
  },
  daySelected: {
    borderColor: '#fbbf24',
    borderWidth: 2,
  },
  selectedInfo: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#1f2937',
    borderRadius: 8,
  },
  selectedDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e5e7eb',
    marginBottom: 4,
  },
  selectedStatus: {
    fontSize: 13,
    color: '#9ca3af',
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 8,
  },
  legendText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  legendSquares: {
    flexDirection: 'row',
    gap: 4,
  },
  legendSquare: {
    width: 16,
    height: 16,
    borderRadius: 3,
  },
});
