// Utilitaire pour déterminer le moment de la journée
// morning: 5h-12h, afternoon: 12h-18h, evening: 18h-5h
export type TimeOfDay = 'morning' | 'afternoon' | 'evening';

export function getTimeOfDay(date: Date = new Date()): TimeOfDay {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'evening';
}
