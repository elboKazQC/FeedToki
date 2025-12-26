import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../lib/auth-context';
import { useTheme } from '../lib/theme-context';
import { Colors } from '../constants/theme';
import { DragonSprite } from '../components/dragon-sprite';
import { StreakCalendar } from '../components/streak-calendar';
import { 
  MealEntry, 
  computeStreak, 
  computeDragonState, 
  computeScore7Jours,
  normalizeDate,
  StreakStats,
  DragonStatus,
  DAYS_CRITICAL,
} from '../lib/stats';
import { getDragonLevel, getDragonProgress, getDaysToNextLevel } from '../lib/dragon-levels';
import { loadWeights, saveWeight, toDisplay, toKg, WeightEntry } from '../lib/weight';

export default function StatsScreen() {
  const { profile, user } = useAuth();
  const { activeTheme } = useTheme();
  const colors = Colors[activeTheme];
  
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
  const [score7j, setScore7j] = useState<{ score: number; zone: 'vert' | 'jaune' | 'rouge'; mealsCount: number }>({ score: 0, zone: 'rouge', mealsCount: 0 });
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('lbs');
  const [weightInput, setWeightInput] = useState('');

  const currentUserId = profile?.userId || (user as any)?.id || 'guest';

  // Charger les entrées
  useEffect(() => {
    const loadEntries = async () => {
      try {
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
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  // Calculer les stats
  useEffect(() => {
    const dayFeeds = entries.reduce((acc, entry) => {
      const dateKey = normalizeDate(entry.createdAt);
      const existing = acc[dateKey] ?? { date: dateKey, mealIds: [] };
      acc[dateKey] = { ...existing, mealIds: [...existing.mealIds, entry.id] };
      return acc;
    }, {} as Record<string, { date: string; mealIds: string[] }>);

    setStreak(computeStreak(dayFeeds));
    setDragonState(computeDragonState(dayFeeds));
    setScore7j(computeScore7Jours(entries));
  }, [entries]);

  const dragonLevel = getDragonLevel(streak.currentStreakDays);
  const dragonProgress = getDragonProgress(streak.currentStreakDays);
  const daysToNext = getDaysToNextLevel(streak.currentStreakDays);

  // Vérifier si le dragon est mort (5 jours sans nourrir)
  const isDragonDead = dragonState.daysSinceLastMeal >= DAYS_CRITICAL;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {/* Header avec bouton retour */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
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
            <DragonSprite
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

        {/* Score 7 jours */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>📊 Score 7 jours</Text>
          <View style={[styles.scoreCard, { backgroundColor: activeTheme === 'dark' ? '#1f2937' : '#fff' }]}>
            <View style={styles.scoreCircle}>
              <Text style={[
                styles.scoreValue,
                { color: score7j.zone === 'vert' ? '#10b981' : score7j.zone === 'jaune' ? '#f59e0b' : '#ef4444' }
              ]}>
                {score7j.score}%
              </Text>
            </View>
            <View style={styles.scoreInfo}>
              <Text style={[styles.scoreLabel, { color: colors.text }]}>
                {score7j.zone === 'vert' ? '🟢 Excellent!' : score7j.zone === 'jaune' ? '🟡 En progrès' : '🔴 À améliorer'}
              </Text>
              <Text style={[styles.scoreDesc, { color: colors.icon }]}>
                Basé sur {score7j.mealsCount} repas cette semaine
              </Text>
            </View>
          </View>
        </View>

        {/* Poids */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>⚖️ Poids</Text>
          <View style={[styles.weightCard, { backgroundColor: activeTheme === 'dark' ? '#1f2937' : '#fff' }]}>
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
                  if (!isNaN(v)) {
                    const today = new Date().toISOString().slice(0, 10);
                    await saveWeight(currentUserId, { date: today, weightKg: toKg(v, weightUnit) });
                    const list = await loadWeights(currentUserId);
                    setWeights(list);
                  }
                }}
              >
                <Text style={styles.saveBtnText}>Enregistrer</Text>
              </TouchableOpacity>
            </View>

            {/* Mini graphique barres */}
            <View style={styles.chartRow}>
              {(() => {
                const last30 = weights.slice(-30);
                if (last30.length < 2) {
                  return <Text style={{ color: colors.icon }}>Ajoute 2+ valeurs pour voir la tendance</Text>;
                }
                const values = last30.map((w) => w.weightKg);
                const min = Math.min(...values);
                const max = Math.max(...values);
                const range = Math.max(0.1, max - min);
                return last30.map((w, idx) => {
                  const hPct = ((w.weightKg - min) / range) * 100;
                  return (
                    <View key={idx} style={styles.chartBarWrap}>
                      <View style={[styles.chartBar, { height: `${Math.max(8, hPct)}%` }]} />
                    </View>
                  );
                });
              })()}
            </View>

            {/* Delta */}
            {weights.length >= 2 && (
              <View style={styles.deltaRow}>
                {(() => {
                  const last = weights[weights.length - 1].weightKg;
                  const prev = weights[weights.length - 2].weightKg;
                  const diff = last - prev;
                  const sign = diff > 0 ? '+' : '';
                  return (
                    <Text style={[styles.deltaText, { color: diff <= 0 ? '#10b981' : '#ef4444' }]}>
                      {sign}{toDisplay(diff, 'kg')} kg depuis la dernière mesure
                    </Text>
                  );
                })()}
              </View>
            )}
          </View>
        </View>

        {/* Calendrier des streaks */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>📅 Calendrier</Text>
          <View style={[styles.calendarCard, { backgroundColor: activeTheme === 'dark' ? '#1f2937' : '#fff' }]}>
            <StreakCalendar entries={entries} />
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
    </ScrollView>
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
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 80,
    marginTop: 8,
  },
  chartBarWrap: {
    flex: 1,
    paddingHorizontal: 1,
    height: '100%',
  },
  chartBar: {
    backgroundColor: '#3b82f6',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    width: '100%',
  },
  deltaRow: {
    marginTop: 8,
  },
  deltaText: {
    fontSize: 12,
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
});
