import { View, Text, ScrollView, Pressable, TextInput, StyleSheet } from 'react-native';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WeightGoal, ActivityLevel, Gender } from '../lib/types';
import { computeUserProfile, getGoalDescription, getDailyCalorieTarget, convertFeetInchesToCm } from '../lib/profile-utils';
import { getCurrentLocalUser, updateLocalUserProfile } from '../lib/local-auth';
import { FIREBASE_ENABLED } from '../lib/firebase-config';

import { useAuth } from '../lib/auth-context';
import { updateUserProfile } from '../lib/firebase-auth';
import { trackOnboardingCompleted } from '../lib/analytics';

const PROFILE_KEY = 'toki_user_profile_v1';

export default function OnboardingScreen() {
  const { refreshProfile, user } = useAuth();
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState<WeightGoal>('lose-1lb');
  const [weight, setWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('lbs'); // Par défaut en lbs pour Amérique du Nord
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate');
  const [userId, setUserId] = useState<string | null>(null);
  const [weightError, setWeightError] = useState<string>('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [heightFeet, setHeightFeet] = useState('');
  const [heightInches, setHeightInches] = useState('');
  const [heightError, setHeightError] = useState<string>('');

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
    
    // Validation du poids si fourni
    let weightInKg: number | undefined;
    if (weight) {
      const weightValue = parseFloat(weight);
      
      // Validation: poids doit être positif et raisonnable
      if (isNaN(weightValue) || weightValue <= 0) {
        setWeightError('Le poids doit être un nombre positif');
        return;
      }
      
      // Convertir en kg
      weightInKg = weightUnit === 'lbs' ? weightValue * 0.453592 : weightValue;
      
      // Validation: poids raisonnable (entre 20 kg et 300 kg)
      if (weightInKg < 20 || weightInKg > 300) {
        setWeightError(weightUnit === 'lbs' 
          ? 'Le poids doit être entre 44 lbs et 660 lbs'
          : 'Le poids doit être entre 20 kg et 300 kg');
        return;
      }
      
      setWeightError(''); // Clear error si validation OK
    }
    console.log('[Onboarding] weightInKg:', weightInKg);
    
    // Validation de la taille si fournie
    let heightInCm: number | undefined;
    if (heightFeet || heightInches) {
      const feet = parseInt(heightFeet, 10) || 0;
      const inches = parseInt(heightInches, 10) || 0;
      
      // Validation: au moins un champ rempli et valeurs raisonnables
      if (feet === 0 && inches === 0) {
        // Les deux sont vides, c'est OK (optionnel)
        heightInCm = undefined;
      } else {
        // Validation: pieds entre 3 et 8, pouces entre 0 et 11
        if (feet < 3 || feet > 8) {
          setHeightError('Les pieds doivent être entre 3 et 8');
          return;
        }
        if (inches < 0 || inches > 11) {
          setHeightError('Les pouces doivent être entre 0 et 11');
          return;
        }
        
        // Validation: taille totale raisonnable (minimum 4 pieds, maximum 7'6")
        const totalInches = feet * 12 + inches;
        if (totalInches < 48) { // 4 pieds
          setHeightError('La taille totale doit être d\'au moins 4 pieds');
          return;
        }
        if (totalInches > 90) { // 7'6"
          setHeightError('La taille totale doit être d\'au plus 7 pieds 6 pouces');
          return;
        }
        
        // Convertir en cm
        heightInCm = convertFeetInchesToCm(feet, inches);
        setHeightError(''); // Clear error si validation OK
      }
    }
    console.log('[Onboarding] heightInCm:', heightInCm);
    console.log('[Onboarding] gender:', gender);
    
    // Compute full profile
    const profile = computeUserProfile(
      goal,
      weightInKg,
      activityLevel,
      gender || undefined,
      heightInCm
    );
    console.log('[Onboarding] computed profile:', JSON.stringify(profile, null, 2));

    // Sauvegarde du profil - toujours écrire directement pour éviter les erreurs
    const firebaseUserId = (user as any)?.uid || userId;
    const profileKey = firebaseUserId ? `toki_user_profile_${firebaseUserId}` : PROFILE_KEY;
    
    // S'assurer que userId est toujours défini pour Firestore
    const fullProfile = { 
      ...profile, 
      userId: firebaseUserId || userId || undefined, 
      onboardingCompleted: true,
    };
    
    // Ajouter les valeurs de taille en pieds/pouces pour l'affichage futur
    if (heightFeet || heightInches) {
      const feet = parseInt(heightFeet, 10) || 0;
      const inches = parseInt(heightInches, 10) || 0;
      if (feet > 0 || inches > 0) {
        fullProfile.heightFeet = feet;
        fullProfile.heightInches = inches;
      }
    }
    
    await AsyncStorage.setItem(profileKey, JSON.stringify(fullProfile));
    
    console.log('[Onboarding] Profil sauvegardé:', profileKey);

    // Calculer et sauvegarder les objectifs nutritionnels personnalisés
    try {
      const { calculateNutritionTargets, updateUserNutritionTargets } = await import('../lib/nutrition-calculator');
      const calculatedTargets = calculateNutritionTargets(fullProfile);
      
      if (firebaseUserId) {
        await updateUserNutritionTargets(firebaseUserId, fullProfile);
        console.log('[Onboarding] Objectifs nutritionnels calculés:', calculatedTargets);
      }
    } catch (error) {
      console.error('[Onboarding] Erreur calcul objectifs nutritionnels:', error);
      // Continue même si ça échoue
    }

    // Si Firebase est activé, sauvegarder aussi dans Firestore
    if (FIREBASE_ENABLED && user && (user as any).uid) {
      try {
        // Filtrer les valeurs undefined pour Firestore
        const firestoreProfile: any = {};
        for (const [key, value] of Object.entries(fullProfile)) {
          if (value !== undefined) {
            firestoreProfile[key] = value;
          }
        }
        // S'assurer que userId est toujours défini et que onboardingCompleted est true
        firestoreProfile.userId = (user as any).uid;
        firestoreProfile.onboardingCompleted = true;
        
        console.log('[Onboarding] Sauvegarde Firestore avec:', firestoreProfile);
        await updateUserProfile((user as any).uid, firestoreProfile);
        console.log('[Onboarding] Profil sauvegardé dans Firestore avec succès');
      } catch (error) {
        console.error('[Onboarding] Erreur sauvegarde Firestore:', error);
        // Continuer même si Firestore échoue
      }
    }

    // Tracker l'événement analytics
    trackOnboardingCompleted({
      weightGoal: goal,
      weightKg: weightInKg,
      activityLevel,
    });
    
    // Recharger le profil dans le contexte et attendre
    await refreshProfile();
    console.log('[Onboarding] refreshProfile done');
    
    // Petit délai pour laisser le contexte se mettre à jour
    await new Promise(resolve => setTimeout(resolve, 200));

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
              style={[styles.input, weightError && styles.inputError]}
              placeholder={weightUnit === 'kg' ? "Ex: 75" : "Ex: 165"}
              keyboardType="decimal-pad"
              value={weight}
              onChangeText={(text) => {
                setWeight(text);
                setWeightError(''); // Clear error on change
              }}
            />
            {weightError ? (
              <Text style={styles.errorText}>{weightError}</Text>
            ) : (
              <Text style={styles.inputHint}>
                Optionnel - Par défaut, on utilise 165 lbs (75 kg) pour les calculs
              </Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Genre</Text>
            
            <Pressable
              style={[styles.activityOption, gender === 'male' && styles.optionSelected]}
              onPress={() => setGender('male')}
            >
              <Text style={styles.activityText}>👨 Garçon</Text>
            </Pressable>

            <Pressable
              style={[styles.activityOption, gender === 'female' && styles.optionSelected]}
              onPress={() => setGender('female')}
            >
              <Text style={styles.activityText}>👩 Fille</Text>
            </Pressable>
            
            <Text style={styles.inputHint}>
              Optionnel - Aide à calculer tes besoins caloriques plus précisément
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Taille</Text>
            
            <View style={styles.heightInputRow}>
              <View style={styles.heightInputContainer}>
                <TextInput
                  style={[styles.heightInput, heightError && styles.inputError]}
                  placeholder="Pieds"
                  keyboardType="number-pad"
                  value={heightFeet}
                  onChangeText={(text) => {
                    const num = parseInt(text, 10);
                    if (text === '' || (!isNaN(num) && num >= 0 && num <= 8)) {
                      setHeightFeet(text);
                      setHeightError('');
                    }
                  }}
                />
                <Text style={styles.heightUnitLabel}>pieds</Text>
              </View>
              
              <View style={styles.heightInputContainer}>
                <TextInput
                  style={[styles.heightInput, heightError && styles.inputError]}
                  placeholder="Pouces"
                  keyboardType="number-pad"
                  value={heightInches}
                  onChangeText={(text) => {
                    const num = parseInt(text, 10);
                    if (text === '' || (!isNaN(num) && num >= 0 && num <= 11)) {
                      setHeightInches(text);
                      setHeightError('');
                    }
                  }}
                />
                <Text style={styles.heightUnitLabel}>pouces</Text>
              </View>
            </View>
            
            {heightError ? (
              <Text style={styles.errorText}>{heightError}</Text>
            ) : (
              <Text style={styles.inputHint}>
                Optionnel - Ex: 5&apos;10&quot; (5 pieds, 10 pouces)
              </Text>
            )}
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
  
  // Convertir la taille en cm pour le preview
  let previewHeightCm: number | undefined;
  if (heightFeet || heightInches) {
    const feet = parseInt(heightFeet, 10) || 0;
    const inches = parseInt(heightInches, 10) || 0;
    if (feet > 0 || inches > 0) {
      previewHeightCm = convertFeetInchesToCm(feet, inches);
    }
  }
  
  const previewProfile = computeUserProfile(
    goal,
    previewWeightKg ?? 0,
    activityLevel,
    gender || undefined,
    previewHeightCm
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
              {previewProfile.dailyPointsBudget ?? 0} pts
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Cap maximum:</Text>
            <Text style={styles.summaryValue}>{previewProfile.maxPointsCap ?? 0} pts</Text>
          </View>
        </View>

        <View style={styles.formulaBox}>
          <Text style={styles.formulaTitle}>🧮 Comment on calcule tes besoins?</Text>
          <Text style={styles.formulaText}>
            On utilise la <Text style={styles.bold}>formule de Mifflin-St Jeor</Text>, reconnue scientifiquement comme l&apos;une des plus précises pour calculer ton métabolisme de base (BMR).
          </Text>
          <Text style={styles.formulaText}>
            Cette formule prend en compte ton <Text style={styles.bold}>poids</Text>, ta <Text style={styles.bold}>taille</Text>, ton <Text style={styles.bold}>genre</Text> et ton <Text style={styles.bold}>niveau d&apos;activité</Text> pour déterminer exactement combien de calories ton corps brûle chaque jour.
          </Text>
          <Text style={styles.formulaText}>
            Ensuite, on ajuste selon ton objectif (perte de poids, maintenance) pour te donner un budget calorique personnalisé, puis on convertit ça en <Text style={styles.bold}>points</Text> pour que ce soit simple à suivre!
          </Text>
        </View>

        <View style={styles.explainBox}>
          <Text style={styles.explainText}>
            💡 Avec <Text style={styles.bold}>{previewProfile.dailyPointsBudget ?? 0} points/jour</Text>, 
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
  formulaBox: {
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  formulaTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#166534',
    marginBottom: 12,
  },
  formulaText: {
    fontSize: 14,
    color: '#15803d',
    marginBottom: 8,
    lineHeight: 20,
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
  inputError: {
    borderColor: '#ef4444',
    borderWidth: 2,
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 4,
    fontWeight: '500',
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
  heightInputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },
  heightInputContainer: {
    flex: 1,
  },
  heightInput: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#d1d5db',
    textAlign: 'center',
  },
  heightUnitLabel: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 4,
  },
});
