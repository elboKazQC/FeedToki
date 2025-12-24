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

type StatsUI = {
  scorePct: number;
  label: string;
  level: 1 | 2 | 3;
};

type CategoryFilter = 'all' | 'sain' | 'ok' | 'cheat';

const STORAGE_KEY = 'feedtoki_entries_v1';
const POINTS_KEY = 'feedtoki_points_v2'; // v2 pour reset
const TARGETS_KEY = 'feedtoki_targets_v1';
const DAILY_POINTS = 3; // Points quotidiens fixes
const MAX_POINTS = 12; // Cap d'accumulation strict
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
  // Heuristic: calories + carbs + transformation level; sugar/ultra tags add a bit; healthy items return 0.
  const cat = scoreToCategory(fi.baseScore);
    if (typeof fi.points === 'number') return fi.points;
    if (cat === 'sain') return 0;
  const cal = fi.calories_kcal ?? 200;
  const carbs = fi.carbs_g ?? 0;
  const sugarBoost = fi.tags.includes('sucre') ? 1.5 : 0;
  const ultraBoost = fi.tags.includes('ultra_transforme') ? 1.5 : 0;
  const basePenalty = Math.max(0, (100 - fi.baseScore) / 20); // up to ~5
  const raw = cal / 150 + carbs / 50 + sugarBoost + ultraBoost + basePenalty;
  return Math.max(0, Math.round(raw));
}

// ---- Composant principal ----
export default function App() {
  const [screen, setScreen] = useState<'home' | 'add'>('home');
  const [entries, setEntries] = useState<MealEntry[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [points, setPoints] = useState<number>(0);
  const [lastClaimDate, setLastClaimDate] = useState<string>('');
  const [targets, setTargets] = useState(DEFAULT_TARGETS);

  // Charger les entrées au démarrage
  useEffect(() => {
    const load = async () => {
      try {
        const json = await AsyncStorage.getItem(STORAGE_KEY);
        if (json) {
          const parsed = JSON.parse(json);
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
        }
      } catch (e) {
        console.log('Erreur chargement AsyncStorage', e);
      } finally {
        setIsReady(true);
      }
    };
    load();
  }, []);

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
    const loadTargets = async () => {
      try {
        const raw = await AsyncStorage.getItem(TARGETS_KEY);
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
  }, []);

  // Calculer streak et stats avant de les utiliser
  const dayFeeds = useMemo(() => buildDayFeeds(entries), [entries]);
  const score7 = computeScore7Jours(entries);
  const stats = mapScore7ToStatsUI(score7.score);
  const dragonState = computeDragonState(dayFeeds);
  const streak = computeStreak(dayFeeds);
  const recommendations = getCanadaGuideRecommendations(entries);
  const todayTotals = computeDailyTotals(entries, new Date().toISOString());

  // Points: charger et créditer quotidiennement
  useEffect(() => {
    const loadPoints = async () => {
      const today = new Date().toISOString().slice(0, 10);
      try {
        const raw = await AsyncStorage.getItem(POINTS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          let balance = parsed.balance ?? 0;
          const last = parsed.lastClaimDate ?? '';
          if (last !== today) {
            balance = Math.min(MAX_POINTS, balance + DAILY_POINTS);
            await AsyncStorage.setItem(POINTS_KEY, JSON.stringify({ balance, lastClaimDate: today }));
          }
          setPoints(balance);
          setLastClaimDate(today);
        } else {
          const initBalance = INITIAL_POINTS;
          await AsyncStorage.setItem(POINTS_KEY, JSON.stringify({ balance: initBalance, lastClaimDate: today }));
          setPoints(initBalance);
          setLastClaimDate(today);
        }
      } catch (e) {
        console.log('Erreur points', e);
      }
    };
    loadPoints();
  }, []);

  // Sauvegarder à chaque changement
  useEffect(() => {
    const save = async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
      } catch (e) {
        console.log('Erreur sauvegarde AsyncStorage', e);
      }
    };
    if (isReady) {
      save();
    }
  }, [entries, isReady]);

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
      await AsyncStorage.setItem(POINTS_KEY, JSON.stringify({ balance: newBalance, lastClaimDate }));
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
            await AsyncStorage.setItem(TARGETS_KEY, JSON.stringify(next));
          }}
          points={points}
        />
      )}

      {screen === 'add' && (
        <AddEntryScreen
          onCancel={() => setScreen('home')}
          onSave={handleAddEntry}
          points={points}
          spendPoints={spendPoints}
          todayTotals={todayTotals}
          targets={targets}
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

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.innerContent}>
      <Text style={styles.logo}>FeedToki 🐉</Text>

      <View style={styles.dragonBox}>
        <Image source={imgSource} style={styles.dragonImage} resizeMode="contain" />
      </View>

      <Text style={styles.statsText}>
        7 derniers jours : {stats.label} ({stats.scorePct}%)
      </Text>

      <Text style={styles.streakText}>
        Streak actuel: {streak.currentStreakDays} jour(s) · Meilleurs: {streak.longestStreakDays} · Jours nourris: {streak.totalFedDays}
      </Text>

      <Text style={styles.stateText}>
        {dragonState.mood === 'normal' && 'FeedToki est en forme 🐉'}
        {dragonState.mood === 'inquiet' && "FeedToki s'inquiete un peu… 😟"}
        {dragonState.mood === 'critique' && 'FeedToki a besoin de toi 😰'}
      </Text>

      <Text style={styles.pointsText}>Points disponibles : {points}</Text>

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

      <View style={styles.nutritionBox}>
        <Text style={styles.nutritionTitle}>Objectifs du jour</Text>
        <NutritionBar label="Protéines" value={todayTotals.protein_g} unit="g" pct={percentageOfTarget(todayTotals.protein_g, targets.protein_g)} color="#22c55e" />
        <NutritionBar label="Glucides" value={todayTotals.carbs_g} unit="g" pct={percentageOfTarget(todayTotals.carbs_g, targets.carbs_g)} color="#3b82f6" />
        <NutritionBar label="Calories" value={todayTotals.calories_kcal} unit="kcal" pct={percentageOfTarget(todayTotals.calories_kcal, targets.calories_kcal)} color="#f59e0b" />
        <NutritionBar label="Produits laitiers" value={todayTotals.dairy_servings} unit="portion(s)" pct={percentageOfTarget(todayTotals.dairy_servings, targets.dairy_servings)} color="#a78bfa" />

        {!isEditingTargets && (
          <TouchableOpacity style={styles.buttonGhost} onPress={() => setIsEditingTargets(true)}>
            <Text style={styles.buttonGhostText}>Modifier mes objectifs</Text>
          </TouchableOpacity>
        )}

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
}: {
  onCancel: () => void;
  onSave: (entry: Omit<MealEntry, 'id' | 'createdAt'>) => void;
  points: number;
  spendPoints: (cost: number) => Promise<void> | void;
  todayTotals: ReturnType<typeof computeDailyTotals>;
  targets: typeof DEFAULT_TARGETS;
}) {
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState<MealEntry['category']>('sain');
  const [items, setItems] = useState<FoodItemRef[]>([]);
  const [quickFilter, setQuickFilter] = useState<CategoryFilter>('all');

  const selectionNutrition = useMemo(() => {
    return items.reduce(
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
  }, [items]);

  const pendingCost = items.reduce((sum, ref) => {
    const fi = QUICK_ITEMS.find((f) => f.id === ref.foodId);
    if (!fi) return sum;
    const cost = computeFoodPoints(fi);
    return sum + cost;
  }, 0);

  const toggleItem = (foodId: string) => {
    setItems((prev) => {
      const exists = prev.some((i) => i.foodId === foodId);
      if (exists) return prev.filter((i) => i.foodId !== foodId);
      const fi = QUICK_ITEMS.find((f) => f.id === foodId);
      const addCost = fi ? computeFoodPoints(fi) : 0;
      if (pendingCost + addCost > points) return prev; // not enough points
      return [...prev, { foodId }];
    });
  };

  const applyQuickMeal = (mealId: string) => {
    const preset = QUICK_MEALS.find((m) => m.id === mealId);
    if (preset) {
      setItems(preset.items);
      setLabel(preset.name);
      const cls = classifyMealByItems(preset.items);
      setCategory(cls.category);
    }
  };

  const filteredItems = QUICK_ITEMS.filter((fi) => quickFilter === 'all' || scoreToCategory(fi.baseScore) === quickFilter);
  const filteredMeals = QUICK_MEALS.filter((qm) => {
    const cls = classifyMealByItems(qm.items);
    return quickFilter === 'all' || cls.category === quickFilter;
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
    <View style={styles.inner}>
      <Text style={styles.logo}>Partager avec Toki</Text>

      <TextInput
        style={styles.input}
        placeholder="Ex: poulet + légumes, poutine, bière..."
        placeholderTextColor="#6b7280"
        value={label}
        onChangeText={setLabel}
      />

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
    </View>
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logo: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fbbf24',
    marginBottom: 32,
    textAlign: 'center',
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
  nutritionTitle: {
    color: '#e5e7eb',
    fontSize: 14,
    marginBottom: 6,
  },
});

function NutritionBar({ label, value, unit, pct, color }: { label: string; value: number; unit: string; pct: number; color: string }) {
  return (
    <View style={{ width: '100%' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ color: '#e5e7eb', fontSize: 12 }}>{label}</Text>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>{Math.round(value)} {unit} · {pct}%</Text>
      </View>
      <View style={{ width: '100%', height: 10, backgroundColor: '#111827', borderRadius: 999, overflow: 'hidden', borderWidth: 1, borderColor: '#374151' }}>
        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: color }} />
      </View>
    </View>
  );
}
