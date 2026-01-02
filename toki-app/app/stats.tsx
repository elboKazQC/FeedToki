import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Modal } from 'react-native';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { SafeAreaView } from '../components/safe-area-view-wrapper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../lib/auth-context';
import { useTheme } from '../lib/theme-context';
import { Colors } from '../constants/theme';
import { DragonDisplay } from '../components/dragon-display';
import { StreakCalendar } from '../components/streak-calendar';
import { 
  MealEntry, 
  computeStreakWithCalories,
  computeDragonStateWithCalories,
  normalizeDate,
  StreakStats,
  DragonStatus,
  DAYS_CRITICAL,
  MIN_CALORIES_FOR_COMPLETE_DAY,
} from '../lib/stats';
import { getDragonLevel, getDragonProgress, getDaysToNextLevel } from '../lib/dragon-levels';
import { loadWeights, saveWeight, toDisplay, toKg, WeightEntry, loadBaseline, getWeeklyAverageSeries } from '../lib/weight';
import { WeightChart } from '../components/weight-chart';
import { validateWeight } from '../lib/validation';
import { BestDays, DaySummary } from '../components/best-days';
import { loadCustomFoods } from '../lib/custom-foods';
import { FOOD_DB } from '../lib/food-db';
import { computeDailyTotals, computeMealTotals, DEFAULT_TARGETS } from '../lib/nutrition';

export default function StatsScreen() {
  const { profile, user } = useAuth();
  const { activeTheme } = useTheme();
  const colors = Colors[activeTheme];
  
  // État pour rendu côté client uniquement (évite erreurs d'hydratation #418/#310 sur web)
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  const [entries, setEntries] = useState<MealEntry[]>([]);
  const [streak, setStreak] = useState<StreakStats>({
    currentStreakDays: 0,
    longestStreakDays: 0,
    totalFedDays: 0,
    evolutionsUnlocked: 0,
    progressToNextEvolution: 0,
    streakBonusEarned: 0,
    isStreakBonusDay: false,
  });
  const [dragonState, setDragonState] = useState<DragonStatus>({ mood: 'normal', daysSinceLastMeal: 0 });
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('lbs');
  const [weightInput, setWeightInput] = useState('');
  const [baseline, setBaseline] = useState<WeightEntry | null>(null);
  const [customFoods, setCustomFoods] = useState<typeof FOOD_DB>([]);
  const [excludedBestDays, setExcludedBestDays] = useState<string[]>([]); // Jours exclus du classement (pas supprimés)
  const [selectedDay, setSelectedDay] = useState<DaySummary | null>(null); // Journée sélectionnée pour afficher les détails
  const [targets, setTargets] = useState(DEFAULT_TARGETS); // Objectifs nutritionnels
  const [cheatDays, setCheatDays] = useState<Record<string, boolean>>({}); // Journées cheat

  const currentUserId = profile?.userId || (user as any)?.uid || (user as any)?.id || 'guest';

  // Réinitialiser les données quand on change de compte/utilisateur
  const prevUserIdRef = React.useRef<string | undefined>(undefined);
  
  useEffect(() => {
    // Si l'userId a changé ET que ce n'est pas la première fois (undefined → valeur initiale), réinitialiser
    if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== currentUserId && currentUserId !== 'guest') {
      if (__DEV__) console.log('[Stats] ⚠️ Changement de compte détecté:', prevUserIdRef.current, '→', currentUserId);
      if (__DEV__) console.log('[Stats] Réinitialisation des données locales pour éviter mélange');
      
      // Réinitialiser les états spécifiques à l'utilisateur (pas customFoods car partagés)
      setEntries([]);
      setStreak({
        currentStreakDays: 0,
        longestStreakDays: 0,
        totalFedDays: 0,
        evolutionsUnlocked: 0,
        progressToNextEvolution: 0,
        streakBonusEarned: 0,
        isStreakBonusDay: false,
      });
      setDragonState({ mood: 'normal', daysSinceLastMeal: 0 });
      setWeights([]);
      setBaseline(null);
      setExcludedBestDays([]);
      setSelectedDay(null);
      setCheatDays({});
      
      // Note: Ne pas réinitialiser customFoods car ils sont partagés entre tous les utilisateurs
      // Les données seront rechargées par les useEffect suivants avec le bon userId
    }
    
    // Mettre à jour la référence
    prevUserIdRef.current = currentUserId;
  }, [currentUserId]);

  // Calcul des calories par jour (pour aligner la logique streak avec la Home)
  // IMPORTANT: ce useMemo doit être AVANT tout return conditionnel (règle des hooks React)
  const dayCaloriesMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (!entries || entries.length === 0) return map;
    const uniqueDays = Array.from(new Set(entries.map((e) => normalizeDate(e.createdAt))));
    for (const day of uniqueDays) {
      try {
        const totals = computeDailyTotals(entries, day, customFoods);
        map[day] = totals.calories_kcal || 0;
      } catch {
        map[day] = 0;
      }
    }
    return map;
  }, [entries, customFoods]);

  // Charger les entrées (avec synchronisation Firestore comme sur la page principale)
  useEffect(() => {
    const loadEntries = async () => {
      if (!currentUserId || currentUserId === 'guest') {
        setEntries([]);
        return;
      }
      
      try {
        // IMPORTANT: Synchroniser d'abord depuis Firestore (fusion) pour avoir les données les plus récentes
        try {
          const { syncFromFirestore } = await import('../lib/data-sync');
          await syncFromFirestore(currentUserId);
        } catch (syncError) {
          console.warn('[Stats] Erreur sync Firestore, utilisation locale:', syncError);
        }
        
        // Après synchronisation, charger depuis AsyncStorage (qui contient maintenant les données fusionnées)
        const key = `feedtoki_entries_${currentUserId}_v1`;
        const json = await AsyncStorage.getItem(key);
        if (json) {
          const parsed = JSON.parse(json);
          if (Array.isArray(parsed)) {
            setEntries(parsed);
          }
        }
      } catch (e) {
        console.log('Erreur chargement entries:', e);
      }
    };
    loadEntries();
  }, [currentUserId]);

  // Charger poids
  useEffect(() => {
    const load = async () => {
      const list = await loadWeights(currentUserId);
      setWeights(list);
      const last = list[list.length - 1];
      if (last) setWeightInput(String(toDisplay(last.weightKg, weightUnit)));
      const base = await loadBaseline(currentUserId);
      setBaseline(base);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  // Charger custom foods
  useEffect(() => {
    const load = async () => {
      try {
        const foods = await loadCustomFoods(currentUserId !== 'guest' ? currentUserId : undefined);
        setCustomFoods(foods || []);
      } catch (error) {
        console.error('Erreur chargement custom foods:', error);
        setCustomFoods([]);
      }
    };
    load();
  }, [currentUserId]);

  // Charger les objectifs nutritionnels
  useEffect(() => {
    const loadTargets = async () => {
      if (!profile) {
        setTargets(DEFAULT_TARGETS);
        return;
      }
      
      try {
        // Calculer les objectifs basés sur le profil
        const { calculateNutritionTargets } = await import('../lib/nutrition-calculator');
        const calculatedTargets = calculateNutritionTargets(profile);
        setTargets(calculatedTargets);
      } catch (error) {
        console.error('[Stats] Erreur calcul objectifs:', error);
        setTargets(DEFAULT_TARGETS);
      }
    };
    loadTargets();
  }, [profile]);

  // Charger les jours exclus des "meilleurs jours"
  useEffect(() => {
    const loadExcludedDays = async () => {
      try {
        const key = `feedtoki_excluded_best_days_${currentUserId}`;
        const json = await AsyncStorage.getItem(key);
        if (json) {
          const parsed = JSON.parse(json);
          if (Array.isArray(parsed)) {
            setExcludedBestDays(parsed);
          }
        }
      } catch (error) {
        console.error('[Stats] Erreur chargement jours exclus:', error);
      }
    };
    loadExcludedDays();
  }, [currentUserId]);

  // Charger les cheat days
  useEffect(() => {
    const loadCheatDays = async () => {
      if (!currentUserId || currentUserId === 'guest') {
        setCheatDays({});
        return;
      }
      
      try {
        const { getCheatDays } = await import('../lib/cheat-days');
        const cheatDaysData = await getCheatDays(currentUserId);
        setCheatDays(cheatDaysData);
        console.log('[Stats] ✅ Cheat days chargés:', Object.keys(cheatDaysData).length, 'jours');
      } catch (error) {
        console.error('[Stats] Erreur chargement cheat days:', error);
        setCheatDays({});
      }
    };
    
    loadCheatDays();
  }, [currentUserId]);

  // Calculer les stats
  useEffect(() => {
    const dayFeeds = entries.reduce((acc, entry) => {
      const dateKey = normalizeDate(entry.createdAt);
      const existing = acc[dateKey] ?? { date: dateKey, mealIds: [] };
      acc[dateKey] = { ...existing, mealIds: [...existing.mealIds, entry.id] };
      return acc;
    }, {} as Record<string, { date: string; mealIds: string[] }>);

    // IMPORTANT: même logique que la Home (streak validé par calories minimum)
    setStreak(computeStreakWithCalories(dayFeeds, dayCaloriesMap, MIN_CALORIES_FOR_COMPLETE_DAY));
    setDragonState(computeDragonStateWithCalories(dayFeeds, dayCaloriesMap, MIN_CALORIES_FOR_COMPLETE_DAY));
  }, [entries, dayCaloriesMap]);

  const dragonLevel = getDragonLevel(streak.currentStreakDays);
  const dragonProgress = getDragonProgress(streak.currentStreakDays);
  const daysToNext = getDaysToNextLevel(streak.currentStreakDays);

  const saveWeightEntry = async (weightKg: number) => {
    const today = new Date().toISOString().slice(0, 10);
    await saveWeight(currentUserId, { date: today, weightKg });
    const list = await loadWeights(currentUserId);
    setWeights(list);
    setWeightInput(String(toDisplay(weightKg, weightUnit)));
  };

  // Fonction pour exclure un jour du classement des "meilleurs jours"
  // Les données ne sont PAS supprimées, juste masquées du top
  const handleExcludeDay = useCallback(async (date: string) => {
    try {
      // Ajouter le jour à la liste d'exclusion (sans supprimer les données)
      setExcludedBestDays(current => {
        if (current.includes(date)) return current; // Déjà exclu
        const updated = [...current, date];
        
        // Sauvegarder dans AsyncStorage
        const key = `feedtoki_excluded_best_days_${currentUserId}`;
        AsyncStorage.setItem(key, JSON.stringify(updated)).catch(error => {
          console.error('[Stats] Erreur sauvegarde jours exclus:', error);
        });
        
        return updated;
      });
    } catch (error) {
      console.error('[Stats] Erreur exclusion jour:', error);
      Alert.alert('Erreur', 'Impossible d\'exclure ce jour. Réessayez plus tard.');
    }
  }, [currentUserId]);

  // Fonction pour gérer le clic sur une journée
  const handleDayPress = useCallback((day: DaySummary) => {
    setSelectedDay(day);
  }, []);

  // Vérifier si le dragon est mort (5 jours sans nourrir)
  const isDragonDead = dragonState.daysSinceLastMeal >= DAYS_CRITICAL;

  // IMPORTANT (Web export): éviter les erreurs d'hydratation React (#418/#310)
  // Ce return conditionnel doit être APRÈS tous les hooks (règle des hooks React)
  if (!isClient) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]} edges={['top', 'bottom']}>
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>Chargement…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {/* Header avec bouton retour */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.push('/(tabs)')}>
            <Text style={[styles.backButtonText, { color: colors.tint }]}>← Retour</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.title, { color: colors.text }]}>🔥 Statistiques</Text>

        {/* Dragon Status */}
        <View style={[styles.dragonSection, { backgroundColor: activeTheme === 'dark' ? '#1f2937' : '#fff' }]}>
          {isDragonDead ? (
            <View style={styles.dragonDeadContainer}>
              <Text style={styles.dragonDeadEmoji}>💀</Text>
              <Text style={[styles.dragonDeadTitle, { color: colors.text }]}>Dragon Affamé!</Text>
              <Text style={[styles.dragonDeadText, { color: colors.icon }]}>
                Ton dragon n&apos;a pas mangé depuis {dragonState.daysSinceLastMeal} jours.
                Nourris-le vite pour le sauver!
              </Text>
            </View>
          ) : (
            <DragonDisplay
              streakDays={streak.currentStreakDays}
              mood={dragonState.mood}
              showInfo={false}
              size={120}
            />
          )}
          
          <View style={styles.dragonInfo}>
            <Text style={[styles.levelText, { color: colors.text }]}>
              {dragonLevel.emoji} Niveau {dragonLevel.level} - {dragonLevel.name}
            </Text>
            <Text style={[styles.evolutionsText, { color: colors.icon }]}>
              Niveaux débloqués: {streak.evolutionsUnlocked} / 12
            </Text>
            {dragonLevel.level < 12 && (
              <>
                <View style={styles.progressContainer}>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressBar, { width: `${dragonProgress * 100}%` }]} />
                  </View>
                </View>
                <Text style={[styles.progressText, { color: colors.icon }]}>
                  {daysToNext} jour{daysToNext > 1 ? 's' : ''} pour le niveau suivant
                </Text>
                <Text style={[styles.progressText, { color: colors.icon, marginTop: 4 }]}>
                  Progression: {Math.round(streak.progressToNextEvolution * 100)}% vers niveau {dragonLevel.level + 1}
                </Text>
              </>
            )}
            {dragonLevel.level === 12 && (
              <Text style={[styles.maxLevelText, { color: '#10b981' }]}>
                🎉 Niveau maximum atteint!
              </Text>
            )}
          </View>
        </View>

        {/* Streak Stats */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>🔥 Streak</Text>
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: activeTheme === 'dark' ? '#1f2937' : '#fff' }]}>
              <Text style={styles.statEmoji}>🔥</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>{streak.currentStreakDays}</Text>
              <Text style={[styles.statLabel, { color: colors.icon }]}>Jours consécutifs</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: activeTheme === 'dark' ? '#1f2937' : '#fff' }]}>
              <Text style={styles.statEmoji}>🏆</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>{streak.longestStreakDays}</Text>
              <Text style={[styles.statLabel, { color: colors.icon }]}>Record</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: activeTheme === 'dark' ? '#1f2937' : '#fff' }]}>
              <Text style={styles.statEmoji}>📅</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>{streak.totalFedDays}</Text>
              <Text style={[styles.statLabel, { color: colors.icon }]}>Jours total</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: activeTheme === 'dark' ? '#1f2937' : '#fff' }]}>
              <Text style={styles.statEmoji}>🎖️</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>{streak.streakBonusEarned}</Text>
              <Text style={[styles.statLabel, { color: colors.icon }]}>Mois complétés</Text>
            </View>
          </View>
        </View>

        {/* Poids */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>⚖️ Poids</Text>
          <View style={[styles.weightCard, { backgroundColor: activeTheme === 'dark' ? '#1f2937' : '#fff' }]}>
            {baseline && (
              <View style={styles.baselineRow}>
                <Text style={[styles.baselineText, { color: colors.icon }]}>Poids de départ:</Text>
                <Text style={[styles.baselineValue, { color: colors.text }]}>
                  {toDisplay(baseline.weightKg, weightUnit)} {weightUnit}
                </Text>
                <Text style={[styles.baselineDate, { color: colors.icon }]}>({baseline.date})</Text>
              </View>
            )}
            <View style={styles.weightRow}>
              <View style={styles.unitSelector}>
                <TouchableOpacity
                  style={[styles.unitBtn, weightUnit === 'kg' && styles.unitBtnActive]}
                  onPress={() => {
                    setWeightUnit('kg');
                    const last = weights[weights.length - 1];
                    if (last) setWeightInput(String(toDisplay(last.weightKg, 'kg')));
                  }}
                >
                  <Text style={[styles.unitText, weightUnit === 'kg' && styles.unitTextActive]}>kg</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.unitBtn, weightUnit === 'lbs' && styles.unitBtnActive]}
                  onPress={() => {
                    setWeightUnit('lbs');
                    const last = weights[weights.length - 1];
                    if (last) setWeightInput(String(toDisplay(last.weightKg, 'lbs')));
                  }}
                >
                  <Text style={[styles.unitText, weightUnit === 'lbs' && styles.unitTextActive]}>lbs</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.weightInput}
                keyboardType="decimal-pad"
                placeholder={weightUnit === 'kg' ? 'Ex: 95.2' : 'Ex: 210'}
                value={weightInput}
                onChangeText={setWeightInput}
              />
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={async () => {
                  const v = parseFloat(weightInput);
                  if (isNaN(v)) {
                    Alert.alert('Erreur', 'Veuillez entrer un poids valide');
                    return;
                  }
                  
                  // Validation du poids
                  const validation = validateWeight(v, weightUnit);
                  if (!validation.isValid) {
                    Alert.alert('Erreur', validation.error || 'Poids invalide');
                    return;
                  }
                  
                  await saveWeightEntry(toKg(v, weightUnit));
                  setWeightInput(''); // Clear input après sauvegarde
                }}
              >
                <Text style={styles.saveBtnText}>Enregistrer</Text>
              </TouchableOpacity>
            </View>

            {/* Ajustements rapides */}
            <View style={styles.quickRow}>
              {['-','+'].map((sign) => {
                const delta = weightUnit === 'kg' ? 0.5 : 1;
                const lastKg = weights[weights.length - 1]?.weightKg ?? baseline?.weightKg;
                return (
                  <TouchableOpacity
                    key={`quick-${sign}`}
                    style={styles.quickBtn}
                    onPress={() => {
                      if (lastKg == null) return;
                      const deltaKg = sign === '+' ? toKg(delta, weightUnit) : -toKg(delta, weightUnit);
                      const nextKg = Math.max(0, lastKg + deltaKg);
                      saveWeightEntry(nextKg);
                    }}
                  >
                    <Text style={styles.quickBtnText}>{sign}{delta} {weightUnit}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Graphique XY avec points reliés */}
            <View style={styles.chartRow}>
              {(() => {
                if (weights.length < 2) {
                  return <Text style={{ color: colors.icon }}>Ajoute 2+ valeurs pour voir la tendance</Text>;
                }
                const useWeekly = weights.length > 60;
                if (useWeekly) {
                  const weekly = getWeeklyAverageSeries(weights).slice(-12);
                  const valuesKg = weekly.map((w) => w.avgKg);
                  const valuesDisplay = valuesKg.map((v) => toDisplay(v, weightUnit));
                  const labels = weekly.map((w) => w.weekStart);
                  const trendColor = baseline && valuesKg.length ? (valuesKg[valuesKg.length - 1] < baseline.weightKg ? '#10b981' : '#ef4444') : '#3b82f6';
                  return <WeightChart values={valuesDisplay} labels={labels} height={120} color={trendColor} baselineValue={baseline ? toDisplay(baseline.weightKg, weightUnit) : undefined} />;
                } else {
                  const daily = weights.slice(-30);
                  const valuesKg = daily.map((w) => w.weightKg);
                  const valuesDisplay = valuesKg.map((v) => toDisplay(v, weightUnit));
                  const labels = daily.map((w) => w.date);
                  const trendColor = baseline && valuesKg.length ? (valuesKg[valuesKg.length - 1] < baseline.weightKg ? '#10b981' : '#ef4444') : '#3b82f6';
                  return <WeightChart values={valuesDisplay} labels={labels} height={120} color={trendColor} baselineValue={baseline ? toDisplay(baseline.weightKg, weightUnit) : undefined} />;
                }
              })()}
            </View>

            {/* Delta depuis départ */}
            {weights.length >= 1 && baseline && (
              <View style={styles.deltaRow}>
                {(() => {
                  const last = weights[weights.length - 1].weightKg;
                  const base = baseline.weightKg;
                  const diff = last - base;
                  const sign = diff > 0 ? '+' : '';
                  return (
                    <Text style={[styles.deltaText, { color: diff <= 0 ? '#10b981' : '#ef4444' }]}>
                      {sign}{toDisplay(diff, weightUnit)} {weightUnit} depuis le départ
                    </Text>
                  );
                })()}
              </View>
            )}

            {/* Résumé de progression */}
            {weights.length >= 2 && (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                {(() => {
                  const last = weights[weights.length - 1].weightKg;
                  const w7 = weights[weights.length - Math.min(7, weights.length)].weightKg;
                  const w30 = weights[weights.length - Math.min(30, weights.length)].weightKg;
                  const d7 = last - w7;
                  const d30 = last - w30;
                  return (
                    <>
                      <View style={styles.progressChip}><Text style={[styles.progressChipText, { color: d7 <= 0 ? '#10b981' : '#ef4444' }]}>7j: {d7 > 0 ? '+' : ''}{toDisplay(d7, weightUnit)} {weightUnit}</Text></View>
                      <View style={styles.progressChip}><Text style={[styles.progressChipText, { color: d30 <= 0 ? '#10b981' : '#ef4444' }]}>30j: {d30 > 0 ? '+' : ''}{toDisplay(d30, weightUnit)} {weightUnit}</Text></View>
                      <View style={styles.progressChip}><Text style={styles.progressChipText}>Dernier: {toDisplay(last, weightUnit)} {weightUnit}</Text></View>
                    </>
                  );
                })()}
              </View>
            )}
          </View>
        </View>

        {/* Meilleurs jours */}
        {entries.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>🏆 Meilleurs jours</Text>
            <BestDays 
              entries={entries} 
              customFoods={customFoods}
              targets={targets}
              expectedMealsPerDay={3}
              excludedDays={excludedBestDays}
              onExcludeDay={handleExcludeDay}
              onDayPress={handleDayPress}
            />
          </View>
        )}

        {/* Calendrier des streaks */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>📅 Calendrier</Text>
          <View style={[styles.calendarCard, { backgroundColor: activeTheme === 'dark' ? '#1f2937' : '#fff' }]}>
            <StreakCalendar entries={entries} cheatDays={cheatDays} />
          </View>
        </View>

        {/* Bonus Streak */}
        {streak.streakBonusEarned > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>🏅 Accomplissements</Text>
            <View style={[styles.bonusCard, { backgroundColor: '#fef3c7' }]}>
              <Text style={styles.bonusEmoji}>🔥</Text>
              <View style={styles.bonusInfo}>
                <Text style={styles.bonusTitle}>Streak de {streak.streakBonusEarned * 30} jours!</Text>
                <Text style={styles.bonusDesc}>
                  Tu as maintenu ton streak pendant {streak.streakBonusEarned} mois complet{streak.streakBonusEarned > 1 ? 's' : ''}!
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Modal de détails nutritionnels */}
      <Modal
        visible={selectedDay !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedDay(null)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.7)' }]}>
          <View style={[styles.modalContent, { backgroundColor: activeTheme === 'dark' ? '#1f2937' : '#fff' }]}>
            {selectedDay && (() => {
              // Formater la date
              const formatDate = (dateStr: string) => {
                const date = new Date(dateStr);
                const now = new Date();
                const today = normalizeDate(now.toISOString());
                const yesterday = new Date(now);
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStr = normalizeDate(yesterday.toISOString());
                
                if (dateStr === today) return "Aujourd'hui";
                if (dateStr === yesterdayStr) return "Hier";
                
                return date.toLocaleDateString('fr-FR', { 
                  weekday: 'long', 
                  day: 'numeric', 
                  month: 'long' 
                });
              };

              const getScoreColor = (score: number) => {
                if (score >= 80) return '#22c55e';
                if (score >= 60) return '#f59e0b';
                return '#ef4444';
              };

              const getCategoryLabel = (category: string) => {
                if (category === 'sain') return 'Sain';
                if (category === 'ok') return 'OK';
                return 'Cheat';
              };

              return (
                <>
                  {/* Header */}
                  <View style={styles.modalHeader}>
                    <View style={styles.modalHeaderLeft}>
                      <Text style={[styles.modalTitle, { color: colors.text }]}>
                        📅 {formatDate(selectedDay.date)}
                      </Text>
                      <View style={[styles.modalScoreBadge, { backgroundColor: getScoreColor(selectedDay.score) }]}>
                        <Text style={styles.modalScoreText}>Score: {selectedDay.score}%</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => setSelectedDay(null)}
                      style={styles.modalCloseButton}
                    >
                      <Text style={[styles.modalCloseText, { color: colors.text }]}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Totaux de la journée */}
                  <View style={[styles.modalTotalsSection, { borderColor: activeTheme === 'dark' ? '#374151' : '#e5e7eb' }]}>
                    <Text style={[styles.modalSectionTitle, { color: colors.text }]}>Totaux de la journée</Text>
                    <View style={styles.modalTotalsGrid}>
                      <View style={styles.modalTotalItem}>
                        <Text style={[styles.modalTotalLabel, { color: colors.icon }]}>🔥 Calories</Text>
                        <Text style={[styles.modalTotalValue, { color: colors.text }]}>
                          {Math.round(selectedDay.totals.calories_kcal)}
                        </Text>
                      </View>
                      <View style={styles.modalTotalItem}>
                        <Text style={[styles.modalTotalLabel, { color: colors.icon }]}>💪 Protéines</Text>
                        <Text style={[styles.modalTotalValue, { color: colors.text }]}>
                          {Math.round(selectedDay.totals.protein_g)}g
                        </Text>
                      </View>
                      <View style={styles.modalTotalItem}>
                        <Text style={[styles.modalTotalLabel, { color: colors.icon }]}>🍞 Glucides</Text>
                        <Text style={[styles.modalTotalValue, { color: colors.text }]}>
                          {Math.round(selectedDay.totals.carbs_g)}g
                        </Text>
                      </View>
                      <View style={styles.modalTotalItem}>
                        <Text style={[styles.modalTotalLabel, { color: colors.icon }]}>🧈 Lipides</Text>
                        <Text style={[styles.modalTotalValue, { color: colors.text }]}>
                          {Math.round(selectedDay.totals.fat_g)}g
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Liste des repas */}
                  <View style={styles.modalMealsSection}>
                    <Text style={[styles.modalSectionTitle, { color: colors.text }]}>
                      Repas ({selectedDay.meals.length})
                    </Text>
                    <ScrollView style={styles.modalMealsList} showsVerticalScrollIndicator={false}>
                      {selectedDay.meals.map((meal) => {
                        const mealTotals = computeMealTotals(meal, customFoods);
                        return (
                          <View
                            key={meal.id}
                            style={[styles.modalMealCard, { backgroundColor: activeTheme === 'dark' ? '#111827' : '#f9fafb', borderColor: activeTheme === 'dark' ? '#374151' : '#e5e7eb' }]}
                          >
                            <View style={styles.modalMealHeader}>
                              <Text style={[styles.modalMealCategory, { color: colors.icon }]}>
                                [{getCategoryLabel(meal.category)}]
                              </Text>
                              <Text style={[styles.modalMealLabel, { color: colors.text }]} numberOfLines={2}>
                                {meal.label}
                              </Text>
                            </View>
                            <View style={styles.modalMealNutrition}>
                              <View style={styles.modalMealNutritionRow}>
                                <Text style={[styles.modalMealNutritionItem, { color: colors.icon }]}>
                                  🔥 {Math.round(mealTotals.calories_kcal)} kcal
                                </Text>
                                <Text style={[styles.modalMealNutritionItem, { color: colors.icon }]}>
                                  💪 {Math.round(mealTotals.protein_g)}g
                                </Text>
                              </View>
                              <View style={styles.modalMealNutritionRow}>
                                <Text style={[styles.modalMealNutritionItem, { color: colors.icon }]}>
                                  🍞 {Math.round(mealTotals.carbs_g)}g
                                </Text>
                                <Text style={[styles.modalMealNutritionItem, { color: colors.icon }]}>
                                  🧈 {Math.round(mealTotals.fat_g)}g
                                </Text>
                              </View>
                            </View>
                          </View>
                        );
                      })}
                    </ScrollView>
                  </View>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 8,
  },
  backButton: {
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  dragonSection: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dragonDeadContainer: {
    alignItems: 'center',
    padding: 20,
  },
  dragonDeadEmoji: {
    fontSize: 60,
    marginBottom: 12,
  },
  dragonDeadTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  dragonDeadText: {
    fontSize: 14,
    textAlign: 'center',
  },
  dragonInfo: {
    marginTop: 16,
    alignItems: 'center',
    width: '100%',
  },
  levelText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  evolutionsText: {
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  progressContainer: {
    width: '100%',
    marginBottom: 8,
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#f97316',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
  },
  maxLevelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  weightCard: {
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  unitSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  unitBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  unitBtnActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  unitText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  unitTextActive: {
    color: '#3b82f6',
  },
  weightInput: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  saveBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  quickRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  quickBtn: {
    backgroundColor: '#eef2ff',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  quickBtnText: {
    color: '#4f46e5',
    fontWeight: '600',
    fontSize: 12,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 140,
    marginTop: 12,
  },
  baselineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  baselineText: {
    fontSize: 12,
  },
  baselineValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  baselineDate: {
    fontSize: 12,
  },
  deltaRow: {
    marginTop: 8,
  },
  deltaText: {
    fontSize: 12,
  },
  progressChip: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  progressChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '47%',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statEmoji: {
    fontSize: 24,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  scoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  scoreCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  scoreInfo: {
    flex: 1,
  },
  scoreLabel: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  scoreDesc: {
    fontSize: 14,
  },
  calendarCard: {
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  bonusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
  },
  bonusEmoji: {
    fontSize: 40,
    marginRight: 16,
  },
  bonusInfo: {
    flex: 1,
  },
  bonusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#92400e',
    marginBottom: 4,
  },
  bonusDesc: {
    fontSize: 14,
    color: '#b45309',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  modalHeaderLeft: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textTransform: 'capitalize',
  },
  modalScoreBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  modalScoreText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalCloseText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalTotalsSection: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: 16,
    marginBottom: 20,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  modalTotalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  modalTotalItem: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
  },
  modalTotalLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  modalTotalValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalMealsSection: {
    flex: 1,
  },
  modalMealsList: {
    maxHeight: 400,
  },
  modalMealCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  modalMealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalMealCategory: {
    fontSize: 11,
    marginRight: 8,
    width: 60,
  },
  modalMealLabel: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  modalMealNutrition: {
    marginTop: 8,
  },
  modalMealNutritionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  modalMealNutritionItem: {
    fontSize: 12,
    flex: 1,
  },
});
