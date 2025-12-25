import { View, Text, ScrollView, Pressable, TextInput, StyleSheet } from 'react-native';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WeightGoal, ActivityLevel } from '../lib/types';
import { computeUserProfile, getGoalDescription, getDailyCalorieTarget } from '../lib/points-calculator';
import { getCurrentLocalUser, updateLocalUserProfile } from '../lib/local-auth';
import { FIREBASE_ENABLED } from '../lib/firebase-config';
import { useAuth } from '../lib/auth-context';

const PROFILE_KEY = 'toki_user_profile_v1';

export default function OnboardingScreen() {
  const { refreshProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState<WeightGoal>('lose-1lb');
  const [weight, setWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('lbs'); // Par défaut en lbs pour Amérique du Nord
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate');
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      if (!FIREBASE_ENABLED) {
        const currentUser = await getCurrentLocalUser();
        if (currentUser) {
          setUserId(currentUser.id);
        }
      }
    };
    loadUser();
  }, []);

  const handleComplete = async () => {
    console.log('[Onboarding] handleComplete - userId:', userId);
    console.log('[Onboarding] handleComplete - weight:', weight, 'unit:', weightUnit);
    
    // Convertir le poids en kg si nécessaire
    let weightInKg: number | undefined;
    if (weight) {
      const weightValue = parseFloat(weight);
      weightInKg = weightUnit === 'lbs' ? weightValue * 0.453592 : weightValue;
    }
    console.log('[Onboarding] weightInKg:', weightInKg);
    
    // Compute full profile
    const profile = computeUserProfile(
      goal,
      weightInKg,
      activityLevel
    );
    console.log('[Onboarding] computed profile:', JSON.stringify(profile, null, 2));

    // Sauvegarde du profil - toujours écrire directement pour éviter les erreurs
    const profileKey = userId ? `toki_user_profile_${userId}` : PROFILE_KEY;
    const fullProfile = { ...profile, userId: userId || undefined, onboardingCompleted: true };
    await AsyncStorage.setItem(profileKey, JSON.stringify(fullProfile));
    
    console.log('[Onboarding] Profil sauvegardé:', profileKey);

    // Recharger le profil dans le contexte et attendre
    await refreshProfile();
    console.log('[Onboarding] refreshProfile done');
    
    // Petit délai pour laisser le contexte se mettre à jour
    await new Promise(resolve => setTimeout(resolve, 100));

    // Naviguer vers l'application principale
    console.log('[Onboarding] Navigating to /(tabs)');
    router.replace('/(tabs)');
  };

  if (step === 1) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.emoji}>🐉</Text>
          <Text style={styles.title}>Bienvenue sur Toki!</Text>
          <Text style={styles.subtitle}>
            Toki est ton ami dragon qui t&apos;aide à mieux manger via un système de{' '}
            <Text style={styles.bold}>points-budget</Text>.
          </Text>
          
          <View style={styles.explainBox}>
            <Text style={styles.explainTitle}>💡 Comment ça marche?</Text>
            <Text style={styles.explainText}>
              • Tu as un <Text style={styles.bold}>budget de points</Text> par jour
            </Text>
            <Text style={styles.explainText}>
              • Les aliments sains coûtent <Text style={styles.bold}>0-1 point</Text> 🥗
            </Text>
            <Text style={styles.explainText}>
              • Les cheats coûtent <Text style={styles.bold}>plus cher</Text> 🍕
            </Text>
            <Text style={styles.explainText}>
              • <Text style={styles.bold}>Rien n&apos;est interdit</Text>, tu gères ton budget!
            </Text>
          </View>

          <Pressable style={styles.buttonPrimary} onPress={() => setStep(2)}>
            <Text style={styles.buttonText}>C&apos;est parti! 🚀</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  if (step === 2) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Quel est ton objectif?</Text>
          <Text style={styles.subtitle}>
            Ceci déterminera ton budget calorique et tes points quotidiens.
          </Text>

          <View style={styles.optionsContainer}>
            <Pressable
              style={[styles.optionCard, goal === 'maintenance' && styles.optionSelected]}
              onPress={() => setGoal('maintenance')}
            >
              <Text style={styles.optionEmoji}>⚖️</Text>
              <Text style={styles.optionTitle}>Maintenance</Text>
              <Text style={styles.optionDesc}>Maintenir mon poids actuel</Text>
            </Pressable>

            <Pressable
              style={[styles.optionCard, goal === 'lose-1lb' && styles.optionSelected]}
              onPress={() => setGoal('lose-1lb')}
            >
              <Text style={styles.optionEmoji}>🎯</Text>
              <Text style={styles.optionTitle}>Perdre ~1 lb/sem</Text>
              <Text style={styles.optionDesc}>Déficit modéré (-500 cal/jour)</Text>
            </Pressable>

            <Pressable
              style={[styles.optionCard, goal === 'lose-2lb' && styles.optionSelected]}
              onPress={() => setGoal('lose-2lb')}
            >
              <Text style={styles.optionEmoji}>🔥</Text>
              <Text style={styles.optionTitle}>Perdre ~2 lbs/sem</Text>
              <Text style={styles.optionDesc}>Déficit important (-1000 cal/jour)</Text>
            </Pressable>

            <Pressable
              style={[styles.optionCard, goal === 'lose-3lb' && styles.optionSelected]}
              onPress={() => setGoal('lose-3lb')}
            >
              <Text style={styles.optionEmoji}>⚡</Text>
              <Text style={styles.optionTitle}>Perdre ~3 lbs/sem</Text>
              <Text style={styles.optionDesc}>Déficit majeur (-1500 cal/jour)</Text>
            </Pressable>
          </View>

          <View style={styles.buttonRow}>
            <Pressable style={styles.buttonSecondary} onPress={() => setStep(1)}>
              <Text style={styles.buttonSecondaryText}>Retour</Text>
            </Pressable>
            <Pressable style={styles.buttonPrimary} onPress={() => setStep(3)}>
              <Text style={styles.buttonText}>Suivant</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    );
  }

  if (step === 3) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Info optionnelle</Text>
          <Text style={styles.subtitle}>
            Aide-nous à personnaliser tes objectifs (tu peux sauter cette étape).
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Ton poids actuel</Text>
            
            {/* Sélecteur d'unité */}
            <View style={styles.unitSelector}>
              <Pressable
                style={[styles.unitButton, weightUnit === 'kg' && styles.unitButtonSelected]}
                onPress={() => setWeightUnit('kg')}
              >
                <Text style={[styles.unitButtonText, weightUnit === 'kg' && styles.unitButtonTextSelected]}>kg</Text>
              </Pressable>
              <Pressable
                style={[styles.unitButton, weightUnit === 'lbs' && styles.unitButtonSelected]}
                onPress={() => setWeightUnit('lbs')}
              >
                <Text style={[styles.unitButtonText, weightUnit === 'lbs' && styles.unitButtonTextSelected]}>lbs</Text>
              </Pressable>
            </View>
            
            <TextInput
              style={styles.input}
              placeholder={weightUnit === 'kg' ? "Ex: 75" : "Ex: 165"}
              keyboardType="decimal-pad"
              value={weight}
              onChangeText={setWeight}
            />
            <Text style={styles.inputHint}>
              Optionnel - Par défaut, on utilise 165 lbs (75 kg) pour les calculs
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Niveau d&apos;activité</Text>
            
            <Pressable
              style={[styles.activityOption, activityLevel === 'sedentary' && styles.optionSelected]}
              onPress={() => setActivityLevel('sedentary')}
            >
              <Text style={styles.activityText}>🪑 Sédentaire (peu d&apos;exercice)</Text>
            </Pressable>

            <Pressable
              style={[styles.activityOption, activityLevel === 'moderate' && styles.optionSelected]}
              onPress={() => setActivityLevel('moderate')}
            >
              <Text style={styles.activityText}>🚶 Modéré (3-5x/semaine)</Text>
            </Pressable>

            <Pressable
              style={[styles.activityOption, activityLevel === 'active' && styles.optionSelected]}
              onPress={() => setActivityLevel('active')}
            >
              <Text style={styles.activityText}>🏃 Actif (6-7x/semaine)</Text>
            </Pressable>
          </View>

          <View style={styles.buttonRow}>
            <Pressable style={styles.buttonSecondary} onPress={() => setStep(2)}>
              <Text style={styles.buttonSecondaryText}>Retour</Text>
            </Pressable>
            <Pressable style={styles.buttonPrimary} onPress={() => setStep(4)}>
              <Text style={styles.buttonText}>Suivant</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    );
  }

  // Step 4: Summary
  // Convertir le poids en kg pour le preview
  let previewWeightKg: number | undefined;
  if (weight) {
    const weightValue = parseFloat(weight);
    previewWeightKg = weightUnit === 'lbs' ? weightValue * 0.453592 : weightValue;
  }
  
  const previewProfile = computeUserProfile(
    goal,
    previewWeightKg,
    activityLevel
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.emoji}>✨</Text>
        <Text style={styles.title}>Ton plan personnalisé</Text>
        
        <View style={styles.summaryBox}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Objectif:</Text>
            <Text style={styles.summaryValue}>{getGoalDescription(goal)}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Calories par semaine:</Text>
            <Text style={styles.summaryValue}>
              {previewProfile.weeklyCalorieTarget.toLocaleString()} cal
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Calories par jour:</Text>
            <Text style={styles.summaryValue}>
              ~{getDailyCalorieTarget(previewProfile.weeklyCalorieTarget)} cal
            </Text>
          </View>

          <View style={[styles.summaryRow, styles.highlight]}>
            <Text style={styles.summaryLabel}>💰 Points par jour:</Text>
            <Text style={[styles.summaryValue, styles.bold]}>
              {previewProfile.dailyPointsBudget} pts
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Cap maximum:</Text>
            <Text style={styles.summaryValue}>{previewProfile.maxPointsCap} pts</Text>
          </View>
        </View>

        <View style={styles.explainBox}>
          <Text style={styles.explainText}>
            💡 Avec <Text style={styles.bold}>{previewProfile.dailyPointsBudget} points/jour</Text>, 
            tu peux manger sainement ET te permettre des petits plaisirs tout en atteignant ton objectif!
          </Text>
        </View>

        <Pressable style={styles.buttonPrimary} onPress={handleComplete}>
          <Text style={styles.buttonText}>Commencer l&apos;aventure! 🐉</Text>
        </Pressable>

        <Pressable style={styles.buttonSecondary} onPress={() => setStep(2)}>
          <Text style={styles.buttonSecondaryText}>Modifier mes choix</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  emoji: {
    fontSize: 64,
    textAlign: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  bold: {
    fontWeight: '700',
    color: '#111827',
  },
  explainBox: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  explainTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 12,
  },
  explainText: {
    fontSize: 14,
    color: '#1e3a8a',
    marginBottom: 6,
    lineHeight: 20,
  },
  optionsContainer: {
    marginBottom: 32,
  },
  optionCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  optionSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  optionEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  optionDesc: {
    fontSize: 14,
    color: '#6b7280',
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  unitSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  unitButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  unitButtonSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  unitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  unitButtonTextSelected: {
    color: '#3b82f6',
  },
  inputHint: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  activityOption: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  activityText: {
    fontSize: 16,
    color: '#374151',
  },
  summaryBox: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  summaryValue: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  highlight: {
    backgroundColor: '#fef3c7',
    marginHorizontal: -16,
    paddingHorizontal: 16,
    borderBottomColor: '#fde68a',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  buttonPrimary: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flex: 1,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSecondary: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  buttonSecondaryText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
});
