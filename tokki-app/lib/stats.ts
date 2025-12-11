// Core types and stats helpers (no side effects yet)

export type MealCategory = 'sain' | 'ok' | 'cheat';

export type FoodItemRef = {
  foodId: string;
  quantityHint?: string;
};

export type MealEntry = {
  id: string;
  label: string;
  category: MealCategory;
  score: number; // 0-100 range; higher = healthier
  createdAt: string; // ISO string
  items?: FoodItemRef[];
};

export type DayFeed = {
  date: string; // YYYY-MM-DD
  mealIds: string[];
};

export type StreakStats = {
  currentStreakDays: number;
  longestStreakDays: number;
  totalFedDays: number;
  evolutionsUnlocked: number; // 0..12
  progressToNextEvolution: number; // 0..1
};

export type DragonState = 'normal' | 'inquiet' | 'critique';

export type DragonStatus = {
  mood: DragonState;
  daysSinceLastMeal: number;
};

export type Score7Jours = {
  score: number; // 0-100
  zone: 'vert' | 'jaune' | 'rouge';
  mealsCount: number;
};

const EVOLUTION_STEP_DAYS = 30;
export const DAYS_WARNING = 2;
export const DAYS_CRITICAL = 5;

// Normalize any ISO date to YYYY-MM-DD (local timezone agnostic via UTC slice)
export function normalizeDate(dateIso: string): string {
  return new Date(dateIso).toISOString().slice(0, 10);
}

function diffDays(aIso: string, bIso: string): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const a = Date.parse(aIso.slice(0, 10));
  const b = Date.parse(bIso.slice(0, 10));
  return Math.floor((a - b) / MS_PER_DAY);
}

export function computeStreak(dayFeeds: Record<string, DayFeed>): StreakStats {
  const days = Object.keys(dayFeeds).sort();
  if (days.length === 0) {
    return {
      currentStreakDays: 0,
      longestStreakDays: 0,
      totalFedDays: 0,
      evolutionsUnlocked: 0,
      progressToNextEvolution: 0,
    };
  }

  const today = normalizeDate(new Date().toISOString());

  let current = 0;
  let cursor = today;
  while (dayFeeds[cursor]) {
    current += 1;
    const prevDay = new Date(cursor);
    prevDay.setUTCDate(prevDay.getUTCDate() - 1);
    cursor = normalizeDate(prevDay.toISOString());
  }

  // Longest streak scan
  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    const gap = diffDays(days[i], days[i - 1]);
    if (gap === 1) {
      run += 1;
      if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }

  const total = days.length;
  const evolutionsUnlocked = Math.min(12, Math.floor(current / EVOLUTION_STEP_DAYS));
  const progressToNextEvolution =
    evolutionsUnlocked >= 12 ? 1 : (current % EVOLUTION_STEP_DAYS) / EVOLUTION_STEP_DAYS;

  return {
    currentStreakDays: current,
    longestStreakDays: longest,
    totalFedDays: total,
    evolutionsUnlocked,
    progressToNextEvolution,
  };
}

export function computeDragonState(dayFeeds: Record<string, DayFeed>): DragonStatus {
  const days = Object.keys(dayFeeds);
  if (days.length === 0) {
    return { mood: 'critique', daysSinceLastMeal: 999 };
  }
  const lastDay = days.sort().slice(-1)[0];
  const diff = diffDays(normalizeDate(new Date().toISOString()), lastDay);

  let mood: DragonState = 'normal';
  if (diff >= DAYS_CRITICAL) mood = 'critique';
  else if (diff >= DAYS_WARNING) mood = 'inquiet';

  return { mood, daysSinceLastMeal: diff };
}

export function computeScore7Jours(meals: MealEntry[]): Score7Jours {
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const recent = meals.filter((m) => new Date(m.createdAt).getTime() >= sevenDaysAgo);

  if (recent.length === 0) {
    return { score: 0, zone: 'rouge', mealsCount: 0 };
  }

  const raw = recent.reduce((sum, m) => sum + m.score, 0);
  const avg = raw / recent.length;
  const clamped = Math.max(0, Math.min(100, Math.round(avg)));

  let zone: Score7Jours['zone'] = 'vert';
  if (clamped < 40) zone = 'rouge';
  else if (clamped < 70) zone = 'jaune';

  return { score: clamped, zone, mealsCount: recent.length };
}

// Helper to map manual categories to a score for 7j calculation
export function mapManualCategoryToScore(category: MealCategory): number {
  if (category === 'sain') return 85;
  if (category === 'ok') return 60;
  return 25;
}
