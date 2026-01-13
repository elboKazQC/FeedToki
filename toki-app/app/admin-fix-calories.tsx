import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, TextInput } from 'react-native';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { Colors } from '@/constants/theme';
import { db } from '@/lib/firebase-config';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { FoodItem } from '@/lib/food-db';
import { checkIsAdmin } from '@/lib/admin-utils';

type FoodToFix = FoodItem & {
  newCalories?: number;
  originalCalories: number;
};

export default function AdminFixCaloriesScreen() {
  const { profile, user } = useAuth();
  const { activeTheme } = useTheme();
  const colors = Colors[activeTheme];
  
  const [foods, setFoods] = useState<FoodToFix[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('');
  
  const isAdmin = checkIsAdmin(user, profile);

  // Valeurs suggérées pour les aliments problématiques
  const suggestions: Record<string, { calories: number, protein: number, carbs: number, fat: number }> = {
    'poutine': { calories: 750, protein: 25, carbs: 80, fat: 40 },
    'bière': { calories: 150, protein: 1, carbs: 13, fat: 0 },
    'biere': { calories: 150, protein: 1, carbs: 13, fat: 0 },
    'bloody caesar': { calories: 150, protein: 1, carbs: 8, fat: 0 },
    'cornichon frit': { calories: 300, protein: 3, carbs: 30, fat: 18 },
    'tarte au pacane': { calories: 500, protein: 6, carbs: 65, fat: 25 },
    'tarte aux pacanes': { calories: 500, protein: 6, carbs: 65, fat: 25 },
  };

  useEffect(() => {
    loadFoods();
  }, [isAdmin]);

  const loadFoods = async () => {
    if (!db || !isAdmin) {
      setLoading(false);
      return;
    }

    try {
      const globalFoodsRef = collection(db!, 'globalFoods');
      const snapshot = await getDocs(globalFoodsRef);
      
      const allFoods: FoodToFix[] = snapshot.docs.map(doc => {
        const data = doc.data() as FoodItem;
        return {
          ...data,
          originalCalories: data.calories_kcal || 0,
        };
      });

      // Trier par calories décroissantes (les plus élevées en premier)
      allFoods.sort((a, b) => (b.originalCalories) - (a.originalCalories));
      
      setFoods(allFoods);
    } catch (error) {
      console.error('[Fix Calories] Erreur chargement:', error);
      Alert.alert('Erreur', 'Impossible de charger les aliments.');
    } finally {
      setLoading(false);
    }
  };

  const getSuggestion = (name: string): { calories: number, protein: number, carbs: number, fat: number } | null => {
    const lowerName = name.toLowerCase();
    for (const [key, value] of Object.entries(suggestions)) {
      if (lowerName.includes(key)) {
        return value;
      }
    }
    return null;
  };

  const updateFoodCalories = (foodId: string, newCalories: number) => {
    setFoods(prev => prev.map(f => 
      f.id === foodId ? { ...f, newCalories } : f
    ));
  };

  const applySuggestion = (food: FoodToFix) => {
    const suggestion = getSuggestion(food.name);
    if (suggestion) {
      updateFoodCalories(food.id, suggestion.calories);
    }
  };

  const saveChanges = async () => {
    const changedFoods = foods.filter(f => f.newCalories !== undefined && f.newCalories !== f.originalCalories);
    
    if (changedFoods.length === 0) {
      Alert.alert('Info', 'Aucune modification à sauvegarder.');
      return;
    }

    setSaving(true);
    let saved = 0;
    let errors = 0;

    for (const food of changedFoods) {
      try {
        const suggestion = getSuggestion(food.name);
        const updates: any = {
          calories_kcal: food.newCalories,
          calories: food.newCalories,
        };
        
        // Si on a une suggestion complète, appliquer aussi les macros
        if (suggestion && food.newCalories === suggestion.calories) {
          updates.protein_g = suggestion.protein;
          updates.protein = suggestion.protein;
          updates.carbs_g = suggestion.carbs;
          updates.carbs = suggestion.carbs;
          updates.fat_g = suggestion.fat;
          updates.fat = suggestion.fat;
        }

        await updateDoc(doc(db!, 'globalFoods', food.id), updates);
        saved++;
      } catch (error) {
        console.error(`Erreur mise à jour ${food.name}:`, error);
        errors++;
      }
    }

    setSaving(false);
    
    if (errors > 0) {
      Alert.alert('Partiel', `${saved} aliment(s) modifié(s), ${errors} erreur(s).`);
    } else {
      Alert.alert('Succès', `✅ ${saved} aliment(s) corrigé(s)!\n\nRafraîchis l'app pour voir les nouvelles moyennes.`);
      // Recharger pour voir les changements
      loadFoods();
    }
  };

  const filteredFoods = foods.filter(f => 
    f.name.toLowerCase().includes(filter.toLowerCase())
  );

  if (!isAdmin) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Text style={styles.accessDeniedEmoji}>🔒</Text>
        <Text style={[styles.accessDeniedText, { color: colors.text.primary }]}>
          Accès réservé aux administrateurs
        </Text>
        <TouchableOpacity style={styles.backButtonCentered} onPress={() => router.back()}>
          <Text style={styles.backButtonCenteredText}>← Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={[styles.backButtonText, { color: colors.primary }]}>← Retour</Text>
        </TouchableOpacity>

        <Text style={[styles.title, { color: colors.text.primary }]}>
          🔧 Corriger Calories
        </Text>
        <Text style={[styles.subtitle, { color: colors.icon }]}>
          Modifier les calories des aliments estimés
        </Text>

        {/* Filtrer */}
        <TextInput
          style={[styles.filterInput, { backgroundColor: activeTheme === 'dark' ? '#374151' : '#f3f4f6', color: colors.text.primary }]}
          placeholder="Filtrer par nom..."
          placeholderTextColor={colors.icon}
          value={filter}
          onChangeText={setFilter}
        />

        {/* Bouton sauvegarder */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={saveChanges}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? '⏳ Sauvegarde...' : '💾 Sauvegarder les modifications'}
          </Text>
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loading} />
        ) : (
          <View style={styles.section}>
            {filteredFoods.map((food) => {
              const suggestion = getSuggestion(food.name);
              const isHighCalorie = food.originalCalories > 1000;
              
              return (
                <View
                  key={food.id}
                  style={[
                    styles.foodCard, 
                    { backgroundColor: activeTheme === 'dark' ? '#1f2937' : '#fff' },
                    isHighCalorie && styles.foodCardWarning
                  ]}
                >
                  <Text style={[styles.foodName, { color: colors.text.primary }]}> 
                    {food.name}
                  </Text>
                  
                  <View style={styles.calorieRow}>
                    <Text style={[styles.originalCalories, { color: isHighCalorie ? '#ef4444' : colors.icon }]}>
                      Actuel: {food.originalCalories} kcal
                    </Text>
                    
                    <TextInput
                      style={[styles.calorieInput, { backgroundColor: activeTheme === 'dark' ? '#374151' : '#f3f4f6', color: colors.text.primary }]}
                      placeholder="Nouveau"
                      placeholderTextColor={colors.icon}
                      keyboardType="numeric"
                      value={food.newCalories?.toString() || ''}
                      onChangeText={(text) => updateFoodCalories(food.id, parseInt(text) || 0)}
                    />
                  </View>

                  {suggestion && food.originalCalories > suggestion.calories + 100 && (
                    <TouchableOpacity
                      style={styles.suggestionButton}
                      onPress={() => applySuggestion(food)}
                    >
                      <Text style={styles.suggestionButtonText}>
                        💡 Suggéré: {suggestion.calories} kcal
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
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
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  backButton: {
    marginBottom: 20,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  backButtonCentered: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
  },
  backButtonCenteredText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  accessDeniedEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  accessDeniedText: {
    fontSize: 18,
    textAlign: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 20,
  },
  filterInput: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: '#10b981',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  saveButtonDisabled: {
    backgroundColor: '#6b7280',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loading: {
    marginTop: 40,
  },
  section: {
    gap: 12,
  },
  foodCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  foodCardWarning: {
    borderWidth: 2,
    borderColor: '#ef4444',
  },
  foodName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  calorieRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  originalCalories: {
    fontSize: 14,
    flex: 1,
  },
  calorieInput: {
    padding: 10,
    borderRadius: 8,
    width: 100,
    textAlign: 'center',
    fontSize: 16,
  },
  suggestionButton: {
    backgroundColor: '#fef3c7',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
    alignItems: 'center',
  },
  suggestionButtonText: {
    color: '#92400e',
    fontWeight: '600',
  },
});
