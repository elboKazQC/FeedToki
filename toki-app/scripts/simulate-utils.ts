/**
 * simulate-utils.ts
 * Helpers pour le simulateur de système de points Toki.
 */

import { FOOD_DB } from '../lib/food-db';

// ============================================================================
// TYPES
// ============================================================================

export interface UserProfile {
  name: string;
  weightKg: number;
  tdeeKcal: number; // TDEE quotidien
  weeklyTarget: number; // objectif calorique hebdo (TDEE×7 - déficit)
  pointsPerDay: number;
  maxCap: number;
  complianceRate: number; // 0-1 : % de respect du budget
  cheatsPerWeek: number; // nombre de cheats autorisés/semaine
}

export interface SimulatedMeal {
  category: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    points: number;
    calories: number;
  }>;
  totalPoints: number;
  totalCalories: number;
}

export interface DayResult {
  day: number;
  meals: SimulatedMeal[];
  totalPoints: number;
  totalCalories: number;
  deltaCalories: number; // vs TDEE
  weightChangeKg: number; // approximation
  currentWeightKg: number;
  overBudget: boolean;
}

export interface SimulationResult {
  profile: UserProfile;
  days: DayResult[];
  summary: {
    initialWeight: number;
    finalWeight: number;
    totalWeightChange: number;
    avgCaloriesPerDay: number;
    avgPointsPerDay: number;
    daysOverBudget: number;
    totalDays: number;
  };
}

export interface FoodAuditItem {
  id: string;
  name: string;
  points: number;
  calories: number;
  calPerPoint: number;
  tags: string[];
  issue?: string;
}

// ============================================================================
// PROFILS UTILISATEURS
// ============================================================================

export function createProfiles(): UserProfile[] {
  // Profil base: 90kg, TDEE 2500 kcal/j, objectif -2 lbs/sem (-7000 kcal/sem)
  const baseTdee = 2500;
  const weeklyDeficit = 7000; // -2 lbs/sem
  const weeklyTarget = baseTdee * 7 - weeklyDeficit; // 10,500 kcal/sem
  const basePoints = Math.round((weeklyTarget * 0.30 / 7) / 80); // ~6 pts
  const pointsPerDay = basePoints + 1; // Bonus +1 pt pour -2 lbs/sem → 7 pts
  const maxCap = Math.min(pointsPerDay * 4, 12); // 12

  return [
    {
      name: 'Strict Sarah',
      weightKg: 90,
      tdeeKcal: baseTdee,
      weeklyTarget,
      pointsPerDay,
      maxCap,
      complianceRate: 0.90, // respecte 90% des jours
      cheatsPerWeek: 1,
    },
    {
      name: 'Normal Nathan',
      weightKg: 90,
      tdeeKcal: baseTdee,
      weeklyTarget,
      pointsPerDay,
      maxCap,
      complianceRate: 0.70,
      cheatsPerWeek: 3,
    },
    {
      name: 'Cheater Charlie',
      weightKg: 90,
      tdeeKcal: baseTdee,
      weeklyTarget,
      pointsPerDay,
      maxCap,
      complianceRate: 0.40,
      cheatsPerWeek: 6,
    },
    {
      name: 'Chaotic Casey',
      weightKg: 90,
      tdeeKcal: baseTdee,
      weeklyTarget,
      pointsPerDay,
      maxCap,
      complianceRate: 0.60, // variable selon sine wave
      cheatsPerWeek: 4,
    },
  ];
}

// ============================================================================
// GÉNÉRATION JOURNÉES ALIMENTAIRES
// ============================================================================

/**
 * Génère une journée de repas selon le profil utilisateur.
 * @param profile Profil utilisateur
 * @param dayNumber Jour de simulation (pour pattern chaotic)
 * @param seed Pour randomisation
 */
export function generateDayMeals(
  profile: UserProfile,
  dayNumber: number,
  seed: number = 0
): SimulatedMeal[] {
  const rng = seededRandom(seed + dayNumber);
  const meals: SimulatedMeal[] = [];

  // Determine si c'est un jour "cheat"
  const isCheatDay = rng() < profile.cheatsPerWeek / 7;

  // Ajustement pour profil chaotic (sine wave)
  let adjustedCompliance = profile.complianceRate;
  if (profile.name.includes('Chaotic')) {
    // Sine wave: parfois parfait, parfois chaos
    const phase = (dayNumber / 7) * Math.PI * 2;
    adjustedCompliance = 0.5 + 0.4 * Math.sin(phase);
  }

  const respectBudget = rng() < adjustedCompliance;

  // Budget points disponible
  let remainingPoints = respectBudget ? profile.pointsPerDay : profile.maxCap * 1.5;

  // Déjeuner
  meals.push(generateMeal('breakfast', remainingPoints, rng, false));
  remainingPoints -= meals[0].totalPoints;

  // Dîner (lunch)
  meals.push(generateMeal('lunch', remainingPoints, rng, false));
  remainingPoints -= meals[1].totalPoints;

  // Souper (dinner)
  const allowCheat = isCheatDay && !respectBudget;
  meals.push(generateMeal('dinner', remainingPoints, rng, allowCheat));
  remainingPoints -= meals[2].totalPoints;

  // Snack (optionnel, 50% chance au lieu de 30%)
  if (rng() < 0.5 && remainingPoints > 0) {
    meals.push(generateMeal('snack', remainingPoints, rng, false));
  }

  return meals;
}

/**
 * Génère un repas individuel.
 */
function generateMeal(
  category: 'breakfast' | 'lunch' | 'dinner' | 'snack',
  remainingPoints: number,
  rng: () => number,
  allowCheat: boolean
): SimulatedMeal {
  const items: SimulatedMeal['items'] = [];
  let totalPoints = 0;
  let totalCalories = 0;

  // Stratégies par catégorie
  if (category === 'breakfast') {
    // Déjeuner typique: gruau/toasts + fruit + café + potentiellement oeufs/bacon
    const breakfastItems = FOOD_DB.filter(
      (f) =>
        f.tags?.includes('grain_complet') ||
        f.tags?.includes('feculent_simple') ||
        f.id === 'avoine' ||
        f.id === 'toasts' ||
        f.id === 'pain_complet'
    );
    const fruits = FOOD_DB.filter((f) => f.id === 'banane' || f.id === 'pomme' || f.id === 'baies');
    const proteins = FOOD_DB.filter((f) => f.id === 'oeufs' || f.id === 'bacon' || f.id === 'yaourt');
    
    addRandomItems(items, breakfastItems, 1, rng);
    addRandomItems(items, fruits, 1, rng);
    // 50% chance de protéine au déjeuner
    if (rng() < 0.5) {
      addRandomItems(items, proteins, 1, rng);
    }
  } else if (category === 'lunch') {
    // Dîner: protéine + féculent + légume (portions généreuses)
    const proteins = FOOD_DB.filter((f) => f.tags?.includes('proteine_maigre'));
    const starches = FOOD_DB.filter(
      (f) =>
        f.tags?.includes('feculent_simple') ||
        f.tags?.includes('grain_complet')
    );
    const veggies = FOOD_DB.filter((f) => f.tags?.includes('legume') && f.id !== 'banane' && f.id !== 'pomme');

    addRandomItems(items, proteins, 1, rng);
    addRandomItems(items, starches, 1, rng);
    addRandomItems(items, veggies, 2, rng);
    
    // 30% chance d'ajouter un deuxième féculent ou plus de protéine
    if (rng() < 0.3) {
      addRandomItems(items, starches, 1, rng);
    }
  } else if (category === 'dinner') {
    if (allowCheat) {
      // Cheat meal: poutine, pizza, burger, etc.
      const cheats = FOOD_DB.filter(
        (f) =>
          f.tags?.includes('ultra_transforme') ||
          f.tags?.includes('gras_frit') ||
          (f.points !== undefined && f.points >= 6)
      );
      addRandomItems(items, cheats, 1, rng);
      
      // Ajouter une petite portion de légumes avec le cheat (réalisme)
      const veggies = FOOD_DB.filter((f) => f.tags?.includes('legume') && f.id !== 'banane' && f.id !== 'pomme');
      if (rng() < 0.4) {
        addRandomItems(items, veggies, 1, rng);
      }
    } else {
      // Souper normal: protéine + légumes + féculent + dessert sain optionnel
      const proteins = FOOD_DB.filter((f) => f.tags?.includes('proteine_maigre'));
      const veggies = FOOD_DB.filter((f) => f.tags?.includes('legume') && f.id !== 'banane' && f.id !== 'pomme');
      const starches = FOOD_DB.filter(
        (f) =>
          f.tags?.includes('feculent_simple') ||
          f.tags?.includes('grain_complet')
      );

      addRandomItems(items, proteins, 1, rng);
      addRandomItems(items, starches, 1, rng);
      addRandomItems(items, veggies, 2, rng);

      // Dessert santé 50% du temps
      if (rng() < 0.5) {
        const desserts = FOOD_DB.filter((f) => f.tags?.includes('dessert_sante'));
        if (desserts.length > 0) {
          addRandomItems(items, desserts, 1, rng);
        }
      }
    }
  } else {
    // Snack: fruits, noix, yogourt, fromage, shake protéiné
    const snacks = FOOD_DB.filter(
      (f) =>
        f.id === 'banane' ||
        f.id === 'pomme' ||
        f.id === 'baies' ||
        f.id === 'yaourt' ||
        f.id === 'fromage' ||
        f.id === 'yaourt_grec' ||
        f.tags?.includes('dessert_sante')
    );
    addRandomItems(items, snacks, 1, rng);
    
    // 30% chance d'ajouter un deuxième item de snack
    if (rng() < 0.3 && snacks.length > 0) {
      addRandomItems(items, snacks, 1, rng);
    }
  }

  // Fallback si rien ajouté
  if (items.length === 0) {
    const fallback = FOOD_DB[Math.floor(rng() * FOOD_DB.length)];
    items.push({
      id: fallback.id,
      name: fallback.name,
      quantity: 1,
      points: fallback.points ?? 0,
      calories: fallback.calories_kcal || 0,
    });
  }

  // Calculer totaux
  items.forEach((item) => {
    totalPoints += item.points * item.quantity;
    totalCalories += item.calories * item.quantity;
  });

  return {
    category,
    items,
    totalPoints,
    totalCalories,
  };
}

/**
 * Ajoute N items aléatoires depuis une liste.
 */
function addRandomItems(
  target: SimulatedMeal['items'],
  source: typeof FOOD_DB,
  count: number,
  rng: () => number
) {
  if (source.length === 0) return;

  for (let i = 0; i < count; i++) {
    const item = source[Math.floor(rng() * source.length)];
    target.push({
      id: item.id,
      name: item.name,
      quantity: 1,
      points: item.points ?? 0,
      calories: item.calories_kcal || 0,
    });
  }
}

// ============================================================================
// CALCULS QUOTIDIENS
// ============================================================================

/**
 * Calcule les totaux d'une journée et met à jour le poids.
 */
export function computeDayTotals(
  meals: SimulatedMeal[],
  profile: UserProfile,
  currentWeight: number,
  dayNumber: number
): DayResult {
  let totalPoints = 0;
  let totalCalories = 0;

  meals.forEach((meal) => {
    totalPoints += meal.totalPoints;
    totalCalories += meal.totalCalories;
  });

  const deltaCalories = totalCalories - profile.tdeeKcal;

  // Approximation perte/gain poids: 7700 kcal ≈ 1 kg
  const weightChangeKg = deltaCalories / 7700;
  const newWeight = currentWeight + weightChangeKg;

  return {
    day: dayNumber,
    meals,
    totalPoints,
    totalCalories,
    deltaCalories,
    weightChangeKg,
    currentWeightKg: newWeight,
    overBudget: totalPoints > profile.pointsPerDay,
  };
}

// ============================================================================
// SIMULATION COMPLÈTE
// ============================================================================

/**
 * Lance une simulation sur N semaines pour un profil.
 */
export function runSimulation(
  profile: UserProfile,
  weeks: number,
  seed: number = 0
): SimulationResult {
  const days: DayResult[] = [];
  let currentWeight = profile.weightKg;

  const totalDays = weeks * 7;

  for (let day = 1; day <= totalDays; day++) {
    const meals = generateDayMeals(profile, day, seed);
    const dayResult = computeDayTotals(meals, profile, currentWeight, day);
    currentWeight = dayResult.currentWeightKg;
    days.push(dayResult);
  }

  // Calculer summary
  const totalCalories = days.reduce((sum, d) => sum + d.totalCalories, 0);
  const totalPoints = days.reduce((sum, d) => sum + d.totalPoints, 0);
  const daysOverBudget = days.filter((d) => d.overBudget).length;

  return {
    profile,
    days,
    summary: {
      initialWeight: profile.weightKg,
      finalWeight: currentWeight,
      totalWeightChange: currentWeight - profile.weightKg,
      avgCaloriesPerDay: totalCalories / totalDays,
      avgPointsPerDay: totalPoints / totalDays,
      daysOverBudget,
      totalDays,
    },
  };
}

// ============================================================================
// AUDIT FOOD DATABASE
// ============================================================================

/**
 * Détecte les incohérences dans FOOD_DB.
 */
export function auditFoodDb(): {
  worst: FoodAuditItem[];
  best: FoodAuditItem[];
  suspicious: FoodAuditItem[];
} {
  const items: FoodAuditItem[] = FOOD_DB.map((f) => {
    const calories = f.calories_kcal || 0;
    const points = f.points ?? 0;
    const calPerPoint = points > 0 ? calories / points : calories;

    let issue: string | undefined;
    if (points === 0 && calories > 150) {
      issue = 'FREE_HIGH_CAL';
    } else if (points === 1 && calories > 250) {
      issue = 'CHEAP_HIGH_CAL';
    } else if (points >= 5 && calPerPoint < 70) {
      issue = 'EXPENSIVE_LOW_CAL';
    }

    return {
      id: f.id,
      name: f.name,
      points,
      calories,
      calPerPoint,
      tags: f.tags || [],
      issue,
    };
  });

  // Trier par ratio cal/point
  const sorted = [...items].sort((a, b) => b.calPerPoint - a.calPerPoint);

  return {
    worst: sorted.slice(-15), // 15 pires (plus chers pour les calories)
    best: sorted.slice(0, 15), // 15 meilleurs (trop avantageux)
    suspicious: items.filter((i) => i.issue),
  };
}

// ============================================================================
// UTILS
// ============================================================================

/**
 * Générateur pseudo-aléatoire seedé (simple LCG).
 */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}
