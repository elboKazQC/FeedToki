import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import {
  MealEntry,
  DragonStatus,
  computeDragonState,
  computeScore7Jours,
  computeStreak,
  computeStreakWithCalories,
  computeDragonStateWithCalories,
  mapManualCategoryToScore,
  normalizeDate,
  DAYS_CRITICAL,
  MIN_CALORIES_FOR_COMPLETE_DAY,
} from '../../lib/stats';
import { classifyMealByItems, FoodItemRef } from '../../lib/classifier';
import { QUICK_ITEMS, QUICK_MEALS } from '../../lib/presets';
import { FOOD_DB, type FoodItem } from '../../lib/food-db';
import {
  initNotificationsIfAllowed,
  requestNotifPermission,
  scheduleDailyDragonReminders,
} from '../../lib/notifications';
import { getSmartRecommendations, getSmartRecommendationsByTaste, getHungerAnalysis, SmartRecommendation, getCanadaGuideRecommendations } from '../../lib/smart-recommendations';
import { computeDailyTotals, DEFAULT_TARGETS, percentageOfTarget } from '../../lib/nutrition';
import { UserProfile } from '../../lib/types';
import { getDailyCalorieTarget } from '../../lib/points-calculator';
import { getPortionsForItem, getDefaultPortion, formatPortionLabel, PortionReference, PortionSize } from '../../lib/portions';
import { DragonSprite } from '../../components/dragon-sprite';
import { useAuth } from '../../lib/auth-context';
import { checkDragonDeath, calculateResurrectCost, resurrectDragon, resetDragon } from '../../lib/dragon-life';
import { purchaseProduct, PRODUCTS } from '../../lib/purchases';
import { computeFoodPoints } from '../../lib/points-utils';
import { syncAllToFirestore, syncMealEntryToFirestore, syncPointsToFirestore } from '../../lib/data-sync';
import { loadCustomFoods, mergeFoodsWithCustom } from '../../lib/custom-foods';
import { userLogger, logError } from '../../lib/user-logger';

type StatsUI = {
  scorePct: number;
  label: string;
  level: 1 | 2 | 3;
};

type CategoryFilter = 'all' | 'sain' | 'ok' | 'cheat';

const STORAGE_KEY = 'feedtoki_entries_v1';
const POINTS_KEY = 'feedtoki_points_v2'; // v2 pour reset
const TOTAL_POINTS_KEY = 'feedtoki_total_points_v1'; // Points totaux accumulés (jamais décrémentés)
const TARGETS_KEY = 'feedtoki_targets_v1';
const DAILY_POINTS = 3; // Points quotidiens fixes (legacy - sera remplacé par profil)
const MAX_POINTS = 12; // Cap d'accumulation strict (legacy - sera remplacé par profil)
const INITIAL_POINTS = 2; // Débutants commencent avec peu

// Map score 0-100 to UI label/level (1..3) for existing visuals
function mapScore7ToStatsUI(score: number): StatsUI {
  let label = 'À améliorer 🐉';
  let level: 1 | 2 | 3 = 1;
  if (score >= 70) {
    label = 'Excellent 👑';
    level = 3;
  } else if (score >= 40) {
    label = 'En progrès 💪';
    level = 2;
  }
  return { scorePct: score, label, level };
}

function buildDayFeeds(entries: MealEntry[]): Record<string, { date: string; mealIds: string[] }> {
  return entries.reduce((acc, entry) => {
    const dateKey = normalizeDate(entry.createdAt);
    const existing = acc[dateKey] ?? { date: dateKey, mealIds: [] };
    acc[dateKey] = { ...existing, mealIds: [...existing.mealIds, entry.id] };
    return acc;
  }, {} as Record<string, { date: string; mealIds: string[] }>);
}

function scoreToCategory(score: number): MealEntry['category'] {
  if (score >= 70) return 'sain';
  if (score >= 40) return 'ok';
  return 'cheat';
}

// Helper pour obtenir la date d'aujourd'hui en heure locale (évite les problèmes de fuseau horaire)
function getTodayLocal(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ---- Composant principal ----
export default function App() {
  const { profile: authProfile, user: authUser, loading: authLoading } = useAuth();
  const [customFoods, setCustomFoods] = useState<typeof FOOD_DB>([]);
  const [screen, setScreen] = useState<'home' | 'add'>('home');
  const [entries, setEntries] = useState<MealEntry[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [points, setPoints] = useState<number>(0);
  const [totalPointsEarned, setTotalPointsEarned] = useState<number>(0); // Points totaux pour le niveau du dragon
  const [lastClaimDate, setLastClaimDate] = useState<string>('');
  const [targets, setTargets] = useState(DEFAULT_TARGETS);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [preselectedItem, setPreselectedItem] = useState<{ item: FoodItem; portion: PortionReference } | null>(null);
  // TEMPORAIRE: Désactiver le modal dragon pour fixer le bug
  // const [showDragonDeadModal, setShowDragonDeadModal] = useState(false);
  const [isDragonDead, setIsDragonDead] = useState(false);

  // IMPORTANT: Déclarer currentUserId AVANT les useEffect qui l'utilisent
  const currentUserId = (authProfile?.userId || (authUser as any)?.id || 'guest');

  // Utiliser le profil du contexte Auth
  useEffect(() => {
    if (!authLoading && authProfile) {
      setUserProfile(authProfile);
      
      // Calculer les objectifs nutritionnels personnalisés basés sur le poids et les objectifs
      (async () => {
        try {
          const { calculateNutritionTargets } = await import('../../lib/nutrition-calculator');
          const calculatedTargets = calculateNutritionTargets(authProfile);
          
          setTargets(calculatedTargets);
          
          // Sauvegarder les objectifs calculés dans AsyncStorage et Firestore
          if (currentUserId && currentUserId !== 'guest') {
            try {
              const targetsKey = getTargetsKey();
              await AsyncStorage.setItem(targetsKey, JSON.stringify(calculatedTargets));
              await syncAllToFirestore(currentUserId);
              console.log('[Index] Objectifs nutritionnels mis à jour:', calculatedTargets);
            } catch (e) {
              console.log('[Index] Erreur sauvegarde targets calculés:', e);
            }
          }
        } catch (e) {
          console.error('[Index] Erreur calcul objectifs nutritionnels:', e);
        }
      })();
    }
    // Note: Ne pas rediriger ici - AuthProvider gère le routage
  }, [authProfile, authLoading, currentUserId]);
  
  // Log userId à chaque render pour debug
  useEffect(() => {
    console.log('[Index] === USER DEBUG ===');
    console.log('[Index] authUser:', JSON.stringify(authUser, null, 2));
    console.log('[Index] authProfile?.userId:', authProfile?.userId);
    console.log('[Index] currentUserId computed:', currentUserId);
  }, [authUser, authProfile, currentUserId]);
  
  const getEntriesKey = () => `feedtoki_entries_${currentUserId}_v1`;
  const getPointsKey = () => `feedtoki_points_${currentUserId}_v2`;
  const getTotalPointsKey = () => `feedtoki_total_points_${currentUserId}_v1`;
  const getTargetsKey = () => `feedtoki_targets_${currentUserId}_v1`;

  // Réinitialiser les données quand on change de compte
  useEffect(() => {
    if (currentUserId && currentUserId !== 'guest') {
      console.log('[Index] User changed, resetting data for:', currentUserId);
      // Reset pour forcer le rechargement des données du nouveau compte
      setEntries([]);
      setPoints(0);
      setTotalPointsEarned(0);
      setIsReady(false);
    }
  }, [currentUserId]);

  // Charger les entrées au démarrage - recharger quand userId change
  // Note: La synchronisation depuis Firestore se fait dans auth-context.tsx et ici aussi
  useEffect(() => {
    // Attendre que le profil soit chargé
    if (authLoading || !currentUserId || currentUserId === 'guest') {
      console.log('[Index] Waiting for user, currentUserId:', currentUserId);
      return;
    }
    
    const load = async () => {
      try {
        // IMPORTANT: Synchroniser d'abord depuis Firestore (fusion) pour avoir les données les plus récentes
        try {
          const { syncFromFirestore } = await import('../../lib/data-sync');
          const syncResult = await syncFromFirestore(currentUserId);
          console.log('[Index] Sync depuis Firestore terminée:', syncResult);
        } catch (syncError) {
          console.warn('[Index] Erreur sync Firestore, utilisation locale:', syncError);
        }
        
        // Après synchronisation, charger depuis AsyncStorage (qui contient maintenant les données fusionnées)
        const key = getEntriesKey();
        console.log('[Index] Loading entries for key:', key);
        const json = await AsyncStorage.getItem(key);
        if (json) {
          const parsed = JSON.parse(json);
          console.log('[Index] Loaded entries count:', parsed?.length);
          if (Array.isArray(parsed)) {
            const normalized: MealEntry[] = (parsed as any[]).map((e) => ({
              id: e.id ?? Date.now().toString(),
              label: e.label ?? '',
              category: e.category ?? 'ok',
              score: typeof e.score === 'number' ? e.score : mapManualCategoryToScore(e.category ?? 'ok'),
              createdAt: e.createdAt ?? e.date ?? new Date().toISOString(),
              items: e.items,
            }));
            setEntries(normalized);
          }
        } else {
          console.log('[Index] No entries found for this user, starting fresh');
          setEntries([]);
        }
      } catch (e) {
        console.log('Erreur chargement AsyncStorage', e);
      } finally {
        setIsReady(true);
      }
    };
    load();
  }, [currentUserId, authLoading]);

  // Notifications (permission + planification)
  useEffect(() => {
    const setupNotifications = async () => {
      try {
        await initNotificationsIfAllowed();
        const status = await requestNotifPermission();
        if (status === 'granted') {
          await scheduleDailyDragonReminders();
        }
      } catch (e) {
        console.log('Notif error', e);
      }
    };
    setupNotifications();
  }, []);

  // Charger les objectifs nutritionnels personnalisés
  useEffect(() => {
    if (authLoading || !currentUserId) return;
    
    const loadTargets = async () => {
      try {
        const key = getTargetsKey();
        console.log('[Index] Loading targets for key:', key);
        const raw = await AsyncStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            setTargets({
              protein_g: Number(parsed.protein_g) || DEFAULT_TARGETS.protein_g,
              carbs_g: Number(parsed.carbs_g) || DEFAULT_TARGETS.carbs_g,
              calories_kcal: Number(parsed.calories_kcal) || DEFAULT_TARGETS.calories_kcal,
              fat_g: Number(parsed.fat_g) || DEFAULT_TARGETS.fat_g,
            });
          }
        }
      } catch (e) {
        console.log('Erreur load targets', e);
      }
    };
    loadTargets();
  }, [currentUserId, authLoading]);

  // Calculer streak et stats avant de les utiliser
  const dayFeeds = useMemo(() => buildDayFeeds(entries), [entries]);
  const score7 = computeScore7Jours(entries);
  const stats = mapScore7ToStatsUI(score7.score);
  
  // Calculer les calories par jour pour valider les journées "complètes"
  const dayCaloriesMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const entry of entries) {
      const dateKey = normalizeDate(entry.createdAt);
      const dayTotals = computeDailyTotals(entries, entry.createdAt, customFoods);
      map[dateKey] = dayTotals.calories_kcal;
    }
    return map;
  }, [entries]);
  
  // Utiliser les nouvelles fonctions avec validation des calories
  const dragonState = computeDragonStateWithCalories(dayFeeds, dayCaloriesMap);
  const streak = computeStreakWithCalories(dayFeeds, dayCaloriesMap);
  const todayTotals = computeDailyTotals(entries, new Date().toISOString(), customFoods);
  
  // Déterminer l'heure de la journée pour les recommandations intelligentes
  const getTimeOfDay = (): 'morning' | 'afternoon' | 'evening' => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    return 'evening';
  };
  
  // Déterminer l'heure de la journée
  const timeOfDay = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    return 'evening';
  }, []);
  
  // Générer des recommandations intelligentes basées sur ce qui a été mangé
  const smartRecommendations = useMemo(() => {
    return getSmartRecommendations(
      todayTotals,
      targets,
      points,
      timeOfDay
    );
  }, [todayTotals, targets, points, timeOfDay]);
  
  // Analyse de la faim basée sur les totaux
  const hungerAnalysis = useMemo(() => {
    return getHungerAnalysis(todayTotals, targets, timeOfDay);
  }, [todayTotals, targets, timeOfDay]);
  
  // Vérifier si le dragon est mort (5 jours sans repas complet)
  const dragonIsDead = checkDragonDeath(dragonState.daysSinceLastMeal);
  const resurrectCost = calculateResurrectCost(dragonState.daysSinceLastMeal);
  
  // TEMPORAIRE: Désactiver le useEffect pour le modal
  // Afficher le modal de mort si le dragon meurt
  // useEffect(() => {
  //   if (dragonIsDead && !isDragonDead) {
  //     setIsDragonDead(true);
  //     setShowDragonDeadModal(true);
  //   }
  // }, [dragonIsDead, isDragonDead]);

  // Points: charger et créditer quotidiennement (utiliser le profil si disponible)
  useEffect(() => {
    const loadPoints = async () => {
      if (!userProfile || authLoading || !currentUserId) {
        console.log('[Index] loadPoints waiting - userProfile:', !!userProfile, 'currentUserId:', currentUserId);
        return;
      }
      
      const today = getTodayLocal();
      const dailyPointsFromProfile = userProfile.dailyPointsBudget || DAILY_POINTS;
      const maxCapFromProfile = userProfile.maxPointsCap || MAX_POINTS;
      
      try {
        const pointsKey = getPointsKey();
        const totalKey = getTotalPointsKey();
        console.log('[Index] Loading points for keys:', pointsKey, totalKey);
        
        const raw = await AsyncStorage.getItem(pointsKey);
        const totalRaw = await AsyncStorage.getItem(totalKey);
        
        // Charger points totaux
        if (totalRaw) {
          setTotalPointsEarned(JSON.parse(totalRaw));
        }
        
        if (raw) {
          const parsed = JSON.parse(raw);
          let balance = parsed.balance ?? 0;
          const last = parsed.lastClaimDate ?? '';
          
          console.log('[Index] Points check - lastClaimDate:', last, 'today:', today, 'balance:', balance);
          
          if (last !== today) {
            // Nouveau jour : créditer les points quotidiens
            const oldBalance = balance;
            balance = Math.min(maxCapFromProfile, balance + dailyPointsFromProfile);
            console.log('[Index] Nouveau jour ! Crédit de', dailyPointsFromProfile, 'pts. Ancien:', oldBalance, '→ Nouveau:', balance);
            
            await AsyncStorage.setItem(pointsKey, JSON.stringify({ balance, lastClaimDate: today }));
            
            // Incrémenter les points totaux
            const currentTotal = totalRaw ? JSON.parse(totalRaw) : 0;
            const newTotal = currentTotal + dailyPointsFromProfile;
            setTotalPointsEarned(newTotal);
            await AsyncStorage.setItem(totalKey, JSON.stringify(newTotal));
          } else {
            console.log('[Index] Points déjà crédités aujourd\'hui. Balance actuelle:', balance);
            // Le recalcul se fera dans un useEffect séparé après le chargement des entrées
          }
          setPoints(balance);
          setLastClaimDate(today);
        } else {
          // Premier jour : donner les points quotidiens au lieu de INITIAL_POINTS
          console.log('[Index] No points found, initializing for user:', currentUserId);
          const initBalance = Math.min(maxCapFromProfile, dailyPointsFromProfile);
          console.log('[Index] Initialisation avec', initBalance, 'pts (budget quotidien:', dailyPointsFromProfile, ', cap:', maxCapFromProfile, ')');
          
          await AsyncStorage.setItem(pointsKey, JSON.stringify({ balance: initBalance, lastClaimDate: today }));
          setPoints(initBalance);
          setLastClaimDate(today);
          
          // Initialiser points totaux
          await AsyncStorage.setItem(totalKey, JSON.stringify(initBalance));
          setTotalPointsEarned(initBalance);
        }
      } catch (e) {
        console.log('Erreur points', e);
      }
    };
    loadPoints();
  }, [userProfile, currentUserId, authLoading]); // Relancer quand le profil ou userId change

  // Recalculer les points après chargement des entrées (pour corriger les incohérences)
  useEffect(() => {
    const recalculatePointsFromEntries = async () => {
      console.log('[Recalc] Déclenchement recalcul - Conditions:', { 
        userProfile: !!userProfile, 
        currentUserId, 
        isReady, 
        entriesCount: entries.length 
      });
      
      if (!userProfile || !currentUserId || currentUserId === 'guest' || !isReady) {
        console.log('[Recalc] Conditions non remplies, skip');
        return;
      }

      // Attendre un peu pour s'assurer que tout est chargé (synchronisation Firestore terminée)
      await new Promise(resolve => setTimeout(resolve, 1000));

      const today = getTodayLocal();
      const dailyPointsFromProfile = userProfile.dailyPointsBudget || DAILY_POINTS;

      try {
        // Charger les points actuels
        const pointsKey = getPointsKey();
        const pointsRaw = await AsyncStorage.getItem(pointsKey);
        if (!pointsRaw) {
          console.log('[Recalc] Pas de points trouvés');
          return;
        }
        
        const pointsData = JSON.parse(pointsRaw);
        const currentBalance = pointsData.balance ?? 0;
        const lastClaimDate = pointsData.lastClaimDate ?? '';

        // Ne recalculer que si c'est aujourd'hui
        if (lastClaimDate !== today) {
          console.log('[Recalc] Pas aujourd\'hui, skip. lastClaimDate:', lastClaimDate, 'today:', today);
          return;
        }

        // Charger les custom foods pour calculer les coûts
        const customFoods = await loadCustomFoods(currentUserId);
        const allFoods = mergeFoodsWithCustom(FOOD_DB, customFoods);

        // Filtrer les entrées d'aujourd'hui
        const todayEntries = entries.filter(e => normalizeDate(e.createdAt) === today);
        let totalSpentToday = 0;

        console.log('[Recalc] Recalcul des points - Total entrées:', entries.length, 'Entrées d\'aujourd\'hui:', todayEntries.length);
        console.log('[Recalc] Date aujourd\'hui:', today);
        console.log('[Recalc] Dates des entrées:', entries.map(e => ({ 
          label: e.label, 
          createdAt: e.createdAt,
          normalizedDate: normalizeDate(e.createdAt),
          isToday: normalizeDate(e.createdAt) === today
        })));
        
        if (todayEntries.length === 0) {
          console.log('[Recalc] Aucune entrée d\'aujourd\'hui, pas de recalcul nécessaire');
          return;
        }

        for (const entry of todayEntries) {
          if (entry.items && entry.items.length > 0) {
            const entryCost = entry.items.reduce((sum, itemRef) => {
              const fi = allFoods.find(f => f.id === itemRef.foodId);
              if (!fi) {
                console.log('[Recalc] Aliment non trouvé:', itemRef.foodId);
                return sum;
              }
              const multiplier = itemRef.multiplier || 1.0;
              const baseCost = computeFoodPoints(fi);
              const cost = Math.round(baseCost * Math.sqrt(multiplier));
              console.log(`[Recalc] ${entry.label || 'Entrée'} - ${fi.name}: ${cost} pts`);
              return sum + cost;
            }, 0);
            totalSpentToday += entryCost;
          }
        }

        // Calculer le solde attendu : points du jour - dépenses
        const expectedBalance = Math.max(0, dailyPointsFromProfile - totalSpentToday);

        console.log('[Recalc] Recalcul des points:', {
          dailyPoints: dailyPointsFromProfile,
          totalSpent: totalSpentToday,
          expectedBalance,
          currentBalance,
        });

        // Si le solde attendu est différent du solde actuel, corriger
        if (expectedBalance !== currentBalance) {
          console.log('[Recalc] ✅ Correction automatique des points:', {
            dailyPoints: dailyPointsFromProfile,
            totalSpent: totalSpentToday,
            expectedBalance,
            currentBalance,
          });

          await AsyncStorage.setItem(pointsKey, JSON.stringify({ balance: expectedBalance, lastClaimDate: today }));
          setPoints(expectedBalance);
          console.log('[Recalc] Points mis à jour localement:', expectedBalance);

          // Synchroniser vers Firestore pour écraser l'ancienne valeur
          if (currentUserId !== 'guest') {
            const totalPointsKey = getTotalPointsKey();
            const totalRaw = await AsyncStorage.getItem(totalPointsKey);
            const totalPointsVal = totalRaw ? JSON.parse(totalRaw) : 0;
            console.log('[Recalc] Synchronisation vers Firestore...');
            await syncPointsToFirestore(currentUserId, expectedBalance, today, totalPointsVal);
            console.log('[Recalc] Points synchronisés vers Firestore avec succès');
          }

          console.log('[Recalc] ✅ Solde corrigé automatiquement:', expectedBalance, 'pts');
        }
      } catch (error) {
        console.error('[Recalc] Erreur recalcul points:', error);
      }
    };

    recalculatePointsFromEntries();
  }, [entries, isReady, userProfile, currentUserId]); // Se déclenche après chargement des entrées

  // Charger les aliments personnalisés (depuis AsyncStorage + Firestore)
  const loadCustomFoodsData = async () => {
    if (!currentUserId || currentUserId === 'guest') {
      const custom = await loadCustomFoods();
      setCustomFoods(custom);
      return;
    }
    const custom = await loadCustomFoods(currentUserId);
    setCustomFoods(custom);
  };

  // Vérification et correction automatique des points au chargement initial seulement
  // (Désactivé pour éviter les race conditions - la déduction se fait directement dans handleAddEntry)
  // TODO: Réactiver avec une logique plus robuste si nécessaire
  /*
  useEffect(() => {
    const verifyAndFixPoints = async () => {
      if (!userProfile || !currentUserId || currentUserId === 'guest' || entries.length === 0 || !isReady) {
        return;
      }

      const today = getTodayLocal();
      const dailyPointsFromProfile = userProfile.dailyPointsBudget || DAILY_POINTS;

      try {
        // Charger les custom foods pour calculer les coûts
        const customFoodsForCalc = await loadCustomFoods(currentUserId);
        const allFoodsForCalc = mergeFoodsWithCustom(FOOD_DB, customFoodsForCalc);

        // Filtrer les entrées d'aujourd'hui
        const todayEntries = entries.filter(e => normalizeDate(e.createdAt) === today);
        let totalSpentToday = 0;

        console.log('[AutoFix] Vérification des points - Entrées d\'aujourd\'hui:', todayEntries.length);
        
        for (const entry of todayEntries) {
          if (entry.items && entry.items.length > 0) {
            const entryCost = entry.items.reduce((sum, itemRef) => {
              const fi = allFoodsForCalc.find(f => f.id === itemRef.foodId);
              if (!fi) {
                console.log('[AutoFix] Aliment non trouvé:', itemRef.foodId);
                return sum;
              }
              const multiplier = itemRef.multiplier || 1.0;
              const baseCost = computeFoodPoints(fi);
              const cost = Math.round(baseCost * Math.sqrt(multiplier));
              console.log(`[AutoFix] ${entry.label || 'Entrée'} - ${fi.name}: ${cost} pts (base: ${baseCost}, mult: ${multiplier})`);
              return sum + cost;
            }, 0);
            console.log(`[AutoFix] Coût total entrée "${entry.label || entry.id}": ${entryCost} pts`);
            totalSpentToday += entryCost;
          }
        }

        // Calculer le solde correct
        const correctBalance = Math.max(0, dailyPointsFromProfile - totalSpentToday);

        console.log('[AutoFix] Résumé:', {
          dailyPoints: dailyPointsFromProfile,
          totalSpent: totalSpentToday,
          currentBalance: points,
          correctBalance,
          expectedCalculation: `${dailyPointsFromProfile} - ${totalSpentToday} = ${correctBalance}`,
        });

        // Si le solde actuel est différent du solde calculé, corriger silencieusement
        if (correctBalance !== points && lastClaimDate === today) {
          console.log('[AutoFix] ✅ Correction automatique des points:', {
            dailyPoints: dailyPointsFromProfile,
            totalSpent: totalSpentToday,
            currentBalance: points,
            correctBalance,
          });

          const pointsKey = getPointsKey();
          await AsyncStorage.setItem(pointsKey, JSON.stringify({ balance: correctBalance, lastClaimDate: today }));
          setPoints(correctBalance);

          // Synchroniser vers Firestore
          const totalPointsKey = getTotalPointsKey();
          const totalRaw = await AsyncStorage.getItem(totalPointsKey);
          const totalPointsVal = totalRaw ? JSON.parse(totalRaw) : 0;
          await syncPointsToFirestore(currentUserId, correctBalance, today, totalPointsVal);
        }
      } catch (error) {
        console.error('[AutoFix] Erreur vérification points:', error);
      }
    };

    verifyAndFixPoints();
  }, [entries, isReady, userProfile, currentUserId, points, lastClaimDate]);
  */

  useEffect(() => {
    if (currentUserId) {
      loadCustomFoodsData();
    }
  }, [currentUserId]);

  // Recharger les aliments personnalisés quand on revient sur l'écran add
  useEffect(() => {
    if (screen === 'add' && currentUserId) {
      loadCustomFoodsData();
    }
  }, [screen, currentUserId]);

  // Sauvegarder à chaque changement - SEULEMENT si on a un vrai userId
  useEffect(() => {
    const save = async () => {
      // Ne pas sauvegarder si userId pas encore chargé
      if (!currentUserId) {
        console.log('[Index] Skip save - no valid userId yet');
        return;
      }
      try {
        const key = getEntriesKey();
        console.log('[Index] Saving entries to key:', key, 'count:', entries.length);
        await AsyncStorage.setItem(key, JSON.stringify(entries));
        
        // Sync vers Firestore en arrière-plan
        await syncAllToFirestore(currentUserId);
      } catch (e) {
        console.log('Erreur sauvegarde AsyncStorage', e);
      }
    };
    if (isReady && currentUserId) {
      save();
    }
  }, [entries, isReady, currentUserId]);

  const handleAddEntry = async (entry: Omit<MealEntry, 'id' | 'createdAt'> & { score?: number }) => {
    try {
      const newEntry: MealEntry = {
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        ...entry,
        score: typeof entry.score === 'number' ? entry.score : mapManualCategoryToScore(entry.category),
      };
      
      await userLogger.info(
        currentUserId,
        `Ajout d'entrée: ${newEntry.label}`,
        'add-entry',
        { entryId: newEntry.id, itemsCount: entry.items?.length || 0, category: newEntry.category }
      );
      
      // Ajouter au state
      const updatedEntries = [newEntry, ...entries];
      setEntries(updatedEntries);
      
      // Sauvegarder dans AsyncStorage
      const entriesKey = getEntriesKey();
      await AsyncStorage.setItem(entriesKey, JSON.stringify(updatedEntries));
      
      // Synchroniser avec Firestore
      if (currentUserId !== 'guest') {
        await syncMealEntryToFirestore(currentUserId, newEntry);
      }
      
      // Calculer et déduire les points si l'entrée a des items
      if (entry.items && entry.items.length > 0) {
        const customFoods = await loadCustomFoods(currentUserId !== 'guest' ? currentUserId : undefined);
        const allFoods = mergeFoodsWithCustom(FOOD_DB, customFoods);
        
        const totalPoints = entry.items.reduce((sum, itemRef) => {
          const fi = allFoods.find(f => f.id === itemRef.foodId);
          if (!fi) {
            console.warn(`[Index] Aliment non trouvé pour itemRef.foodId: ${itemRef.foodId}`);
            return sum;
          }
          const multiplier = itemRef.multiplier || 1.0;
          const baseCost = computeFoodPoints(fi);
          const cost = Math.round(baseCost * Math.sqrt(multiplier));
          console.log(`[Index] Calcul points: ${fi.name} = ${cost} pts (base: ${baseCost}, mult: ${multiplier})`);
          return sum + cost;
        }, 0);
        
        console.log(`[Index] Total points calculés pour entrée ${newEntry.id}: ${totalPoints} pts`);
        
        if (totalPoints > 0) {
          const pointsKey = getPointsKey();
          const pointsRaw = await AsyncStorage.getItem(pointsKey);
          const pointsData = pointsRaw ? JSON.parse(pointsRaw) : { balance: 0, lastClaimDate: '' };
          const newBalance = Math.max(0, pointsData.balance - totalPoints);
          
          await AsyncStorage.setItem(pointsKey, JSON.stringify({
            ...pointsData,
            balance: newBalance,
          }));
          
          setPoints(newBalance);
          
          // Synchroniser les points avec Firestore
          if (currentUserId !== 'guest') {
            console.log('[Index] Synchronisation points vers Firestore:', {
              newBalance,
              lastClaimDate: pointsData.lastClaimDate,
              totalPointsEarned,
            });
            await syncPointsToFirestore(currentUserId, newBalance, pointsData.lastClaimDate, totalPointsEarned);
            console.log('[Index] Points synchronisés vers Firestore avec succès');
          }
          
          await userLogger.info(
            currentUserId,
            `Points déduits: -${totalPoints} pts (nouveau solde: ${newBalance})`,
            'points-calculation',
            { pointsDeducted: totalPoints, newBalance, previousBalance: pointsData.balance }
          );
        } else {
          await userLogger.warn(
            currentUserId,
            `Entrée ajoutée mais aucun point déduit`,
            'add-entry',
            { entryId: newEntry.id, items: entry.items }
          );
        }
      } else {
        await userLogger.warn(
          currentUserId,
          `Entrée ajoutée sans items`,
          'add-entry',
          { entryId: newEntry.id, label: newEntry.label }
        );
      }
      
      setScreen('home');
    } catch (error) {
      await logError(currentUserId, error, 'add-entry', { entry });
      console.error('[Index] Erreur lors de l\'ajout d\'entrée:', error);
      Alert.alert('Erreur', 'Impossible d\'enregistrer l\'entrée. Réessayez plus tard.');
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    try {
      // Trouver l'entrée à supprimer
      const entryToDelete = entries.find(e => e.id === entryId);
      if (!entryToDelete) {
        console.error('[Delete] Entrée non trouvée:', entryId);
        return;
      }
      
      console.log('[Delete] Suppression entrée:', entryToDelete.label, 'ID:', entryId);

      // Calculer le coût en points de cette entrée pour remboursement
      let refundPoints = 0;
      if (entryToDelete.items && entryToDelete.items.length > 0) {
        // Charger les aliments personnalisés pour le calcul
        const customFoods = await loadCustomFoods(currentUserId !== 'guest' ? currentUserId : undefined);
        const allFoods = mergeFoodsWithCustom(FOOD_DB, customFoods);
        
        refundPoints = entryToDelete.items.reduce((sum, itemRef) => {
          const fi = allFoods.find(f => f.id === itemRef.foodId);
          if (!fi) return sum;
          const multiplier = itemRef.multiplier || 1.0;
          const baseCost = computeFoodPoints(fi);
          const cost = Math.round(baseCost * Math.sqrt(multiplier));
          return sum + cost;
        }, 0);
      }

      // Supprimer l'entrée
      const updated = entries.filter(e => e.id !== entryId);
      setEntries(updated);
      
      // Rembourser les points si nécessaire
      if (refundPoints > 0) {
        const newBalance = Math.min(userProfile?.maxPointsCap || MAX_POINTS, points + refundPoints);
        setPoints(newBalance);
        
        // Sauvegarder les points
        const pointsKey = getPointsKey();
        const pointsRaw = await AsyncStorage.getItem(pointsKey);
        const pointsData = pointsRaw ? JSON.parse(pointsRaw) : { balance: 0, lastClaimDate: '' };
        await AsyncStorage.setItem(pointsKey, JSON.stringify({
          ...pointsData,
          balance: newBalance,
        }));
        
        console.log(`[Index] Points remboursés: +${refundPoints} pts (nouveau solde: ${newBalance})`);
      }
      
      // Sauvegarder les entrées
      const key = getEntriesKey();
      await AsyncStorage.setItem(key, JSON.stringify(updated));
      if (currentUserId !== 'guest') {
        // Supprimer explicitement de Firestore
        const { deleteMealEntryFromFirestore } = await import('../../lib/data-sync');
        await deleteMealEntryFromFirestore(currentUserId, entryId);
        // Synchroniser aussi pour être sûr que tout est à jour
        const { syncAllToFirestore } = await import('../../lib/data-sync');
        await syncAllToFirestore(currentUserId);
      }
      
      // Afficher un message de succès
      const successMsg = refundPoints > 0 
        ? `Entrée supprimée. ${refundPoints} point(s) remboursé(s).`
        : 'Entrée supprimée avec succès';
      
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        console.log(successMsg);
        if (refundPoints > 0) {
          window.alert(successMsg);
        }
      } else {
        Alert.alert('✅ Supprimé', successMsg);
      }
    } catch (e) {
      console.error('Erreur suppression entrée:', e);
      const errorMsg = 'Impossible de supprimer l\'entrée. Réessayez plus tard.';
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(errorMsg);
      } else {
        Alert.alert('Erreur', errorMsg);
      }
    }
  };

  // Fonction pour corriger les points après les changements du système
  const fixPointsBalance = async () => {
    if (!userProfile || !currentUserId) {
      console.log('[Index] fixPointsBalance: Pas de profil ou userId');
      return;
    }
    
    try {
      const today = getTodayLocal();
      const dailyPointsFromProfile = userProfile.dailyPointsBudget || DAILY_POINTS;
      const maxCapFromProfile = userProfile.maxPointsCap || MAX_POINTS;
      
      // Calculer le total dépensé aujourd'hui
      const todayEntries = entries.filter(e => normalizeDate(e.createdAt) === today);
      let totalSpent = 0;
      
      if (todayEntries.length > 0) {
        const customFoods = await loadCustomFoods(currentUserId !== 'guest' ? currentUserId : undefined);
        const allFoods = mergeFoodsWithCustom(FOOD_DB, customFoods);
        
        for (const entry of todayEntries) {
          if (entry.items && entry.items.length > 0) {
            const entryCost = entry.items.reduce((sum, itemRef) => {
              const fi = allFoods.find(f => f.id === itemRef.foodId);
              if (!fi) return sum;
              const multiplier = itemRef.multiplier || 1.0;
              const baseCost = computeFoodPoints(fi);
              const cost = Math.round(baseCost * Math.sqrt(multiplier));
              return sum + cost;
            }, 0);
            totalSpent += entryCost;
          }
        }
      }
      
      // Calculer le solde correct : points du jour - dépenses
      const correctBalance = Math.max(0, Math.min(maxCapFromProfile, dailyPointsFromProfile - totalSpent));
      
      const pointsKey = getPointsKey();
      await AsyncStorage.setItem(pointsKey, JSON.stringify({
        balance: correctBalance,
        lastClaimDate: today,
      }));
      
      setPoints(correctBalance);
      setLastClaimDate(today);
      
      console.log('[Index] Points corrigés:', {
        dailyPoints: dailyPointsFromProfile,
        totalSpent,
        correctBalance,
      });
      
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(`Points corrigés ! Tu as maintenant ${correctBalance} points (reçu ${dailyPointsFromProfile} pts ce matin, dépensé ${totalSpent} pts).`);
      } else {
        Alert.alert(
          '✅ Points corrigés',
          `Tu as maintenant ${correctBalance} points (reçu ${dailyPointsFromProfile} pts ce matin, dépensé ${totalSpent} pts).`
        );
      }
    } catch (e) {
      console.error('[Index] Erreur correction points:', e);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert('Erreur lors de la correction des points.');
      } else {
        Alert.alert('Erreur', 'Impossible de corriger les points.');
      }
    }
  };
  
  const spendPoints = async (cost: number) => {
    if (cost <= 0) return;
    const newBalance = Math.max(0, points - cost);
    setPoints(newBalance);
    try {
      await AsyncStorage.setItem(getPointsKey(), JSON.stringify({ balance: newBalance, lastClaimDate }));
    } catch (e) {
      console.log('Erreur sauvegarde points', e);
    }
  };

  return (
    <View style={styles.container}>
      {screen === 'home' && (
        <HomeScreen
          entries={entries}
          onPressAdd={() => setScreen('add')}
          onDeleteEntry={handleDeleteEntry}
          stats={stats}
          dragonState={dragonState}
          streak={streak}
          recommendations={smartRecommendations}
          todayTotals={todayTotals}
          targets={targets}
          onSaveTargets={async (next) => {
            setTargets(next);
            await AsyncStorage.setItem(getTargetsKey(), JSON.stringify(next));
          }}
          points={points}
          totalPointsEarned={totalPointsEarned}
          userProfile={userProfile}
          setPreselectedItem={setPreselectedItem}
          lastClaimDate={lastClaimDate}
          customFoods={customFoods}
        />
      )}

      {screen === 'add' && (
        <AddEntryScreen
          onCancel={() => {
            setScreen('home');
            setPreselectedItem(null);
          }}
          onSave={handleAddEntry}
          points={points}
          spendPoints={spendPoints}
          todayTotals={todayTotals}
          targets={targets}
          preselectedItem={preselectedItem}
          customFoods={customFoods}
        />
      )}

      <StatusBar style="light" />
    </View>
  );
}

// ---- Écran d'accueil ----
function HomeScreen({
  entries,
  onPressAdd,
  onDeleteEntry,
  stats,
  dragonState,
  streak,
  recommendations,
  todayTotals,
  targets,
  onSaveTargets,
  points,
  totalPointsEarned,
  userProfile,
  setPreselectedItem,
  lastClaimDate,
  customFoods,
}: {
  entries: MealEntry[];
  onPressAdd: () => void;
  onDeleteEntry: (entryId: string) => void | Promise<void>;
  stats: StatsUI;
  dragonState: DragonStatus;
  streak: ReturnType<typeof computeStreak>;
  recommendations: SmartRecommendation[];
  todayTotals: ReturnType<typeof computeDailyTotals>;
  targets: typeof DEFAULT_TARGETS;
  onSaveTargets: (next: typeof DEFAULT_TARGETS) => void | Promise<void>;
  points: number;
  totalPointsEarned: number;
  userProfile: UserProfile | null;
  setPreselectedItem: (item: { item: FoodItem; portion: PortionReference } | null) => void;
  lastClaimDate: string;
  customFoods: typeof FOOD_DB;
}) {
  // Calculer le coût en points d'une entrée
  const calculateEntryCost = (entry: MealEntry): number => {
    if (!entry.items || entry.items.length === 0) return 0;
    const allFoods = mergeFoodsWithCustom(FOOD_DB, customFoods);
    return entry.items.reduce((sum, itemRef) => {
      const fi = allFoods.find(f => f.id === itemRef.foodId);
      if (!fi) return sum;
      const multiplier = itemRef.multiplier || 1.0;
      const baseCost = computeFoodPoints(fi);
      const cost = Math.round(baseCost * Math.sqrt(multiplier));
      return sum + cost;
    }, 0);
  };
  
  const [isEditingTargets, setIsEditingTargets] = useState(false);
  const [draftTargets, setDraftTargets] = useState({
    protein_g: targets.protein_g.toString(),
    carbs_g: targets.carbs_g.toString(),
    calories_kcal: targets.calories_kcal.toString(),
    fat_g: targets.fat_g.toString(),
  });

  useEffect(() => {
    setDraftTargets({
      protein_g: targets.protein_g.toString(),
      carbs_g: targets.carbs_g.toString(),
      calories_kcal: targets.calories_kcal.toString(),
      fat_g: targets.fat_g.toString(),
    });
  }, [targets]);

  const handleSaveTargets = async () => {
    // Validation des inputs
    const protein = Number(draftTargets.protein_g);
    const carbs = Number(draftTargets.carbs_g);
    const calories = Number(draftTargets.calories_kcal);
    const fat = Number(draftTargets.fat_g);

    // Validation: valeurs doivent être positives et raisonnables
    if (isNaN(protein) || protein < 0 || protein > 500) {
      alert('Les protéines doivent être entre 0 et 500 g');
      return;
    }
    if (isNaN(carbs) || carbs < 0 || carbs > 1000) {
      alert('Les glucides doivent être entre 0 et 1000 g');
      return;
    }
    if (isNaN(calories) || calories < 500 || calories > 10000) {
      alert('Les calories doivent être entre 500 et 10000 kcal/jour');
      return;
    }
    if (isNaN(fat) || fat < 0 || fat > 500) {
      alert('Les lipides doivent être entre 0 et 500 g');
      return;
    }

    const next = {
      protein_g: protein,
      carbs_g: carbs,
      calories_kcal: calories,
      fat_g: fat,
    };
    await onSaveTargets(next);
    setIsEditingTargets(false);
  };

  const levelImages: Record<1 | 2 | 3, any> = {
    1: require('../../assets/images/feedtoki_lvl1.png'),
    2: require('../../assets/images/feedtoki_lvl2.png'),
    3: require('../../assets/images/feedtoki_lvl3.png'),
  };
  const imgSource = levelImages[stats.level as 1 | 2 | 3] || levelImages[1];
  
  // Info budget personnalisé
  const dailyBudget = userProfile?.dailyPointsBudget || DAILY_POINTS;
  const maxCap = userProfile?.maxPointsCap || MAX_POINTS;
  const weeklyCalTarget = userProfile?.weeklyCalorieTarget;
  
  // Smart recommendations state
  const [showHungryMode, setShowHungryMode] = useState(false);
  const [tastePreference, setTastePreference] = useState<'sweet' | 'salty' | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  
  // Get time of day for context-aware suggestions
  const getTimeOfDay = (): 'morning' | 'afternoon' | 'evening' => {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'evening';
  };
  
  const timeOfDay = getTimeOfDay();
  
  const smartRecs = showHungryMode 
    ? (tastePreference 
        ? getSmartRecommendationsByTaste(todayTotals, targets, points, tastePreference, timeOfDay)
        : getSmartRecommendations(todayTotals, targets, points, timeOfDay))
    : [];
  const hungerAnalysis = getHungerAnalysis(todayTotals, targets, timeOfDay);

  // Détection de profil suspect (calories trop élevées = probable erreur lbs/kg)
  const hasSuspectProfile = userProfile && weeklyCalTarget && weeklyCalTarget > 30000;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.innerContent}>
      {/* Header avec settings */}
      <View style={styles.headerRow}>
        <Text style={styles.logo}>FeedToki 🐉</Text>
        <TouchableOpacity 
          style={styles.headerSettingsButton}
          onPress={() => setShowSettingsModal(true)}
        >
          <Text style={styles.headerSettingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Modal Settings */}
      {showSettingsModal && (
        <View style={styles.settingsOverlay}>
          <View style={styles.settingsModal}>
            <View style={styles.settingsHeader}>
              <Text style={styles.settingsTitle}>⚙️ Paramètres</Text>
              <TouchableOpacity onPress={() => setShowSettingsModal(false)}>
                <Text style={styles.settingsClose}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity 
              style={styles.settingsOption}
              onPress={() => {
                setShowSettingsModal(false);
                router.push('/onboarding');
              }}
            >
              <Text style={styles.settingsOptionIcon}>🎯</Text>
              <View style={styles.settingsOptionContent}>
                <Text style={styles.settingsOptionTitle}>Modifier mes objectifs</Text>
                <Text style={styles.settingsOptionDesc}>Poids, objectif de perte, niveau d'activité</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.settingsOption}
              onPress={() => {
                setShowSettingsModal(false);
                router.push('/(tabs)/explore');
              }}
            >
              <Text style={styles.settingsOptionIcon}>👤</Text>
              <View style={styles.settingsOptionContent}>
                <Text style={styles.settingsOptionTitle}>Mon compte</Text>
                <Text style={styles.settingsOptionDesc}>Profil, déconnexion</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.settingsOption, styles.settingsOptionLast]}
              onPress={() => setShowSettingsModal(false)}
            >
              <Text style={styles.settingsOptionIcon}>ℹ️</Text>
              <View style={styles.settingsOptionContent}>
                <Text style={styles.settingsOptionTitle}>À propos</Text>
                <Text style={styles.settingsOptionDesc}>Version 1.0 - Toki</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Modal Dragon Mort - TEMPORAIREMENT DÉSACTIVÉ - TODO: Réimplémenter après fix */}

      {/* Alerte profil suspect */}
      {hasSuspectProfile && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningTitle}>⚠️ Profil à vérifier</Text>
          <Text style={styles.warningText}>
            Tes objectifs semblent incorrects ({Math.round((weeklyCalTarget || 0) / 7)} cal/jour).
            Tu as probablement entré ton poids en livres mais l'ancien système l'a interprété en kg.
          </Text>
          <TouchableOpacity 
            style={styles.warningButton}
            onPress={() => router.push('/onboarding')}
          >
            <Text style={styles.warningButtonText}>✏️ Corriger mes objectifs</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Dragon avec système de niveaux */}
      <DragonSprite 
        streakDays={streak.currentStreakDays}
        mood={dragonState.mood}
        showInfo={true}
        size={140}
      />
      
      {/* Budget Points Personnalisé */}
      {userProfile && (
        <View style={styles.budgetBox}>
          <Text style={styles.budgetTitle}>💰 Ton Budget Points</Text>
          {weeklyCalTarget && (
            <Text style={styles.budgetSubtitle}>
              Objectif: {weeklyCalTarget.toLocaleString()} cal/semaine
            </Text>
          )}
          
          {/* Points disponibles - Mise en avant */}
          <View style={styles.budgetCurrentBox}>
            <Text style={styles.budgetCurrentLabel}>Points disponibles</Text>
            <Text style={[styles.budgetCurrentValue, points === 0 && styles.budgetCurrentZero]}>
              {points} pts
            </Text>
            {points === 0 && (
              <Text style={styles.budgetHint}>
                Tu as utilisé tous tes points aujourd'hui. Tu recevras {dailyBudget} nouveaux points demain matin.
              </Text>
            )}
            {points > 0 && lastClaimDate === getTodayLocal() && (
              <Text style={styles.budgetHint}>
                Reçu ce matin : {dailyBudget} pts
              </Text>
            )}
          </View>

          {/* Détails du système */}
          <View style={styles.budgetDetailsRow}>
            <View style={styles.budgetDetailCol}>
              <Text style={styles.budgetDetailLabel}>Gagné par jour</Text>
              <Text style={styles.budgetDetailValue}>{dailyBudget} pts</Text>
              <Text style={styles.budgetDetailHint}>Reçu chaque matin</Text>
            </View>
            <View style={styles.budgetDetailCol}>
              <Text style={styles.budgetDetailLabel}>Cap maximum</Text>
              <Text style={styles.budgetDetailValue}>{maxCap} pts</Text>
              <Text style={styles.budgetDetailHint}>Maximum accumulable</Text>
            </View>
          </View>

          {/* Barre de progression */}
          <View style={styles.budgetProgressContainer}>
            <View style={styles.budgetProgressTrack}>
              <View 
                style={[
                  styles.budgetProgressBar, 
                  { width: `${Math.min(100, (points / maxCap) * 100)}%` }
                ]} 
              />
            </View>
            <Text style={styles.budgetProgressText}>
              {points} / {maxCap} pts
            </Text>
          </View>
        </View>
      )}

      <Text style={styles.statsText}>
        7 derniers jours : {stats.label} ({stats.scorePct}%)
      </Text>

      {/* Bouton Streak - ouvre la page stats */}
      <TouchableOpacity 
        style={styles.streakButton}
        onPress={() => router.push('/stats')}
      >
        <View style={styles.streakButtonContent}>
          <Text style={styles.streakButtonIcon}>🔥</Text>
          <View style={styles.streakButtonInfo}>
            <Text style={styles.streakButtonDays}>{streak.currentStreakDays} jour{streak.currentStreakDays !== 1 ? 's' : ''}</Text>
            <Text style={styles.streakButtonLabel}>Streak actuel</Text>
          </View>
          <Text style={styles.streakButtonArrow}>→</Text>
        </View>
      </TouchableOpacity>

      {/* Bonus de streak */}
      {streak.streakBonusEarned > 0 && (
        <View style={styles.streakBonusBox}>
          <Text style={styles.streakBonusTitle}>🔥 Bonus Streak!</Text>
          <Text style={styles.streakBonusText}>
            Tu as complété {streak.streakBonusEarned} mois complet{streak.streakBonusEarned > 1 ? 's' : ''} (30 jours)!
          </Text>
          {streak.isStreakBonusDay && (
            <Text style={styles.streakBonusSpecial}>
              🎉 Félicitations! Tu viens de compléter un mois complet (30 jours)!
            </Text>
          )}
        </View>
      )}

      <Text style={styles.stateText}>
        {dragonState.mood === 'normal' && 'FeedToki est en forme 🐉'}
        {dragonState.mood === 'inquiet' && "FeedToki s'inquiete un peu… 😟"}
        {dragonState.mood === 'critique' && 'FeedToki a besoin de toi 😰'}
      </Text>
      
      {/* Bouton "J'ai faim" */}
      <TouchableOpacity 
        style={styles.hungryButton} 
        onPress={() => {
          if (showHungryMode) {
            setShowHungryMode(false);
            setTastePreference(null); // Reset taste preference when closing
          } else {
            setShowHungryMode(true);
          }
        }}
      >
        <Text style={styles.hungryButtonText}>
          {showHungryMode ? '✕ Fermer' : '🍴 J\'ai faim - Aide-moi à choisir!'}
        </Text>
      </TouchableOpacity>
      
      {/* Smart recommendations quand activé */}
      {showHungryMode && (
        <View style={styles.smartRecsBox}>
          <Text style={styles.smartRecsTitle}>🤖 Suggestions Intelligentes</Text>
          
          {/* Résumé de ce qui a été mangé aujourd'hui */}
          <View style={styles.todaySummaryBox}>
            <Text style={styles.todaySummaryTitle}>📊 Ce que tu as mangé aujourd'hui:</Text>
            <Text style={styles.todaySummaryText}>
              • {todayTotals.calories_kcal.toFixed(0)} / {targets.calories_kcal.toFixed(0)} calories ({((todayTotals.calories_kcal / targets.calories_kcal) * 100).toFixed(0)}%)
            </Text>
            <Text style={styles.todaySummaryText}>
              • {todayTotals.protein_g.toFixed(0)} / {targets.protein_g.toFixed(0)}g protéines ({((todayTotals.protein_g / targets.protein_g) * 100).toFixed(0)}%)
            </Text>
            <Text style={styles.todaySummaryText}>
              • {todayTotals.carbs_g.toFixed(0)} / {targets.carbs_g.toFixed(0)}g glucides ({((todayTotals.carbs_g / targets.carbs_g) * 100).toFixed(0)}%)
            </Text>
            <Text style={styles.todaySummaryText}>
              • {todayTotals.fat_g.toFixed(0)} / {targets.fat_g.toFixed(0)}g lipides ({((todayTotals.fat_g / targets.fat_g) * 100).toFixed(0)}%)
            </Text>
            <Text style={styles.todaySummaryText}>
              • Points restants : {points} pts
            </Text>
          </View>
          
          {/* Analyse de la faim avec contexte temporel */}
          <Text style={styles.smartRecsAnalysis}>{hungerAnalysis}</Text>
          
          {/* Choix du goût (sucré ou salé) */}
          {!tastePreference ? (
            <View style={styles.tasteChoiceBox}>
              <Text style={styles.tasteChoiceTitle}>🍽️ Qu'est-ce qui te ferait plaisir ?</Text>
              <View style={styles.tasteButtonsRow}>
                <TouchableOpacity
                  style={[styles.tasteButton, styles.tasteButtonSweet]}
                  onPress={() => setTastePreference('sweet')}
                >
                  <Text style={styles.tasteButtonText}>🍰 Sucré</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tasteButton, styles.tasteButtonSalty]}
                  onPress={() => setTastePreference('salty')}
                >
                  <Text style={styles.tasteButtonText}>🍗 Salé</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.tasteSelectedBox}>
              <Text style={styles.tasteSelectedText}>
                {tastePreference === 'sweet' ? '🍰 Mode sucré' : '🍗 Mode salé'}
              </Text>
              <TouchableOpacity
                style={styles.tasteChangeButton}
                onPress={() => setTastePreference(null)}
              >
                <Text style={styles.tasteChangeButtonText}>Changer</Text>
              </TouchableOpacity>
            </View>
          )}
          
          {!tastePreference ? (
            <Text style={styles.smartRecsEmpty}>
              Choisis d'abord si tu préfères sucré ou salé ! 👆
            </Text>
          ) : smartRecs.length === 0 ? (
            <Text style={styles.smartRecsEmpty}>
              Aucune suggestion pour l&apos;instant. Tu es peut-être proche de ton objectif! 🎯
            </Text>
          ) : (
            <>
              <Text style={styles.smartRecsSubtitle}>
                💡 Recommandé pour toi ({tastePreference === 'sweet' ? 'sucré' : 'salé'}, {timeOfDay === 'morning' ? 'matin' : timeOfDay === 'afternoon' ? 'après-midi' : 'soir'}):
              </Text>
              {smartRecs.map((rec, idx) => (
                <TouchableOpacity
                  key={rec.item.id}
                  style={styles.smartRecItem}
                  onPress={() => {
                    setShowHungryMode(false);
                    setPreselectedItem({
                      item: rec.item,
                      portion: rec.portion
                    });
                    onPressAdd();
                  }}
                >
                  <View style={styles.smartRecHeader}>
                    <Text style={styles.smartRecName}>
                      {idx + 1}. {rec.item.name}
                    </Text>
                    <Text style={styles.smartRecCost}>{rec.pointsCost} pts</Text>
                  </View>
                  <Text style={styles.smartRecReason}>💡 {rec.reason}</Text>
                  <Text style={styles.smartRecNutrition}>
                    📏 {rec.suggestedGrams}g ({rec.suggestedVisualRef}) · 🔥 {rec.item.calories_kcal || 0} cal · 💪 {rec.item.protein_g || 0}g protéines
                  </Text>
                </TouchableOpacity>
              ))}
            </>
          )}
        </View>
      )}

      {(dragonState.mood === 'inquiet' || dragonState.mood === 'critique') && (
        <View style={styles.hungryBox}>
          <Text style={styles.hungryTitle}>Toki a faim — voici quoi ajouter :</Text>
          {getCanadaGuideRecommendations().map((rec) => (
            <View key={rec.group} style={styles.recRow}>
              <Text style={styles.recTitle}>{rec.title}</Text>
              <Text style={styles.recExamples}>{rec.examples.join(', ')}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.evolutionBox}>
        <Text style={styles.evolutionTitle}>Évolution du dragon</Text>
        <Text style={styles.evolutionText}>
          Niv. débloqués: {streak.evolutionsUnlocked} / 12
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressBar, { width: `${Math.round(streak.progressToNextEvolution * 100)}%` }]} />
        </View>
        <Text style={styles.progressHint}>Progrès vers le prochain niveau</Text>
      </View>

      {/* Calendrier des streaks retiré de la Home; disponible via l'écran Streak/Stats */}

      <View style={styles.nutritionBox}>
        <View style={styles.nutritionHeader}>
          <Text style={styles.nutritionTitle}>Objectifs du jour</Text>
          {!isEditingTargets && (
            <TouchableOpacity 
              style={styles.settingsButton} 
              onPress={() => setIsEditingTargets(true)}
            >
              <Text style={styles.settingsIcon}>⚙️</Text>
            </TouchableOpacity>
          )}
        </View>
        {/* Changement pour forcer rebuild */}
        <NutritionBar label="Calories" value={todayTotals.calories_kcal} unit="kcal" pct={percentageOfTarget(todayTotals.calories_kcal, targets.calories_kcal)} color="#f59e0b" target={targets.calories_kcal} />
        <NutritionBar label="Protéines" value={todayTotals.protein_g} unit="g" pct={percentageOfTarget(todayTotals.protein_g, targets.protein_g)} color="#22c55e" target={targets.protein_g} />
        <NutritionBar label="Glucides" value={todayTotals.carbs_g} unit="g" pct={percentageOfTarget(todayTotals.carbs_g, targets.carbs_g)} color="#3b82f6" target={targets.carbs_g} />
        <NutritionBar label="Lipides" value={todayTotals.fat_g} unit="g" pct={percentageOfTarget(todayTotals.fat_g, targets.fat_g)} color="#ec4899" target={targets.fat_g} />

        {isEditingTargets && (
          <View style={styles.targetsForm}>
            <Text style={styles.targetsHint}>Ajuste les limites quotidiennes pour chaque macro.</Text>
            <View style={styles.targetRow}>
              <Text style={styles.targetLabel}>Protéines (g)</Text>
              <TextInput
                style={styles.targetInput}
                keyboardType="numeric"
                value={draftTargets.protein_g}
                onChangeText={(t) => setDraftTargets((prev) => ({ ...prev, protein_g: t.replace(',', '.') }))}
              />
            </View>
            <View style={styles.targetRow}>
              <Text style={styles.targetLabel}>Glucides (g)</Text>
              <TextInput
                style={styles.targetInput}
                keyboardType="numeric"
                value={draftTargets.carbs_g}
                onChangeText={(t) => setDraftTargets((prev) => ({ ...prev, carbs_g: t.replace(',', '.') }))}
              />
            </View>
            <View style={styles.targetRow}>
              <Text style={styles.targetLabel}>Calories (kcal)</Text>
              <TextInput
                style={styles.targetInput}
                keyboardType="numeric"
                value={draftTargets.calories_kcal}
                onChangeText={(t) => setDraftTargets((prev) => ({ ...prev, calories_kcal: t.replace(',', '.') }))}
              />
            </View>
            <View style={styles.targetRow}>
              <Text style={styles.targetLabel}>Lipides (g)</Text>
              <TextInput
                style={styles.targetInput}
                keyboardType="numeric"
                value={draftTargets.fat_g}
                onChangeText={(t) => setDraftTargets((prev) => ({ ...prev, fat_g: t.replace(',', '.') }))}
              />
            </View>
            <View style={styles.targetsActions}>
              <TouchableOpacity style={styles.buttonGhost} onPress={() => setIsEditingTargets(false)}>
                <Text style={styles.buttonGhostText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.buttonPrimary} onPress={handleSaveTargets}>
                <Text style={styles.buttonPrimaryText}>Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <View style={styles.homeButtons}>
        <TouchableOpacity style={styles.buttonPrimary} onPress={onPressAdd}>
          <Text style={styles.buttonPrimaryText}>Partager avec Toki</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.historyBox}>
        <Text style={styles.historyTitle}>Dernières entrées</Text>
        {entries.length === 0 ? (
          <Text style={styles.historyEmpty}>{"Aucune entrée pour l'instant."}</Text>
        ) : (
          <FlatList
            data={(() => {
              // Trier par date (plus récent en premier) et limiter à 10 pour ne pas surcharger l'interface
              return entries
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 10);
            })()}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const entryCost = calculateEntryCost(item);
              // Calculer les totaux nutritionnels pour cette entrée
              const allFoods = mergeFoodsWithCustom(FOOD_DB, customFoods);
              const entryNutrition = item.items?.reduce((acc, itemRef) => {
                const fi = allFoods.find(f => f.id === itemRef.foodId);
                if (!fi) return acc;
                const multiplier = itemRef.multiplier || 1.0;
                return {
                  calories: acc.calories + (fi.calories_kcal || 0) * multiplier,
                  protein: acc.protein + (fi.protein_g || 0) * multiplier,
                  carbs: acc.carbs + (fi.carbs_g || 0) * multiplier,
                  fat: acc.fat + (fi.fat_g || 0) * multiplier,
                };
              }, { calories: 0, protein: 0, carbs: 0, fat: 0 }) || { calories: 0, protein: 0, carbs: 0, fat: 0 };
              
              return (
              <View style={styles.historyItemRow}>
                <View style={styles.historyItemContent}>
                  <Text style={styles.historyItem}>
                    • [{item.category}] {item.label}
                  </Text>
                  <View style={styles.historyItemNutrition}>
                    <Text style={styles.historyItemNutritionText}>
                      🔥 {Math.round(entryNutrition.calories)} cal
                    </Text>
                    <Text style={styles.historyItemNutritionText}>
                      💪 {Math.round(entryNutrition.protein)}g prot
                    </Text>
                    <Text style={styles.historyItemNutritionText}>
                      🍞 {Math.round(entryNutrition.carbs)}g gluc
                    </Text>
                    <Text style={styles.historyItemNutritionText}>
                      🧈 {Math.round(entryNutrition.fat)}g lipides
                    </Text>
                  </View>
                  {entryCost > 0 && (
                    <Text style={styles.historyItemCost}>
                      -{entryCost} pts
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.historyDeleteButton}
                  onPress={() => {
                    // Sur web, utiliser window.confirm, sinon Alert.alert
                    if (Platform.OS === 'web' && typeof window !== 'undefined') {
                      const confirmed = window.confirm(`Supprimer "${item.label}" ?`);
                      if (confirmed) {
                        onDeleteEntry(item.id);
                      }
                    } else {
                      Alert.alert(
                        'Supprimer',
                        `Supprimer "${item.label}" ?`,
                        [
                          { text: 'Annuler', style: 'cancel' },
                          {
                            text: 'Supprimer',
                            style: 'destructive',
                            onPress: () => onDeleteEntry(item.id),
                          },
                        ]
                      );
                    }
                  }}
                >
                  <Text style={styles.historyDeleteText}>✕</Text>
                </TouchableOpacity>
              </View>
              );
            }}
          />
        )}
      </View>
    </ScrollView>
  );
}

// ---- Écran ajout d'une consommation ----
function AddEntryScreen({
  onCancel,
  onSave,
  points,
  spendPoints,
  todayTotals,
  targets,
  preselectedItem,
  customFoods = [],
}: {
  onCancel: () => void;
  onSave: (entry: Omit<MealEntry, 'id' | 'createdAt'>) => void;
  points: number;
  spendPoints: (cost: number) => Promise<void> | void;
  todayTotals: ReturnType<typeof computeDailyTotals>;
  targets: typeof DEFAULT_TARGETS;
  preselectedItem: { item: FoodItem; portion: PortionReference } | null;
  customFoods?: typeof FOOD_DB;
}) {
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState<MealEntry['category']>('sain');
  const [items, setItems] = useState<FoodItemRef[]>([]);
  const [quickFilter, setQuickFilter] = useState<CategoryFilter>('all');
  const [selectedItemForPortion, setSelectedItemForPortion] = useState<string | null>(null); // Item ID pour modal portion

  // Fusionner FOOD_DB avec les aliments personnalisés (doit être défini avant tout usage)
  const allFoods = useMemo(() => {
    return mergeFoodsWithCustom(FOOD_DB, customFoods);
  }, [customFoods]);

  const selectionNutrition = useMemo(() => {
    return items.reduce(
      (acc, ref) => {
        const fi = allFoods.find((f) => f.id === ref.foodId);
        if (!fi) return acc;
        const multiplier = ref.multiplier || 1.0;
        return {
          protein_g: acc.protein_g + (fi.protein_g || 0) * multiplier,
          carbs_g: acc.carbs_g + (fi.carbs_g || 0) * multiplier,
          calories_kcal: acc.calories_kcal + (fi.calories_kcal || 0) * multiplier,
          fat_g: acc.fat_g + (fi.fat_g || 0) * multiplier,
        };
      },
      { protein_g: 0, carbs_g: 0, calories_kcal: 0, fat_g: 0 }
    );
  }, [items, allFoods]);

  const pendingCost = items.reduce((sum, ref) => {
    const fi = allFoods.find((f) => f.id === ref.foodId);
    if (!fi) return sum;
    const multiplier = ref.multiplier || 1.0;
    const baseCost = computeFoodPoints(fi);
    // Le coût augmente avec la portion (mais pas linéairement pour rester équitable)
    const cost = Math.round(baseCost * Math.sqrt(multiplier));
    return sum + cost;
  }, 0);

  const toggleItem = (foodId: string) => {
    setItems((prev) => {
      const exists = prev.some((i) => i.foodId === foodId);
      if (exists) return prev.filter((i) => i.foodId !== foodId);
      
      // Ouvrir le sélecteur de portion au lieu d'ajouter directement
      const fi = allFoods.find((f) => f.id === foodId);
      if (!fi) return prev;
      
      setSelectedItemForPortion(foodId);
      return prev; // Ne pas ajouter tout de suite
    });
  };
  
  const addItemWithPortion = (foodId: string, portion: PortionReference) => {
    const fi = allFoods.find((f) => f.id === foodId);
    if (!fi) return;
    
    const baseCost = computeFoodPoints(fi);
    const cost = Math.round(baseCost * Math.sqrt(portion.multiplier));
    
    if (pendingCost + cost > points) return; // Pas assez de points
    
    setItems((prev) => [
      ...prev,
      {
        foodId,
        portionSize: portion.size,
        portionGrams: portion.grams,
        multiplier: portion.multiplier,
        quantityHint: `${portion.grams}g (${portion.visualRef})`,
      },
    ]);
    setSelectedItemForPortion(null);
  };

  // Auto-ajouter l'item pré-sélectionné depuis les recommandations
  useEffect(() => {
    if (preselectedItem) {
      const portion = preselectedItem.portion;
      addItemWithPortion(preselectedItem.item.id, portion);
    }
  }, []); // Exécuter une seule fois au montage

  const applyQuickMeal = (mealId: string) => {
    const preset = QUICK_MEALS.find((m) => m.id === mealId);
    if (preset) {
      setItems(preset.items);
      setLabel(preset.name);
      const cls = classifyMealByItems(preset.items);
      setCategory(cls.category);
    }
  };


  // Filtre basé sur la recherche + la catégorie sélectionnée
  const searchLower = label.toLowerCase().trim();
  const filteredItems = allFoods.filter((fi) => {
    const matchesCategory = quickFilter === 'all' || scoreToCategory(fi.baseScore) === quickFilter;
    const matchesSearch = !searchLower || fi.name.toLowerCase().includes(searchLower);
    return matchesCategory && matchesSearch;
  });

  const filteredMeals = QUICK_MEALS.filter((qm) => {
    const cls = classifyMealByItems(qm.items);
    const matchesCategory = quickFilter === 'all' || cls.category === quickFilter;
    const matchesSearch = !searchLower || qm.name.toLowerCase().includes(searchLower);
    return matchesCategory && matchesSearch;
  });

  const handleSave = async () => {
    // Toujours exiger des items - le label est généré automatiquement
    if (items.length === 0) {
      Alert.alert(
        'Aucun aliment sélectionné',
        'Veuillez sélectionner au moins un aliment dans la liste ci-dessous, ou utilise le bouton "🧠 Log avec IA" pour analyser du texte libre.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    // Générer le label automatiquement à partir des items sélectionnés
    const finalLabel = items.map(it => allFoods.find(f => f.id === it.foodId)?.name || it.foodId).join(', ');
    
    const classification = classifyMealByItems(items);
    // onSave gère maintenant la sauvegarde ET la déduction des points
    // Ne plus appeler spendPoints ici pour éviter la double déduction
    onSave({ label: finalLabel, category: classification.category, score: classification.score, items });
  };

  return (
    <ScrollView style={styles.inner} contentContainerStyle={styles.innerContent}>
      <Text style={styles.logo}>Partager avec Toki</Text>

      <TextInput
        style={styles.input}
        placeholder="Rechercher un aliment..."
        placeholderTextColor="#6b7280"
        value={label}
        onChangeText={setLabel}
      />


      {/* Options: Log avec IA et Demande d'aliment */}
      <View style={styles.requestBox}>
        <TouchableOpacity
          style={[styles.requestLinkBtn, { backgroundColor: '#8b5cf6', marginBottom: 8 }]}
          onPress={() => router.push({ pathname: '/ai-logger', params: { initialText: label } })}
        >
          <Text style={[styles.requestLink, { color: '#fff', fontWeight: '600' }]}>🧠 Log avec IA</Text>
        </TouchableOpacity>
        <Text style={styles.requestText}>Tu ne trouves pas l&apos;aliment?</Text>
        <TouchableOpacity
          style={styles.requestLinkBtn}
          onPress={() => router.push({ pathname: '/food-request', params: { q: label || '' } })}
        >
          <Text style={styles.requestLink}>Demander un ajout</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Catégorie</Text>
      <CategoryChips
        category={category}
        setCategory={(cat) => {
          setCategory(cat);
          setQuickFilter(cat);
        }}
      />

      <View style={styles.filterRow}>
        {(['all', 'sain', 'ok', 'cheat'] as CategoryFilter[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, quickFilter === f && styles.filterChipSelected]}
            onPress={() => setQuickFilter(f)}
          >
            <Text style={[styles.filterChipText, quickFilter === f && styles.filterChipTextSelected]}>
              {f === 'all' ? 'Tout' : f === 'sain' ? 'Sain' : f === 'ok' ? 'Correct' : 'Cheat'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.pointsHelper}>Points restants : {Math.max(0, points - pendingCost)} (coûts dynamiques selon l&apos;aliment)</Text>
      
      {/* Items sélectionnés avec portions */}
      {items.length > 0 && (
        <>
          <Text style={styles.label}>Sélectionnés ({items.length})</Text>
          <View style={styles.selectedItemsBox}>
            {items.map((itemRef, idx) => {
              const fi = allFoods.find(f => f.id === itemRef.foodId);
              if (!fi) return null;
              const multiplier = itemRef.multiplier || 1.0;
              return (
                <View key={`${itemRef.foodId}-${idx}`} style={styles.selectedItem}>
                  <View style={styles.selectedItemInfo}>
                    <Text style={styles.selectedItemName}>{fi.name}</Text>
                    <Text style={styles.selectedItemPortion}>
                      {itemRef.quantityHint || `${itemRef.portionGrams || 100}g`}
                    </Text>
                    <Text style={styles.selectedItemNutrition}>
                      {Math.round((fi.calories_kcal || 0) * multiplier)} cal · {Math.round((fi.protein_g || 0) * multiplier)}g prot
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.selectedItemRemove}
                    onPress={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                  >
                    <Text style={styles.selectedItemRemoveText}>✕</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </>
      )}

      <Text style={styles.label}>Items rapides</Text>
      <View style={styles.quickRow}>
        {filteredItems.map((fi) => {
          const cost = computeFoodPoints(fi as any);
          const selected = items.some((i) => i.foodId === fi.id);
          const macros = {
            protein_g: fi.protein_g || 0,
            carbs_g: fi.carbs_g || 0,
            calories_kcal: fi.calories_kcal || 0,
            fat_g: fi.fat_g || 0,
          };
          const projected = {
            protein_g: todayTotals.protein_g + selectionNutrition.protein_g + (selected ? 0 : macros.protein_g),
            carbs_g: todayTotals.carbs_g + selectionNutrition.carbs_g + (selected ? 0 : macros.carbs_g),
            calories_kcal: todayTotals.calories_kcal + selectionNutrition.calories_kcal + (selected ? 0 : macros.calories_kcal),
            fat_g: todayTotals.fat_g + selectionNutrition.fat_g + (selected ? 0 : macros.fat_g),
          };
          const overTargets =
            projected.protein_g > targets.protein_g ||
            projected.carbs_g > targets.carbs_g ||
            projected.calories_kcal > targets.calories_kcal ||
            projected.fat_g > targets.fat_g;
          const affordable = pendingCost + (selected ? 0 : cost) <= points && !overTargets;
          return (
            <TouchableOpacity
              key={fi.id}
              style={[
                styles.quickChip,
                selected && styles.quickChipSelected,
                (!affordable || overTargets) && styles.quickChipDisabled,
              ]}
              onPress={() => {
                if (!affordable) return;
                toggleItem(fi.id);
              }}
            >
              <Text style={[styles.quickChipText, (!affordable || overTargets) && styles.quickChipTextDisabled]}>
                {fi.name} · {cost} pts
              </Text>
              {/* Tooltip éducatif basé sur le coût */}
              {cost === 0 && (
                <Text style={styles.tooltipText}>🎉 Gratuit! Protéines/légumes</Text>
              )}
              {cost >= 1 && cost <= 2 && (
                <Text style={styles.tooltipText}>⚡ Bon choix énergétique</Text>
              )}
              {cost >= 6 && (
                <Text style={styles.tooltipText}>
                  💰 {cost} pts = {fi.calories_kcal || 0} cal · {Math.round((cost / (points || 1)) * 100)}% budget
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.label}>Repas favoris</Text>
      <View style={styles.quickRow}>
        {filteredMeals.map((qm) => {
          const totalCost = qm.items.reduce((sum, ref) => {
            const fi = filteredItems.find((f) => f.id === ref.foodId);
            return sum + (fi ? computeFoodPoints(fi as any) : 0);
          }, 0);
          const macrosSum = qm.items.reduce(
            (acc, ref) => {
              const fi = allFoods.find((f) => f.id === ref.foodId);
              if (!fi) return acc;
              return {
                protein_g: acc.protein_g + (fi.protein_g || 0),
                carbs_g: acc.carbs_g + (fi.carbs_g || 0),
                calories_kcal: acc.calories_kcal + (fi.calories_kcal || 0),
                fat_g: acc.fat_g + (fi.fat_g || 0),
              };
            },
            { protein_g: 0, carbs_g: 0, calories_kcal: 0, fat_g: 0 }
          );
          const projected = {
            protein_g: todayTotals.protein_g + selectionNutrition.protein_g + macrosSum.protein_g,
            carbs_g: todayTotals.carbs_g + selectionNutrition.carbs_g + macrosSum.carbs_g,
            calories_kcal: todayTotals.calories_kcal + selectionNutrition.calories_kcal + macrosSum.calories_kcal,
            fat_g: todayTotals.fat_g + selectionNutrition.fat_g + macrosSum.fat_g,
          };
          const overTargets =
            projected.protein_g > targets.protein_g ||
            projected.carbs_g > targets.carbs_g ||
            projected.calories_kcal > targets.calories_kcal ||
            projected.fat_g > targets.fat_g;
          const affordable = pendingCost + totalCost <= points && !overTargets;
          return (
            <TouchableOpacity
              key={qm.id}
              style={[styles.quickMealBtn, (!affordable || overTargets) && styles.quickMealBtnDisabled]}
              onPress={() => {
                if (!affordable) return;
                applyQuickMeal(qm.id);
              }}
            >
              <Text style={[styles.quickMealText, (!affordable || overTargets) && styles.quickChipTextDisabled]}>
                {qm.name} · {totalCost} pts
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelText}>Annuler</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveText}>Nourrir Toki</Text>
        </TouchableOpacity>
      </View>
      
      {/* Modal de sélection de portion */}
      {selectedItemForPortion && (
        <View style={styles.portionModal}>
          <View style={styles.portionModalContent}>
            <Text style={styles.portionModalTitle}>
              Choisis la portion
            </Text>
            <Text style={styles.portionModalSubtitle}>
              {allFoods.find(f => f.id === selectedItemForPortion)?.name}
            </Text>
            
            {getPortionsForItem(
              allFoods.find(f => f.id === selectedItemForPortion)?.tags || []
            ).map((portion) => (
              <TouchableOpacity
                key={portion.size}
                style={styles.portionOption}
                onPress={() => addItemWithPortion(selectedItemForPortion, portion)}
              >
                <Text style={styles.portionOptionLabel}>
                  {formatPortionLabel(portion)}
                </Text>
                <Text style={styles.portionOptionCost}>
                  {Math.round(
                    computeFoodPoints(
                      allFoods.find(f => f.id === selectedItemForPortion)!
                    ) * Math.sqrt(portion.multiplier)
                  )} pts
                </Text>
              </TouchableOpacity>
            ))}
            
            <TouchableOpacity
              style={styles.portionModalCancel}
              onPress={() => setSelectedItemForPortion(null)}
            >
              <Text style={styles.portionModalCancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}


// ---- Composant chips catégories réutilisable ----
function CategoryChips({
  category,
  setCategory,
}: {
  category: MealEntry['category'];
  setCategory: (cat: MealEntry['category']) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {['sain', 'ok', 'cheat'].map((cat) => (
        <TouchableOpacity
          key={cat}
          style={[
            styles.chip,
            category === cat && styles.chipSelected,
          ]}
          onPress={() => setCategory(cat as MealEntry['category'])}
        >
          <Text
            style={[
              styles.chipText,
              category === cat && styles.chipTextSelected,
            ]}
          >
            {cat === 'sain'
              ? '✅ Sain'
              : cat === 'ok'
              ? '🟡 Correct'
              : '🍟 Cheat'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ---- Styles ----
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  scroll: {
    flex: 1,
    width: '100%',
  },
  inner: {
    flex: 1,
  },
  innerContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  logo: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fbbf24',
  },
  headerSettingsButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#1f2937',
  },
  headerSettingsIcon: {
    fontSize: 22,
  },
  requestBox: {
    width: '100%',
    marginTop: 12,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#0b1220',
    borderWidth: 1,
    borderColor: '#1f2937',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  requestText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  requestLinkBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#1f2937',
  },
  requestLink: {
    color: '#60a5fa',
    fontWeight: '600',
    fontSize: 14,
  },
  settingsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  settingsModal: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#374151',
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  settingsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#e5e7eb',
  },
  settingsClose: {
    fontSize: 24,
    color: '#9ca3af',
    padding: 4,
  },
  settingsOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  settingsOptionLast: {
    borderBottomWidth: 0,
  },
  settingsOptionIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  settingsOptionContent: {
    flex: 1,
  },
  settingsOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e5e7eb',
    marginBottom: 2,
  },
  settingsOptionDesc: {
    fontSize: 13,
    color: '#9ca3af',
  },
  warningBanner: {
    width: '100%',
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#fbbf24',
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#78350f',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#78350f',
    marginBottom: 12,
    lineHeight: 20,
  },
  warningButton: {
    backgroundColor: '#f59e0b',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  warningButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  dragonBox: {
    width: 260,
    height: 260,
    borderRadius: 32,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  dragonImage: {
    width: '100%',
    height: '100%',
  },
  statsText: {
    color: '#e5e7eb',
    fontSize: 14,
    marginBottom: 16,
  },
  stateText: {
    color: '#9ca3af',
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
  },
  homeButtons: {
    width: '100%',
    gap: 8,
    marginBottom: 24,
  },
  buttonPrimary: {
    backgroundColor: '#22c55e',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#bbf7d0',
    alignItems: 'center',
  },
  buttonPrimaryText: {
    color: '#022c22',
    fontWeight: 'bold',
    fontSize: 16,
  },
  buttonAI: {
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#93c5fd',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonAIText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  buttonGhost: {
    backgroundColor: '#0b1220',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#4b5563',
    alignItems: 'center',
    marginRight: 8,
  },
  buttonGhostText: {
    color: '#e5e7eb',
    fontSize: 14,
  },
  buttonSecondary: {
    backgroundColor: '#111827',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#4b5563',
    alignItems: 'center',
  },
  buttonSecondaryText: {
    color: '#e5e7eb',
    fontSize: 15,
  },
  historyBox: {
    width: '100%',
    marginTop: 8,
  },
  historyTitle: {
    color: '#e5e7eb',
    fontSize: 16,
    marginBottom: 4,
  },
  historyEmpty: {
    color: '#6b7280',
    fontSize: 13,
  },
  historyItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  historyItemContent: {
    flex: 1,
    flexDirection: 'column',
    gap: 4,
  },
  historyItem: {
    color: '#d1d5db',
    fontSize: 14,
    flex: 1,
  },
  historyItemNutrition: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  historyItemNutritionText: {
    color: '#9ca3af',
    fontSize: 11,
  },
  historyItemCost: {
    color: '#f59e0b',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  historyDeleteButton: {
    padding: 4,
    marginLeft: 8,
  },
  historyDeleteText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: 'bold',
  },
  pointsText: {
    color: '#e5e7eb',
    fontSize: 13,
    marginBottom: 12,
  },
  targetsForm: {
    width: '100%',
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    backgroundColor: '#0b1220',
  },
  targetsHint: {
    color: '#9ca3af',
    fontSize: 12,
    marginBottom: 8,
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  targetLabel: {
    flex: 1,
    color: '#e5e7eb',
    fontSize: 14,
    marginRight: 8,
  },
  targetInput: {
    width: 110,
    backgroundColor: '#020617',
    borderColor: '#4b5563',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#f9fafb',
    textAlign: 'right',
  },
  targetsActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  input: {
    width: '100%',
    backgroundColor: '#020617',
    borderColor: '#4b5563',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f9fafb',
    marginBottom: 16,
  },
  suggestionsBox: {
    width: '100%',
    backgroundColor: '#111827',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
    marginBottom: 16,
    overflow: 'hidden',
  },
  suggestionsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  suggestionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  suggestionItemName: {
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: '500',
  },
  suggestionItemCost: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '600',
  },
  label: {
    color: '#e5e7eb',
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 24,
  },
  chip: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginHorizontal: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#4b5563',
    alignItems: 'center',
  },
  chipSelected: {
    backgroundColor: '#22c55e33',
    borderColor: '#22c55e',
  },
  chipText: {
    color: '#e5e7eb',
    fontSize: 13,
  },
  chipTextSelected: {
    color: '#bbf7d0',
    fontWeight: '600',
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    gap: 8,
    marginBottom: 16,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    marginBottom: 12,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#4b5563',
    backgroundColor: '#0b1220',
  },
  filterChipSelected: {
    backgroundColor: '#22c55e33',
    borderColor: '#22c55e',
  },
  filterChipText: {
    color: '#e5e7eb',
    fontSize: 12,
  },
  filterChipTextSelected: {
    color: '#bbf7d0',
    fontWeight: '600',
  },
  quickChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#4b5563',
    backgroundColor: '#0b1220',
  },
  quickChipSelected: {
    backgroundColor: '#22c55e33',
    borderColor: '#22c55e',
  },
  quickChipDisabled: {
    opacity: 0.45,
  },
  quickChipText: {
    color: '#e5e7eb',
    fontSize: 12,
  },
  quickChipTextDisabled: {
    color: '#9ca3af',
  },
  quickMealBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#4b5563',
  },
  quickMealBtnDisabled: {
    opacity: 0.5,
  },
  quickMealText: {
    color: '#e5e7eb',
    fontSize: 12,
  },
  pointsHelper: {
    color: '#9ca3af',
    fontSize: 12,
    marginBottom: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    marginRight: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#6b7280',
    alignItems: 'center',
  },
  cancelText: {
    color: '#e5e7eb',
  },
  saveBtn: {
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#22c55e',
    alignItems: 'center',
  },
  saveText: {
    color: '#022c22',
    fontWeight: 'bold',
  },
  askBtn: {
    flex: 1,
    paddingVertical: 12,
    marginLeft: 6,
    borderRadius: 999,
    backgroundColor: '#0369a1',
    alignItems: 'center',
  },
  askText: {
    color: '#e0f2fe',
    fontWeight: 'bold',
  },
  adviceText: {
    color: '#e5e7eb',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 6,
  },
  previewStats: {
    color: '#9ca3af',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  streakText: {
    color: '#c4b5fd',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  streakButton: {
    width: '100%',
    backgroundColor: '#1e3a8a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#f97316',
  },
  streakButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakButtonIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  streakButtonInfo: {
    flex: 1,
  },
  streakButtonDays: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fbbf24',
  },
  streakButtonLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  streakButtonArrow: {
    fontSize: 20,
    color: '#9ca3af',
  },
  streakBonusBox: {
    width: '100%',
    backgroundColor: '#1e3a8a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  streakBonusTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fbbf24',
    marginBottom: 8,
  },
  streakBonusText: {
    fontSize: 14,
    color: '#e5e7eb',
    marginBottom: 4,
  },
  streakBonusSpecial: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22c55e',
    marginTop: 4,
  },
  hungryBox: {
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#1f2937',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    marginBottom: 16,
  },
  hungryTitle: {
    color: '#fbbf24',
    fontSize: 14,
    marginBottom: 6,
  },
  recRow: {
    marginBottom: 6,
  },
  recTitle: {
    color: '#e5e7eb',
    fontSize: 13,
  },
  recExamples: {
    color: '#9ca3af',
    fontSize: 12,
  },
  evolutionBox: {
    width: '100%',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#0b1220',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    marginBottom: 16,
  },
  evolutionTitle: {
    color: '#e5e7eb',
    fontSize: 14,
    marginBottom: 4,
  },
  evolutionText: {
    color: '#9ca3af',
    fontSize: 12,
    marginBottom: 8,
  },
  progressTrack: {
    width: '100%',
    height: 10,
    backgroundColor: '#111827',
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#374151',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#22c55e',
  },
  progressHint: {
    color: '#6b7280',
    fontSize: 11,
    marginTop: 6,
  },
  nutritionBox: {
    width: '100%',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#0b1220',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    marginBottom: 16,
    gap: 8,
  },
  nutritionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  nutritionTitle: {
    color: '#e5e7eb',
    fontSize: 14,
  },
  settingsButton: {
    padding: 4,
    borderRadius: 8,
  },
  settingsIcon: {
    fontSize: 18,
    color: '#9ca3af',
  },
  budgetBox: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fbbf24',
    marginBottom: 16,
  },
  budgetTitle: {
    color: '#78350f',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  budgetSubtitle: {
    color: '#92400e',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
  },
  budgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  budgetCol: {
    flex: 1,
    alignItems: 'center',
  },
  budgetLabel: {
    color: '#92400e',
    fontSize: 11,
    marginBottom: 4,
  },
  budgetValue: {
    color: '#78350f',
    fontSize: 18,
    fontWeight: '700',
  },
  budgetCurrent: {
    color: '#059669',
    fontSize: 22,
  },
  budgetCurrentBox: {
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 12,
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  budgetCurrentLabel: {
    color: '#065f46',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  budgetCurrentValue: {
    color: '#059669',
    fontSize: 32,
    fontWeight: 'bold',
  },
  budgetCurrentZero: {
    color: '#dc2626',
  },
  budgetHint: {
    color: '#92400e',
    fontSize: 11,
    marginTop: 4,
    fontStyle: 'italic',
  },
  budgetDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
    gap: 12,
  },
  budgetDetailCol: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: '#fffbeb',
    borderRadius: 8,
  },
  budgetDetailLabel: {
    color: '#92400e',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  budgetDetailValue: {
    color: '#78350f',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  budgetDetailHint: {
    color: '#a16207',
    fontSize: 9,
    textAlign: 'center',
  },
  budgetProgressContainer: {
    marginTop: 8,
  },
  budgetProgressText: {
    color: '#78350f',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '600',
  },
  budgetProgressTrack: {
    width: '100%',
    height: 8,
    backgroundColor: '#fde68a',
    borderRadius: 999,
    overflow: 'hidden',
  },
  budgetProgressBar: {
    height: '100%',
    backgroundColor: '#f59e0b',
  },
  tooltipText: {
    color: '#9ca3af',
    fontSize: 10,
    marginTop: 2,
    fontStyle: 'italic',
  },
  hungryButton: {
    width: '100%',
    paddingVertical: 14,
    backgroundColor: '#10b981',
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#059669',
  },
  hungryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  smartRecsBox: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#ecfdf5',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#10b981',
    marginBottom: 16,
  },
  smartRecsTitle: {
    color: '#065f46',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  smartRecsAnalysis: {
    color: '#047857',
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingHorizontal: 8,
  },
  todaySummaryBox: {
    backgroundColor: '#d1fae5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  todaySummaryTitle: {
    color: '#065f46',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  todaySummaryText: {
    color: '#047857',
    fontSize: 13,
    marginBottom: 4,
  },
  smartRecsSubtitle: {
    color: '#065f46',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  smartRecsEmpty: {
    color: '#6b7280',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  tasteChoiceBox: {
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#fbbf24',
  },
  tasteChoiceTitle: {
    color: '#92400e',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  tasteButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 12,
  },
  tasteButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
  },
  tasteButtonSweet: {
    backgroundColor: '#fce7f3',
    borderColor: '#ec4899',
  },
  tasteButtonSalty: {
    backgroundColor: '#dbeafe',
    borderColor: '#3b82f6',
  },
  tasteButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  tasteSelectedBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#fbbf24',
  },
  tasteSelectedText: {
    color: '#92400e',
    fontSize: 16,
    fontWeight: '600',
  },
  tasteChangeButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#fbbf24',
    borderRadius: 6,
  },
  tasteChangeButtonText: {
    color: '#78350f',
    fontSize: 12,
    fontWeight: '600',
  },
  smartRecItem: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  smartRecHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  smartRecName: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  smartRecCost: {
    color: '#059669',
    fontSize: 14,
    fontWeight: '700',
  },
  smartRecReason: {
    color: '#047857',
    fontSize: 13,
    marginBottom: 4,
  },
  smartRecNutrition: {
    color: '#6b7280',
    fontSize: 12,
  },
  portionModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  portionModalContent: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  portionModalTitle: {
    color: '#e5e7eb',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  portionModalSubtitle: {
    color: '#9ca3af',
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  portionOption: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#374151',
  },
  portionOptionLabel: {
    color: '#e5e7eb',
    fontSize: 15,
    flex: 1,
  },
  portionOptionCost: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: '700',
  },
  portionModalCancel: {
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  portionModalCancelText: {
    color: '#9ca3af',
    fontSize: 16,
    fontWeight: '600',
  },
  selectedItemsBox: {
    width: '100%',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  selectedItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  selectedItemInfo: {
    flex: 1,
  },
  selectedItemName: {
    color: '#e5e7eb',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  selectedItemPortion: {
    color: '#10b981',
    fontSize: 13,
    marginBottom: 2,
  },
  selectedItemNutrition: {
    color: '#9ca3af',
    fontSize: 12,
  },
  selectedItemRemove: {
    backgroundColor: '#dc2626',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  selectedItemRemoveText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  // Dragon Dead Modal Styles
  dragonDeadModal: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  dragonDeadEmoji: {
    fontSize: 60,
    marginBottom: 16,
  },
  dragonDeadTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ef4444',
    marginBottom: 12,
    textAlign: 'center',
  },
  dragonDeadText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  dragonDeadOptions: {
    width: '100%',
    gap: 12,
  },
  dragonDeadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  dragonDeadButtonPrimary: {
    backgroundColor: '#3b82f6',
  },
  dragonDeadButtonSecondary: {
    backgroundColor: '#374151',
  },
  dragonDeadButtonDisabled: {
    opacity: 0.5,
  },
  dragonDeadButtonIcon: {
    fontSize: 24,
  },
  dragonDeadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  dragonDeadButtonCost: {
    fontSize: 12,
    color: '#d1d5db',
    marginTop: 2,
  },
  dragonDeadClose: {
    marginTop: 20,
    padding: 12,
  },
  dragonDeadCloseText: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
  },
});

function NutritionBar({ label, value, unit, pct, color, target }: { label: string; value: number; unit: string; pct: number; color: string; target: number }) {
  return (
    <View style={{ width: '100%' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ color: '#e5e7eb', fontSize: 13, fontWeight: '500' }}>{label}</Text>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>
          {Math.round(value)}/{Math.round(target)} {unit} · {pct}%
        </Text>
      </View>
      <View style={{ width: '100%', height: 10, backgroundColor: '#111827', borderRadius: 999, overflow: 'hidden', borderWidth: 1, borderColor: '#374151' }}>
        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: color }} />
      </View>
    </View>
  );
}
