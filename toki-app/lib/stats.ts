// Core types and stats helpers (no side effects yet)

// Helper pour obtenir la date locale au format YYYY-MM-DD
export function getTodayLocal(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export type MealCategory = 'sain' | 'ok' | 'cheat';

export type FoodItemRef = {
  foodId: string;
  quantityHint?: string;
  portionSize?: string; // 'small' | 'medium' | 'large' | 'custom'
  portionGrams?: number; // Poids en grammes
  multiplier?: number; // Multiplicateur pour les macros (1.0 = portion moyenne)
  nutritionSource?: 'db' | 'off' | 'estimated' | 'custom'; // Source des données nutritionnelles
};

export type MealEntry = {
  id: string;
  label: string;
  category: MealCategory;
  score: number; // 0-100 range; higher = healthier
  createdAt: string; // ISO string
  items?: FoodItemRef[];
  isCheatMeal?: boolean; // True si le repas a été ajouté en mode "cheat day" (ne consomme pas de points)
  parsingTimeMs?: number; // Temps de parsing en millisecondes (pour repas créés via IA)
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
  streakBonusEarned: number; // Nombre de bonus de 30 jours gagnés
  isStreakBonusDay: boolean; // Vrai si aujourd'hui est un jour de bonus (multiple de 30)
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
  // Breakdown par catégorie
  sainCount: number;
  okCount: number;
  cheatCount: number;
  // Conseil actionable
  tip: string;
};

const EVOLUTION_STEP_DAYS = 30;
export const DAYS_WARNING = 2;
export const DAYS_CRITICAL = 5;
export const MIN_CALORIES_FOR_COMPLETE_DAY = 800; // Minimum de calories pour considérer la journée comme complète

// Normalize any ISO date to YYYY-MM-DD (using LOCAL time to match user's timezone)
export function normalizeDate(dateIso: string): string {
  // Si la date est déjà au format YYYY-MM-DD, la retourner telle quelle
  // Cela évite les problèmes de timezone avec new Date()
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
    return dateIso;
  }
  
  const d = new Date(dateIso);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
      streakBonusEarned: 0,
      isStreakBonusDay: false,
    };
  }

  // Get today in local time to match user's timezone
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  let current = 0;
  let cursor = today;
  while (dayFeeds[cursor]) {
    current += 1;
    const prevDay = new Date(cursor + 'T00:00:00');
    prevDay.setDate(prevDay.getDate() - 1);
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

  // Calculer les bonus de streak (chaque 30 jours / mensuel)
  const streakBonusEarned = Math.floor(current / 30);
  const isStreakBonusDay = current > 0 && current % 30 === 0;

  return {
    currentStreakDays: current,
    longestStreakDays: longest,
    totalFedDays: total,
    evolutionsUnlocked,
    progressToNextEvolution,
    streakBonusEarned,
    isStreakBonusDay,
  };
}

export function computeDragonState(dayFeeds: Record<string, DayFeed>): DragonStatus {
  const days = Object.keys(dayFeeds);
  if (days.length === 0) {
    return { mood: 'critique', daysSinceLastMeal: 999 };
  }
  const lastDay = days.sort().slice(-1)[0];
  
  // Get today in local time to match user's timezone
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const diff = diffDays(today, lastDay);

  let mood: DragonState = 'normal';
  if (diff >= DAYS_CRITICAL) mood = 'critique';
  else if (diff >= DAYS_WARNING) mood = 'inquiet';

  return { mood, daysSinceLastMeal: diff };
}

export function computeScore7Jours(meals: MealEntry[]): Score7Jours {
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const today = getTodayLocal();
  
  // Filtrer les repas des 7 derniers jours EXCLUANT la journée actuelle (incomplète)
  const recent = meals.filter((m) => {
    const mealTime = new Date(m.createdAt).getTime();
    const mealDate = normalizeDate(m.createdAt);
    return mealTime >= sevenDaysAgo && mealDate !== today;
  });

  // Calculer le breakdown par catégorie
  let sainCount = 0;
  let okCount = 0;
  let cheatCount = 0;
  
  recent.forEach((m) => {
    if (m.category === 'sain') sainCount++;
    else if (m.category === 'ok') okCount++;
    else cheatCount++;
  });

  if (recent.length === 0) {
    return { 
      score: 0, 
      zone: 'rouge', 
      mealsCount: 0,
      sainCount: 0,
      okCount: 0,
      cheatCount: 0,
      tip: 'Commence à logger tes repas! 🍽️'
    };
  }

  const raw = recent.reduce((sum, m) => sum + m.score, 0);
  const avg = raw / recent.length;
  const clamped = Math.max(0, Math.min(100, Math.round(avg)));

  let zone: Score7Jours['zone'] = 'vert';
  if (clamped < 40) zone = 'rouge';
  else if (clamped < 70) zone = 'jaune';

  // Générer un conseil actionable basé sur les données
  let tip = '';
  const cheatRatio = cheatCount / recent.length;
  const sainRatio = sainCount / recent.length;
  
  if (clamped >= 80) {
    tip = 'Excellent! Continue comme ça! 🏆';
  } else if (cheatRatio > 0.3) {
    // Plus de 30% de cheat meals
    tip = 'Remplace 1 cheat par 1 sain = +6% 📈';
  } else if (sainRatio < 0.3) {
    // Moins de 30% de repas sains
    tip = '+protéines au déjeuner = score ↑ 🥩';
  } else if (okCount > sainCount) {
    // Beaucoup de repas OK, peu de sains
    tip = 'Upgrade 1 repas OK → sain = +4% 💪';
  } else {
    tip = 'Tu progresses bien! Vise 60%+ 🎯';
  }

  return { 
    score: clamped, 
    zone, 
    mealsCount: recent.length,
    sainCount,
    okCount,
    cheatCount,
    tip
  };
}

// Helper to map manual categories to a score for 7j calculation
export function mapManualCategoryToScore(category: MealCategory): number {
  if (category === 'sain') return 85;
  if (category === 'ok') return 60;
  return 25;
}

// Types for computing calories per day
export type DayCalories = {
  date: string; // YYYY-MM-DD
  totalCalories: number;
  isComplete: boolean; // true if totalCalories >= MIN_CALORIES_FOR_COMPLETE_DAY
};

// Compute streak with calorie validation
// A day counts toward streak ONLY if it has minimum calories
export function computeStreakWithCalories(
  dayFeeds: Record<string, DayFeed>,
  dayCaloriesMap: Record<string, number>, // Map de date -> calories totales
  minCalories: number = MIN_CALORIES_FOR_COMPLETE_DAY
): StreakStats {
  // Logs de diagnostic
  console.log('[Streak] 🔍 Début calcul streak avec calories');
  console.log('[Streak] Jours avec repas (dayFeeds):', Object.keys(dayFeeds).sort());
  console.log('[Streak] Calories par jour:', Object.entries(dayCaloriesMap).map(([date, cal]) => `${date}: ${cal} cal`));
  console.log('[Streak] Seuil minimum calories:', minCalories);
  
  // Filtrer les jours qui ont assez de calories
  const completeDays = Object.keys(dayFeeds).filter(date => {
    const calories = dayCaloriesMap[date] || 0;
    const isComplete = calories >= minCalories;
    if (!isComplete) {
      console.log(`[Streak] ⚠️ Jour ${date} exclu: ${calories} cal < ${minCalories} cal`);
    }
    return isComplete;
  }).sort();

  console.log('[Streak] Jours complets (>= calories):', completeDays);

  if (completeDays.length === 0) {
    console.log('[Streak] ❌ Aucun jour complet, streak = 0');
    return {
      currentStreakDays: 0,
      longestStreakDays: 0,
      totalFedDays: 0,
      evolutionsUnlocked: 0,
      progressToNextEvolution: 0,
      streakBonusEarned: 0,
      isStreakBonusDay: false,
    };
  }

  // Get today in local time to match user's timezone
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const completeDaysSet = new Set(completeDays);
  console.log('[Streak] Date aujourd\'hui (locale):', today);

  let current = 0;
  
  // Toujours commencer depuis hier (ou aujourd'hui si complet)
  // Le streak continue tant qu'il y a des jours consécutifs complets
  // On commence par vérifier si aujourd'hui est complet, sinon on commence depuis hier
  let cursor: string;
  const todayCalories = dayCaloriesMap[today] || 0;
  
  if (todayCalories >= minCalories) {
    // Aujourd'hui est complet, commencer depuis aujourd'hui
    cursor = today;
    console.log(`[Streak] ✅ Aujourd'hui est complet (${todayCalories} cal), démarrage depuis aujourd'hui`);
  } else {
    // Aujourd'hui n'est pas encore complet, commencer depuis hier
    // Utiliser setDate() pour l'heure locale
    const yesterdayDate = new Date(today + 'T00:00:00');
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    cursor = normalizeDate(yesterdayDate.toISOString());
    console.log(`[Streak] ⚠️ Aujourd'hui incomplet (${todayCalories} cal), démarrage depuis hier: ${cursor}`);
  }
  
  // Compter les jours consécutifs depuis le cursor
  console.log('[Streak] 🔄 Début comptage depuis:', cursor);
  let iteration = 0;
  while (completeDaysSet.has(cursor)) {
    current += 1;
    const calories = dayCaloriesMap[cursor] || 0;
    console.log(`[Streak]   Jour ${current}: ${cursor} (${calories} cal)`);
    // Utiliser setDate() pour l'heure locale
    const prevDay = new Date(cursor + 'T00:00:00');
    prevDay.setDate(prevDay.getDate() - 1);
    cursor = normalizeDate(prevDay.toISOString());
    iteration++;
    if (iteration > 100) {
      console.error('[Streak] ❌ Boucle infinie détectée, arrêt forcé');
      break;
    }
  }
  console.log(`[Streak] ✅ Streak actuelle calculée: ${current} jours`);

  // Longest streak scan
  let longest = 1;
  let run = 1;
  for (let i = 1; i < completeDays.length; i++) {
    const gap = diffDays(completeDays[i], completeDays[i - 1]);
    if (gap === 1) {
      run += 1;
      if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }

  const total = completeDays.length;
  const evolutionsUnlocked = Math.min(12, Math.floor(current / EVOLUTION_STEP_DAYS));
  const progressToNextEvolution =
    evolutionsUnlocked >= 12 ? 1 : (current % EVOLUTION_STEP_DAYS) / EVOLUTION_STEP_DAYS;

  const streakBonusEarned = Math.floor(current / 30);
  const isStreakBonusDay = current > 0 && current % 30 === 0;

  return {
    currentStreakDays: current,
    longestStreakDays: longest,
    totalFedDays: total,
    evolutionsUnlocked,
    progressToNextEvolution,
    streakBonusEarned,
    isStreakBonusDay,
  };
}

// Compute dragon state considering if today is a "complete" day
export function computeDragonStateWithCalories(
  dayFeeds: Record<string, DayFeed>,
  dayCaloriesMap: Record<string, number>,
  minCalories: number = MIN_CALORIES_FOR_COMPLETE_DAY
): DragonStatus {
  // Trouver le dernier jour COMPLET (avec assez de calories)
  const completeDays = Object.keys(dayFeeds).filter(date => {
    const calories = dayCaloriesMap[date] || 0;
    return calories >= minCalories;
  }).sort();

  if (completeDays.length === 0) {
    return { mood: 'critique', daysSinceLastMeal: 999 };
  }

  const lastCompleteDay = completeDays[completeDays.length - 1];
  
  // Get today in local time to match user's timezone
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const diff = diffDays(today, lastCompleteDay);

  let mood: DragonState = 'normal';
  if (diff >= DAYS_CRITICAL) mood = 'critique';
  else if (diff >= DAYS_WARNING) mood = 'inquiet';

  return { mood, daysSinceLastMeal: diff };
}
