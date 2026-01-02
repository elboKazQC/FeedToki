import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from '@/components/safe-area-view-wrapper';
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
import { classifyMealByItems, classifyMealByNutrition, FoodItemRef } from '../../lib/classifier';
import { QUICK_MEALS } from '../../lib/presets';
import { calculateFavoriteMeals } from '../../lib/favorite-meals';
import { FOOD_DB, type FoodItem } from '../../lib/food-db';
import {
  initNotificationsIfAllowed,
  requestNotifPermission,
  scheduleDailyDragonReminders,
} from '../../lib/notifications';
import { getSmartRecommendations, getSmartRecommendationsByTaste, getHungerAnalysis, SmartRecommendation, getCanadaGuideRecommendations } from '../../lib/smart-recommendations';
import { computeDailyTotals, DEFAULT_TARGETS, percentageOfTarget, computeMealScore, NutritionTargets } from '../../lib/nutrition';
import { UserProfile } from '../../lib/types';
import { getDailyCalorieTarget } from '../../lib/points-calculator';
import { getPortionsForItem, getDefaultPortion, formatPortionLabel, PortionReference, PortionSize, getUnitForFood, createCustomPortion, formatPortionHint, createPortionCustomPortion } from '../../lib/portions';
import { DragonSprite } from '../../components/dragon-sprite';
import { DragonDisplay } from '../../components/dragon-display';
import { getLevelUpMessage } from '../../lib/dragon-levels';
import { StreakCalendarDuolingo } from '../../components/streak-calendar-duolingo';
import { useAuth } from '../../lib/auth-context';
import { checkDragonDeath, calculateResurrectCost, resurrectDragon, resetDragon } from '../../lib/dragon-life';
import { purchaseProduct, PRODUCTS } from '../../lib/purchases';
import { computeFoodPoints } from '../../lib/points-utils';
import { syncAllToFirestore, syncMealEntryToFirestore, syncPointsToFirestore } from '../../lib/data-sync';
import { loadCustomFoods, mergeFoodsWithCustom, migrateLocalFoodsToGlobal } from '../../lib/custom-foods';
import { userLogger, logError, flushLogsNow } from '../../lib/user-logger';
import { isCheatDay, setCheatDay } from '../../lib/cheat-days';
import { PaywallModal } from '../../components/paywall-modal';
import { trackMealLogged, trackStreakMilestone, trackTargetUpdated } from '../../lib/analytics';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Badge } from '../../components/ui/Badge';
import { spacing, typography, borderRadius, darkTheme, lightTheme } from '../../constants/design-tokens';
import { useTheme as useAppTheme } from '../../lib/theme-context';
import { getFormattedAppVersion } from '../../lib/app-version';

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
  if (score >= 80) {
    label = 'Excellent 👑';
    level = 3;
  } else if (score >= 60) {
    label = 'En progrès 💪';
    level = 2;
  }
  return { scorePct: score, label, level };
}

function buildDayFeeds(entries: MealEntry[]): Record<string, { date: string; mealIds: string[] }> {
  const result = entries.reduce((acc, entry) => {
    const dateKey = normalizeDate(entry.createdAt);
    const existing = acc[dateKey] ?? { date: dateKey, mealIds: [] };
    acc[dateKey] = { ...existing, mealIds: [...existing.mealIds, entry.id] };
    return acc;
  }, {} as Record<string, { date: string; mealIds: string[] }>);
  
  // Logs de diagnostic
  console.log('[buildDayFeeds] 📊 Total repas:', entries.length);
  console.log('[buildDayFeeds] 📅 Jours avec repas:', Object.keys(result).sort());
  Object.entries(result).forEach(([date, feed]) => {
    console.log(`[buildDayFeeds]   ${date}: ${feed.mealIds.length} repas`);
  });
  
  return result;
}

function scoreToCategory(score: number): MealEntry['category'] {
  if (score >= 80) return 'sain';
  if (score >= 60) return 'ok';
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

// Helper pour obtenir la date d'hier en heure locale
function getYesterdayLocal(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
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
  const [preselectedEntryItems, setPreselectedEntryItems] = useState<FoodItemRef[] | null>(null);
  const [preselectedEntryLabel, setPreselectedEntryLabel] = useState<string | null>(null);
  const [cheatDays, setCheatDays] = useState<Record<string, boolean>>({});
  // TEMPORAIRE: Désactiver le modal dragon pour fixer le bug
  // const [showDragonDeadModal, setShowDragonDeadModal] = useState(false);
  const [isDragonDead, setIsDragonDead] = useState(false);
  
  // État pour rendu côté client uniquement (évite erreurs d'hydratation #418 sur web)
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  // IMPORTANT: Déclarer currentUserId AVANT les useEffect qui l'utilisent
  // Utiliser authUser.uid pour Firebase (pas authUser.id qui n'existe pas)
  const currentUserId = (authProfile?.userId || (authUser as any)?.uid || (authUser as any)?.id || 'guest');

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
              if (__DEV__) console.log('[Index] Objectifs nutritionnels mis à jour:', calculatedTargets);
            } catch (e) {
              if (__DEV__) console.log('[Index] Erreur sauvegarde targets calculés:', e);
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
    // Debug logs seulement en développement
    if (__DEV__) {
      console.log('[Index] === USER DEBUG ===');
      console.log('[Index] authUser:', JSON.stringify(authUser, null, 2));
      console.log('[Index] authProfile?.userId:', authProfile?.userId);
      console.log('[Index] currentUserId computed:', currentUserId);
    }
  }, [authUser, authProfile, currentUserId]);
  
  const getEntriesKey = () => `feedtoki_entries_${currentUserId}_v1`;
  const getPointsKey = () => `feedtoki_points_${currentUserId}_v2`;
  const getTotalPointsKey = () => `feedtoki_total_points_${currentUserId}_v1`;
  const getTargetsKey = () => `feedtoki_targets_${currentUserId}_v1`;

  // Réinitialiser les données quand on change de compte/utilisateur
  const prevUserIdRef = React.useRef<string | undefined>(undefined);
  
  useEffect(() => {
    // Si l'userId a changé (et que ce n'est pas la première initialisation), réinitialiser immédiatement
    if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== currentUserId) {
      console.log('[Index] ⚠️ Changement de compte détecté:', prevUserIdRef.current, '→', currentUserId);
      console.log('[Index] Réinitialisation immédiate des données locales pour éviter mélange');
      
      // Réinitialiser IMMÉDIATEMENT tous les états pour éviter d'afficher les données de l'ancien compte
      setEntries([]);
      setPoints(0);
      setTotalPointsEarned(0);
      setLastClaimDate('');
      setIsReady(false);
      
      // Forcer un nettoyage des données en mémoire
      // Les données seront rechargées par les useEffect suivants avec le bon userId
    }
    
    // Mettre à jour la référence APRÈS la réinitialisation
    prevUserIdRef.current = currentUserId;
  }, [currentUserId]);

  // Charger les entrées au démarrage - recharger quand userId change
  // Note: La synchronisation depuis Firestore se fait dans auth-context.tsx et ici aussi
  useEffect(() => {
    // Attendre que le profil soit chargé
    if (authLoading || !currentUserId || currentUserId === 'guest') {
      console.log('[Index] Waiting for user, currentUserId:', currentUserId);
      return;
    }
    
    // CRITIQUE: Capturer le userId au début du chargement pour validation
    const userIdAtStart = currentUserId;
    const expectedUserId = authProfile?.userId || (authUser as any)?.uid || (authUser as any)?.id || 'guest';
    
    // VÉRIFICATION: S'assurer que le currentUserId correspond bien au userId du profil/auth
    if (userIdAtStart !== expectedUserId) {
      console.log('[Index] ⚠️ ERREUR: currentUserId ne correspond pas au userId du profil!', {
        currentUserId: userIdAtStart,
        expectedUserId: expectedUserId,
        authProfileUserId: authProfile?.userId,
        authUserUid: (authUser as any)?.uid,
      });
      // Ne pas charger les données si le userId ne correspond pas
      return;
    }
    
    // Réinitialiser les états AVANT de charger pour éviter d'afficher les données de l'ancien compte
    console.log('[Index] 🔄 Début chargement des données pour userId:', userIdAtStart);
    setEntries([]);
    setPoints(0);
    setTotalPointsEarned(0);
    setLastClaimDate('');
    setIsReady(false);
    
    const load = async () => {
      try {
        // VÉRIFICATION 1: Vérifier que le userId n'a pas changé au début du chargement
        const currentUserIdCheck1 = authProfile?.userId || (authUser as any)?.uid || (authUser as any)?.id || 'guest';
        if (currentUserIdCheck1 !== userIdAtStart) {
          console.log('[Index] ⚠️ userId a changé au début du chargement, abandon:', {
            userIdAtStart,
            currentUserIdCheck1,
          });
          return;
        }
        
        // IMPORTANT: Ordre de chargement optimisé pour la synchronisation
        // 1. Synchroniser depuis Firestore (repas, points) ET charger les custom foods EN PARALLÈLE
        // 2. Attendre que les deux soient complétés
        // 3. Charger les entrées depuis AsyncStorage (qui contient maintenant les données fusionnées)
        // 4. Valider que tous les foodId dans les items existent
        
        console.log('[Index] 🔄 Démarrage synchronisation complète depuis Firestore...');
        console.log('[Index] UserId:', userIdAtStart);
        console.log('[Index] Auth user:', authUser);
        console.log('[Index] Auth profile:', authProfile);
        
        // Étape 1: Synchroniser depuis Firestore ET charger les custom foods EN PARALLÈLE
        // Cela améliore les performances en faisant les deux opérations simultanément
        let syncResult;
        try {
          const { syncFromFirestore } = await import('../../lib/data-sync');
          
          // Exécuter en parallèle pour améliorer les performances
          // IMPORTANT: Utiliser userIdAtStart pour garantir la bonne synchronisation
          const [syncResultValue, _] = await Promise.all([
            syncFromFirestore(userIdAtStart),
            loadCustomFoodsData(), // Charger les custom foods en parallèle
          ]);
          
          syncResult = syncResultValue;
          console.log('[Index] ✅ Sync depuis Firestore terminée:', {
            mealsMerged: syncResult.mealsMerged,
            pointsRestored: syncResult.pointsRestored,
            targetsRestored: syncResult.targetsRestored,
            weightsMerged: syncResult.weightsMerged,
          });
          console.log('[Index] ✅ Custom foods chargés en parallèle, prêt pour validation des repas');
        } catch (syncError) {
          console.error('[Index] ❌ Erreur sync Firestore:', syncError);
          console.warn('[Index] ⚠️ Erreur sync Firestore, utilisation locale:', syncError);
          syncResult = { mealsMerged: 0, pointsRestored: false, targetsRestored: false, weightsMerged: 0 };
          
          // En cas d'erreur, charger quand même les custom foods
          try {
            await loadCustomFoodsData();
            console.log('[Index] ✅ Custom foods chargés (après erreur sync)');
          } catch (customFoodsError) {
            console.error('[Index] ❌ Erreur chargement custom foods:', customFoodsError);
          }
        }
        
        // VÉRIFICATION 2: Vérifier que le userId n'a pas changé avant de charger depuis AsyncStorage
        const currentUserIdCheck2 = authProfile?.userId || (authUser as any)?.uid || (authUser as any)?.id || 'guest';
        if (currentUserIdCheck2 !== userIdAtStart) {
          console.log('[Index] ⚠️ userId a changé avant chargement AsyncStorage, abandon:', {
            userIdAtStart,
            currentUserIdCheck2,
          });
          return;
        }
        
        // Étape 3: Charger les entrées depuis AsyncStorage (qui contient maintenant les données fusionnées)
        // IMPORTANT: Utiliser userIdAtStart pour garantir la bonne clé
        const key = `feedtoki_entries_${userIdAtStart}_v1`;
        console.log('[Index] 📥 Chargement des entrées depuis AsyncStorage (clé:', key, ', userId validé:', userIdAtStart, ')');
        const json = await AsyncStorage.getItem(key);
        if (json) {
          try {
            const parsed = JSON.parse(json);
            console.log('[Index] ✅ Entrées chargées depuis AsyncStorage:', parsed?.length, 'repas');
            if (Array.isArray(parsed)) {
              const normalized: MealEntry[] = (parsed as any[]).map((e, idx) => {
                // Validation et nettoyage de chaque entrée
                const entry: MealEntry = {
                  id: typeof e.id === 'string' && e.id.length > 0 ? e.id : `entry_${Date.now()}_${idx}`,
                  label: typeof e.label === 'string' ? e.label.substring(0, 200) : '',
                  category: typeof e.category === 'string' && ['ok', 'warning', 'danger'].includes(e.category) 
                    ? e.category 
                    : 'ok',
                  score: typeof e.score === 'number' && !isNaN(e.score) && e.score >= 0 && e.score <= 100
                    ? e.score
                    : mapManualCategoryToScore(e.category ?? 'ok'),
                  createdAt: typeof e.createdAt === 'string' && e.createdAt.length > 0
                    ? e.createdAt
                    : (typeof e.date === 'string' ? e.date : new Date().toISOString()),
                  items: Array.isArray(e.items) ? e.items : [],
                };
                return entry;
              });
              
              // Étape 4: Valider que tous les foodId dans les items existent
              // Charger les custom foods directement pour la validation (pas le state qui peut être asynchrone)
              const currentCustomFoods = await loadCustomFoods(userIdAtStart !== 'guest' ? userIdAtStart : undefined);
              const allFoods = mergeFoodsWithCustom(FOOD_DB, currentCustomFoods);
              
              // Étape 4.5: Réparer les items manquants (ajouter les items mentionnés dans le titre)
              // Cela doit être fait AVANT la validation pour que les nouveaux items soient validés aussi
              console.log('[Index] 🔧 AVANT réparation - userIdAtStart:', userIdAtStart);
              try {
                console.log('[Index] 🔧 Démarrage réparation des items manquants dans les repas...');
                console.log('[Index] 🔧 Import du module sync-repair...');
                const repairModule = await import('../../lib/sync-repair');
                console.log('[Index] 🔧 Module importé:', Object.keys(repairModule));
                const { repairMissingItemsInMeals } = repairModule;
                console.log('[Index] 🔧 Fonction repairMissingItemsInMeals:', typeof repairMissingItemsInMeals);
                console.log('[Index] 🔧 Appel de repairMissingItemsInMeals avec userId:', userIdAtStart);
                const repairResult = await repairMissingItemsInMeals(userIdAtStart);
                console.log('[Index] ✅ Réparation terminée:', {
                  itemsAdded: repairResult.itemsAdded,
                  mealsFixed: repairResult.mealsFixed,
                  success: repairResult.success,
                  errors: repairResult.errors.length,
                });
                if (repairResult.itemsAdded > 0) {
                  console.log(`[Index] ✅ ${repairResult.itemsAdded} items ajoutés dans ${repairResult.mealsFixed} repas lors du chargement`);
                  // Recharger les repas après réparation
                  const jsonAfterRepair = await AsyncStorage.getItem(key);
                  if (jsonAfterRepair) {
                    const parsedAfterRepair = JSON.parse(jsonAfterRepair);
                    if (Array.isArray(parsedAfterRepair)) {
                      // Mettre à jour normalized avec les repas réparés
                      const repairedMap = new Map(parsedAfterRepair.map((e: any) => [e.id, e]));
                      for (let i = 0; i < normalized.length; i++) {
                        const repaired = repairedMap.get(normalized[i].id);
                        if (repaired) {
                          normalized[i] = {
                            ...normalized[i],
                            items: repaired.items || normalized[i].items,
                          };
                        }
                      }
                    }
                  }
                }
              } catch (repairError: any) {
                console.error('[Index] ❌ Erreur lors de la réparation des items manquants:', repairError);
                console.error('[Index] ❌ Stack trace:', repairError?.stack);
                console.error('[Index] ❌ Message:', repairError?.message);
                // Continuer même en cas d'erreur
              }
              
              // Utiliser la fonction de validation dédiée
              const { validateAndFixMealEntries } = await import('../../lib/data-sync');
              const validatedEntries = validateAndFixMealEntries(normalized, allFoods);
              
              // VÉRIFICATION FINALE: Vérifier que le userId n'a pas changé avant de setEntries
              const currentUserIdFinal = authProfile?.userId || (authUser as any)?.uid || (authUser as any)?.id || 'guest';
              if (currentUserIdFinal !== userIdAtStart) {
                console.log('[Index] ⚠️ userId a changé avant setEntries, abandon chargement des données:', {
                  userIdAtStart,
                  currentUserIdFinal,
                });
                return;
              }
              
              setEntries(validatedEntries);
              console.log('[Index] ✅ Entrées normalisées, validées et chargées dans le state pour userId:', userIdAtStart, ':', validatedEntries.length, 'repas');
              
              // Étape 5: Recalculer les points après synchronisation pour éviter les duplications
              // Attendre un peu pour s'assurer que le state est mis à jour
              setTimeout(async () => {
                // VÉRIFICATION: Vérifier que le userId n'a pas changé avant de recalculer les points
                const currentUserIdForPoints = authProfile?.userId || (authUser as any)?.uid || (authUser as any)?.id || 'guest';
                if (currentUserIdForPoints !== userIdAtStart) {
                  console.log('[Index] ⚠️ userId a changé avant recalcul points, abandon:', {
                    userIdAtStart,
                    currentUserIdForPoints,
                  });
                  return;
                }
                if (userProfile && userIdAtStart !== 'guest') {
                  console.log('[Index] 🔄 Recalcul des points après synchronisation...');
                  try {
                    const today = getTodayLocal();
                    const dailyPointsFromProfile = userProfile.dailyPointsBudget || DAILY_POINTS;
                    const maxCapFromProfile = userProfile.maxPointsCap || MAX_POINTS;
                    
                    // Charger les custom foods pour calculer les coûts
                    const customFoodsForCalc = await loadCustomFoods(currentUserId);
                    const allFoodsForCalc = mergeFoodsWithCustom(FOOD_DB, customFoodsForCalc);
                    
                    // Filtrer les entrées d'aujourd'hui
                    const todayEntries = validatedEntries.filter(e => normalizeDate(e.createdAt) === today);
                    let totalSpentToday = 0;
                    
                    for (const entry of todayEntries) {
                      if (entry.items && entry.items.length > 0) {
                        const entryCost = entry.items.reduce((sum, itemRef) => {
                          const fi = allFoodsForCalc.find(f => f.id === itemRef.foodId);
                          if (!fi) {
                            console.warn('[Index] ⚠️ Aliment non trouvé pour recalcul points:', itemRef.foodId);
                            return sum;
                          }
                          const multiplier = itemRef.multiplier || 1.0;
                          const baseCost = computeFoodPoints(fi);
                          const cost = Math.round(baseCost * Math.sqrt(multiplier));
                          return sum + cost;
                        }, 0);
                        totalSpentToday += entryCost;
                      }
                    }
                    
                    // Charger les points actuels
                    const pointsKey = getPointsKey();
                    const pointsRaw = await AsyncStorage.getItem(pointsKey);
                    if (pointsRaw) {
                      const pointsData = JSON.parse(pointsRaw);
                      const lastClaimDate = pointsData.lastClaimDate || '';
                      
                      // Ne recalculer que si c'est aujourd'hui
                      if (lastClaimDate === today) {
                        let startOfDayBalance = pointsData.startOfDayBalance;
                        const currentBalance = pointsData.balance ?? 0;
                        
                        // Si startOfDayBalance n'existe pas, l'estimer
                        if (startOfDayBalance === undefined) {
                          startOfDayBalance = Math.min(maxCapFromProfile, currentBalance + totalSpentToday);
                        }
                        
                        // Calculer le solde attendu
                        const expectedBalance = Math.max(0, startOfDayBalance - totalSpentToday);
                        
                        if (expectedBalance !== currentBalance) {
                          console.log('[Index] ✅ Correction des points après sync:', {
                            startOfDayBalance,
                            totalSpent: totalSpentToday,
                            expectedBalance,
                            currentBalance,
                          });
                          
                          await AsyncStorage.setItem(pointsKey, JSON.stringify({
                            ...pointsData,
                            balance: expectedBalance,
                            startOfDayBalance,
                          }));
                          setPoints(expectedBalance);
                          
                          // Synchroniser vers Firestore
                          const totalPointsKey = getTotalPointsKey();
                          const totalRaw = await AsyncStorage.getItem(totalPointsKey);
                          const totalPointsVal = totalRaw ? JSON.parse(totalRaw) : 0;
                          const { syncPointsToFirestore } = await import('../../lib/data-sync');
                          await syncPointsToFirestore(currentUserId, expectedBalance, today, totalPointsVal);
                          console.log('[Index] ✅ Points recalculés et synchronisés');
                        } else {
                          console.log('[Index] ✅ Points déjà corrects après sync');
                        }
                      }
                    }
                  } catch (recalcError) {
                    console.error('[Index] ❌ Erreur recalcul points après sync:', recalcError);
                  }
                }
              }, 500); // Petit délai pour laisser le state se mettre à jour
            } else {
              console.warn('[Index] ⚠️ Données non-array, initialisation vide');
              setEntries([]);
            }
          } catch (parseError) {
            console.error('[Index] ❌ Erreur parsing JSON, initialisation vide:', parseError);
            setEntries([]);
          }
        } else {
          console.log('[Index] ℹ️ Aucune entrée trouvée pour cet utilisateur, démarrage à zéro');
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
        if (__DEV__) console.log('[Index] Loading targets for key:', key);
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
    Object.keys(dayFeeds).forEach(date => {
      const dayEntries = entries.filter(e => normalizeDate(e.createdAt) === date);
      // Construire un ISO string à partir de la date normalisée en utilisant le timezone local
      // On utilise midi (12:00) pour éviter les problèmes de timezone aux limites de jour
      const [year, month, day] = date.split('-').map(Number);
      const dateObj = new Date(year, month - 1, day, 12, 0, 0); // midi local
      const dateIso = dateObj.toISOString();
      const totals = computeDailyTotals(dayEntries, dateIso, customFoods);
      map[date] = totals.calories_kcal;
    });
    
    // Logs de diagnostic
    console.log('[dayCaloriesMap] 🔥 Calories calculées par jour:');
    Object.entries(map).sort().forEach(([date, calories]) => {
      console.log(`[dayCaloriesMap]   ${date}: ${Math.round(calories)} cal`);
    });
    
    return map;
  }, [entries, dayFeeds, customFoods]);
  
  // Utiliser les nouvelles fonctions avec validation des calories
  const dragonState = computeDragonStateWithCalories(dayFeeds, dayCaloriesMap);
  const streak = computeStreakWithCalories(dayFeeds, dayCaloriesMap);
  console.log('[Index] 📊 Streak calculée:', {
    currentStreakDays: streak.currentStreakDays,
    longestStreakDays: streak.longestStreakDays,
    totalFedDays: streak.totalFedDays,
  });
  const todayTotals = computeDailyTotals(entries, new Date().toISOString(), customFoods);
  
  // Tracker les milestones de streak
  useEffect(() => {
    if (streak.isStreakBonusDay && streak.currentStreakDays > 0) {
      trackStreakMilestone({
        streakDays: streak.currentStreakDays,
        milestoneType: 'monthly',
      });
    }
  }, [streak.isStreakBonusDay, streak.currentStreakDays]);
  
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
        if (__DEV__) console.log('[Index] loadPoints waiting - userProfile:', !!userProfile, 'currentUserId:', currentUserId);
        return;
      }
      
      const today = getTodayLocal();
      const dailyPointsFromProfile = userProfile.dailyPointsBudget || DAILY_POINTS;
      const maxCapFromProfile = userProfile.maxPointsCap || MAX_POINTS;
      
      try {
        const pointsKey = getPointsKey();
        const totalKey = getTotalPointsKey();
        if (__DEV__) console.log('[Index] Loading points for keys:', pointsKey, totalKey);
        
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
          const startOfDayBalance = parsed.startOfDayBalance;
          
          if (__DEV__) console.log('[Index] Points check - lastClaimDate:', last, 'today:', today, 'balance:', balance, 'startOfDayBalance:', startOfDayBalance);
          
          if (last !== today) {
            // Nouveau jour : créditer les points quotidiens (carryover)
            const oldBalance = balance;
            balance = Math.min(maxCapFromProfile, balance + dailyPointsFromProfile);
            if (__DEV__) console.log('[Index] Nouveau jour ! Crédit de', dailyPointsFromProfile, 'pts. Ancien:', oldBalance, '→ Nouveau:', balance);
            
            // Stocker aussi startOfDayBalance pour le recalcul
            await AsyncStorage.setItem(pointsKey, JSON.stringify({ 
              balance, 
              lastClaimDate: today,
              startOfDayBalance: balance 
            }));
            
            // Incrémenter les points totaux
            const currentTotal = totalRaw ? JSON.parse(totalRaw) : 0;
            const newTotal = currentTotal + dailyPointsFromProfile;
            setTotalPointsEarned(newTotal);
            await AsyncStorage.setItem(totalKey, JSON.stringify(newTotal));
          } else {
            if (__DEV__) console.log('[Index] Points déjà crédités aujourd\'hui. Balance actuelle:', balance);
            // Le recalcul se fera dans un useEffect séparé après le chargement des entrées
          }
          setPoints(balance);
          setLastClaimDate(today);
        } else {
          // Premier jour : donner les points quotidiens au lieu de INITIAL_POINTS
          if (__DEV__) console.log('[Index] No points found, initializing for user:', currentUserId);
          const initBalance = Math.min(maxCapFromProfile, dailyPointsFromProfile);
          if (__DEV__) console.log('[Index] Initialisation avec', initBalance, 'pts (budget quotidien:', dailyPointsFromProfile, ', cap:', maxCapFromProfile, ')');
          
          await AsyncStorage.setItem(pointsKey, JSON.stringify({ 
            balance: initBalance, 
            lastClaimDate: today,
            startOfDayBalance: initBalance 
          }));
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
      if (__DEV__) console.log('[Recalc] Déclenchement recalcul - Conditions:', { 
        userProfile: !!userProfile, 
        currentUserId, 
        isReady, 
        entriesCount: entries.length 
      });
      
      if (!userProfile || !currentUserId || currentUserId === 'guest' || !isReady) {
        if (__DEV__) console.log('[Recalc] Conditions non remplies, skip');
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
          if (__DEV__) console.log('[Recalc] Pas de points trouvés');
          return;
        }
        
        const pointsData = JSON.parse(pointsRaw);
        const currentBalance = pointsData.balance ?? 0;
        const lastClaimDate = pointsData.lastClaimDate ?? '';
        let startOfDayBalance = pointsData.startOfDayBalance;

        // Ne recalculer que si c'est aujourd'hui
        if (lastClaimDate !== today) {
          if (__DEV__) console.log('[Recalc] Pas aujourd\'hui, skip. lastClaimDate:', lastClaimDate, 'today:', today);
          return;
        }

        // Charger les custom foods pour calculer les coûts
        const customFoods = await loadCustomFoods(currentUserId);
        const allFoods = mergeFoodsWithCustom(FOOD_DB, customFoods);

        // Filtrer les entrées d'aujourd'hui
        const todayEntries = entries.filter(e => normalizeDate(e.createdAt) === today);
        let totalSpentToday = 0;

        if (__DEV__) {
          console.log('[Recalc] Recalcul des points - Total entrées:', entries.length, 'Entrées d\'aujourd\'hui:', todayEntries.length);
          console.log('[Recalc] Date aujourd\'hui:', today);
          console.log('[Recalc] Dates des entrées:', entries.map(e => ({ 
            label: e.label, 
            createdAt: e.createdAt,
            normalizedDate: normalizeDate(e.createdAt),
            isToday: normalizeDate(e.createdAt) === today
          })));
        }
        
        if (todayEntries.length === 0) {
          if (__DEV__) console.log('[Recalc] Aucune entrée d\'aujourd\'hui, pas de recalcul nécessaire');
          return;
        }

        for (const entry of todayEntries) {
          if (entry.items && entry.items.length > 0) {
            const entryCost = entry.items.reduce((sum, itemRef) => {
              const fi = allFoods.find(f => f.id === itemRef.foodId);
              if (!fi) {
                if (__DEV__) console.log('[Recalc] Aliment non trouvé:', itemRef.foodId);
                return sum;
              }
              const multiplier = itemRef.multiplier || 1.0;
              const baseCost = computeFoodPoints(fi);
              const cost = Math.round(baseCost * Math.sqrt(multiplier));
              if (__DEV__) console.log(`[Recalc] ${entry.label || 'Entrée'} - ${fi.name}: ${cost} pts`);
              return sum + cost;
            }, 0);
            totalSpentToday += entryCost;
          }
        }

        // Si startOfDayBalance n'existe pas (ancienne version), l'estimer depuis currentBalance + totalSpentToday
        if (startOfDayBalance === undefined) {
          const maxCapFromProfile = userProfile.maxPointsCap || MAX_POINTS;
          startOfDayBalance = Math.min(maxCapFromProfile, currentBalance + totalSpentToday);
          if (__DEV__) console.log('[Recalc] startOfDayBalance non trouvé, estimation:', startOfDayBalance);
        }

        // Calculer le solde attendu : solde de début de journée - dépenses (carryover préservé)
        const expectedBalance = Math.max(0, startOfDayBalance - totalSpentToday);

        if (__DEV__) {
          console.log('[Recalc] Recalcul des points:', {
            startOfDayBalance,
            totalSpent: totalSpentToday,
            expectedBalance,
            currentBalance,
          });
        }

        // Si le solde attendu est différent du solde actuel, corriger
        if (expectedBalance !== currentBalance) {
          if (__DEV__) {
            console.log('[Recalc] ✅ Correction automatique des points:', {
              startOfDayBalance,
              totalSpent: totalSpentToday,
              expectedBalance,
              currentBalance,
            });
          }

          await AsyncStorage.setItem(pointsKey, JSON.stringify({ 
            balance: expectedBalance, 
            lastClaimDate: today,
            startOfDayBalance 
          }));
          setPoints(expectedBalance);
          if (__DEV__) console.log('[Recalc] Points mis à jour localement:', expectedBalance);

          // Synchroniser vers Firestore pour écraser l'ancienne valeur
          if (currentUserId !== 'guest') {
            const totalPointsKey = getTotalPointsKey();
            const totalRaw = await AsyncStorage.getItem(totalPointsKey);
            const totalPointsVal = totalRaw ? JSON.parse(totalRaw) : 0;
            if (__DEV__) console.log('[Recalc] Synchronisation vers Firestore...');
            await syncPointsToFirestore(currentUserId, expectedBalance, today, totalPointsVal);
            if (__DEV__) console.log('[Recalc] Points synchronisés vers Firestore avec succès');
          }

          if (__DEV__) console.log('[Recalc] ✅ Solde corrigé automatiquement:', expectedBalance, 'pts');
        }
      } catch (error) {
        console.error('[Recalc] Erreur recalcul points:', error);
      }
    };

    recalculatePointsFromEntries();
  }, [entries, isReady, userProfile, currentUserId]); // Se déclenche après chargement des entrées

  // Recharger et valider les repas avec les custom foods à jour
  const reloadAndValidateMeals = async () => {
    if (!currentUserId) {
      return;
    }

    try {
      console.log('[Index] 🔄 Rechargement et validation des repas...');
      
      // 1. D'abord synchroniser depuis Firestore pour avoir les dernières données
      const { syncFromFirestore } = await import('../../lib/data-sync');
      await syncFromFirestore(currentUserId);
      console.log('[Index] ✅ Synchronisation depuis Firestore terminée');
      
      // 2. Recharger les repas depuis AsyncStorage (qui contient maintenant les données fusionnées)
      const entriesKey = getEntriesKey();
      const json = await AsyncStorage.getItem(entriesKey);
      
      if (!json) {
        console.log('[Index] ℹ️ Aucun repas à recharger');
        return;
      }

      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed)) {
        console.warn('[Index] ⚠️ Données repas non-array');
        return;
      }

      // Normaliser les entrées
      const normalized: MealEntry[] = (parsed as any[]).map((e, idx) => {
        const entry: MealEntry = {
          id: typeof e.id === 'string' && e.id.length > 0 ? e.id : `entry_${Date.now()}_${idx}`,
          label: typeof e.label === 'string' ? e.label.substring(0, 200) : '',
          category: typeof e.category === 'string' && ['ok', 'warning', 'danger'].includes(e.category) 
            ? e.category 
            : 'ok',
          score: typeof e.score === 'number' && !isNaN(e.score) && e.score >= 0 && e.score <= 100
            ? e.score
            : mapManualCategoryToScore(e.category ?? 'ok'),
          createdAt: typeof e.createdAt === 'string' && e.createdAt.length > 0
            ? e.createdAt
            : (typeof e.date === 'string' ? e.date : new Date().toISOString()),
          items: Array.isArray(e.items) ? e.items : [],
        };
        return entry;
      });

      // 3. Réparer les items manquants (ajouter les items mentionnés dans le titre)
      const { repairMissingItemsInMeals } = await import('../../lib/sync-repair');
      const repairResult = await repairMissingItemsInMeals(currentUserId);
      if (repairResult.itemsAdded > 0) {
        console.log(`[Index] ✅ ${repairResult.itemsAdded} items ajoutés dans ${repairResult.mealsFixed} repas`);
        // Recharger les repas après réparation
        const jsonAfterRepair = await AsyncStorage.getItem(entriesKey);
        if (jsonAfterRepair) {
          const parsedAfterRepair = JSON.parse(jsonAfterRepair);
          if (Array.isArray(parsedAfterRepair)) {
            // Mettre à jour normalized avec les repas réparés
            const repairedMap = new Map(parsedAfterRepair.map((e: any) => [e.id, e]));
            for (let i = 0; i < normalized.length; i++) {
              const repaired = repairedMap.get(normalized[i].id);
              if (repaired) {
                normalized[i] = {
                  ...normalized[i],
                  items: repaired.items || normalized[i].items,
                };
              }
            }
          }
        }
      }

      // 4. Charger les custom foods à jour pour la validation
      const currentCustomFoods = await loadCustomFoods(currentUserId !== 'guest' ? currentUserId : undefined);
      const allFoods = mergeFoodsWithCustom(FOOD_DB, currentCustomFoods);

      // 5. Valider les repas avec les custom foods à jour
      const { validateAndFixMealEntries } = await import('../../lib/data-sync');
      const validatedEntries = validateAndFixMealEntries(normalized, allFoods);

      // Mettre à jour le state
      setEntries(validatedEntries);
      console.log('[Index] ✅ Repas rechargés et validés:', validatedEntries.length);

      // Sauvegarder les repas validés
      await AsyncStorage.setItem(entriesKey, JSON.stringify(validatedEntries));

      // Recalculer les points si nécessaire
      if (userProfile && currentUserId !== 'guest') {
        setTimeout(async () => {
          try {
            const today = getTodayLocal();
            const dailyPointsFromProfile = userProfile.dailyPointsBudget || DAILY_POINTS;
            const maxCapFromProfile = userProfile.maxPointsCap || MAX_POINTS;

            // Charger les custom foods pour calculer les coûts
            const customFoodsForCalc = await loadCustomFoods(currentUserId);
            const allFoodsForCalc = mergeFoodsWithCustom(FOOD_DB, customFoodsForCalc);

            // Filtrer les entrées d'aujourd'hui
            const todayEntries = validatedEntries.filter(e => normalizeDate(e.createdAt) === today);
            let totalSpentToday = 0;

            for (const entry of todayEntries) {
              if (entry.items && entry.items.length > 0) {
                const entryCost = entry.items.reduce((sum, itemRef) => {
                  const fi = allFoodsForCalc.find(f => f.id === itemRef.foodId);
                  if (!fi) {
                    console.warn('[Index] ⚠️ Aliment non trouvé pour recalcul points:', itemRef.foodId);
                    return sum;
                  }
                  const multiplier = itemRef.multiplier || 1.0;
                  const baseCost = computeFoodPoints(fi);
                  const cost = Math.round(baseCost * Math.sqrt(multiplier));
                  return sum + cost;
                }, 0);
                totalSpentToday += entryCost;
              }
            }

            // Charger les points actuels
            const pointsKey = getPointsKey();
            const pointsRaw = await AsyncStorage.getItem(pointsKey);
            if (pointsRaw) {
              const pointsData = JSON.parse(pointsRaw);
              const lastClaimDate = pointsData.lastClaimDate || '';

              // Ne recalculer que si c'est aujourd'hui
              if (lastClaimDate === today) {
                let startOfDayBalance = pointsData.startOfDayBalance;
                const currentBalance = pointsData.balance ?? 0;

                // Si startOfDayBalance n'existe pas, l'estimer
                if (startOfDayBalance === undefined) {
                  startOfDayBalance = Math.min(maxCapFromProfile, currentBalance + totalSpentToday);
                }

                // Calculer le solde attendu
                const expectedBalance = Math.max(0, startOfDayBalance - totalSpentToday);

                if (expectedBalance !== currentBalance) {
                  console.log('[Index] ✅ Correction des points après rechargement repas:', {
                    startOfDayBalance,
                    totalSpent: totalSpentToday,
                    expectedBalance,
                    currentBalance,
                  });

                  await AsyncStorage.setItem(pointsKey, JSON.stringify({
                    ...pointsData,
                    balance: expectedBalance,
                    startOfDayBalance,
                  }));
                  setPoints(expectedBalance);

                  // Synchroniser vers Firestore
                  const totalPointsKey = getTotalPointsKey();
                  const totalRaw = await AsyncStorage.getItem(totalPointsKey);
                  const totalPointsVal = totalRaw ? JSON.parse(totalRaw) : 0;
                  const { syncPointsToFirestore } = await import('../../lib/data-sync');
                  await syncPointsToFirestore(currentUserId, expectedBalance, today, totalPointsVal);
                  console.log('[Index] ✅ Points recalculés après rechargement repas');
                }
              }
            }
          } catch (recalcError) {
            console.error('[Index] ❌ Erreur recalcul points après rechargement:', recalcError);
          }
        }, 500);
      }
    } catch (error) {
      console.error('[Index] ❌ Erreur rechargement repas:', error);
    }
  };

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

  // Migration automatique des aliments locaux vers globalFoods (une seule fois au démarrage)
  useEffect(() => {
    if (!currentUserId || currentUserId === 'guest' || !isReady) {
      return;
    }

    const runMigration = async () => {
      try {
        console.log('[Index] 🔄 Vérification migration des aliments locaux vers globalFoods...');
        const result = await migrateLocalFoodsToGlobal(currentUserId);
        if (result.migrated > 0) {
          console.log(`[Index] ✅ ${result.migrated} aliments migrés vers la base globale`);
          // Recharger les custom foods après migration pour avoir les données à jour
          await loadCustomFoodsData();
        }
        if (result.errors > 0) {
          console.warn(`[Index] ⚠️ ${result.errors} erreurs lors de la migration`);
        }
      } catch (error) {
        console.error('[Index] ❌ Erreur lors de la migration:', error);
      }
    };

    runMigration();
  }, [currentUserId, isReady]); // Se déclenche une fois au démarrage quand userId est disponible

  // Détection automatique et synchronisation des custom foods manquants au démarrage
  useEffect(() => {
    if (!currentUserId || currentUserId === 'guest' || !isReady) {
      return;
    }

    const syncMissingFoods = async () => {
      try {
        console.log('[Index] 🔍 Vérification des custom foods manquants...');
        const { syncMissingCustomFoods } = await import('../../lib/sync-repair');
        const result = await syncMissingCustomFoods(currentUserId);
        
        if (result.localToFirestore > 0 || result.firestoreToLocal > 0) {
          console.log(`[Index] ✅ Synchronisation custom foods: ${result.localToFirestore} envoyés, ${result.firestoreToLocal} reçus`);
          // Recharger les custom foods après synchronisation
          await loadCustomFoodsData();
          // IMPORTANT: Recharger et valider les repas avec les nouveaux custom foods
          // Cela permet de mettre à jour l'historique et recalculer les points
          await reloadAndValidateMeals();
        } else {
          console.log('[Index] ✅ Tous les custom foods sont synchronisés');
        }
        
        if (result.errors.length > 0) {
          console.warn(`[Index] ⚠️ Erreurs lors de la sync custom foods:`, result.errors);
        }
      } catch (error) {
        console.error('[Index] ❌ Erreur sync custom foods:', error);
      }
    };

    // Attendre un peu après le chargement initial pour ne pas surcharger
    const timeout = setTimeout(() => {
      syncMissingFoods();
    }, 2000);

    return () => clearTimeout(timeout);
  }, [currentUserId, isReady]);

  // Détection automatique et synchronisation des repas manquants au démarrage
  useEffect(() => {
    if (!currentUserId || currentUserId === 'guest' || !isReady) {
      return;
    }

    const syncMissingMealsData = async () => {
      try {
        console.log('[Index] 🔍 Vérification des repas manquants...');
        
        // D'abord synchroniser depuis Firestore pour avoir les dernières données
        const { syncFromFirestore } = await import('../../lib/data-sync');
        await syncFromFirestore(currentUserId);
        console.log('[Index] ✅ Synchronisation depuis Firestore terminée avant comparaison');
        
        // Ensuite comparer et synchroniser les repas manquants
        const { syncMissingMeals } = await import('../../lib/sync-repair');
        const result = await syncMissingMeals(currentUserId);
        
        if (result.localToFirestore > 0 || result.firestoreToLocal > 0) {
          console.log(`[Index] ✅ Synchronisation repas: ${result.localToFirestore} envoyés, ${result.firestoreToLocal} reçus`);
          // Recharger les repas après synchronisation
          const entriesKey = getEntriesKey();
          const json = await AsyncStorage.getItem(entriesKey);
          if (json) {
            const parsed = JSON.parse(json);
            setEntries(parsed);
          }
        } else {
          console.log('[Index] ✅ Tous les repas sont synchronisés');
        }
        
        if (result.errors.length > 0) {
          console.warn(`[Index] ⚠️ Erreurs lors de la sync repas:`, result.errors);
        }
      } catch (error) {
        console.error('[Index] ❌ Erreur sync repas:', error);
      }
    };

    // Attendre un peu après le chargement initial pour ne pas surcharger
    const timeout = setTimeout(() => {
      syncMissingMealsData();
    }, 3000); // Un peu plus tard que les custom foods pour éviter la surcharge

    return () => clearTimeout(timeout);
  }, [currentUserId, isReady]);

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
          const pointsRaw = await AsyncStorage.getItem(pointsKey);
          const pointsData = pointsRaw ? JSON.parse(pointsRaw) : { balance: 0, lastClaimDate: '' };
          await AsyncStorage.setItem(pointsKey, JSON.stringify({ 
            ...pointsData,
            balance: correctBalance, 
            lastClaimDate: today 
          }));
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

  // Charger les cheat days
  useEffect(() => {
    const loadCheatDays = async () => {
      if (!currentUserId || currentUserId === 'guest') {
        setCheatDays({});
        return;
      }
      
      try {
        const { getCheatDays } = await import('../../lib/cheat-days');
        const cheatDaysData = await getCheatDays(currentUserId);
        setCheatDays(cheatDaysData);
        console.log('[Index] ✅ Cheat days chargés:', Object.keys(cheatDaysData).length, 'jours');
      } catch (error) {
        console.error('[Index] Erreur chargement cheat days:', error);
        setCheatDays({});
      }
    };
    
    if (isReady && currentUserId) {
      loadCheatDays();
    }
  }, [currentUserId, isReady]);

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
        if (__DEV__) console.log('[Index] Saving entries to key:', key, 'count:', entries.length);
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
      // Calculer le score avec le nouveau système si les items sont disponibles
      let calculatedScore: number | undefined = undefined;
      if (entry.items && entry.items.length > 0 && targets) {
        const customFoodsForScore = await loadCustomFoods(currentUserId !== 'guest' ? currentUserId : undefined);
        const tempEntry: MealEntry = {
          id: 'temp',
          createdAt: new Date().toISOString(),
          label: entry.label,
          category: entry.category,
          score: 0,
          items: entry.items,
        };
        calculatedScore = computeMealScore(tempEntry, targets, 3, customFoodsForScore);
      }
      
      const newEntry: MealEntry = {
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        ...entry,
        score: typeof entry.score === 'number' 
          ? entry.score 
          : calculatedScore !== undefined 
            ? calculatedScore 
            : mapManualCategoryToScore(entry.category),
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
        console.log('[Index] 🔄 Synchronisation du repas vers Firestore...', { 
          userId: currentUserId, 
          entryId: newEntry.id,
          label: newEntry.label
        });
        await syncMealEntryToFirestore(currentUserId, newEntry);
        console.log('[Index] ✅ Repas synchronisé vers Firestore');
      } else {
        console.log('[Index] ⚠️ Mode guest, pas de synchronisation Firestore');
      }
      
      // Calculer et déduire les points si l'entrée a des items
      let totalPoints = 0;
      if (entry.items && entry.items.length > 0) {
        const customFoods = await loadCustomFoods(currentUserId !== 'guest' ? currentUserId : undefined);
        const allFoods = mergeFoodsWithCustom(FOOD_DB, customFoods);
        
        totalPoints = entry.items.reduce((sum, itemRef) => {
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
        
        // Tracker l'événement analytics
        trackMealLogged({
          mealId: newEntry.id,
          category: newEntry.category,
          itemsCount: entry.items.length,
          score: newEntry.score,
          pointsCost: totalPoints,
          hasAiParser: false, // Sera mis à jour si nécessaire
        });
        
        // Ne pas déduire de points si c'est un repas cheat
        if (totalPoints > 0 && !entry.isCheatMeal) {
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
        
        // Sauvegarder les points localement
        const pointsKey = getPointsKey();
        const pointsRaw = await AsyncStorage.getItem(pointsKey);
        const pointsData = pointsRaw ? JSON.parse(pointsRaw) : { balance: 0, lastClaimDate: '' };
        await AsyncStorage.setItem(pointsKey, JSON.stringify({
          ...pointsData,
          balance: newBalance,
        }));
        
        // IMPORTANT: Synchroniser les points remboursés avec Firestore
        // Sans ça, la prochaine sync écrasera les points locaux avec l'ancienne valeur Firestore
        if (currentUserId !== 'guest') {
          await syncPointsToFirestore(currentUserId, newBalance, pointsData.lastClaimDate || lastClaimDate, totalPointsEarned);
          console.log(`[Delete] Points synchronisés avec Firestore: ${newBalance} pts`);
        }
        
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
      
      // Calculer le solde correct : startOfDayBalance - dépenses (pour préserver le carryover)
      // Si pas de startOfDayBalance, l'estimer (cas de migration)
      const pointsKey = getPointsKey();
      const pointsRaw = await AsyncStorage.getItem(pointsKey);
      const pointsData = pointsRaw ? JSON.parse(pointsRaw) : { balance: 0, lastClaimDate: '' };
      let startOfDayBalance = pointsData.startOfDayBalance;
      
      if (startOfDayBalance === undefined) {
        // Estimer depuis le budget quotidien (cas de migration)
        startOfDayBalance = dailyPointsFromProfile;
      }
      
      const correctBalance = Math.max(0, Math.min(maxCapFromProfile, startOfDayBalance - totalSpent));
      
      await AsyncStorage.setItem(pointsKey, JSON.stringify({
        balance: correctBalance,
        lastClaimDate: today,
        startOfDayBalance,
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

  // Helper pour calculer le coût en points d'une entrée
  const calculateEntryCost = async (entry: MealEntry): Promise<number> => {
    if (!entry.items || entry.items.length === 0) return 0;
    
    const customFoods = await loadCustomFoods(currentUserId !== 'guest' ? currentUserId : undefined);
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

  const handleUpdateEntry = async (entryId: string, updatedEntry: MealEntry) => {
    try {
      // Trouver l'ancienne entrée
      const oldEntry = entries.find(e => e.id === entryId);
      if (!oldEntry) {
        console.error('[Update] Entrée non trouvée:', entryId);
        return;
      }

      // Calculer l'ancien coût
      const oldCost = await calculateEntryCost(oldEntry);
      
      // Re-classer le repas avec les items mis à jour
      let classification: { score: number; category: MealEntry['category'] };
      if (updatedEntry.items && updatedEntry.items.length > 0 && targets) {
        const customFoodsForScore = await loadCustomFoods(currentUserId !== 'guest' ? currentUserId : undefined);
        classification = classifyMealByNutrition(updatedEntry, targets, 3, customFoodsForScore);
      } else {
        classification = classifyMealByItems(updatedEntry.items || []);
      }
      
      const finalEntry: MealEntry = {
        ...updatedEntry,
        id: entryId,
        category: classification.category,
        score: classification.score,
        createdAt: oldEntry.createdAt, // Garder la date originale
      };
      
      // Calculer le nouveau coût
      const newCost = await calculateEntryCost(finalEntry);
      
      // Mettre à jour l'entrée dans le state
      const updatedEntries = entries.map(e => e.id === entryId ? finalEntry : e);
      setEntries(updatedEntries);
      
      // Sauvegarder dans AsyncStorage
      const entriesKey = getEntriesKey();
      await AsyncStorage.setItem(entriesKey, JSON.stringify(updatedEntries));
      
      // Ajuster les points (différence entre ancien et nouveau coût)
      const pointsDifference = newCost - oldCost;
      if (pointsDifference !== 0) {
        const pointsKey = getPointsKey();
        const pointsRaw = await AsyncStorage.getItem(pointsKey);
        const pointsData = pointsRaw ? JSON.parse(pointsRaw) : { balance: 0, lastClaimDate: '' };
        const newBalance = Math.max(0, pointsData.balance - pointsDifference);
        
        await AsyncStorage.setItem(pointsKey, JSON.stringify({
          ...pointsData,
          balance: newBalance,
        }));
        
        setPoints(newBalance);
        
        // Synchroniser les points avec Firestore
        if (currentUserId !== 'guest') {
          await syncPointsToFirestore(currentUserId, newBalance, pointsData.lastClaimDate, totalPointsEarned);
        }
        
        console.log(`[Update] Points ajustés: ${pointsDifference > 0 ? '-' : '+'}${Math.abs(pointsDifference)} pts (ancien: ${oldCost}, nouveau: ${newCost}, nouveau solde: ${newBalance})`);
      }
      
      // Synchroniser avec Firestore
      if (currentUserId !== 'guest') {
        await syncMealEntryToFirestore(currentUserId, finalEntry);
      }
      
      await userLogger.info(
        currentUserId,
        `Entrée mise à jour: ${finalEntry.label}`,
        'update-entry',
        { entryId: finalEntry.id, oldCost, newCost, category: finalEntry.category }
      );
    } catch (error) {
      await logError(currentUserId, error, 'update-entry', { entryId, updatedEntry });
      console.error('[Update] Erreur lors de la mise à jour d\'entrée:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour l\'entrée. Réessayez plus tard.');
    }
  };

  // IMPORTANT (Web export): éviter les erreurs d'hydratation React (#418)
  // Ce return conditionnel doit être APRÈS tous les hooks
  if (!isClient) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: '#e5e7eb', fontSize: 16, fontWeight: '600' }}>Chargement…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {screen === 'home' && (
        <HomeScreen
          entries={entries}
          onPressAdd={() => setScreen('add')}
          onDeleteEntry={handleDeleteEntry}
          onUpdateEntry={handleUpdateEntry}
          stats={stats}
          dragonState={dragonState}
          streak={streak}
          recommendations={smartRecommendations}
          todayTotals={todayTotals}
          targets={targets}
          onSaveTargets={async (next) => {
            // Tracker la mise à jour des objectifs
            trackTargetUpdated({
              targetType: 'nutrition',
              oldValue: targets.calories_kcal,
              newValue: next.calories_kcal,
            });
            setTargets(next);
            await AsyncStorage.setItem(getTargetsKey(), JSON.stringify(next));
          }}
          points={points}
          totalPointsEarned={totalPointsEarned}
          userProfile={userProfile}
          setPreselectedItem={setPreselectedItem}
          onReuseEntry={(entry) => {
            // Ajouter directement le repas pour aujourd'hui avec confirmation
            if (entry.items && entry.items.length > 0) {
              if (Platform.OS === 'web' && typeof window !== 'undefined') {
                const confirmed = window.confirm(`Ajouter "${entry.label}" pour aujourd'hui ?`);
                if (confirmed) {
                  // Créer une nouvelle entrée avec la date d'aujourd'hui
                  const newEntry: Omit<MealEntry, 'id' | 'createdAt'> = {
                    label: entry.label,
                    category: entry.category,
                    score: entry.score,
                    items: entry.items,
                  };
                  handleAddEntry(newEntry);
                }
              } else {
                Alert.alert(
                  'Réutiliser le repas',
                  `Ajouter "${entry.label}" pour aujourd'hui ?`,
                  [
                    { text: 'Annuler', style: 'cancel' },
                    {
                      text: 'Ajouter',
                      onPress: async () => {
                        // Créer une nouvelle entrée avec la date d'aujourd'hui
                        const newEntry: Omit<MealEntry, 'id' | 'createdAt'> = {
                          label: entry.label,
                          category: entry.category,
                          score: entry.score,
                          items: entry.items,
                        };
                        await handleAddEntry(newEntry);
                      },
                    },
                  ]
                );
              }
            }
          }}
          lastClaimDate={lastClaimDate}
          customFoods={customFoods}
          dayCaloriesMap={dayCaloriesMap}
          cheatDays={cheatDays}
        />
      )}

      {screen === 'add' && (
        <AddEntryScreen
          onCancel={() => {
            setScreen('home');
            setPreselectedItem(null);
            setPreselectedEntryItems(null);
            setPreselectedEntryLabel(null);
          }}
          onSave={handleAddEntry}
          points={points}
          spendPoints={spendPoints}
          todayTotals={todayTotals}
          targets={targets}
          preselectedItem={preselectedItem}
          preselectedEntryItems={preselectedEntryItems}
          preselectedEntryLabel={preselectedEntryLabel}
          customFoods={customFoods}
          entries={entries}
          currentUserId={currentUserId}
        />
      )}

      <StatusBar style="light" />
    </SafeAreaView>
  );
}

// ---- Écran d'accueil ----
function HomeScreen({
  entries,
  onPressAdd,
  onDeleteEntry,
  onUpdateEntry,
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
  onReuseEntry,
  lastClaimDate,
  customFoods,
  dayCaloriesMap,
  cheatDays,
}: {
  entries: MealEntry[];
  onPressAdd: () => void;
  onDeleteEntry: (entryId: string) => void | Promise<void>;
  onUpdateEntry: (entryId: string, updatedEntry: MealEntry) => Promise<void>;
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
  onReuseEntry: (entry: MealEntry) => void;
  lastClaimDate: string;
  customFoods: typeof FOOD_DB;
  dayCaloriesMap: Record<string, number>;
  cheatDays: Record<string, boolean>;
}) {
  const { profile: authProfile, user: authUser } = useAuth();
  const currentUserId = (authProfile?.userId || (authUser as any)?.uid || (authUser as any)?.id || 'guest');
  
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<{ entryId: string; itemIndex: number; itemRef: FoodItemRef; foodItem: FoodItem } | null>(null);
  
  // Smart recommendations state (déclaré avant return conditionnel pour respecter les règles des hooks)
  const [showHungryMode, setShowHungryMode] = useState(false);
  const [tastePreference, setTastePreference] = useState<'sweet' | 'salty' | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Fusionner FOOD_DB avec les aliments personnalisés
  const allFoods = useMemo(() => {
    return mergeFoodsWithCustom(FOOD_DB, customFoods);
  }, [customFoods]);

  // Helper pour calculer le coût en points d'une entrée (pour l'affichage)
  const calculateEntryCostDisplay = (entry: MealEntry): number => {
    if (!entry.items || entry.items.length === 0) return 0;
    
    return entry.items.reduce((sum, itemRef) => {
      const fi = allFoods.find(f => f.id === itemRef.foodId);
      if (!fi) return sum;
      const multiplier = itemRef.multiplier || 1.0;
      const baseCost = computeFoodPoints(fi);
      const cost = Math.round(baseCost * Math.sqrt(multiplier));
      return sum + cost;
    }, 0);
  };
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
  
  const { activeTheme } = useAppTheme();
  const theme = activeTheme === 'dark' ? darkTheme : lightTheme;
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
        <View style={styles.headerRightSection}>
          <TouchableOpacity onPress={() => router.push('/version')}>
            <Text style={styles.headerVersion}>{getFormattedAppVersion()}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerSettingsButton}
            onPress={() => setShowSettingsModal(true)}
          >
            <Text style={styles.headerSettingsIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Modal Settings */}
      <Modal
        visible={showSettingsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSettingsModal(false)}
      >
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
                <Text style={styles.settingsOptionDesc}>Poids, objectif de perte, niveau d&apos;activité</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.settingsOption}
              onPress={() => {
                setShowSettingsModal(false);
                router.push('/help');
              }}
            >
              <Text style={styles.settingsOptionIcon}>❓</Text>
              <View style={styles.settingsOptionContent}>
                <Text style={styles.settingsOptionTitle}>Aide & FAQ</Text>
                <Text style={styles.settingsOptionDesc}>Réponses aux questions fréquentes</Text>
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
              style={styles.settingsOption}
              onPress={() => setShowSettingsModal(false)}
            >
              <Text style={styles.settingsOptionIcon}>ℹ️</Text>
              <View style={styles.settingsOptionContent}>
                <Text style={styles.settingsOptionTitle}>À propos</Text>
                <Text style={styles.settingsOptionDesc}>Version {getFormattedAppVersion()} - Toki</Text>
              </View>
            </TouchableOpacity>
            
            {/* Bouton Réparation Synchronisation */}
            <TouchableOpacity
              style={[styles.settingsOption, styles.settingsOptionLast]}
              onPress={async () => {
                setShowSettingsModal(false);
                
                if (!userProfile || !currentUserId || currentUserId === 'guest') {
                  if (Platform.OS === 'web' && typeof window !== 'undefined') {
                    window.alert('Tu dois être connecté pour utiliser la réparation de synchronisation.');
                  } else {
                    Alert.alert('Erreur', 'Tu dois être connecté pour utiliser la réparation de synchronisation.');
                  }
                  return;
                }
                
                if (Platform.OS === 'web' && typeof window !== 'undefined') {
                  const confirmed = window.confirm(
                    '🔧 Réparation de Synchronisation\n\n' +
                    'Cette action va :\n' +
                    '1. Recalculer les points à partir des repas\n' +
                    '2. Synchroniser les custom foods manquants\n' +
                    '3. Réparer les repas avec items invalides\n\n' +
                    'Cela peut prendre quelques secondes...'
                  );
                  if (!confirmed) return;
                  
                  // Pour web, exécuter directement
                  try {
                    const { fullRepair } = await import('../../lib/sync-repair');
                    const dailyPointsBudget = userProfile.dailyPointsBudget || 6;
                    const maxPointsCap = userProfile.maxPointsCap || 12;
                    
                    const result = await fullRepair(currentUserId, dailyPointsBudget, maxPointsCap);
                    
                    if (result.success) {
                      const mealsInfo = [
                        result.meals.syncedFromFirestore > 0 && `${result.meals.syncedFromFirestore} reçus depuis Firestore`,
                        result.meals.syncedToFirestore > 0 && `${result.meals.syncedToFirestore} envoyés vers Firestore`,
                        result.meals.itemsAdded && result.meals.itemsAdded > 0 && `${result.meals.itemsAdded} items ajoutés`,
                        result.meals.entriesFixed > 0 && `${result.meals.entriesFixed} corrigés`,
                        result.meals.itemsRemoved > 0 && `${result.meals.itemsRemoved} items retirés`,
                      ].filter(Boolean).join(', ') || 'Aucun changement';
                      
                      window.alert(
                        '✅ Réparation terminée\n\n' +
                        `Points: ${result.points.oldBalance} → ${result.points.newBalance} pts\n` +
                        `Custom foods: ${result.customFoods.localToFirestore} envoyés, ${result.customFoods.firestoreToLocal} reçus\n` +
                        `Repas: ${mealsInfo}`
                      );
                      // Recharger la page pour voir les changements
                      window.location.reload();
                    } else {
                      window.alert(
                        '⚠️ Réparation partielle\n\n' +
                        `Certaines erreurs sont survenues:\n\n${result.errors.slice(0, 3).join('\n')}${result.errors.length > 3 ? '\n...' : ''}`
                      );
                    }
                  } catch (error: any) {
                    window.alert(`Erreur: Impossible de réparer: ${error?.message || error}`);
                  }
                } else {
                  Alert.alert(
                    '🔧 Réparation de Synchronisation',
                    'Cette action va :\n\n' +
                    '1. Recalculer les points à partir des repas\n' +
                    '2. Synchroniser les custom foods manquants\n' +
                    '3. Réparer les repas avec items invalides\n\n' +
                    'Cela peut prendre quelques secondes...',
                    [
                      { text: 'Annuler', style: 'cancel' },
                      { text: 'Réparer', onPress: async () => {
                        try {
                          const { fullRepair } = await import('../../lib/sync-repair');
                          const dailyPointsBudget = userProfile.dailyPointsBudget || 6;
                          const maxPointsCap = userProfile.maxPointsCap || 12;
                          
                          const result = await fullRepair(currentUserId, dailyPointsBudget, maxPointsCap);
                          
                          if (result.success) {
                            const mealsInfo = [
                              result.meals.syncedFromFirestore > 0 && `${result.meals.syncedFromFirestore} reçus depuis Firestore`,
                              result.meals.syncedToFirestore > 0 && `${result.meals.syncedToFirestore} envoyés vers Firestore`,
                              result.meals.itemsAdded && result.meals.itemsAdded > 0 && `${result.meals.itemsAdded} items ajoutés`,
                              result.meals.entriesFixed > 0 && `${result.meals.entriesFixed} corrigés`,
                              result.meals.itemsRemoved > 0 && `${result.meals.itemsRemoved} items retirés`,
                            ].filter(Boolean).join(', ') || 'Aucun changement';
                            
                            Alert.alert(
                              '✅ Réparation terminée',
                              `Points: ${result.points.oldBalance} → ${result.points.newBalance} pts\n` +
                              `Custom foods: ${result.customFoods.localToFirestore} envoyés, ${result.customFoods.firestoreToLocal} reçus\n` +
                              `Repas: ${mealsInfo}`
                            );
                            // Recharger les données
                            window.location?.reload();
                          } else {
                            Alert.alert(
                              '⚠️ Réparation partielle',
                              `Certaines erreurs sont survenues:\n\n${result.errors.slice(0, 3).join('\n')}${result.errors.length > 3 ? '\n...' : ''}`
                            );
                          }
                        } catch (error: any) {
                          Alert.alert('Erreur', `Impossible de réparer: ${error?.message || error}`);
                        }
                      }}
                    ]
                  );
                }
              }}
            >
              <Text style={styles.settingsOptionIcon}>🔧</Text>
              <View style={styles.settingsOptionContent}>
                <Text style={styles.settingsOptionTitle}>Réparer la synchronisation</Text>
                <Text style={styles.settingsOptionDesc}>Corriger les incohérences entre appareils</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Dragon Mort - TEMPORAIREMENT DÉSACTIVÉ - TODO: Réimplémenter après fix */}

      {/* Alerte profil suspect */}
      {hasSuspectProfile && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningTitle}>⚠️ Profil à vérifier</Text>
          <Text style={styles.warningText}>
            Tes objectifs semblent incorrects ({Math.round((weeklyCalTarget || 0) / 7)} cal/jour).
            Tu as probablement entré ton poids en livres mais l&apos;ancien système l&apos;a interprété en kg.
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
      <DragonDisplay 
        streakDays={streak.currentStreakDays}
        mood={dragonState.mood}
        showInfo={true}
        size={140}
        onLevelUp={(newLevel) => {
          // Afficher un message de félicitations quand le niveau augmente
          const message = getLevelUpMessage(newLevel);
          Alert.alert('🎉 Nouveau Niveau!', message);
        }}
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
          
          {/* Indicateur de nouveau jour */}
          {lastClaimDate !== getTodayLocal() && (
            <View style={styles.newDayBanner}>
              <Text style={styles.newDayBannerText}>✨ Nouveau jour ! Points quotidiens reçus</Text>
            </View>
          )}
          
          {/* Points disponibles - Mise en avant */}
          <View style={styles.budgetCurrentBox}>
            <Text style={styles.budgetCurrentLabel}>Points disponibles</Text>
            <Text style={[styles.budgetCurrentValue, points === 0 && styles.budgetCurrentZero]}>
              {points} pts
            </Text>
            {points === 0 && (
              <Text style={styles.budgetHint}>
                Tu as utilisé tous tes points aujourd&apos;hui. Tu recevras {dailyBudget} nouveaux points demain matin.
              </Text>
            )}
            {points > 0 && lastClaimDate === getTodayLocal() && (
              <Text style={styles.budgetHint}>
                Reçu ce matin : {dailyBudget} pts
              </Text>
            )}
            {lastClaimDate !== getTodayLocal() && (
              <Text style={styles.budgetHint}>
                Nouveau jour ! +{dailyBudget} pts ajoutés
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

      {/* Calendrier de Streak style Duolingo */}
      <StreakCalendarDuolingo
        currentStreakDays={streak.currentStreakDays}
        dayFeeds={buildDayFeeds(entries)}
        dayCaloriesMap={dayCaloriesMap}
        minCalories={MIN_CALORIES_FOR_COMPLETE_DAY}
        daysToShow={10}
        cheatDays={cheatDays}
      />

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
            <Text style={styles.todaySummaryTitle}>📊 Ce que tu as mangé aujourd&apos;hui:</Text>
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
              <Text style={styles.tasteChoiceTitle}>🍽️ Qu&apos;est-ce qui te ferait plaisir ?</Text>
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
              Choisis d&apos;abord si tu préfères sucré ou salé ! 👆
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
        <Text style={styles.historyTitle}>📅 Repas d&apos;aujourd&apos;hui</Text>
        {entries.length === 0 ? (
          <Text style={styles.historyEmpty}>{"Aucune entrée pour l'instant."}</Text>
        ) : (
          <FlatList
            data={(() => {
              const today = getTodayLocal();
              const yesterday = getYesterdayLocal();
              
              // Séparer les repas d'aujourd'hui, d'hier, et les autres
              const todayEntries = entries.filter(e => normalizeDate(e.createdAt) === today);
              const yesterdayEntries = entries.filter(e => normalizeDate(e.createdAt) === yesterday);
              const olderEntries = entries.filter(e => {
                const entryDate = normalizeDate(e.createdAt);
                return entryDate !== today && entryDate !== yesterday;
              })
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 5); // Limiter à 5 repas plus anciens que hier
              
              // Afficher d'abord les repas d'aujourd'hui, puis ceux d'hier, puis les autres
              const allEntries = [
                ...todayEntries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
                ...yesterdayEntries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
                ...olderEntries
              ];
              
              return allEntries;
            })()}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => {
              const entryCost = calculateEntryCostDisplay(item);
              const entryDate = normalizeDate(item.createdAt);
              const today = getTodayLocal();
              const yesterday = getYesterdayLocal();
              
              const isToday = entryDate === today;
              const isYesterday = entryDate === yesterday;
              const isExpanded = expandedEntryId === item.id;
              
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
              
              // Formater la date pour l'affichage
              const dateObj = new Date(item.createdAt);
              const timeStr = dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
              let dateStr = '';
              if (isToday) {
                dateStr = `Aujourd'hui ${timeStr}`;
              } else if (isYesterday) {
                dateStr = `Hier ${timeStr}`;
              } else {
                dateStr = dateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ` ${timeStr}`;
              }
              
              // Déterminer le style selon la date
              let rowStyle = styles.historyItemRow;
              let textStyle = styles.historyItem;
              let dateStyle = styles.historyItemDate;
              
              if (isToday) {
                rowStyle = styles.historyItemRowToday;
                textStyle = styles.historyItemToday;
                dateStyle = styles.historyItemDateToday;
              } else if (isYesterday) {
                rowStyle = styles.historyItemRowYesterday;
                textStyle = styles.historyItemYesterday;
                dateStyle = styles.historyItemDateYesterday;
              } else {
                rowStyle = styles.historyItemRowOther;
                textStyle = styles.historyItemOther;
                dateStyle = styles.historyItemDateOther;
              }
              
              return (
              <View style={rowStyle}>
                <View style={styles.historyItemContent}>
                  <View style={styles.historyItemHeader}>
                    <View style={styles.historyItemHeaderLeft}>
                      <Text style={textStyle}>
                        {isToday ? '✨' : isYesterday ? '📅' : '•'} [{item.category}] {item.label}
                      </Text>
                      {item.isCheatMeal && (
                        <View style={styles.cheatMealBadge}>
                          <Text style={styles.cheatMealBadgeText}>🎉 Cheat</Text>
                        </View>
                      )}
                    </View>
                    <Text style={dateStyle}>
                      {dateStr}
                    </Text>
                  </View>
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
                  {entryCost > 0 && !item.isCheatMeal && (
                    <Text style={styles.historyItemCost}>
                      -{entryCost} pts
                    </Text>
                  )}
                  {item.isCheatMeal && (
                    <Text style={styles.historyItemCostCheat}>
                      🎉 Repas cheat (0 pts)
                    </Text>
                  )}
                  
                  {/* Items détaillés (si expanded et aujourd'hui) */}
                  {isToday && isExpanded && item.items && item.items.length > 0 && (
                    <View style={styles.historyItemsDetail}>
                      {item.items.map((itemRef, itemIdx) => {
                        const fi = allFoods.find(f => f.id === itemRef.foodId);
                        if (!fi) return null;
                        const multiplier = itemRef.multiplier || 1.0;
                        const itemCalories = Math.round((fi.calories_kcal || 0) * multiplier);
                        const itemProtein = Math.round((fi.protein_g || 0) * multiplier);
                        const unit = getUnitForFood(fi);
                        const quantityDisplay = itemRef.quantityHint || 
                          (itemRef.portionGrams ? `${itemRef.portionGrams}${unit}` : '1 portion');
                        
                        return (
                          <View key={`${itemRef.foodId}-${itemIdx}`} style={styles.historyItemDetailRow}>
                            <View style={styles.historyItemDetailInfo}>
                              <Text style={styles.historyItemDetailName}>{fi.name}</Text>
                              <Text style={styles.historyItemDetailQuantity}>{quantityDisplay}</Text>
                              <Text style={styles.historyItemDetailNutrition}>
                                🔥 {itemCalories} cal · 💪 {itemProtein}g prot
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={styles.historyItemEditButton}
                              onPress={() => {
                                setEditingItem({
                                  entryId: item.id,
                                  itemIndex: itemIdx,
                                  itemRef: itemRef,
                                  foodItem: fi,
                                });
                              }}
                            >
                              <Text style={styles.historyItemEditText}>✏️</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
                <View style={styles.historyItemActions}>
                  {isToday && item.items && item.items.length > 0 && (
                    <TouchableOpacity
                      style={styles.historyExpandButton}
                      onPress={() => setExpandedEntryId(isExpanded ? null : item.id)}
                    >
                      <Text style={styles.historyExpandText}>{isExpanded ? '▼' : '▶'}</Text>
                    </TouchableOpacity>
                  )}
                  {!isToday && item.items && item.items.length > 0 && (
                    <TouchableOpacity
                      style={styles.historyReuseButton}
                      onPress={() => {
                        onReuseEntry(item);
                      }}
                    >
                      <Text style={styles.historyReuseText}>↻</Text>
                    </TouchableOpacity>
                  )}
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
              </View>
              );
            }}
          />
        )}

      {/* Modal d'édition d'item */}
      {editingItem && (() => {
        const entry = entries.find(e => e.id === editingItem.entryId);
        if (!entry) return null;
        
        return <EditItemModal
          editingItem={editingItem}
          entry={entry}
          onUpdate={(updatedItems) => {
            const updatedEntry: MealEntry = {
              ...entry,
              items: updatedItems,
            };
            onUpdateEntry(editingItem.entryId, updatedEntry);
            setEditingItem(null);
          }}
          onCancel={() => setEditingItem(null)}
          allFoods={allFoods}
          getUnitForFood={getUnitForFood}
          createCustomPortion={createCustomPortion}
          getDefaultPortion={getDefaultPortion}
          getPortionsForItem={getPortionsForItem}
          formatPortionLabel={formatPortionLabel}
          computeFoodPoints={computeFoodPoints}
        />;
      })()}
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
  preselectedEntryItems,
  preselectedEntryLabel,
  customFoods = [],
  entries = [],
  currentUserId,
}: {
  onCancel: () => void;
  onSave: (entry: Omit<MealEntry, 'id' | 'createdAt'>) => void;
  points: number;
  spendPoints: (cost: number) => Promise<void> | void;
  todayTotals: ReturnType<typeof computeDailyTotals>;
  targets: typeof DEFAULT_TARGETS;
  preselectedItem: { item: FoodItem; portion: PortionReference } | null;
  preselectedEntryItems: FoodItemRef[] | null;
  preselectedEntryLabel: string | null;
  customFoods?: typeof FOOD_DB;
  entries?: MealEntry[];
  currentUserId: string;
}) {
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState<MealEntry['category']>('sain');
  const [items, setItems] = useState<FoodItemRef[]>([]);
  const [quickFilter, setQuickFilter] = useState<CategoryFilter>('all');
  const [selectedItemForPortion, setSelectedItemForPortion] = useState<string | null>(null); // Item ID pour modal portion
  const [showCustomPortionModal, setShowCustomPortionModal] = useState<{ foodId: string; unit: 'g' | 'ml'; initialGrams?: number; onConfirm: (grams: number, mode?: 'g/ml' | 'portion', portionValue?: number) => void } | null>(null);
  const [portionCount, setPortionCount] = useState<number>(1); // Nombre de portions (toujours visible)
  const [isCheatDayState, setIsCheatDayState] = useState<boolean>(false);
  const [hasSubscriptionAccess, setHasSubscriptionAccess] = useState<boolean | null>(null);
  const [showCheatPaywall, setShowCheatPaywall] = useState(false);

  // Fusionner FOOD_DB avec les aliments personnalisés
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
    console.log('[AddEntry] toggleItem appelé avec foodId:', foodId);
    const fi = allFoods.find((f) => f.id === foodId);
    if (!fi) {
      console.error('[AddEntry] Aliment non trouvé:', foodId);
      return;
    }
    
    const exists = items.some((i) => i.foodId === foodId);
    if (exists) {
      console.log('[AddEntry] Aliment déjà sélectionné, suppression');
      setItems((prev) => prev.filter((i) => i.foodId !== foodId));
      return;
    }
    
    // Ouvrir le sélecteur de portion au lieu d'ajouter directement
    console.log('[AddEntry] Ouverture du modal de portion pour:', fi.name);
    setSelectedItemForPortion(foodId);
  };
  
  const addItemWithPortion = (foodId: string, portion: PortionReference) => {
    const fi = allFoods.find((f) => f.id === foodId);
    if (!fi) return;
    
    const baseCost = computeFoodPoints(fi);
    const cost = Math.round(baseCost * Math.sqrt(portion.multiplier));
    
    // Permettre l'ajout même sans points si c'est un cheat day
    if (!isCheatDayState && pendingCost + cost > points) return; // Pas assez de points
    
    // Formater quantityHint
    const unit = getUnitForFood(fi);
    let quantityHint: string;
    
    if (portion.size === 'custom') {
      // Pour les portions custom, visualRef contient déjà le bon format (ex: "2 portions" ou "150g")
      quantityHint = portion.visualRef;
    } else {
      // Pour les portions prédéfinies
      quantityHint = `${portion.grams}g (${portion.visualRef})`;
    }
    
    setItems((prev) => [
      ...prev,
      {
        foodId,
        portionSize: portion.size,
        portionGrams: portion.grams,
        multiplier: portion.multiplier,
        quantityHint: quantityHint,
      },
    ]);
    setSelectedItemForPortion(null);
  };

  const addItemWithCustomPortion = (foodId: string, grams: number, unit: 'g' | 'ml', mode?: 'g/ml' | 'portion', portionValue?: number) => {
    const fi = allFoods.find((f) => f.id === foodId);
    if (!fi) return;
    
    const mediumPortion = getDefaultPortion(fi.tags);
    let customPortion: PortionReference;
    
    if (mode === 'portion' && portionValue !== undefined) {
      // Mode portion: utiliser createPortionCustomPortion
      customPortion = createPortionCustomPortion(portionValue, mediumPortion, unit);
    } else {
      // Mode g/ml: utiliser createCustomPortion classique
      customPortion = createCustomPortion(grams, mediumPortion, unit);
    }
    
    addItemWithPortion(foodId, customPortion);
  };

  // Charger l'état cheat day et vérifier l'abonnement au montage
  useEffect(() => {
    const loadCheatDayAndCheckAccess = async () => {
      if (currentUserId === 'guest') {
        setHasSubscriptionAccess(false);
        return;
      }
      
      try {
        // Vérifier l'abonnement
        const { hasActiveSubscription } = await import('../../lib/subscription-utils');
        const hasAccess = await hasActiveSubscription(currentUserId);
        setHasSubscriptionAccess(hasAccess);
        
        // Charger l'état cheat day seulement si l'utilisateur a accès
        if (hasAccess) {
          const today = getTodayLocal();
          const isCheat = await isCheatDay(currentUserId, today);
          setIsCheatDayState(isCheat);
        }
      } catch (error) {
        console.error('[AddEntry] Erreur vérification abonnement:', error);
        setHasSubscriptionAccess(false);
      }
    };
    loadCheatDayAndCheckAccess();
  }, [currentUserId]);

  // Auto-ajouter l'item pré-sélectionné depuis les recommandations
  useEffect(() => {
    if (preselectedItem) {
      const portion = preselectedItem.portion;
      addItemWithPortion(preselectedItem.item.id, portion);
    }
  }, []); // Exécuter une seule fois au montage

  // Auto-remplir les items d'un repas précédent à réutiliser
  useEffect(() => {
    if (preselectedEntryItems && preselectedEntryItems.length > 0) {
      setItems(preselectedEntryItems);
      if (preselectedEntryLabel) {
        setLabel(preselectedEntryLabel);
      }
      // Classifier le repas automatiquement
      const cls = classifyMealByItems(preselectedEntryItems);
      setCategory(cls.category);
    }
  }, []); // Exécuter une seule fois au montage

  // Calculer les repas favoris basés sur l'usage réel
  const favoriteMeals = calculateFavoriteMeals(entries, 8);
  // Combiner les repas favoris calculés avec les repas par défaut (si pas assez de favoris)
  const allFavoriteMeals = favoriteMeals.length >= 5 
    ? favoriteMeals 
    : [...favoriteMeals, ...QUICK_MEALS.slice(0, Math.max(0, 5 - favoriteMeals.length))];

  const applyQuickMeal = (mealId: string) => {
    // Chercher dans allFavoriteMeals (qui contient les favoris calculés + QUICK_MEALS)
    const preset = allFavoriteMeals.find((m) => m.id === mealId);
    if (preset) {
      setItems(preset.items);
      setLabel(preset.name);
      const cls = classifyMealByItems(preset.items);
      setCategory(cls.category);
    }
  };

  // Filtre basé sur la recherche + la catégorie sélectionnée
  const searchLower = label.toLowerCase().trim();
  
  // Ne plus afficher les quick items - seulement les repas favoris
  const filteredMeals = allFavoriteMeals.filter((qm) => {
    const cls = classifyMealByItems(qm.items);
    const matchesCategory = quickFilter === 'all' || cls.category === quickFilter;
    const matchesSearch = !searchLower || qm.name.toLowerCase().includes(searchLower);
    return matchesCategory && matchesSearch;
  });

  // Filtrer les aliments individuels pour la liste
  const filteredFoods = useMemo(() => {
    const filtered = allFoods.filter((food) => {
      // Filtrer par recherche
      const matchesSearch = !searchLower || food.name.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
      
      // Filtrer par catégorie basée sur baseScore
      if (quickFilter === 'all') return true;
      const score = food.baseScore ?? 50;
      let category: 'sain' | 'ok' | 'cheat' = 'sain';
      if (score < 40) category = 'cheat';
      else if (score < 70) category = 'ok';
      
      return category === quickFilter;
    });
    console.log('[AddEntry] Aliments filtrés:', filtered.length, 'sur', allFoods.length, 'recherche:', searchLower, 'filtre:', quickFilter);
    return filtered;
  }, [allFoods, searchLower, quickFilter]);


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
    
    // Utiliser le nouveau système de scoring si les targets sont disponibles
    let classification: { score: number; category: MealEntry['category'] };
    if (targets) {
      const tempEntry: MealEntry = {
        id: 'temp',
        createdAt: new Date().toISOString(),
        label: finalLabel,
        category: 'ok',
        score: 0,
        items,
      };
      classification = classifyMealByNutrition(tempEntry, targets, 3, customFoods);
    } else {
      classification = classifyMealByItems(items);
    }
    
    // onSave gère maintenant la sauvegarde ET la déduction des points
    // Ne plus appeler spendPoints ici pour éviter la double déduction
    // Marquer comme cheat meal si c'est un cheat day
    onSave({ 
      label: finalLabel, 
      category: classification.category, 
      score: classification.score, 
      items,
      isCheatMeal: isCheatDayState,
    });
  };

  const [showAutocomplete, setShowAutocomplete] = useState(false);

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView style={styles.inner} contentContainerStyle={styles.innerContent}>
        <Text style={styles.logo}>Partager avec Toki</Text>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.input}
          placeholder="Rechercher un aliment..."
          placeholderTextColor="#6b7280"
          value={label}
          onChangeText={(text) => {
            setLabel(text);
            setShowAutocomplete(text.length > 0);
          }}
          onFocus={() => {
            if (label.length > 0) {
              setShowAutocomplete(true);
            }
          }}
          onBlur={() => {
            // Délai pour permettre le clic sur un item avant de fermer
            setTimeout(() => setShowAutocomplete(false), 200);
          }}
        />
      </View>
      
      {/* Liste autocomplete directement sous le champ de recherche */}
      {showAutocomplete && searchLower.length > 0 && filteredFoods.length > 0 && (
        <View style={styles.autocompleteList}>
          <Text style={styles.autocompleteListTitle}>
            🍽️ Suggestions ({filteredFoods.length})
          </Text>
          {filteredFoods.slice(0, 10).map((food) => {
            const baseCost = computeFoodPoints(food);
            const mediumPortion = getDefaultPortion(food.tags);
            const estimatedCost = Math.round(baseCost * Math.sqrt(mediumPortion.multiplier));
            const canAfford = isCheatDayState || pendingCost + estimatedCost <= points;
            
            return (
              <TouchableOpacity
                key={food.id}
                style={[
                  styles.autocompleteItem,
                  !canAfford && styles.autocompleteItemDisabled,
                ]}
                onPress={() => {
                  if (!canAfford) return;
                  setShowAutocomplete(false);
                  setLabel(''); // Vider le champ après sélection
                  toggleItem(food.id);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.autocompleteItemContent}>
                  <Text style={[styles.autocompleteItemName, !canAfford && styles.autocompleteItemNameDisabled]}>
                    {food.name}
                  </Text>
                  <Text style={styles.autocompleteItemInfo}>
                    {food.calories_kcal || 0} cal · {food.protein_g || 0}g prot · ~{estimatedCost} pts
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Options: Log avec IA */}
      <View style={styles.requestBox}>
        <Text style={styles.requestText}>Tu ne trouves pas l&apos;aliment?</Text>
        <TouchableOpacity
          style={[styles.requestLinkBtn, { backgroundColor: '#8b5cf6', marginTop: 8 }]}
          onPress={() => router.push({ pathname: '/ai-logger', params: { initialText: label } })}
        >
          <Text style={[styles.requestLink, { color: '#fff', fontWeight: '600' }]}>🧠 Log avec IA</Text>
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
      
      {/* Bouton Journée Cheat - Toujours visible */}
      {hasSubscriptionAccess !== null && (
        <>
          <TouchableOpacity
            style={[
              styles.cheatDayButton,
              isCheatDayState && styles.cheatDayButtonActive,
              hasSubscriptionAccess === false && styles.cheatDayButtonDisabled,
            ]}
            onPress={async () => {
              // Vérifier l'abonnement avant d'activer
              if (hasSubscriptionAccess === false) {
                setShowCheatPaywall(true);
                return;
              }
              
              if (hasSubscriptionAccess === null) {
                // En cours de vérification, ne rien faire
                return;
              }
              
              const today = getTodayLocal();
              const newCheatState = !isCheatDayState;
              setIsCheatDayState(newCheatState);
              await setCheatDay(currentUserId, today, newCheatState);
              
              // Recharger les cheat days pour mettre à jour le calendrier
              const { getCheatDays } = await import('../../lib/cheat-days');
              const updatedCheatDays = await getCheatDays(currentUserId);
              setCheatDays(updatedCheatDays);
            }}
          >
            <Text style={[
              styles.cheatDayButtonText,
              isCheatDayState && styles.cheatDayButtonTextActive,
              hasSubscriptionAccess === false && styles.cheatDayButtonTextDisabled,
            ]}>
              {hasSubscriptionAccess === false 
                ? '🎉 Journée cheat (Premium requis)' 
                : isCheatDayState 
                  ? '🎉 Journée cheat activée' 
                  : '🎉 Activer journée cheat'}
            </Text>
            {isCheatDayState && hasSubscriptionAccess !== false && (
              <Text style={styles.cheatDayButtonSubtext}>
                Les repas ne consommeront pas de points
              </Text>
            )}
            {hasSubscriptionAccess === false && (
              <Text style={styles.cheatDayButtonSubtext}>
                Fonctionnalité premium - Abonne-toi pour activer
              </Text>
            )}
          </TouchableOpacity>
          
          {/* Paywall modal pour cheat day */}
          {showCheatPaywall && (
            <PaywallModal
              visible={true}
              onSubscribe={() => {
                setShowCheatPaywall(false);
                router.replace('/subscription');
              }}
              onClose={() => {
                setShowCheatPaywall(false);
              }}
            />
          )}
        </>
      )}
      
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

      <Text style={styles.label}>⭐ Repas favoris (basés sur ton usage)</Text>
      <View style={styles.quickRow}>
        {filteredMeals.length === 0 ? (
          <Text style={styles.emptyText}>
            Aucun repas favori pour l'instant. Utilise l'IA ou cherche un aliment ci-dessous.
          </Text>
        ) : (
          filteredMeals.map((qm) => {
            const totalCost = qm.items.reduce((sum, ref) => {
              const fi = allFoods.find((f) => f.id === ref.foodId);
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
          const affordable = isCheatDayState || (pendingCost + totalCost <= points && !overTargets);
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
        }))}
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
      {selectedItemForPortion && (() => {
        const selectedFood = allFoods.find(f => f.id === selectedItemForPortion);
        console.log('[AddEntry] Affichage modal pour:', selectedItemForPortion, selectedFood?.name);
        if (!selectedFood) {
          console.error('[AddEntry] Aliment non trouvé pour modal:', selectedItemForPortion);
          return null;
        }
        return (
          <Modal
            visible={true}
            transparent
            animationType="fade"
            onRequestClose={() => {
              console.log('[AddEntry] Fermeture modal');
              setSelectedItemForPortion(null);
            }}
          >
            <View style={styles.portionModal}>
              <View style={styles.portionModalContent}>
                <Text style={styles.portionModalTitle}>
                  Choisis la portion
                </Text>
                <Text style={styles.portionModalSubtitle}>
                  {selectedFood.name}
                </Text>
                
                {/* Contrôle Portions (toujours visible) */}
                <View style={styles.portionCountControl}>
                  <Text style={styles.portionCountLabel}>Portions:</Text>
                  <View style={styles.portionCountButtons}>
                    <TouchableOpacity
                      style={styles.portionCountButton}
                      onPress={() => setPortionCount(Math.max(0.5, portionCount - 0.5))}
                    >
                      <Text style={styles.portionCountButtonText}>−</Text>
                    </TouchableOpacity>
                    <TextInput
                      style={styles.portionCountInput}
                      value={portionCount.toString()}
                      onChangeText={(text) => {
                        const val = parseFloat(text);
                        if (!isNaN(val) && val > 0) {
                          setPortionCount(val);
                        }
                      }}
                      keyboardType="decimal-pad"
                    />
                    <TouchableOpacity
                      style={styles.portionCountButton}
                      onPress={() => setPortionCount(portionCount + 0.5)}
                    >
                      <Text style={styles.portionCountButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              
              {getPortionsForItem(selectedFood.tags || []).map((portion) => (
                <TouchableOpacity
                  key={portion.size}
                  style={styles.portionOption}
                  onPress={() => {
                    console.log('[AddEntry] Sélection portion:', portion.size, 'avec portionCount:', portionCount);
                    // Appliquer le multiplicateur de portions
                    const finalPortion: PortionReference = {
                      ...portion,
                      grams: portion.grams * portionCount,
                      multiplier: portion.multiplier * portionCount,
                      visualRef: portionCount !== 1 ? `${portionCount} × ${portion.visualRef}` : portion.visualRef,
                    };
                    addItemWithPortion(selectedItemForPortion, finalPortion);
                    setPortionCount(1); // Reset pour prochain item
                  }}
                >
                  <Text style={styles.portionOptionLabel}>
                    {formatPortionLabel(portion)}
                  </Text>
                  <Text style={styles.portionOptionCost}>
                    {Math.round(
                      computeFoodPoints(selectedFood) * Math.sqrt(portion.multiplier)
                    )} pts
                  </Text>
                </TouchableOpacity>
              ))}
              
              {/* Bouton quantité personnalisée */}
              {(() => {
                const unit = getUnitForFood(selectedFood);
                return (
                  <TouchableOpacity
                    style={styles.portionOption}
                    onPress={() => {
                      setSelectedItemForPortion(null);
                      setShowCustomPortionModal({
                        foodId: selectedItemForPortion,
                        unit: unit,
                        onConfirm: (grams: number, mode?: 'g/ml' | 'portion', portionValue?: number) => {
                          // Appliquer le multiplicateur de portions sur les grammes personnalisés
                          const finalGrams = grams * portionCount;
                          addItemWithCustomPortion(selectedItemForPortion, finalGrams, unit, mode, portionValue);
                          setShowCustomPortionModal(null);
                          setPortionCount(1); // Reset pour prochain item
                        },
                      });
                    }}
                  >
                    <Text style={styles.portionOptionLabel}>
                      📝 Quantité personnalisée
                    </Text>
                    <Text style={styles.portionOptionCost}>
                      {unit === 'ml' ? 'ml' : 'g'}
                    </Text>
                  </TouchableOpacity>
                );
              })()}
              
              <TouchableOpacity
                style={styles.portionModalCancel}
                onPress={() => {
                  console.log('[AddEntry] Annulation modal');
                  setSelectedItemForPortion(null);
                  setPortionCount(1); // Reset pour prochain item
                }}
              >
                <Text style={styles.portionModalCancelText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
        );
      })()}

      {/* Modal quantité personnalisée */}
      {showCustomPortionModal && (() => {
        const foodItem = allFoods.find(f => f.id === showCustomPortionModal.foodId);
        if (!foodItem) return null;
        
        return <CustomPortionModal
          foodItem={foodItem}
          unit={showCustomPortionModal.unit}
          initialGrams={showCustomPortionModal.initialGrams}
          onConfirm={showCustomPortionModal.onConfirm}
          onCancel={() => setShowCustomPortionModal(null)}
          allFoods={allFoods}
        />;
      })()}
      
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ---- Modal quantité personnalisée (réutilisable) ----
function CustomPortionModal({
  foodItem,
  unit,
  initialGrams,
  onConfirm,
  onCancel,
  allFoods,
}: {
  foodItem: FoodItem;
  unit: 'g' | 'ml';
  initialGrams?: number;
  onConfirm: (grams: number, mode?: 'g/ml' | 'portion', portionValue?: number) => void;
  onCancel: () => void;
  allFoods: FoodItem[];
}) {
  const [quantity, setQuantity] = useState<string>(initialGrams?.toString() || '');
  const [quantityMode, setQuantityMode] = useState<'g/ml' | 'portion'>('g/ml');
  const mediumPortion = getDefaultPortion(foodItem.tags);
  
  // Calculer les valeurs nutritionnelles et points pour la quantité saisie
  const quantityNum = parseFloat(quantity) || 0;
  
  // Calculer le multiplier selon le mode
  let multiplier: number;
  let actualGrams: number;
  
  if (quantityMode === 'portion') {
    // En mode portion, quantityNum = nombre de portions (base = portion medium)
    multiplier = quantityNum;
    actualGrams = quantityNum * mediumPortion.grams;
  } else {
    // En mode g/ml, quantityNum = grammes/ml réels
    multiplier = quantityNum > 0 ? quantityNum / mediumPortion.grams : 1;
    actualGrams = quantityNum;
  }
  const baseCost = computeFoodPoints(foodItem);
  const cost = Math.round(baseCost * Math.sqrt(multiplier));
  
  const calories = Math.round((foodItem.calories_kcal || 0) * multiplier);
  const protein = Math.round((foodItem.protein_g || 0) * multiplier);
  const carbs = Math.round((foodItem.carbs_g || 0) * multiplier);
  const fat = Math.round((foodItem.fat_g || 0) * multiplier);

  const handleConfirm = () => {
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Erreur', 'Veuillez entrer une quantité valide supérieure à 0.');
      return;
    }
    // Retourner les grammes réels + le mode et la valeur originale
    onConfirm(actualGrams, quantityMode, qty);
  };

  return (
    <Modal
      visible={true}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.portionModal}>
        <View style={styles.portionModalContent}>
          <Text style={styles.portionModalTitle}>
            Quantité personnalisée
          </Text>
          <Text style={styles.portionModalSubtitle}>
            {foodItem.name}
          </Text>
          
          {/* Sélecteur de mode */}
          <View style={styles.quantityModeSelector}>
            <TouchableOpacity
              style={[
                styles.quantityModeButton,
                quantityMode === 'g/ml' && styles.quantityModeButtonActive
              ]}
              onPress={() => setQuantityMode('g/ml')}
            >
              <Text style={[
                styles.quantityModeButtonText,
                quantityMode === 'g/ml' && styles.quantityModeButtonTextActive
              ]}>
                {unit}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.quantityModeButton,
                quantityMode === 'portion' && styles.quantityModeButtonActive
              ]}
              onPress={() => setQuantityMode('portion')}
            >
              <Text style={[
                styles.quantityModeButtonText,
                quantityMode === 'portion' && styles.quantityModeButtonTextActive
              ]}>
                Portion
              </Text>
            </TouchableOpacity>
          </View>
          
          <TextInput
            style={styles.customPortionInput}
            placeholder={quantityMode === 'portion' ? 'Ex: 0.5, 1, 2' : `Quantité en ${unit}`}
            placeholderTextColor="#6b7280"
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="decimal-pad"
            autoFocus
          />
          
          {quantityNum > 0 && (
            <View style={styles.customPortionPreview}>
              <Text style={styles.customPortionPreviewTitle}>Aperçu:</Text>
              <Text style={styles.customPortionPreviewText}>
                🔥 {calories} cal · 💪 {protein}g prot · 🍞 {carbs}g gluc · 🧈 {fat}g lipides
              </Text>
              <Text style={styles.customPortionPreviewCost}>
                Coût: {cost} pts
              </Text>
            </View>
          )}
          
          <View style={styles.customPortionActions}>
            <TouchableOpacity
              style={styles.portionModalCancel}
              onPress={onCancel}
            >
              <Text style={styles.portionModalCancelText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.customPortionConfirm}
              onPress={handleConfirm}
              disabled={quantityNum <= 0}
            >
              <Text style={[styles.customPortionConfirmText, quantityNum <= 0 && styles.customPortionConfirmTextDisabled]}>
                Confirmer
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ---- Modal d'édition d'item ----
function EditItemModal({
  editingItem,
  entry,
  onUpdate,
  onCancel,
  allFoods,
  getUnitForFood,
  createCustomPortion,
  getDefaultPortion,
  getPortionsForItem,
  formatPortionLabel,
  computeFoodPoints,
}: {
  editingItem: { entryId: string; itemIndex: number; itemRef: FoodItemRef; foodItem: FoodItem };
  entry: MealEntry;
  onUpdate: (updatedItems: FoodItemRef[]) => void;
  onCancel: () => void;
  allFoods: FoodItem[];
  getUnitForFood: (item: FoodItem) => 'g' | 'ml';
  createCustomPortion: (grams: number, mediumPortion: PortionReference, unit: 'g' | 'ml') => PortionReference;
  getDefaultPortion: (tags: string[]) => PortionReference;
  getPortionsForItem: (tags: string[]) => PortionReference[];
  formatPortionLabel: (portion: PortionReference) => string;
  computeFoodPoints: (fi: FoodItem) => number;
}) {
  const [editMode, setEditMode] = useState<'quantity' | 'replace' | 'delete' | null>(null);
  const [showCustomPortionModal, setShowCustomPortionModal] = useState<{ initialGrams?: number; onConfirm: (grams: number, mode?: 'g/ml' | 'portion', portionValue?: number) => void } | null>(null);
  const [selectedItemForPortion, setSelectedItemForPortion] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [portionCount, setPortionCount] = useState<number>(1); // Nombre de portions (toujours visible)

  const handleUpdateQuantity = (portion: PortionReference) => {
    const unit = getUnitForFood(editingItem.foodItem);
    let quantityHint: string;
    
    if (portion.size === 'custom') {
      // Pour les portions custom, visualRef contient déjà le bon format (ex: "2 portions" ou "150g")
      quantityHint = portion.visualRef;
    } else {
      // Pour les portions prédéfinies
      quantityHint = `${portion.grams}g (${portion.visualRef})`;
    }
    
    const updatedItems = [...(entry.items || [])];
    updatedItems[editingItem.itemIndex] = {
      ...editingItem.itemRef,
      portionSize: portion.size,
      portionGrams: portion.grams,
      multiplier: portion.multiplier,
      quantityHint: quantityHint,
    };
    onUpdate(updatedItems);
  };

  const handleReplaceFood = (newFoodId: string, portion: PortionReference) => {
    const newFood = allFoods.find(f => f.id === newFoodId);
    if (!newFood) return;
    
    let quantityHint: string;
    
    if (portion.size === 'custom') {
      // Pour les portions custom, visualRef contient déjà le bon format (ex: "2 portions" ou "150g")
      quantityHint = portion.visualRef;
    } else {
      // Pour les portions prédéfinies
      quantityHint = `${portion.grams}g (${portion.visualRef})`;
    }
    
    const updatedItems = [...(entry.items || [])];
    updatedItems[editingItem.itemIndex] = {
      foodId: newFoodId,
      portionSize: portion.size,
      portionGrams: portion.grams,
      multiplier: portion.multiplier,
      quantityHint: quantityHint,
    };
    onUpdate(updatedItems);
  };

  const handleDeleteItem = () => {
    if (Platform.OS !== 'web') {
      Alert.alert(
        'Supprimer',
        'Supprimer cet aliment du repas ?',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Supprimer', style: 'destructive', onPress: () => {
            const updatedItems = (entry.items || []).filter((_, idx) => idx !== editingItem.itemIndex);
            onUpdate(updatedItems);
          }},
        ]
      );
      return;
    }
    
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm('Supprimer cet aliment du repas ?');
      if (confirmed) {
        const updatedItems = (entry.items || []).filter((_, idx) => idx !== editingItem.itemIndex);
        onUpdate(updatedItems);
      }
    }
  };

  if (editMode === 'quantity') {
    const mediumPortion = getDefaultPortion(editingItem.foodItem.tags);
    const unit = getUnitForFood(editingItem.foodItem);
    const currentGrams = editingItem.itemRef.portionGrams || mediumPortion.grams;

    return (
      <Modal visible={true} transparent animationType="fade" onRequestClose={onCancel}>
        <View style={styles.portionModal}>
          <View style={styles.portionModalContent}>
            <Text style={styles.portionModalTitle}>Modifier la quantité</Text>
            <Text style={styles.portionModalSubtitle}>{editingItem.foodItem.name}</Text>
            
            {/* Contrôle Portions (toujours visible) */}
            <View style={styles.portionCountControl}>
              <Text style={styles.portionCountLabel}>Portions:</Text>
              <View style={styles.portionCountButtons}>
                <TouchableOpacity
                  style={styles.portionCountButton}
                  onPress={() => setPortionCount(Math.max(0.5, portionCount - 0.5))}
                >
                  <Text style={styles.portionCountButtonText}>−</Text>
                </TouchableOpacity>
                <TextInput
                  style={styles.portionCountInput}
                  value={portionCount.toString()}
                  onChangeText={(text) => {
                    const val = parseFloat(text);
                    if (!isNaN(val) && val > 0) {
                      setPortionCount(val);
                    }
                  }}
                  keyboardType="decimal-pad"
                />
                <TouchableOpacity
                  style={styles.portionCountButton}
                  onPress={() => setPortionCount(portionCount + 0.5)}
                >
                  <Text style={styles.portionCountButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            {getPortionsForItem(editingItem.foodItem.tags).map((portion) => (
              <TouchableOpacity
                key={portion.size}
                style={styles.portionOption}
                onPress={() => {
                  // Appliquer le multiplicateur de portions
                  const finalPortion: PortionReference = {
                    ...portion,
                    grams: portion.grams * portionCount,
                    multiplier: portion.multiplier * portionCount,
                    visualRef: portionCount !== 1 ? `${portionCount} × ${portion.visualRef}` : portion.visualRef,
                  };
                  handleUpdateQuantity(finalPortion);
                  setEditMode(null);
                  setPortionCount(1); // Reset pour prochain item
                }}
              >
                <Text style={styles.portionOptionLabel}>{formatPortionLabel(portion)}</Text>
                <Text style={styles.portionOptionCost}>
                  {Math.round(computeFoodPoints(editingItem.foodItem) * Math.sqrt(portion.multiplier * portionCount))} pts
                </Text>
              </TouchableOpacity>
            ))}
            
            <TouchableOpacity
              style={styles.portionOption}
              onPress={() => {
                setShowCustomPortionModal({
                  initialGrams: currentGrams,
                  onConfirm: (grams: number, mode?: 'g/ml' | 'portion', portionValue?: number) => {
                    let customPortion: PortionReference;
                    
                    if (mode === 'portion' && portionValue !== undefined) {
                      // Mode portion: utiliser createPortionCustomPortion
                      customPortion = createPortionCustomPortion(portionValue, mediumPortion, unit);
                    } else {
                      // Mode g/ml: utiliser createCustomPortion classique
                      customPortion = createCustomPortion(grams, mediumPortion, unit);
                    }
                    
                    // Appliquer le multiplicateur de portions sur la portion finale
                    const finalPortion: PortionReference = {
                      ...customPortion,
                      grams: customPortion.grams * portionCount,
                      multiplier: customPortion.multiplier * portionCount,
                      visualRef: portionCount !== 1 ? `${portionCount} × ${customPortion.visualRef}` : customPortion.visualRef,
                    };
                    
                    handleUpdateQuantity(finalPortion);
                    setShowCustomPortionModal(null);
                    setEditMode(null);
                    setPortionCount(1); // Reset pour prochain item
                  },
                });
              }}
            >
              <Text style={styles.portionOptionLabel}>📝 Quantité personnalisée</Text>
              <Text style={styles.portionOptionCost}>{unit}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.portionModalCancel} onPress={() => {
              setEditMode(null);
              setPortionCount(1); // Reset pour prochain item
            }}>
              <Text style={styles.portionModalCancelText}>Retour</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {showCustomPortionModal && (
          <CustomPortionModal
            foodItem={editingItem.foodItem}
            unit={unit}
            initialGrams={showCustomPortionModal.initialGrams}
            onConfirm={showCustomPortionModal.onConfirm}
            onCancel={() => setShowCustomPortionModal(null)}
            allFoods={allFoods}
          />
        )}
      </Modal>
    );
  }

  if (editMode === 'replace') {
    // Filtrer les aliments en fonction du texte de recherche
    const normalizeString = (str: string) => {
      return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, ''); // Retirer les accents
    };
    
    const filteredFoods = searchText.trim() === ''
      ? allFoods.slice(0, 50) // Par défaut, montrer les 50 premiers
      : allFoods.filter(food => {
          const normalizedSearch = normalizeString(searchText);
          const normalizedName = normalizeString(food.name);
          const normalizedTags = food.tags ? food.tags.map(normalizeString).join(' ') : '';
          return normalizedName.includes(normalizedSearch) || normalizedTags.includes(normalizedSearch);
        }).slice(0, 50); // Limiter à 50 résultats
    
    return (
      <Modal visible={true} transparent animationType="fade" onRequestClose={onCancel}>
        <View style={styles.portionModal}>
          <View style={[styles.portionModalContent, { maxHeight: '80%' }]}>
            <Text style={styles.portionModalTitle}>Remplacer l'aliment</Text>
            <Text style={styles.portionModalSubtitle}>Recherche ou sélectionne un aliment</Text>
            
            {/* Barre de recherche */}
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher un aliment..."
              placeholderTextColor="#6b7280"
              value={searchText}
              onChangeText={setSearchText}
              autoFocus={true}
              autoCapitalize="none"
              autoCorrect={false}
            />
            
            {filteredFoods.length === 0 ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ color: '#9ca3af', fontSize: 14 }}>Aucun aliment trouvé</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 400 }}>
                {filteredFoods.map((food) => (
                  <TouchableOpacity
                    key={food.id}
                    style={styles.portionOption}
                    onPress={() => {
                      setSelectedItemForPortion(food.id);
                      setSearchText(''); // Reset la recherche
                    }}
                  >
                    <Text style={styles.portionOptionLabel}>{food.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            
            <TouchableOpacity style={styles.portionModalCancel} onPress={() => {
              setEditMode(null);
              setSearchText(''); // Reset la recherche en fermant
            }}>
              <Text style={styles.portionModalCancelText}>Retour</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {selectedItemForPortion && (
          <View style={styles.portionModal}>
            <View style={styles.portionModalContent}>
              <Text style={styles.portionModalTitle}>Choisis la portion</Text>
              <Text style={styles.portionModalSubtitle}>
                {allFoods.find(f => f.id === selectedItemForPortion)?.name}
              </Text>
              
              {/* Contrôle Portions (toujours visible) */}
              <View style={styles.portionCountControl}>
                <Text style={styles.portionCountLabel}>Portions:</Text>
                <View style={styles.portionCountButtons}>
                  <TouchableOpacity
                    style={styles.portionCountButton}
                    onPress={() => setPortionCount(Math.max(0.5, portionCount - 0.5))}
                  >
                    <Text style={styles.portionCountButtonText}>−</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.portionCountInput}
                    value={portionCount.toString()}
                    onChangeText={(text) => {
                      const val = parseFloat(text);
                      if (!isNaN(val) && val > 0) {
                        setPortionCount(val);
                      }
                    }}
                    keyboardType="decimal-pad"
                  />
                  <TouchableOpacity
                    style={styles.portionCountButton}
                    onPress={() => setPortionCount(portionCount + 0.5)}
                  >
                    <Text style={styles.portionCountButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              {getPortionsForItem(
                allFoods.find(f => f.id === selectedItemForPortion)?.tags || []
              ).map((portion) => (
                <TouchableOpacity
                  key={portion.size}
                  style={styles.portionOption}
                  onPress={() => {
                    // Appliquer le multiplicateur de portions
                    const finalPortion: PortionReference = {
                      ...portion,
                      grams: portion.grams * portionCount,
                      multiplier: portion.multiplier * portionCount,
                      visualRef: portionCount !== 1 ? `${portionCount} × ${portion.visualRef}` : portion.visualRef,
                    };
                    handleReplaceFood(selectedItemForPortion, finalPortion);
                    setSelectedItemForPortion(null);
                    setEditMode(null);
                    setPortionCount(1); // Reset pour prochain item
                  }}
                >
                  <Text style={styles.portionOptionLabel}>{formatPortionLabel(portion)}</Text>
                  <Text style={styles.portionOptionCost}>
                    {Math.round(computeFoodPoints(allFoods.find(f => f.id === selectedItemForPortion)!) * Math.sqrt(portion.multiplier * portionCount))} pts
                  </Text>
                </TouchableOpacity>
              ))}
              
              <TouchableOpacity
                style={styles.portionModalCancel}
                onPress={() => {
                  setSelectedItemForPortion(null);
                  setPortionCount(1); // Reset pour prochain item
                }}
              >
                <Text style={styles.portionModalCancelText}>Retour</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>
    );
  }

  return (
    <Modal visible={true} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.portionModal}>
        <View style={styles.portionModalContent}>
          <Text style={styles.portionModalTitle}>Modifier l'aliment</Text>
          <Text style={styles.portionModalSubtitle}>{editingItem.foodItem.name}</Text>
          
          <TouchableOpacity
            style={styles.portionOption}
            onPress={() => setEditMode('quantity')}
          >
            <Text style={styles.portionOptionLabel}>📏 Modifier la quantité</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.portionOption}
            onPress={() => setEditMode('replace')}
          >
            <Text style={styles.portionOptionLabel}>🔄 Remplacer l'aliment</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.portionOption, { backgroundColor: '#dc2626', borderColor: '#991b1b' }]}
            onPress={handleDeleteItem}
          >
            <Text style={[styles.portionOptionLabel, { color: '#fff' }]}>🗑️ Supprimer</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.portionModalCancel} onPress={onCancel}>
            <Text style={styles.portionModalCancelText}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
  headerRightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerVersion: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '600',
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
  requestText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  settingsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
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
    minHeight: 44,
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
    minHeight: 44,
    minWidth: 44,
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
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#0b1220',
  },
  historyItemRowToday: {
    backgroundColor: '#1e3a8a',
    borderWidth: 2,
    borderColor: '#3b82f6',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  historyItemRowYesterday: {
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
    opacity: 0.7,
  },
  historyItemRowOther: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    opacity: 0.5,
  },
  historyItemContent: {
    flex: 1,
    flexDirection: 'column',
    gap: 4,
  },
  historyItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyItem: {
    color: '#e5e7eb',
    fontSize: 14,
    flex: 1,
    fontWeight: '500',
  },
  historyItemToday: {
    color: '#fbbf24',
    fontWeight: '700',
  },
  historyItemYesterday: {
    color: '#d1d5db',
    fontWeight: '500',
  },
  historyItemOther: {
    color: '#9ca3af',
    fontWeight: '400',
  },
  historyItemDate: {
    color: '#9ca3af',
    fontSize: 11,
    marginLeft: 8,
  },
  historyItemDateToday: {
    color: '#93c5fd',
    fontWeight: '600',
  },
  historyItemDateYesterday: {
    color: '#6b7280',
    fontWeight: '400',
  },
  historyItemDateOther: {
    color: '#4b5563',
    fontWeight: '400',
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
  historyItemCostCheat: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  historyExpandButton: {
    padding: 4,
  },
  historyExpandText: {
    color: '#60a5fa',
    fontSize: 18,
    fontWeight: 'bold',
  },
  historyReuseButton: {
    padding: 4,
  },
  historyReuseText: {
    color: '#3b82f6',
    fontSize: 18,
    fontWeight: 'bold',
  },
  historyDeleteButton: {
    padding: 4,
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
  searchContainer: {
    width: '100%',
    marginBottom: 8,
  },
  scanButton: {
    width: '100%',
    backgroundColor: '#8b5cf6',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  },
  autocompleteList: {
    width: '100%',
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4b5563',
    marginBottom: 16,
    padding: 8,
    maxHeight: 400,
  },
  autocompleteListTitle: {
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  autocompleteItem: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  autocompleteItemDisabled: {
    opacity: 0.5,
  },
  autocompleteItemContent: {
    flexDirection: 'column',
  },
  autocompleteItemName: {
    color: '#e5e7eb',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  autocompleteItemNameDisabled: {
    color: '#9ca3af',
  },
  autocompleteItemInfo: {
    color: '#9ca3af',
    fontSize: 12,
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
  cheatDayButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#1f2937',
    borderWidth: 2,
    borderColor: '#f59e0b',
    marginBottom: 16,
    alignItems: 'center',
  },
  cheatDayButtonActive: {
    backgroundColor: '#f59e0b33',
    borderColor: '#f59e0b',
  },
  cheatDayButtonDisabled: {
    opacity: 0.6,
    borderColor: '#6b7280',
  },
  cheatDayButtonText: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '600',
  },
  cheatDayButtonTextActive: {
    color: '#fbbf24',
  },
  cheatDayButtonTextDisabled: {
    color: '#9ca3af',
  },
  cheatDayButtonSubtext: {
    color: '#f59e0b',
    fontSize: 11,
    marginTop: 4,
    opacity: 0.8,
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
    minHeight: 44,
  },
  cancelText: {
    color: '#e5e7eb',
  },
  saveBtn: {
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    minHeight: 44,
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
  portionModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    ...(Platform.OS === 'web' && {
      position: 'fixed' as any,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 9999,
    }),
  },
  portionModal: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    borderWidth: 2,
    borderColor: '#3b82f6',
    ...(Platform.OS === 'web' && {
      position: 'relative' as any,
      margin: 'auto',
      zIndex: 10000,
    }),
  },
  portionModalContent: {
    ...(Platform.OS === 'web' && {
      maxHeight: '90vh',
      overflowY: 'auto' as any,
    }),
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
  portionCountControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  portionCountLabel: {
    color: '#e5e7eb',
    fontSize: 16,
    fontWeight: '600',
  },
  portionCountButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  portionCountButton: {
    backgroundColor: '#374151',
    borderRadius: 8,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4b5563',
  },
  portionCountButtonText: {
    color: '#e5e7eb',
    fontSize: 20,
    fontWeight: '700',
  },
  portionCountInput: {
    backgroundColor: '#020617',
    borderColor: '#4b5563',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    color: '#e5e7eb',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    minWidth: 60,
  },
  searchInput: {
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 12,
    color: '#e5e7eb',
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#4b5563',
  },
  quantityModeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  quantityModeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#374151',
    borderWidth: 2,
    borderColor: '#4b5563',
    alignItems: 'center',
  },
  quantityModeButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#2563eb',
  },
  quantityModeButtonText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '600',
  },
  quantityModeButtonTextActive: {
    color: '#ffffff',
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
    minHeight: 44,
    minWidth: 44,
  },
  portionModalCancelText: {
    color: '#9ca3af',
    fontSize: 16,
    fontWeight: '600',
  },
  customPortionInput: {
    width: '100%',
    backgroundColor: '#020617',
    borderColor: '#4b5563',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#f9fafb',
    fontSize: 16,
    marginTop: 16,
    marginBottom: 16,
  },
  customPortionPreview: {
    backgroundColor: '#111827',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  customPortionPreviewTitle: {
    color: '#e5e7eb',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  customPortionPreviewText: {
    color: '#9ca3af',
    fontSize: 13,
    marginBottom: 4,
  },
  customPortionPreviewCost: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: '600',
  },
  customPortionActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
  },
  customPortionConfirm: {
    flex: 1,
    backgroundColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  customPortionConfirmText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  customPortionConfirmTextDisabled: {
    color: '#6b7280',
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
  historyItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  historyItemHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    flex: 1,
    gap: 8,
  },
  cheatMealBadge: {
    backgroundColor: '#f59e0b33',
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 4,
  },
  cheatMealBadgeText: {
    color: '#fbbf24',
    fontSize: 10,
    fontWeight: '600',
  },
  historyItemsDetail: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  historyItemDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  historyItemDetailInfo: {
    flex: 1,
  },
  historyItemDetailName: {
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  historyItemDetailQuantity: {
    color: '#10b981',
    fontSize: 12,
    marginBottom: 2,
  },
  historyItemDetailNutrition: {
    color: '#9ca3af',
    fontSize: 11,
  },
  historyItemEditButton: {
    backgroundColor: '#3b82f6',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  historyItemEditText: {
    color: '#fff',
    fontSize: 14,
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
  foodListContainer: {
    width: '100%',
    marginBottom: 16,
    gap: 8,
  },
  foodItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#4b5563',
  },
  foodItemBtnSelected: {
    backgroundColor: '#1e3a8a',
    borderColor: '#3b82f6',
    borderWidth: 2,
  },
  foodItemBtnDisabled: {
    opacity: 0.5,
  },
  foodItemContent: {
    flex: 1,
  },
  foodItemName: {
    color: '#e5e7eb',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  foodItemNameSelected: {
    color: '#93c5fd',
  },
  foodItemInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  foodItemNutrition: {
    color: '#9ca3af',
    fontSize: 12,
  },
  foodItemCost: {
    color: '#10b981',
    fontSize: 13,
    fontWeight: '600',
  },
  foodItemCostDisabled: {
    color: '#6b7280',
  },
  foodItemSelectedIcon: {
    color: '#22c55e',
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 8,
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
