// Utilitaires pour le système de KPI Admin
// Permet de récupérer et calculer toutes les métriques utilisateurs

import { collection, doc, getDoc, getDocs, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db, FIREBASE_ENABLED } from './firebase-config';
import { MealEntry, normalizeDate, computeStreak, DayFeed } from './stats';
import { UserProfile, UserDetailedStats, GlobalKPIs, UserKPI, KPIFilter, SubscriptionStatus, SubscriptionTier, WeightGoal, ActivityLevel } from './types';
import { getUserLogs } from './user-logger';
import { calculateAverageSessionsPerDay, getTotalSessions } from './session-tracker';

/**
 * Vérifier si Firebase est disponible
 */
function isFirebaseAvailable(): boolean {
  return FIREBASE_ENABLED && db !== null;
}

/**
 * Charger tous les profils utilisateurs depuis Firestore
 */
export async function fetchAllUsers(): Promise<UserProfile[]> {
  if (!isFirebaseAvailable()) {
    console.warn('[Admin KPI] Firebase non disponible');
    return [];
  }

  try {
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    
    return snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        ...data,
        userId: docSnap.id,
      } as UserProfile;
    });
  } catch (error) {
    console.error('[Admin KPI] Erreur chargement utilisateurs:', error);
    return [];
  }
}

/**
 * Charger tous les repas d'un utilisateur depuis Firestore
 */
export async function fetchUserMeals(userId: string): Promise<MealEntry[]> {
  if (!isFirebaseAvailable()) return [];

  try {
    const mealsRef = collection(db, 'users', userId, 'meals');
    const snapshot = await getDocs(mealsRef);
    
    return snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        ...data,
        id: docSnap.id,
        createdAt: data.createdAt || data.updatedAt?.toDate().toISOString() || new Date().toISOString(),
      } as MealEntry;
    });
  } catch (error) {
    console.error(`[Admin KPI] Erreur chargement repas pour ${userId}:`, error);
    return [];
  }
}

/**
 * Charger les points d'un utilisateur depuis Firestore
 */
export async function fetchUserPoints(userId: string): Promise<{
  balance: number;
  lastClaimDate?: string;
  totalPoints: number;
}> {
  if (!isFirebaseAvailable()) {
    return { balance: 0, totalPoints: 0 };
  }

  try {
    const currentRef = doc(db, 'users', userId, 'points', 'current');
    const totalRef = doc(db, 'users', userId, 'points', 'total');
    
    const [currentDoc, totalDoc] = await Promise.all([
      getDoc(currentRef),
      getDoc(totalRef),
    ]);

    const currentData = currentDoc.data();
    const totalData = totalDoc.data();

    return {
      balance: currentData?.balance || 0,
      lastClaimDate: currentData?.lastClaimDate || undefined,
      totalPoints: totalData?.totalPoints || 0,
    };
  } catch (error) {
    console.error(`[Admin KPI] Erreur chargement points pour ${userId}:`, error);
    return { balance: 0, totalPoints: 0 };
  }
}

/**
 * Charger le nombre d'aliments personnalisés d'un utilisateur
 */
export async function fetchUserCustomFoodsCount(userId: string): Promise<number> {
  if (!isFirebaseAvailable()) return 0;

  try {
    const customFoodsRef = collection(db, 'users', userId, 'customFoods');
    const snapshot = await getDocs(customFoodsRef);
    return snapshot.size;
  } catch (error) {
    console.error(`[Admin KPI] Erreur chargement custom foods pour ${userId}:`, error);
    return 0;
  }
}

/**
 * Calculer les statistiques détaillées d'un utilisateur
 */
export async function calculateUserStats(
  userId: string,
  profile: UserProfile,
  meals: MealEntry[],
  points: { balance: number; lastClaimDate?: string; totalPoints: number },
  customFoodsCount: number
): Promise<UserDetailedStats> {
  const now = new Date();
  const today = normalizeDate(now.toISOString());
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Calculer les jours actifs (jours avec au moins un repas)
  const activeDaysSet = new Set<string>();
  meals.forEach(meal => {
    const date = normalizeDate(meal.createdAt);
    activeDaysSet.add(date);
  });
  const activeDays = activeDaysSet.size;

  // Calculer le streak
  const dayFeeds: Record<string, DayFeed> = {};
  meals.forEach(meal => {
    const date = normalizeDate(meal.createdAt);
    if (!dayFeeds[date]) {
      dayFeeds[date] = { date, mealIds: [] };
    }
    dayFeeds[date].mealIds.push(meal.id);
  });
  const streakStats = computeStreak(dayFeeds);

  // Trouver la dernière activité
  let lastActivityDate: string | undefined;
  if (meals.length > 0) {
    const sortedMeals = [...meals].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    lastActivityDate = normalizeDate(sortedMeals[0].createdAt);
  }

  // Calculer jours depuis dernière activité
  let daysSinceLastActivity = 0;
  if (lastActivityDate) {
    const lastDate = new Date(lastActivityDate + 'T00:00:00');
    const diffTime = now.getTime() - lastDate.getTime();
    daysSinceLastActivity = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  // Vérifier si actif dans les 7/30 derniers jours
  const isActive7d = meals.some(meal => {
    const mealDate = new Date(meal.createdAt);
    return mealDate >= sevenDaysAgo;
  });
  const isActive30d = meals.some(meal => {
    const mealDate = new Date(meal.createdAt);
    return mealDate >= thirtyDaysAgo;
  });

  // Compter les logs IA (gérer l'erreur si index manquant)
  // Note: La requête nécessite un index composite Firestore sur user_logs:
  // Collection: user_logs, Fields: userId (Ascending), timestamp (Descending)
  // Si l'index n'existe pas, on continue sans les logs
  let aiLogsCount = 0;
  try {
    const logs = await getUserLogs(userId, 1000);
    aiLogsCount = logs.filter(log => log.context === 'ai-logger').length;
  } catch (error: any) {
    // Si l'index Firestore n'existe pas, on continue sans les logs
    if (error?.code === 'failed-precondition' || error?.message?.includes('index')) {
      console.warn(`[Admin KPI] Index Firestore manquant pour user_logs (userId: ${userId}), logs ignorés`);
    } else {
      console.error(`[Admin KPI] Erreur chargement logs pour ${userId}:`, error);
    }
  }

  // Calculer moyenne de repas par jour actif
  const mealsPerDay = activeDays > 0 ? meals.length / activeDays : 0;

  // Calculer les statistiques de parsing (temps de parsing des repas créés via IA)
  const mealsWithParsingTime = meals.filter(meal => meal.parsingTimeMs !== undefined && meal.parsingTimeMs > 0);
  const totalParsingTimeMs = mealsWithParsingTime.reduce((sum, meal) => sum + (meal.parsingTimeMs || 0), 0);
  const averageParsingTimeMs = mealsWithParsingTime.length > 0 
    ? Math.round(totalParsingTimeMs / mealsWithParsingTime.length) 
    : undefined;

  // Calculer les statistiques de sessions
  let averageSessionsPerDay: number | undefined;
  let totalSessions: number | undefined;
  try {
    averageSessionsPerDay = await calculateAverageSessionsPerDay(userId);
    totalSessions = await getTotalSessions(userId);
  } catch (error) {
    console.warn(`[Admin KPI] Erreur calcul sessions pour ${userId}:`, error);
    averageSessionsPerDay = undefined;
    totalSessions = undefined;
  }

  return {
    userId,
    email: profile.email,
    displayName: profile.displayName,
    createdAt: profile.createdAt || new Date().toISOString(),
    onboardingCompleted: profile.onboardingCompleted || false,
    weightGoal: profile.weightGoal,
    currentWeight: profile.currentWeight,
    activityLevel: profile.activityLevel,
    subscription: profile.subscription,
    userRank: profile.userRank,
    
    totalMeals: meals.length,
    activeDays,
    currentStreak: streakStats.currentStreakDays,
    longestStreak: streakStats.longestStreakDays,
    lastActivityDate,
    
    currentPointsBalance: points.balance,
    totalPointsEarned: points.totalPoints,
    lastClaimDate: points.lastClaimDate,
    
    customFoodsCount,
    aiLogsCount,
    
    mealsPerDay: Math.round(mealsPerDay * 10) / 10, // Arrondir à 1 décimale
    daysSinceLastActivity,
    isActive7d,
    isActive30d,
    
    // Parsing performance
    averageParsingTimeMs,
    totalParsingTimeMs: totalParsingTimeMs > 0 ? totalParsingTimeMs : undefined,
    
    // Session stats
    averageSessionsPerDay,
    totalSessions,
  };
}

/**
 * Charger toutes les données nécessaires pour un utilisateur
 */
export async function fetchUserKPI(userId: string, profile: UserProfile): Promise<UserKPI> {
  const [meals, points, customFoodsCount] = await Promise.all([
    fetchUserMeals(userId),
    fetchUserPoints(userId),
    fetchUserCustomFoodsCount(userId),
  ]);

  const stats = await calculateUserStats(userId, profile, meals, points, customFoodsCount);

  return {
    user: profile,
    stats,
  };
}

/**
 * Calculer les KPI globaux à partir de toutes les données
 */
export async function calculateGlobalKPIs(
  users: UserProfile[],
  userKPIs: UserKPI[]
): Promise<GlobalKPIs> {
  const now = new Date();
  const today = normalizeDate(now.toISOString());
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Métriques utilisateurs
  const totalUsers = users.length;
  const activeUsers7d = userKPIs.filter(kpi => kpi.stats.isActive7d).length;
  const activeUsers30d = userKPIs.filter(kpi => kpi.stats.isActive30d).length;
  
  const newUsers7d = users.filter(u => {
    if (!u.createdAt) return false;
    const created = new Date(u.createdAt);
    return created >= sevenDaysAgo;
  }).length;
  
  const newUsers30d = users.filter(u => {
    if (!u.createdAt) return false;
    const created = new Date(u.createdAt);
    return created >= thirtyDaysAgo;
  }).length;

  // Calculer rétention (utilisateurs créés il y a 7/30 jours qui sont encore actifs)
  const usersCreated7dAgo = users.filter(u => {
    if (!u.createdAt) return false;
    const created = new Date(u.createdAt);
    const sevenDaysAgoDate = new Date(sevenDaysAgo);
    sevenDaysAgoDate.setHours(0, 0, 0, 0);
    const createdDate = new Date(created);
    createdDate.setHours(0, 0, 0, 0);
    return createdDate.getTime() === sevenDaysAgoDate.getTime();
  });
  const activeFrom7dAgo = usersCreated7dAgo.filter(u => {
    const kpi = userKPIs.find(k => k.user.userId === u.userId);
    return kpi?.stats.isActive7d || false;
  }).length;
  const retentionRate7d = usersCreated7dAgo.length > 0 
    ? (activeFrom7dAgo / usersCreated7dAgo.length) * 100 
    : 0;

  const usersCreated30dAgo = users.filter(u => {
    if (!u.createdAt) return false;
    const created = new Date(u.createdAt);
    const thirtyDaysAgoDate = new Date(thirtyDaysAgo);
    thirtyDaysAgoDate.setHours(0, 0, 0, 0);
    const createdDate = new Date(created);
    createdDate.setHours(0, 0, 0, 0);
    return createdDate.getTime() === thirtyDaysAgoDate.getTime();
  });
  const activeFrom30dAgo = usersCreated30dAgo.filter(u => {
    const kpi = userKPIs.find(k => k.user.userId === u.userId);
    return kpi?.stats.isActive30d || false;
  }).length;
  const retentionRate30d = usersCreated30dAgo.length > 0 
    ? (activeFrom30dAgo / usersCreated30dAgo.length) * 100 
    : 0;

  // Métriques engagement
  const streaks = userKPIs.map(kpi => kpi.stats.currentStreak);
  const averageStreak = streaks.length > 0 
    ? Math.round((streaks.reduce((a, b) => a + b, 0) / streaks.length) * 10) / 10 
    : 0;
  
  const totalMeals = userKPIs.reduce((sum, kpi) => sum + kpi.stats.totalMeals, 0);
  const activeDaysList = userKPIs.map(kpi => kpi.stats.activeDays);
  const averageActiveDays = activeDaysList.length > 0
    ? Math.round((activeDaysList.reduce((a, b) => a + b, 0) / activeDaysList.length) * 10) / 10
    : 0;
  
  const mealsPerDayList = userKPIs.map(kpi => kpi.stats.mealsPerDay);
  const averageMealsPerDay = mealsPerDayList.length > 0
    ? Math.round((mealsPerDayList.reduce((a, b) => a + b, 0) / mealsPerDayList.length) * 10) / 10
    : 0;

  // Métriques abonnements
  const activeSubscriptions = userKPIs.filter(kpi => {
    const sub = kpi.user.subscription;
    return sub && (sub.status === 'active' || sub.status === 'trialing');
  }).length;
  
  const paidSubscriptions = userKPIs.filter(kpi => {
    const sub = kpi.user.subscription;
    return sub && sub.tier === 'paid' && sub.status === 'active';
  }).length;
  
  const betaUsers = userKPIs.filter(kpi => {
    const sub = kpi.user.subscription;
    return (sub && sub.tier === 'beta') || (kpi.user.userRank !== undefined && kpi.user.userRank <= 10);
  }).length;

  // MRR (Monthly Recurring Revenue) - estimation basique
  // Supposons un prix mensuel de $X par abonnement payant
  // TODO: Récupérer le prix réel depuis Stripe si disponible
  const MONTHLY_PRICE = 9.99; // Prix mensuel estimé
  const mrr = paidSubscriptions * MONTHLY_PRICE;

  const conversionRate = totalUsers > 0 
    ? (paidSubscriptions / totalUsers) * 100 
    : 0;

  // Métriques usage
  const pointsList = userKPIs.map(kpi => kpi.stats.currentPointsBalance);
  const averagePointsBalance = pointsList.length > 0
    ? Math.round((pointsList.reduce((a, b) => a + b, 0) / pointsList.length) * 10) / 10
    : 0;
  
  const totalCustomFoods = userKPIs.reduce((sum, kpi) => sum + kpi.stats.customFoodsCount, 0);
  const totalAiLogs = userKPIs.reduce((sum, kpi) => sum + kpi.stats.aiLogsCount, 0);

  // Métriques parsing (temps moyen de parsing)
  const parsingTimes = userKPIs
    .map(kpi => kpi.stats.averageParsingTimeMs)
    .filter((time): time is number => time !== undefined && time > 0);
  const averageParsingTimeMs = parsingTimes.length > 0
    ? Math.round(parsingTimes.reduce((a, b) => a + b, 0) / parsingTimes.length)
    : 0;

  // Métriques sessions (moyenne de sessions par jour)
  const sessionsPerDay = userKPIs
    .map(kpi => kpi.stats.averageSessionsPerDay)
    .filter((sessions): sessions is number => sessions !== undefined && sessions > 0);
  const averageSessionsPerDay = sessionsPerDay.length > 0
    ? Math.round((sessionsPerDay.reduce((a, b) => a + b, 0) / sessionsPerDay.length) * 10) / 10
    : 0;

  // Time series data
  const usersOverTime: Array<{ date: string; count: number }> = [];
  const newUsersByDay: Array<{ date: string; count: number }> = [];
  const mealsByDay: Array<{ date: string; count: number }> = [];

  // Calculer évolution utilisateurs (par semaine sur les 12 dernières semaines)
  const weeksAgo = 12;
  for (let i = weeksAgo; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - (i * 7));
    const weekDate = normalizeDate(weekStart.toISOString());
    
    const usersBeforeWeek = users.filter(u => {
      if (!u.createdAt) return false;
      return new Date(u.createdAt) < weekStart;
    }).length;
    
    usersOverTime.push({ date: weekDate, count: usersBeforeWeek });
  }

  // Nouveaux utilisateurs par jour (30 derniers jours)
  const dailyNewUsers: Record<string, number> = {};
  users.forEach(u => {
    if (!u.createdAt) return;
    const date = normalizeDate(u.createdAt);
    dailyNewUsers[date] = (dailyNewUsers[date] || 0) + 1;
  });
  
  for (let i = 30; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(day.getDate() - i);
    const dateStr = normalizeDate(day.toISOString());
    newUsersByDay.push({ date: dateStr, count: dailyNewUsers[dateStr] || 0 });
  }

  // Repas par jour (30 derniers jours)
  const dailyMeals: Record<string, number> = {};
  userKPIs.forEach(kpi => {
    // Récupérer les repas depuis les stats (on aurait besoin de les charger)
    // Pour l'instant, on utilise les stats déjà calculées
  });
  
  // Pour les repas par jour, on devrait charger tous les repas
  // Pour l'instant, on retourne un tableau vide et on le calculera côté UI si nécessaire
  for (let i = 30; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(day.getDate() - i);
    const dateStr = normalizeDate(day.toISOString());
    mealsByDay.push({ date: dateStr, count: 0 }); // Sera calculé côté UI
  }

  return {
    totalUsers,
    activeUsers7d,
    activeUsers30d,
    newUsers7d,
    newUsers30d,
    retentionRate7d: Math.round(retentionRate7d * 10) / 10,
    retentionRate30d: Math.round(retentionRate30d * 10) / 10,
    
    averageStreak,
    totalMeals,
    averageActiveDays,
    averageMealsPerDay,
    
    activeSubscriptions,
    paidSubscriptions,
    betaUsers,
    mrr: Math.round(mrr * 100) / 100,
    conversionRate: Math.round(conversionRate * 10) / 10,
    
    averagePointsBalance,
    totalCustomFoods,
    totalAiLogs,
    
    averageParsingTimeMs,
    averageSessionsPerDay,
    
    usersOverTime,
    newUsersByDay,
    mealsByDay,
  };
}

/**
 * Filtrer les KPI utilisateurs selon les critères
 */
export function filterUserKPIs(userKPIs: UserKPI[], filter: KPIFilter): UserKPI[] {
  let filtered = [...userKPIs];

  // Filtre par date de création
  if (filter.dateRange) {
    filtered = filtered.filter(kpi => {
      if (!kpi.user.createdAt) return false;
      const created = new Date(kpi.user.createdAt);
      const start = new Date(filter.dateRange!.start);
      const end = new Date(filter.dateRange!.end);
      return created >= start && created <= end;
    });
  }

  // Filtre par statut d'abonnement
  if (filter.subscriptionStatus && filter.subscriptionStatus.length > 0) {
    filtered = filtered.filter(kpi => {
      const sub = kpi.user.subscription;
      return sub && filter.subscriptionStatus!.includes(sub.status);
    });
  }

  // Filtre par tier d'abonnement
  if (filter.subscriptionTier && filter.subscriptionTier.length > 0) {
    filtered = filtered.filter(kpi => {
      const sub = kpi.user.subscription;
      return sub && filter.subscriptionTier!.includes(sub.tier);
    });
  }

  // Filtre par objectif poids
  if (filter.weightGoal && filter.weightGoal.length > 0) {
    filtered = filtered.filter(kpi => {
      return kpi.user.weightGoal && filter.weightGoal!.includes(kpi.user.weightGoal);
    });
  }

  // Filtre par niveau d'activité
  if (filter.activityLevel && filter.activityLevel.length > 0) {
    filtered = filtered.filter(kpi => {
      return kpi.user.activityLevel && filter.activityLevel!.includes(kpi.user.activityLevel);
    });
  }

  // Filtre par recherche (email/displayName)
  if (filter.searchQuery) {
    const query = filter.searchQuery.toLowerCase();
    filtered = filtered.filter(kpi => {
      const email = kpi.user.email?.toLowerCase() || '';
      const displayName = kpi.user.displayName?.toLowerCase() || '';
      return email.includes(query) || displayName.includes(query);
    });
  }

  // Filtre par streak minimum
  if (filter.minStreak !== undefined) {
    filtered = filtered.filter(kpi => kpi.stats.currentStreak >= filter.minStreak!);
  }

  // Filtre par nombre minimum de repas
  if (filter.minMeals !== undefined) {
    filtered = filtered.filter(kpi => kpi.stats.totalMeals >= filter.minMeals!);
  }

  // Filtre par activité
  if (filter.isActive !== undefined) {
    filtered = filtered.filter(kpi => 
      filter.isActive ? kpi.stats.isActive7d : !kpi.stats.isActive7d
    );
  }

  return filtered;
}

/**
 * Exporter les données en CSV
 */
export function exportToCSV(data: any[], filename: string): void {
  if (data.length === 0) {
    console.warn('[Admin KPI] Aucune donnée à exporter');
    return;
  }

  // Obtenir les clés de la première ligne
  const keys = Object.keys(data[0]);
  
  // Créer l'en-tête CSV
  const header = keys.join(',');
  
  // Créer les lignes de données
  const rows = data.map(item => {
    return keys.map(key => {
      const value = item[key];
      // Échapper les virgules et guillemets
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value ?? '';
    }).join(',');
  });
  
  const csv = [header, ...rows].join('\n');
  
  // Créer un blob et télécharger
  if (typeof window !== 'undefined') {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

/**
 * Exporter les données en JSON
 */
export function exportToJSON(data: any, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  
  if (typeof window !== 'undefined') {
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
