// Écran de logging alimentaire via IA
// Permet de décrire un repas en texte ou voix, et l'IA extrait les aliments

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { parseMealDescription } from '../lib/ai-meal-parser';
import { findBestMatch, createFoodItemRef, findMultipleMatches } from '../lib/food-matcher';
import { createEstimatedFoodItem } from '../lib/nutrition-estimator';
import { FoodItem, FOOD_DB } from '../lib/food-db';
import { FoodItemRef } from '../lib/stats';
import { getPortionsForItem, getDefaultPortion } from '../lib/portions';
import { computeFoodPoints } from '../lib/points-utils';

type DetectedItem = {
  originalName: string;
  matchedItem: FoodItem | null;
  estimatedItem?: FoodItem;
  portion: ReturnType<typeof getDefaultPortion>;
  itemRef: FoodItemRef;
  pointsCost: number;
};

export default function AILoggerScreen() {
  const [description, setDescription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedItems, setDetectedItems] = useState<DetectedItem[]>([]);
  const [error, setError] = useState<string>('');

  const handleParse = async () => {
    if (!description.trim()) {
      setError('Veuillez décrire ce que vous avez mangé');
      return;
    }

    setIsProcessing(true);
    setError('');
    setDetectedItems([]);

    try {
      // 1. Parser la description avec IA
      const parseResult = await parseMealDescription(description);

      if (parseResult.error || parseResult.items.length === 0) {
        setError(parseResult.error || 'Aucun aliment détecté. Essayez de décrire plus précisément.');
        setIsProcessing(false);
        return;
      }

      // 2. Pour chaque item détecté, essayer de matcher avec la DB
      const items: DetectedItem[] = [];

      for (const parsedItem of parseResult.items) {
        // Essayer de trouver un match dans la DB
        const match = findBestMatch(parsedItem.name, 0.5);

        let foodItem: FoodItem;
        let portion = getDefaultPortion([]);

        if (match) {
          // Item trouvé dans la DB
          foodItem = match;
          portion = getDefaultPortion(match.tags);
        } else {
          // Item non trouvé, créer une estimation
          foodItem = createEstimatedFoodItem(parsedItem.name, description);
          portion = getDefaultPortion(foodItem.tags);
        }

        // Créer le FoodItemRef
        const itemRef = createFoodItemRef(foodItem, portion);

        // Calculer le coût en points
        const pointsCost = computeFoodPoints(foodItem) * Math.sqrt(portion.multiplier);

        items.push({
          originalName: parsedItem.name,
          matchedItem: match || undefined,
          estimatedItem: match ? undefined : foodItem,
          portion,
          itemRef,
          pointsCost: Math.round(pointsCost),
        });
      }

      setDetectedItems(items);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du parsing');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirm = () => {
    if (detectedItems.length === 0) {
      Alert.alert('Erreur', 'Aucun aliment à enregistrer');
      return;
    }

    // Retourner vers l'écran précédent avec les items détectés
    // On utilise les params de route pour passer les données
    router.back();
    
    // TODO: Intégrer avec l'écran d'ajout de repas pour auto-remplir
    // Pour l'instant, on affiche juste un message
    Alert.alert(
      'Repas détecté',
      `${detectedItems.length} aliment(s) détecté(s). Fonctionnalité d'enregistrement automatique à venir.`,
      [{ text: 'OK' }]
    );
  };

  const handleEditItem = (index: number) => {
    // TODO: Ouvrir un modal pour éditer l'item
    Alert.alert('Édition', 'Fonctionnalité d\'édition à venir');
  };

  const handleRemoveItem = (index: number) => {
    setDetectedItems(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Log avec IA 🧠</Text>
      </View>

      <Text style={styles.subtitle}>
        Décris ce que tu as mangé et l&apos;IA va extraire les aliments automatiquement.
      </Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          placeholder="Ex: Cet après-midi j'ai mangé un beef stick et une pomme"
          placeholderTextColor="#9ca3af"
          value={description}
          onChangeText={(text) => {
            setDescription(text);
            setError('');
          }}
          multiline
          numberOfLines={4}
        />
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.parseButton, isProcessing && styles.parseButtonDisabled]}
        onPress={handleParse}
        disabled={isProcessing}
      >
        {isProcessing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.parseButtonText}>Analyser 🚀</Text>
        )}
      </TouchableOpacity>

      {detectedItems.length > 0 && (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsTitle}>Aliments détectés ({detectedItems.length})</Text>

          {detectedItems.map((item, index) => (
            <View key={index} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemName}>{item.originalName}</Text>
                <Text style={styles.itemPoints}>{item.pointsCost} pts</Text>
              </View>

              {item.matchedItem ? (
                <View style={styles.itemInfo}>
                  <Text style={styles.itemMatch}>
                    ✓ Match: {item.matchedItem.name}
                  </Text>
                  <Text style={styles.itemDetails}>
                    {item.matchedItem.calories_kcal || 0} cal · {item.matchedItem.protein_g || 0}g prot
                  </Text>
                </View>
              ) : item.estimatedItem ? (
                <View style={styles.itemInfo}>
                  <Text style={styles.itemEstimate}>
                    ⚠ Estimé (non trouvé dans la DB)
                  </Text>
                  <Text style={styles.itemDetails}>
                    {item.estimatedItem.calories_kcal || 0} cal · {item.estimatedItem.protein_g || 0}g prot
                  </Text>
                </View>
              ) : null}

              <View style={styles.itemActions}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => handleEditItem(index)}
                >
                  <Text style={styles.editButtonText}>✏️ Modifier</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => handleRemoveItem(index)}
                >
                  <Text style={styles.removeButtonText}>✕ Retirer</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
            <Text style={styles.confirmButtonText}>
              Confirmer et enregistrer ({detectedItems.reduce((sum, item) => sum + item.pointsCost, 0)} pts)
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.hintBox}>
        <Text style={styles.hintTitle}>💡 Astuce</Text>
        <Text style={styles.hintText}>
          Sois aussi précis que possible. Mentionne les quantités si tu les connais (ex: &quot;200g de poulet&quot;).
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  backButton: {
    marginBottom: 12,
  },
  backButtonText: {
    color: '#60a5fa',
    fontSize: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fbbf24',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#9ca3af',
    marginBottom: 24,
    lineHeight: 22,
  },
  inputContainer: {
    marginBottom: 16,
  },
  textInput: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#e5e7eb',
    borderWidth: 1,
    borderColor: '#374151',
    minHeight: 120,
    textAlignVertical: 'top',
  },
  errorBox: {
    backgroundColor: '#7f1d1d',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 14,
  },
  parseButton: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  parseButtonDisabled: {
    opacity: 0.6,
  },
  parseButtonText: {
    color: '#022c22',
    fontSize: 18,
    fontWeight: 'bold',
  },
  resultsContainer: {
    marginTop: 8,
    marginBottom: 24,
  },
  resultsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#e5e7eb',
    marginBottom: 16,
  },
  itemCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e5e7eb',
    flex: 1,
  },
  itemPoints: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fbbf24',
  },
  itemInfo: {
    marginBottom: 12,
  },
  itemMatch: {
    fontSize: 14,
    color: '#22c55e',
    marginBottom: 4,
  },
  itemEstimate: {
    fontSize: 14,
    color: '#f59e0b',
    marginBottom: 4,
  },
  itemDetails: {
    fontSize: 12,
    color: '#9ca3af',
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    flex: 1,
    backgroundColor: '#1e3a8a',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#93c5fd',
    fontSize: 14,
    fontWeight: '600',
  },
  removeButton: {
    flex: 1,
    backgroundColor: '#7f1d1d',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#fca5a5',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  confirmButtonText: {
    color: '#022c22',
    fontSize: 18,
    fontWeight: 'bold',
  },
  hintBox: {
    backgroundColor: '#1e3a8a',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
  },
  hintTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fbbf24',
    marginBottom: 8,
  },
  hintText: {
    fontSize: 14,
    color: '#e5e7eb',
    lineHeight: 20,
  },
});

