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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import {
  MealEntry,
  DragonStatus,
  computeDragonState,
  computeScore7Jours,
  computeStreak,
  mapManualCategoryToScore,
  normalizeDate,
} from '../../lib/stats';
import { classifyMealByItems, FoodItemRef } from '../../lib/classifier';
import { QUICK_ITEMS, QUICK_MEALS } from '../../lib/presets';
import { FOOD_DB, type FoodItem } from '../../lib/food-db';
import {
  initNotificationsIfAllowed,
  requestNotifPermission,
  scheduleDailyDragonReminders,
} from '../../lib/notifications';
import { getCanadaGuideRecommendations } from '../../lib/recommendations';
import { computeDailyTotals, DEFAULT_TARGETS, percentageOfTarget } from '../../lib/nutrition';
import { UserProfile } from '../../lib/types';
import { getDailyCalorieTarget } from '../../lib/points-calculator';
import { getSmartRecommendations, getHungerAnalysis, SmartRecommendation } from '../../lib/smart-recommendations';
import { getPortionsForItem, getDefaultPortion, formatPortionLabel, PortionReference } from '../../lib/portions';
import { getDragonLevel, getPointsToNextLevel } from '../../lib/dragon-levels';
import { DragonSprite } from '../../components/dragon-sprite';
import { StreakCalendar } from '../../components/streak-calendar';
import { useAuth } from '../../lib/auth-context';

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

function computeFoodPoints(fi: FoodItem): number {
  // Si l'item a déjà un coût explicite, l'utiliser
  if (typeof fi.points === 'number') return fi.points;
  
  // Nouvelle formule basée sur les calories (plus cohérente)
  const cal = fi.calories_kcal ?? 150;
  
  // Les protéines maigres et légumes sont gratuits
  if (fi.tags.includes('proteine_maigre') || fi.tags.includes('legume')) {
    return 0;
  }
  
  // Base: calories divisées par 100 (100 cal = ~1 point)
  let baseCost = cal / 100;
  
  // Ajustements selon les tags
  if (fi.tags.includes('ultra_transforme')) {
    baseCost *= 1.5; // 50% plus cher
  }
  
  if (fi.tags.includes('gras_frit')) {
    baseCost *= 1.3; // 30% plus cher
  }
  
  if (fi.tags.includes('sucre') && cal > 100) {
    baseCost *= 1.2; // 20% plus cher
  }
  
  // Grains complets sont légèrement avantagés
  if (fi.tags.includes('grain_complet')) {
    baseCost *= 0.8;
  }
  
  return Math.max(0, Math.round(baseCost));
}

// ---- Composant principal ----
export default function App() {
  const { profile: authProfile, user: authUser, loading: authLoading } = useAuth();
  const [screen, setScreen] = useState<'home' | 'add'>('home');
  const [entries, setEntries] = useState<MealEntry[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [points, setPoints] = useState<number>(0);
  const [totalPointsEarned, setTotalPointsEarned] = useState<number>(0); // Points totaux pour le niveau du dragon
  const [lastClaimDate, setLastClaimDate] = useState<string>('');
  const [targets, setTargets] = useState(DEFAULT_TARGETS);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [preselectedItem, setPreselectedItem] = useState<{ item: FoodItem; portion: PortionSize } | null>(null);

  // Utiliser le profil du contexte Auth
  useEffect(() => {
    if (!authLoading && authProfile) {
      setUserProfile(authProfile);
      
      // Mettre à jour les targets nutrition selon le profil
      const dailyCalTarget = getDailyCalorieTarget(authProfile.weeklyCalorieTarget);
      setTargets((prev) => ({
        ...prev,
        calories_kcal: dailyCalTarget,
      }));
    }
    // Note: Ne pas rediriger ici - AuthProvider gère le routage
  }, [authProfile, authLoading]);

  // Helpers: clés par compte - Debug log
  const currentUserId = (authProfile?.userId || (authUser as any)?.id || 'guest');
  
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
  useEffect(() => {
    // Attendre que le profil soit chargé
    if (authLoading || !currentUserId || currentUserId === 'guest') {
      console.log('[Index] Waiting for user, currentUserId:', currentUserId);
      return;
    }
    
    const load = async () => {
      try {
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
    if (authLoading || !currentUserId || currentUserId === 'guest') return;
    
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
              dairy_servings: Number(parsed.dairy_servings) || DEFAULT_TARGETS.dairy_servings,
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
  const dragonState = computeDragonState(dayFeeds);
  const streak = computeStreak(dayFeeds);
  const recommendations = getCanadaGuideRecommendations(entries);
  const todayTotals = computeDailyTotals(entries, new Date().toISOString());

  // Points: charger et créditer quotidiennement (utiliser le profil si disponible)
  useEffect(() => {
    const loadPoints = async () => {
      if (!userProfile || authLoading || !currentUserId || currentUserId === 'guest') {
        console.log('[Index] loadPoints waiting - userProfile:', !!userProfile, 'currentUserId:', currentUserId);
        return;
      }
      
      const today = new Date().toISOString().slice(0, 10);
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
          if (last !== today) {
            balance = Math.min(maxCapFromProfile, balance + dailyPointsFromProfile);
            await AsyncStorage.setItem(pointsKey, JSON.stringify({ balance, lastClaimDate: today }));
            
            // Incrémenter les points totaux
            const newTotal = (JSON.parse(totalRaw || '0')) + dailyPointsFromProfile;
            setTotalPointsEarned(newTotal);
            await AsyncStorage.setItem(totalKey, JSON.stringify(newTotal));
          }
          setPoints(balance);
          setLastClaimDate(today);
        } else {
          console.log('[Index] No points found, initializing for user:', currentUserId);
          const initBalance = INITIAL_POINTS;
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

  // Sauvegarder à chaque changement - SEULEMENT si on a un vrai userId
  useEffect(() => {
    const save = async () => {
      // Ne pas sauvegarder si userId pas encore chargé
      if (!currentUserId || currentUserId === 'guest') {
        console.log('[Index] Skip save - no valid userId yet');
        return;
      }
      try {
        const key = getEntriesKey();
        console.log('[Index] Saving entries to key:', key, 'count:', entries.length);
        await AsyncStorage.setItem(key, JSON.stringify(entries));
      } catch (e) {
        console.log('Erreur sauvegarde AsyncStorage', e);
      }
    };
    if (isReady && currentUserId && currentUserId !== 'guest') {
      save();
    }
  }, [entries, isReady, currentUserId]);

  const handleAddEntry = (entry: Omit<MealEntry, 'id' | 'createdAt'> & { score?: number }) => {
    const newEntry: MealEntry = {
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      ...entry,
      score: typeof entry.score === 'number' ? entry.score : mapManualCategoryToScore(entry.category),
    };
    setEntries((prev) => [newEntry, ...prev]);
    setScreen('home');
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
          stats={stats}
          dragonState={dragonState}
          streak={streak}
          recommendations={recommendations}
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
}: {
  entries: MealEntry[];
  onPressAdd: () => void;
  stats: StatsUI;
  dragonState: DragonStatus;
  streak: ReturnType<typeof computeStreak>;
  recommendations: ReturnType<typeof getCanadaGuideRecommendations>;
  todayTotals: ReturnType<typeof computeDailyTotals>;
  targets: typeof DEFAULT_TARGETS;
  onSaveTargets: (next: typeof DEFAULT_TARGETS) => void | Promise<void>;
  points: number;
  totalPointsEarned: number;
  userProfile: UserProfile | null;
  setPreselectedItem: (item: { item: FoodItem; portion: PortionSize } | null) => void;
}) {
  const [isEditingTargets, setIsEditingTargets] = useState(false);
  const [draftTargets, setDraftTargets] = useState({
    protein_g: targets.protein_g.toString(),
    carbs_g: targets.carbs_g.toString(),
    calories_kcal: targets.calories_kcal.toString(),
    dairy_servings: targets.dairy_servings.toString(),
  });

  useEffect(() => {
    setDraftTargets({
      protein_g: targets.protein_g.toString(),
      carbs_g: targets.carbs_g.toString(),
      calories_kcal: targets.calories_kcal.toString(),
      dairy_servings: targets.dairy_servings.toString(),
    });
  }, [targets]);

  const handleSaveTargets = async () => {
    const next = {
      protein_g: Number(draftTargets.protein_g) || targets.protein_g,
      carbs_g: Number(draftTargets.carbs_g) || targets.carbs_g,
      calories_kcal: Number(draftTargets.calories_kcal) || targets.calories_kcal,
      dairy_servings: Number(draftTargets.dairy_servings) || targets.dairy_servings,
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
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  
  // Get time of day for context-aware suggestions
  const getTimeOfDay = (): 'morning' | 'afternoon' | 'evening' => {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'evening';
  };
  
  const smartRecs = showHungryMode 
    ? getSmartRecommendations(todayTotals, targets, points, getTimeOfDay())
    : [];
  const hungerAnalysis = getHungerAnalysis(todayTotals, targets);

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
        totalPoints={totalPointsEarned}
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
          <View style={styles.budgetRow}>
            <View style={styles.budgetCol}>
              <Text style={styles.budgetLabel}>Quotidien</Text>
              <Text style={styles.budgetValue}>{dailyBudget} pts</Text>
            </View>
            <View style={styles.budgetCol}>
              <Text style={styles.budgetLabel}>Maximum</Text>
              <Text style={styles.budgetValue}>{maxCap} pts</Text>
            </View>
            <View style={styles.budgetCol}>
              <Text style={styles.budgetLabel}>Disponible</Text>
              <Text style={[styles.budgetValue, styles.budgetCurrent]}>{points} pts</Text>
            </View>
          </View>
          <View style={styles.budgetProgressTrack}>
            <View 
              style={[
                styles.budgetProgressBar, 
                { width: `${Math.min(100, (points / maxCap) * 100)}%` }
              ]} 
            />
          </View>
        </View>
      )}

      <Text style={styles.statsText}>
        7 derniers jours : {stats.label} ({stats.scorePct}%)
      </Text>

      <Text style={styles.streakText}>
        Streak actuel: {streak.currentStreakDays} jour(s) · Meilleurs: {streak.longestStreakDays} · Jours nourris: {streak.totalFedDays}
      </Text>

      {/* Bonus de streak */}
      {streak.streakBonusEarned > 0 && (
        <View style={styles.streakBonusBox}>
          <Text style={styles.streakBonusTitle}>🔥 Bonus Streak!</Text>
          <Text style={styles.streakBonusText}>
            Tu as complété {streak.streakBonusEarned} série{streak.streakBonusEarned > 1 ? 's' : ''} de 7 jours!
          </Text>
          {streak.isStreakBonusDay && (
            <Text style={styles.streakBonusSpecial}>
              🎉 Félicitations! Tu viens de compléter une série de 7 jours!
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
        onPress={() => setShowHungryMode(!showHungryMode)}
      >
        <Text style={styles.hungryButtonText}>
          {showHungryMode ? '✕ Fermer' : '🍴 J\'ai faim - Aide-moi à choisir!'}
        </Text>
      </TouchableOpacity>
      
      {/* Smart recommendations quand activé */}
      {showHungryMode && (
        <View style={styles.smartRecsBox}>
          <Text style={styles.smartRecsTitle}>🤖 Suggestions Intelligentes</Text>
          <Text style={styles.smartRecsAnalysis}>{hungerAnalysis}</Text>
          
          {smartRecs.length === 0 ? (
            <Text style={styles.smartRecsEmpty}>
              Aucune suggestion pour l&apos;instant. Tu es peut-être proche de ton objectif! 🎯
            </Text>
          ) : (
            <>
              <Text style={styles.smartRecsSubtitle}>Recommandé pour toi:</Text>
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
                  <Text style={styles.smartRecReason}>{rec.reason}</Text>
                  <Text style={styles.smartRecNutrition}>
                    {rec.suggestedGrams}g ({rec.suggestedVisualRef}) · {rec.item.calories_kcal || 0} cal · {rec.item.protein_g || 0}g protéines
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
          {recommendations.map((rec) => (
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

      {/* Calendrier des streaks */}
      <StreakCalendar entries={entries} weeksToShow={12} />

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
        <NutritionBar label="Protéines" value={todayTotals.protein_g} unit="g" pct={percentageOfTarget(todayTotals.protein_g, targets.protein_g)} color="#22c55e" target={targets.protein_g} />
        <NutritionBar label="Glucides" value={todayTotals.carbs_g} unit="g" pct={percentageOfTarget(todayTotals.carbs_g, targets.carbs_g)} color="#3b82f6" target={targets.carbs_g} />
        <NutritionBar label="Calories" value={todayTotals.calories_kcal} unit="kcal" pct={percentageOfTarget(todayTotals.calories_kcal, targets.calories_kcal)} color="#f59e0b" target={targets.calories_kcal} />
        <NutritionBar label="Produits laitiers" value={todayTotals.dairy_servings} unit="portion(s)" pct={percentageOfTarget(todayTotals.dairy_servings, targets.dairy_servings)} color="#a78bfa" target={targets.dairy_servings} />

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
              <Text style={styles.targetLabel}>Produits laitiers (portions)</Text>
              <TextInput
                style={styles.targetInput}
                keyboardType="numeric"
                value={draftTargets.dairy_servings}
                onChangeText={(t) => setDraftTargets((prev) => ({ ...prev, dairy_servings: t.replace(',', '.') }))}
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
            data={entries.slice(0, 5)}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Text style={styles.historyItem}>
                • [{item.category}] {item.label}
              </Text>
            )}
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
}: {
  onCancel: () => void;
  onSave: (entry: Omit<MealEntry, 'id' | 'createdAt'>) => void;
  points: number;
  spendPoints: (cost: number) => Promise<void> | void;
  todayTotals: ReturnType<typeof computeDailyTotals>;
  targets: typeof DEFAULT_TARGETS;
  preselectedItem: { item: FoodItem; portion: PortionSize } | null;
}) {
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState<MealEntry['category']>('sain');
  const [items, setItems] = useState<FoodItemRef[]>([]);
  const [quickFilter, setQuickFilter] = useState<CategoryFilter>('all');
  const [selectedItemForPortion, setSelectedItemForPortion] = useState<string | null>(null); // Item ID pour modal portion

  const selectionNutrition = useMemo(() => {
    return items.reduce(
      (acc, ref) => {
        const fi = FOOD_DB.find((f) => f.id === ref.foodId);
        const multiplier = ref.multiplier || 1.0;
        return {
          protein_g: acc.protein_g + (fi.protein_g || 0) * multiplier,
          carbs_g: acc.carbs_g + (fi.carbs_g || 0) * multiplier,
          calories_kcal: acc.calories_kcal + (fi.calories_kcal || 0) * multiplier,
          dairy_servings: acc.dairy_servings + (fi.dairy_serving || 0) * multiplier,
        };
      },
      { protein_g: 0, carbs_g: 0, calories_kcal: 0, dairy_servings: 0 }
    );
  }, [items]);

  const pendingCost = items.reduce((sum, ref) => {
    const fi = QUICK_ITEMS.find((f) => f.id === ref.foodId);
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
      const fi = QUICK_ITEMS.find((f) => f.id === foodId);
      if (!fi) return prev;
      
      setSelectedItemForPortion(foodId);
      return prev; // Ne pas ajouter tout de suite
    });
  };
  
  const addItemWithPortion = (foodId: string, portion: PortionReference) => {
    const fi = QUICK_ITEMS.find((f) => f.id === foodId);
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
      addItemWithPortion(preselectedItem.item.id, {
        size: portion.size,
        grams: portion.grams,
        visualRef: portion.visualRef,
        multiplier: portion.multiplier,
      });
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
  const filteredItems = QUICK_ITEMS.filter((fi) => {
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

  const handleSave = () => {
    // Auto-generate label if empty but items selected
    let finalLabel = label.trim();
    if (!finalLabel && items.length > 0) {
      finalLabel = items.map(it => FOOD_DB.find(f => f.id === it.foodId)?.name || it.foodId).join(', ');
    }
    if (!finalLabel) return; // Still need at least items or text
    
    const classification = items.length > 0 ? classifyMealByItems(items) : { score: mapManualCategoryToScore(category), category };
    onSave({ label: finalLabel, category: classification.category, score: classification.score, items });
    spendPoints(pendingCost);
  };

  return (
    <ScrollView style={styles.inner} contentContainerStyle={styles.innerContent}>
      <Text style={styles.logo}>Partager avec Toki</Text>

      <TextInput
        style={styles.input}
        placeholder="Ex: poulet + légumes, poutine, bière..."
        placeholderTextColor="#6b7280"
        value={label}
        onChangeText={setLabel}
      />

      {/* Suggestions de recherche */}
      {searchLower && filteredItems.length > 0 && (
        <View style={styles.suggestionsBox}>
          <Text style={styles.suggestionsTitle}>Suggestions</Text>
          {filteredItems.slice(0, 6).map((fi) => {
            const cost = computeFoodPoints(fi as any);
            return (
              <TouchableOpacity
                key={fi.id}
                style={styles.suggestionItem}
                onPress={() => {
                  setLabel(fi.name);
                }}
              >
                <Text style={styles.suggestionItemName}>{fi.name}</Text>
                <Text style={styles.suggestionItemCost}>{cost} pts</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

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
              const fi = FOOD_DB.find(f => f.id === itemRef.foodId);
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
            dairy_servings: fi.dairy_serving || 0,
          };
          const projected = {
            protein_g: todayTotals.protein_g + selectionNutrition.protein_g + (selected ? 0 : macros.protein_g),
            carbs_g: todayTotals.carbs_g + selectionNutrition.carbs_g + (selected ? 0 : macros.carbs_g),
            calories_kcal: todayTotals.calories_kcal + selectionNutrition.calories_kcal + (selected ? 0 : macros.calories_kcal),
            dairy_servings: todayTotals.dairy_servings + selectionNutrition.dairy_servings + (selected ? 0 : macros.dairy_servings),
          };
          const overTargets =
            projected.protein_g > targets.protein_g ||
            projected.carbs_g > targets.carbs_g ||
            projected.calories_kcal > targets.calories_kcal ||
            projected.dairy_servings > targets.dairy_servings;
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
              const fi = FOOD_DB.find((f) => f.id === ref.foodId);
              if (!fi) return acc;
              return {
                protein_g: acc.protein_g + (fi.protein_g || 0),
                carbs_g: acc.carbs_g + (fi.carbs_g || 0),
                calories_kcal: acc.calories_kcal + (fi.calories_kcal || 0),
                dairy_servings: acc.dairy_servings + (fi.dairy_serving || 0),
              };
            },
            { protein_g: 0, carbs_g: 0, calories_kcal: 0, dairy_servings: 0 }
          );
          const projected = {
            protein_g: todayTotals.protein_g + selectionNutrition.protein_g + macrosSum.protein_g,
            carbs_g: todayTotals.carbs_g + selectionNutrition.carbs_g + macrosSum.carbs_g,
            calories_kcal: todayTotals.calories_kcal + selectionNutrition.calories_kcal + macrosSum.calories_kcal,
            dairy_servings: todayTotals.dairy_servings + selectionNutrition.dairy_servings + macrosSum.dairy_servings,
          };
          const overTargets =
            projected.protein_g > targets.protein_g ||
            projected.carbs_g > targets.carbs_g ||
            projected.calories_kcal > targets.calories_kcal ||
            projected.dairy_servings > targets.dairy_servings;
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
              {QUICK_ITEMS.find(f => f.id === selectedItemForPortion)?.name}
            </Text>
            
            {getPortionsForItem(
              QUICK_ITEMS.find(f => f.id === selectedItemForPortion)?.tags || []
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
                      QUICK_ITEMS.find(f => f.id === selectedItemForPortion)!
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
  innerContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 24,
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
  historyItem: {
    color: '#d1d5db',
    fontSize: 14,
    marginVertical: 2,
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
