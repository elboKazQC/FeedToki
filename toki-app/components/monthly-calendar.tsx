import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

type MonthlyCalendarProps = {
  entries: { createdAt: string }[];
  cheatDays?: Record<string, boolean>;
};

type DayData = {
  date: string;
  hasMeal: boolean;
  isCheat: boolean;
};

// Date par défaut pour éviter les erreurs d'hydratation SSR (sera mise à jour côté client)
const DEFAULT_DATE = new Date('2026-01-01T00:00:00.000Z');

export function MonthlyCalendar({ entries, cheatDays = {} }: MonthlyCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(DEFAULT_DATE);
  const [isClient, setIsClient] = useState(false);
  
  // Mettre à jour avec la vraie date côté client
  useEffect(() => {
    setCurrentMonth(new Date());
    setIsClient(true);
  }, []);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Créer un map des dates avec repas pour lookup rapide
  const entriesByDate = new Map<string, boolean>();
  entries.forEach(entry => {
    const date = new Date(entry.createdAt);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    entriesByDate.set(dateStr, true);
  });

  // Générer les jours du mois avec padding
  const generateCalendarDays = (): (DayData | null)[] => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    // Premier et dernier jour du mois
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Jour de la semaine du premier jour (0=dimanche, 1=lundi, etc.)
    // On veut lundi=0, donc on ajuste
    let firstDayOfWeek = firstDay.getDay() - 1;
    if (firstDayOfWeek === -1) firstDayOfWeek = 6; // Dimanche devient 6
    
    const daysInMonth = lastDay.getDate();
    const days: (DayData | null)[] = [];
    
    // Padding au début (cellules vides)
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null);
    }
    
    // Jours du mois
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({
        date: dateStr,
        hasMeal: entriesByDate.has(dateStr),
        isCheat: cheatDays[dateStr] || false,
      });
    }
    
    // Padding à la fin pour compléter la grille
    const totalCells = Math.ceil(days.length / 7) * 7;
    while (days.length < totalCells) {
      days.push(null);
    }
    
    return days;
  };

  const days = generateCalendarDays();

  // Navigation
  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    setSelectedDay(null);
  };

  const goToNextMonth = () => {
    const today = new Date();
    const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    
    // Bloquer navigation vers mois futurs
    if (nextMonth <= today) {
      setCurrentMonth(nextMonth);
      setSelectedDay(null);
    }
  };

  // Formater le header du mois
  const monthHeader = currentMonth.toLocaleDateString('fr-FR', { 
    month: 'long', 
    year: 'numeric' 
  });

  // Vérifier si on peut aller au mois suivant
  const today = new Date();
  const canGoNext = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1) <= today;

  // Formater la date sélectionnée
  const formatSelectedDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('fr-FR', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long' 
    });
  };

  const selectedDayData = days.find(d => d?.date === selectedDay);

  return (
    <View style={styles.container}>
      {/* Header avec navigation */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goToPreviousMonth} style={styles.navButton}>
          <Text style={styles.navButtonText}>◀</Text>
        </TouchableOpacity>
        <Text style={styles.monthTitle}>{monthHeader}</Text>
        <TouchableOpacity 
          onPress={goToNextMonth} 
          style={[styles.navButton, !canGoNext && styles.navButtonDisabled]}
          disabled={!canGoNext}
        >
          <Text style={[styles.navButtonText, !canGoNext && styles.navButtonTextDisabled]}>▶</Text>
        </TouchableOpacity>
      </View>

      {/* Jours de la semaine */}
      <View style={styles.weekdayRow}>
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, i) => (
          <View key={i} style={styles.weekdayCell}>
            <Text style={styles.weekdayText}>{day}</Text>
          </View>
        ))}
      </View>

      {/* Grille des jours */}
      <View style={styles.grid}>
        {days.map((day, index) => {
          if (!day) {
            return <View key={`empty-${index}`} style={styles.dayCell} />;
          }

          const isSelected = selectedDay === day.date;
          const dayNumber = parseInt(day.date.split('-')[2], 10);

          // Déterminer la couleur
          let bgColor = '#1f2937'; // Gris par défaut (pas d'activité)
          if (day.isCheat) {
            bgColor = '#ef4444'; // Rouge pour cheat
          } else if (day.hasMeal) {
            bgColor = '#22c55e'; // Vert pour repas normal
          }

          return (
            <TouchableOpacity
              key={day.date}
              style={[
                styles.dayCell,
                { backgroundColor: bgColor },
                isSelected && styles.dayCellSelected,
              ]}
              onPress={() => setSelectedDay(day.date)}
            >
              <Text style={styles.dayText}>{dayNumber}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Panneau d'info du jour sélectionné */}
      {selectedDay && selectedDayData && (
        <View style={styles.selectedDayPanel}>
          <Text style={styles.selectedDayDate}>{formatSelectedDate(selectedDay)}</Text>
          {selectedDayData.isCheat && (
            <Text style={styles.selectedDayStatus}>🎉 Cheat day</Text>
          )}
          {selectedDayData.hasMeal && !selectedDayData.isCheat && (
            <Text style={styles.selectedDayStatus}>✅ Dragon nourri</Text>
          )}
          {!selectedDayData.hasMeal && !selectedDayData.isCheat && (
            <Text style={styles.selectedDayStatus}>Pas d'activité</Text>
          )}
        </View>
      )}

      {/* Légende */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendSquare, { backgroundColor: '#1f2937' }]} />
          <Text style={styles.legendText}>Moins</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSquare, { backgroundColor: '#22c55e' }]} />
          <Text style={styles.legendText}>Plus</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSquare, { backgroundColor: '#ef4444' }]} />
          <Text style={styles.legendText}>🎉 Cheat</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f9fafb',
    textTransform: 'capitalize',
  },
  navButton: {
    padding: 8,
    minWidth: 40,
    alignItems: 'center',
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  navButtonText: {
    fontSize: 20,
    color: '#f9fafb',
  },
  navButtonTextDisabled: {
    color: '#6b7280',
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  weekdayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  dayCell: {
    width: '14%', // approx 100% / 7
    aspectRatio: 1,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellSelected: {
    borderWidth: 2,
    borderColor: '#fbbf24',
  },
  dayText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#f9fafb',
  },
  selectedDayPanel: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#1f2937',
    borderRadius: 8,
  },
  selectedDayDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f9fafb',
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  selectedDayStatus: {
    fontSize: 12,
    color: '#9ca3af',
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendSquare: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 11,
    color: '#9ca3af',
  },
});
