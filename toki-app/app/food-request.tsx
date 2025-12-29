import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addFoodRequest } from '../lib/requests-store';
import { useAuth } from '../lib/auth-context';
import { useTheme } from '../lib/theme-context';
import { Colors } from '../constants/theme';
import { validateFoodName, validateOptionalNutrition } from '../lib/validation';

export type FoodRequest = {
  id: string;
  userId: string;
  userEmail: string;
  foodName: string;
  brand?: string;
  portion?: string;
  calories?: string;
  protein?: string;
  carbs?: string;
  fat?: string;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
};

const REQUESTS_KEY = 'feedtoki_food_requests_v1';

export default function FoodRequestScreen() {
  const { profile, user } = useAuth();
  const { activeTheme } = useTheme();
  const colors = Colors[activeTheme];
  const params = useLocalSearchParams<{ q?: string }>();
  
  const [foodName, setFoodName] = useState(String(params.q || ''));
  const [brand, setBrand] = useState('');
  const [portion, setPortion] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    // Validation du nom
    const nameValidation = validateFoodName(foodName);
    if (!nameValidation.isValid) {
      Alert.alert('Erreur', nameValidation.error || 'Le nom de l\'aliment est requis');
      return;
    }

    // Validation des valeurs nutritionnelles optionnelles
    const caloriesValidation = validateOptionalNutrition(calories, 'calories');
    if (!caloriesValidation.isValid) {
      Alert.alert('Erreur', caloriesValidation.error || 'Valeur de calories invalide');
      return;
    }

    const proteinValidation = validateOptionalNutrition(protein, 'protein');
    if (!proteinValidation.isValid) {
      Alert.alert('Erreur', proteinValidation.error || 'Valeur de protéines invalide');
      return;
    }

    const carbsValidation = validateOptionalNutrition(carbs, 'carbs');
    if (!carbsValidation.isValid) {
      Alert.alert('Erreur', carbsValidation.error || 'Valeur de glucides invalide');
      return;
    }

    const fatValidation = validateOptionalNutrition(fat, 'fat');
    if (!fatValidation.isValid) {
      Alert.alert('Erreur', fatValidation.error || 'Valeur de lipides invalide');
      return;
    }

    setIsSubmitting(true);

    try {
      const request: FoodRequest = {
        id: Date.now().toString(),
        userId: profile?.userId || (user as any)?.id || 'anonymous',
        userEmail: profile?.email || (user as any)?.email || 'inconnu',
        foodName: foodName.trim(),
        brand: brand.trim() || undefined,
        portion: portion.trim() || undefined,
        calories: calories.trim() || undefined,
        protein: protein.trim() || undefined,
        carbs: carbs.trim() || undefined,
        fat: fat.trim() || undefined,
        notes: notes.trim() || undefined,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      // Sauvegarder dans AsyncStorage et fichier (si possible)
      await addFoodRequest(request);

      Alert.alert(
        '✅ Demande envoyée!',
        `Ta demande pour "${foodName}" a été enregistrée. Elle sera traitée prochainement.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );

      // Reset form
      setFoodName('');
      setBrand('');
      setPortion('');
      setCalories('');
      setProtein('');
      setCarbs('');
      setFat('');
      setNotes('');
    } catch (e) {
      console.error('Erreur soumission demande:', e);
      Alert.alert('Erreur', 'Une erreur est survenue. Réessaie plus tard.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.push('/(tabs)')}>
            <Text style={[styles.backButtonText, { color: colors.tint }]}>← Retour</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.title, { color: colors.text }]}>🍽️ Demander un aliment</Text>
        <Text style={[styles.subtitle, { color: colors.icon }]}>
          Tu ne trouves pas un aliment? Fais une demande et on l&apos;ajoutera!
        </Text>

        {/* Formulaire */}
        <View style={styles.form}>
          {/* Nom de l'aliment (requis) */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Nom de l&apos;aliment *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: activeTheme === 'dark' ? '#1f2937' : '#fff', color: colors.text }]}
              placeholder="Ex: Poutine, Poulet BBQ..."
              placeholderTextColor={colors.icon}
              value={foodName}
              onChangeText={setFoodName}
            />
          </View>

          {/* Marque (optionnel) */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Marque (optionnel)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: activeTheme === 'dark' ? '#1f2937' : '#fff', color: colors.text }]}
              placeholder="Ex: McDonald's, St-Hubert..."
              placeholderTextColor={colors.icon}
              value={brand}
              onChangeText={setBrand}
            />
          </View>

          {/* Portion (optionnel) */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Portion (optionnel)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: activeTheme === 'dark' ? '#1f2937' : '#fff', color: colors.text }]}
              placeholder="Ex: 1 assiette, 250g, 1 sandwich..."
              placeholderTextColor={colors.icon}
              value={portion}
              onChangeText={setPortion}
            />
          </View>

          {/* Section Nutrition (optionnel) */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Informations nutritionnelles (si tu les connais)
          </Text>

          <View style={styles.nutritionRow}>
            <View style={styles.nutritionCol}>
              <Text style={[styles.labelSmall, { color: colors.text }]}>Calories</Text>
              <TextInput
                style={[styles.inputSmall, { backgroundColor: activeTheme === 'dark' ? '#1f2937' : '#fff', color: colors.text }]}
                placeholder="kcal"
                placeholderTextColor={colors.icon}
                keyboardType="numeric"
                value={calories}
                onChangeText={setCalories}
              />
            </View>
            <View style={styles.nutritionCol}>
              <Text style={[styles.labelSmall, { color: colors.text }]}>Protéines</Text>
              <TextInput
                style={[styles.inputSmall, { backgroundColor: activeTheme === 'dark' ? '#1f2937' : '#fff', color: colors.text }]}
                placeholder="g"
                placeholderTextColor={colors.icon}
                keyboardType="numeric"
                value={protein}
                onChangeText={setProtein}
              />
            </View>
            <View style={styles.nutritionCol}>
              <Text style={[styles.labelSmall, { color: colors.text }]}>Glucides</Text>
              <TextInput
                style={[styles.inputSmall, { backgroundColor: activeTheme === 'dark' ? '#1f2937' : '#fff', color: colors.text }]}
                placeholder="g"
                placeholderTextColor={colors.icon}
                keyboardType="numeric"
                value={carbs}
                onChangeText={setCarbs}
              />
            </View>
            <View style={styles.nutritionCol}>
              <Text style={[styles.labelSmall, { color: colors.text }]}>Lipides</Text>
              <TextInput
                style={[styles.inputSmall, { backgroundColor: activeTheme === 'dark' ? '#1f2937' : '#fff', color: colors.text }]}
                placeholder="g"
                placeholderTextColor={colors.icon}
                keyboardType="numeric"
                value={fat}
                onChangeText={setFat}
              />
            </View>
          </View>

          {/* Notes (optionnel) */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Notes additionnelles (optionnel)</Text>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: activeTheme === 'dark' ? '#1f2937' : '#fff', color: colors.text }]}
              placeholder="Autres infos utiles..."
              placeholderTextColor={colors.icon}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Bouton soumettre */}
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            <Text style={styles.submitButtonText}>
              {isSubmitting ? '⏳ Envoi...' : '📤 Envoyer la demande'}
            </Text>
          </TouchableOpacity>
        </View>
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
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 24,
    lineHeight: 20,
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  labelSmall: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  input: {
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  inputSmall: {
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#374151',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
  },
  nutritionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  nutritionCol: {
    flex: 1,
  },
  submitButton: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
