// Écran de logging alimentaire via IA
// Permet de décrire un repas en texte ou voix, et l'IA extrait les aliments

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { parseMealDescription } from '../lib/ai-meal-parser';
import { findBestMatch, createFoodItemRef, findMultipleMatches } from '../lib/food-matcher';
import { createEstimatedFoodItem } from '../lib/nutrition-estimator';
import { validateMealDescription } from '../lib/validation';
import { FoodItem, FOOD_DB } from '../lib/food-db';
import { FoodItemRef } from '../lib/stats';
import { getPortionsForItem, getDefaultPortion } from '../lib/portions';
import { useAuth } from '../lib/auth-context';
import { addCustomFood, loadCustomFoods, mergeFoodsWithCustom } from '../lib/custom-foods';
import { MealEntry } from '../lib/stats';
import { classifyMealByItems } from '../lib/classifier';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncMealEntryToFirestore } from '../lib/data-sync';
import { trackAIParserUsed, trackMealLogged } from '../lib/analytics';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { spacing } from '../constants/design-tokens';
import { searchAndMapBestProduct } from '../lib/open-food-facts';
import { logger } from '../lib/logger';
import { PaywallModal } from '../components/paywall-modal';

type ItemSource = 'db' | 'off' | 'estimated';

/**
 * Normaliser un nom d'aliment pour la comparaison (enlever accents, minuscules, trim)
 */
function normalizeFoodName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[ç]/g, 'c')
    .replace(/[^a-z0-9\s]/g, '') // Enlever caractères spéciaux
    .replace(/\s+/g, ' ') // Normaliser espaces
    .trim();
}

/**
 * Convertir une quantité prédite par l'IA en multiplier de portion
 * @param quantityNumber Nombre extrait (ex: 200 pour "200g", 2 pour "2 portions")
 * @param quantity String de quantité (ex: "200g", "2 portions", "1 tasse")
 * @param foodItem L'aliment pour déterminer la portion standard
 * @param defaultPortion La portion par défaut pour cet aliment
 * @returns Multiplier à appliquer (ex: 2.0 pour 200g si portion standard = 100g)
 */
function convertQuantityToMultiplier(
  quantityNumber: number | undefined,
  quantity: string | undefined,
  foodItem: FoodItem,
  defaultPortion: ReturnType<typeof getDefaultPortion>
): number {
  if (!quantityNumber || quantityNumber <= 0) {
    return defaultPortion.multiplier; // Utiliser la portion par défaut
  }

  const quantityLower = (quantity || '').toLowerCase();
  
  // Si c'est en grammes (g, kg)
  if (quantityLower.includes('g') || quantityLower.includes('gramme')) {
    // Convertir kg en g si nécessaire
    let grams = quantityNumber;
    if (quantityLower.includes('kg')) {
      grams = quantityNumber * 1000;
    }
    
    // Calculer le multiplier basé sur les grammes par rapport à la portion standard
    // La portion standard a un certain nombre de grammes (defaultPortion.grams)
    if (defaultPortion.grams > 0) {
      return grams / defaultPortion.grams;
    }
    // Fallback: utiliser quantityNumber directement si on ne peut pas calculer
    return quantityNumber / 100; // Assume 100g = 1 portion
  }
  
  // Si c'est en ml (millilitres)
  if (quantityLower.includes('ml') || quantityLower.includes('l') || quantityLower.includes('litre')) {
    let ml = quantityNumber;
    if (quantityLower.includes('l') && !quantityLower.includes('ml')) {
      ml = quantityNumber * 1000;
    }
    // Pour les liquides, assumer 250ml = 1 portion (1 tasse)
    return ml / 250;
  }
  
  // Cuillères (tablespoon/teaspoon)
  if (quantityLower.includes('cuillère à soupe') || quantityLower.includes('cuillere à soupe') || 
      quantityLower.includes('c. à soupe') || quantityLower.includes('càs') || quantityLower.includes('tbsp')) {
    // 1 cuillère à soupe ≈ 15ml/15g
    const totalAmount = quantityNumber * 15;
    return totalAmount / defaultPortion.grams;
  }
  
  if (quantityLower.includes('cuillère à thé') || quantityLower.includes('cuillere à thé') || 
      quantityLower.includes('c. à thé') || quantityLower.includes('càt') || quantityLower.includes('tsp')) {
    // 1 cuillère à thé ≈ 5ml/5g
    const totalAmount = quantityNumber * 5;
    return totalAmount / defaultPortion.grams;
  }
  
  if (quantityLower.includes('cuillère') || quantityLower.includes('cuillere')) {
    // Cuillère générique (assumer cuillère à soupe par défaut)
    const totalAmount = quantityNumber * 15;
    return totalAmount / defaultPortion.grams;
  }
  
  // Verre/glass
  if (quantityLower.includes('verre') || quantityLower.includes('glass')) {
    // 1 verre ≈ 250ml
    const totalAmount = quantityNumber * 250;
    return totalAmount / defaultPortion.grams;
  }
  
  // Bol/bowl
  if (quantityLower.includes('bol') || quantityLower.includes('bowl')) {
    // 1 bol ≈ 400ml
    const totalAmount = quantityNumber * 400;
    return totalAmount / defaultPortion.grams;
  }
  
  // Si c'est en portions, toasts, tasses, etc.
  if (quantityLower.includes('portion') || 
      quantityLower.includes('toast') || 
      quantityLower.includes('tasse') ||
      quantityLower.includes('pc') ||
      quantityLower.includes('piece') ||
      quantityLower.includes('tranche')) {
    // Le quantityNumber représente déjà le nombre de portions
    // ⚠️ CAPPER à 3.0 max pour éviter des multipliers absurdes (ex: "2.5 portions" → capped à 2.0)
    const portionMultiplier = Math.min(quantityNumber, 3.0);
    
    // Si c'est un nombre décimal non-sens (ex: 2.5), arrondir à l'entier le plus proche
    if (!Number.isInteger(quantityNumber) && quantityNumber > 1.5) {
      // Probabilité: l'IA a mal estimé, arrondir à 1 ou 2
      console.warn(`[Multiplier] ⚠️ Portion décimale détectée: ${quantityNumber}, arrondissement`, {
        original: quantityNumber,
        rounded: Math.round(quantityNumber),
      });
      return Math.round(quantityNumber); // 2.5 → 2 ou 3 selon arrondi
    }
    
    return portionMultiplier;
  }
  
  // Par défaut, utiliser quantityNumber comme multiplier direct (avec cap)
  // Capper à 5.0 max pour éviter des erreurs dramatiques
  return Math.min(quantityNumber, 5.0);
}

type DetectedItem = {
  originalName: string;
  matchedItem: FoodItem | null;
  estimatedItem?: FoodItem;
  offItem?: FoodItem;
  portion: ReturnType<typeof getDefaultPortion>;
  itemRef: FoodItemRef;
  source: ItemSource;
  quantity?: string; // Quantité prédite par l'IA (ex: "200g", "2 portions")
  quantityNumber?: number; // Nombre extrait (ex: 200 pour "200g", 2 pour "2 portions")
};

export default function AILoggerScreen() {
  const params = useLocalSearchParams<{ initialText?: string }>();
  const { profile, user } = useAuth();
  const [description, setDescription] = useState(params.initialText || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedItems, setDetectedItems] = useState<DetectedItem[]>([]);
  const [error, setError] = useState<string>('');
  
  // États pour diagnostic (visible sans console)
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnosticInfo, setDiagnosticInfo] = useState<{
    parserMode: 'OpenAI' | 'Fallback' | null;
    platform: string;
    itemsResolved: Array<{
      input: string;
      matched: string;
      source: ItemSource;
      baseCalories: number;
      multiplier: number;
      finalCalories: number;
    }>;
  }>({
    parserMode: null,
    platform: Platform.OS,
    itemsResolved: [],
  });
  
  // États pour la modification de quantité
  const [editingQuantityIndex, setEditingQuantityIndex] = useState<number | null>(null);
  const [quantityInput, setQuantityInput] = useState<string>('');
  
  // États pour vérification subscription
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  
  // Référence pour stocker le temps de début du parsing
  const parsingStartTimeRef = useRef<number | null>(null);
  
  // Vérifier l'accès à l'IA (après tous les hooks)
  useEffect(() => {
    const checkAccess = async () => {
      const currentUserId = (user as any)?.uid;
      if (!currentUserId || currentUserId === 'guest') {
        setHasAccess(false);
        setShowPaywall(true);
        return;
      }
      
      try {
        const { hasActiveSubscription } = await import('../lib/subscription-utils');
        const access = await hasActiveSubscription(currentUserId);
        setHasAccess(access);
        if (!access) {
          setShowPaywall(true);
        }
      } catch (error) {
        console.error('[AI Logger] Erreur vérification subscription:', error);
        setHasAccess(false);
        setShowPaywall(true);
      }
    };
    
    checkAccess();
  }, [user]);
  
  // Si pas d'accès, afficher le paywall
  const shouldShowPaywall = (hasAccess === false || showPaywall) && hasAccess !== null;
  
  // Afficher un loader pendant la vérification
  if (hasAccess === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 16, color: '#000' }}>Vérification de l'abonnement...</Text>
      </View>
    );
  }

  // Si pas d'accès, afficher le paywall comme overlay
  if (shouldShowPaywall) {
    return (
      <PaywallModal
        visible={true}
        onSubscribe={() => {
          // Utiliser replace pour navigation immédiate (ferme le modal)
          router.replace('/subscription');
        }}
        onClose={() => {
          router.back();
        }}
      />
    );
  }

  const handleParse = async () => {
    // Validation de la description
    const validation = validateMealDescription(description);
    if (!validation.isValid) {
      setError(validation.error || 'Veuillez décrire ce que vous avez mangé');
      return;
    }

    // Démarrer le timer de parsing
    parsingStartTimeRef.current = Date.now();
    
    setIsProcessing(true);
    setError('');
    setDetectedItems([]);

    try {
      // 1. Vérifier que l'email est vérifié
      const currentUserId = user?.uid || undefined;
      const isEmailVerified = user?.emailVerified ?? false;
      
      if (currentUserId && currentUserId !== 'guest' && !isEmailVerified) {
        setError('Veuillez vérifier votre adresse email avant d\'utiliser l\'analyse IA. Consultez vos emails pour le lien de vérification.');
        setIsProcessing(false);
        return;
      }

      // 2. Parser la description avec IA
      const parseResult = await parseMealDescription(description, currentUserId, isEmailVerified);
      
      // Capturer le mode de parsing pour diagnostic
      const hasOpenAIKey = !!process.env.EXPO_PUBLIC_OPENAI_API_KEY;
      setDiagnosticInfo(prev => ({
        ...prev,
        parserMode: hasOpenAIKey ? 'OpenAI' : 'Fallback',
        itemsResolved: [], // Reset avant de résoudre les items
      }));

      if (!parseResult || parseResult.error || parseResult.items.length === 0) {
        // Tracker échec du parser
        try {
          trackAIParserUsed({
            description: description,
            itemsDetected: 0,
            success: false,
          });
        } catch (trackError) {
          console.warn('Erreur tracking:', trackError);
        }
        setError(parseResult?.error || 'Aucun aliment détecté. Essayez de décrire plus précisément.');
        setIsProcessing(false);
        return;
      }
      
      // Tracker succès du parser
      try {
        trackAIParserUsed({
          description: description,
          itemsDetected: parseResult.items.length,
          success: true,
        });
      } catch (trackError) {
        console.warn('Erreur tracking:', trackError);
      }

      // 2. Pour chaque item détecté, essayer de résoudre via OFF, DB, ou estimation
      const items: DetectedItem[] = [];

      for (const parsedItem of parseResult.items) {
        try {
          let foodItem: FoodItem;
          let portion = getDefaultPortion([]);
          let source: ItemSource = 'estimated';
          let match: FoodItem | null = null;
          let offItem: FoodItem | null = null;

          // Étape 1: Essayer Open Food Facts pour les produits de marque
          try {
            logger.info('[AI Logger] Recherche OFF pour:', parsedItem.name);
            offItem = await searchAndMapBestProduct(parsedItem.name);
            if (offItem) {
              logger.info('[AI Logger] Produit OFF trouvé:', offItem.name, {
                calories: offItem.calories_kcal,
                protein: offItem.protein_g,
                carbs: offItem.carbs_g,
                fat: offItem.fat_g,
              });
              
              // Vérifier si le produit OFF a des valeurs nutritionnelles valides
              const hasValidNutrition = 
                (offItem.calories_kcal && offItem.calories_kcal > 0) ||
                ((offItem.protein_g || 0) + (offItem.carbs_g || 0) + (offItem.fat_g || 0) > 0);
              
              // Si le produit OFF a des valeurs à 0 ou manquantes, fusionner avec les valeurs de l'IA
              if (!hasValidNutrition && (
                parsedItem.calories_kcal !== undefined ||
                parsedItem.protein_g !== undefined ||
                parsedItem.carbs_g !== undefined ||
                parsedItem.fat_g !== undefined
              )) {
                logger.info('[AI Logger] Fusion des valeurs: OFF a des valeurs à 0, utilisation des valeurs IA');
                // Créer un nouvel item avec les valeurs de l'IA mais garder les autres propriétés OFF (tags, points, etc.)
                foodItem = {
                  ...offItem,
                  calories_kcal: parsedItem.calories_kcal !== undefined 
                    ? Math.round(parsedItem.calories_kcal) 
                    : offItem.calories_kcal || 0,
                  protein_g: parsedItem.protein_g !== undefined 
                    ? Math.round(parsedItem.protein_g * 10) / 10 
                    : offItem.protein_g || 0,
                  carbs_g: parsedItem.carbs_g !== undefined 
                    ? Math.round(parsedItem.carbs_g * 10) / 10 
                    : offItem.carbs_g || 0,
                  fat_g: parsedItem.fat_g !== undefined 
                    ? Math.round(parsedItem.fat_g * 10) / 10 
                    : offItem.fat_g || 0,
                };
                source = 'off'; // Garder la source OFF car c'est un produit réel
              } else {
                // Le produit OFF a des valeurs valides, l'utiliser tel quel
                foodItem = offItem;
                source = 'off';
              }
              
              portion = getDefaultPortion(offItem.tags);
            }
          } catch (offError) {
            logger.warn('[AI Logger] Erreur recherche OFF:', offError);
          }

          // Étape 2: Si pas trouvé dans OFF, essayer la DB locale
          if (!offItem) {
            // Matching intelligent : si isComposite = false, être très strict pour éviter les faux positifs
            if (parsedItem.isComposite === false) {
              const strictMatch = findBestMatch(parsedItem.name, 0.85);
              if (strictMatch) {
                const matchWords = strictMatch.name.toLowerCase().split(/\s+/).length;
                const searchWords = parsedItem.name.toLowerCase().split(/\s+/).length;
                if (matchWords <= searchWords + 1) {
                  match = strictMatch;
                  
                  // ✅ VALIDATION: Vérifier cohérence entre catégorie OpenAI et tags du match
                  if (parsedItem.category === 'PROTEINE_MAIGRE' && match.tags.includes('ultra_transforme')) {
                    console.warn(
                      `[AI Logger] ⚠️ Incohérence détectée: OpenAI dit PROTEINE_MAIGRE mais match trouvé est ultra_transforme`,
                      { 
                        searched: parsedItem.name, 
                        matched: match.name,
                        matchTags: match.tags,
                        aiCategory: parsedItem.category 
                      }
                    );
                    // Rejeter ce match, créer une estimation à la place
                    match = null;
                  }
                }
              }
            } else {
              match = findBestMatch(parsedItem.name, 0.7);
            }

            if (match) {
              foodItem = match;
              portion = getDefaultPortion(match.tags);
              source = 'db';
            }
          }

          // Étape 3: Si toujours pas trouvé, créer une estimation
          if (!offItem && !match) {
            foodItem = createEstimatedFoodItem(
              parsedItem.name,
              description,
              parsedItem.category,
              parsedItem.calories_kcal !== undefined || parsedItem.protein_g !== undefined
                ? {
                    calories_kcal: parsedItem.calories_kcal,
                    protein_g: parsedItem.protein_g,
                    carbs_g: parsedItem.carbs_g,
                    fat_g: parsedItem.fat_g,
                  }
                : undefined
            );
            portion = getDefaultPortion(foodItem.tags);
            source = 'estimated';
          }

          // Calculer le multiplier depuis la quantité prédite par l'IA
          let finalPortion = portion;
          if (parsedItem.quantityNumber !== undefined && parsedItem.quantity) {
            // 🔍 VALIDATION: Vérifier si la quantité estimée par l'IA a du sens
            // Si c'est > 2.0 ET la description original dit "gros", "grande", etc. (pas de grammes/ml)
            // alors c'est probablement une mauvaise estimation, utiliser 1.0 à la place
            let validatedQuantity = parsedItem.quantityNumber;
            const quantityLower = (parsedItem.quantity || '').toLowerCase();
            
            // Si pas d'unité précise (g, ml, etc) mais quantité > 2.0, c'est suspect
            const hasExactUnit = quantityLower.includes('g') || quantityLower.includes('ml') || 
                                quantityLower.includes('l') || quantityLower.includes('kg');
            
            if (validatedQuantity > 2.0 && !hasExactUnit && description.includes('gros')) {
              console.warn(`[AI Parser] ⚠️ Quantité suspecte détectée: "${parsedItem.quantity}" (${validatedQuantity}) pour "${parsedItem.name}"`, {
                originalQuantity: parsedItem.quantity,
                parsed: validatedQuantity,
                hasExactUnit,
                description,
              });
              // Utiliser la portion par défaut (1.0x) au lieu de la quantité suspecte
              validatedQuantity = 1.0;
              console.log('[AI Parser] 🔧 Utilisation de portion standard (1.0x) à la place');
            }
            
            const calculatedMultiplier = convertQuantityToMultiplier(
              validatedQuantity,
              parsedItem.quantity,
              foodItem!,
              portion
            );
            
            // Créer une portion personnalisée avec le multiplier calculé
            finalPortion = {
              ...portion,
              size: 'custom' as const,
              label: 'Personnalisée',
              multiplier: calculatedMultiplier,
              grams: portion.grams * calculatedMultiplier,
              visualRef: parsedItem.quantity,
            };
          }

          // Créer le FoodItemRef avec la portion ajustée
          const itemRef = createFoodItemRef(foodItem!, finalPortion);
          // Ajouter la source nutritionnelle au FoodItemRef
          itemRef.nutritionSource = source;
          
          // 🔍 LOG DÉTAILLÉ pour diagnostic des divergences calories mobile/PC
          const diagnosticData = {
            input: parsedItem.name,
            matched: foodItem!.name,
            foodId: foodItem!.id,
            source: source,
            quantity: parsedItem.quantity,
            quantityNumber: parsedItem.quantityNumber,
            multiplier: finalPortion.multiplier,
            baseCalories: foodItem!.calories_kcal,
            finalCalories: Math.round(foodItem!.calories_kcal * finalPortion.multiplier),
          };
          logger.info('[AI Logger] ✅ Item résolu:', diagnosticData);
          
          // Ajouter aux diagnostics visibles
          setDiagnosticInfo(prev => ({
            ...prev,
            itemsResolved: [...prev.itemsResolved, {
              input: parsedItem.name,
              matched: foodItem!.name,
              source: source,
              baseCalories: foodItem!.calories_kcal,
              multiplier: finalPortion.multiplier,
              finalCalories: Math.round(foodItem!.calories_kcal * finalPortion.multiplier),
            }],
          }));

          items.push({
            originalName: parsedItem.name || 'Aliment inconnu',
            matchedItem: match || null,
            estimatedItem: (!offItem && !match) ? foodItem : undefined,
            offItem: offItem || undefined,
            portion: finalPortion,
            itemRef,
            source,
            quantity: parsedItem.quantity,
            quantityNumber: parsedItem.quantityNumber,
          });
        } catch (itemError: any) {
          console.error('Erreur traitement item:', itemError);
          // Continuer avec les autres items même si un échoue
        }
      }

      if (items.length === 0) {
        setError('Impossible d\'analyser les aliments. Essayez une autre description.');
      } else {
        setDetectedItems(items);
      }
    } catch (err: any) {
      console.error('Erreur parsing:', err);
      setError(err?.message || 'Erreur lors du parsing. Veuillez réessayer.');
    } finally {
      setIsProcessing(false);
    }
  };

  const currentUserId = profile?.userId || (user as any)?.uid || (user as any)?.id || 'guest';
  const isEmailVerified = user?.emailVerified ?? false;
  const canUseAI = !currentUserId || currentUserId === 'guest' || isEmailVerified;


  const handleConfirm = async () => {
    if (detectedItems.length === 0) {
      Alert.alert('Erreur', 'Aucun aliment à enregistrer');
      return;
    }

    try {
      // 1. Sauvegarder TOUS les aliments analysés par l'IA dans la DB personnalisée
      // Charger les custom foods existants pour vérifier les doublons
      const existingCustomFoods = await loadCustomFoods(currentUserId !== 'guest' ? currentUserId : undefined);
      const existingNamesMap = new Map<string, FoodItem>();
      for (const food of existingCustomFoods) {
        const normalizedName = normalizeFoodName(food.name);
        existingNamesMap.set(normalizedName, food);
      }

      let foodsAdded = 0;
      let foodsUpdated = 0;

      for (const item of detectedItems) {
        // Déterminer quel aliment sauvegarder (priorité: offItem > matchedItem > estimatedItem)
        const foodToSave: FoodItem | null = 
          item.offItem || 
          item.matchedItem || 
          item.estimatedItem || 
          null;

        if (!foodToSave) continue;

        // Normaliser le nom pour vérifier les doublons
        const normalizedName = normalizeFoodName(foodToSave.name);
        const existingFood = existingNamesMap.get(normalizedName);

        if (existingFood) {
          // Aliment existe déjà, mettre à jour avec les nouvelles données
          const updatedFood: FoodItem = {
            ...existingFood,
            // Mettre à jour les valeurs nutritionnelles si elles sont meilleures/mises à jour
            calories_kcal: foodToSave.calories_kcal || existingFood.calories_kcal || 0,
            protein_g: foodToSave.protein_g !== undefined ? foodToSave.protein_g : (existingFood.protein_g || 0),
            carbs_g: foodToSave.carbs_g !== undefined ? foodToSave.carbs_g : (existingFood.carbs_g || 0),
            fat_g: foodToSave.fat_g !== undefined ? foodToSave.fat_g : (existingFood.fat_g || 0),
            // Garder les tags si l'aliment existant en a, sinon utiliser ceux du nouvel aliment
            tags: existingFood.tags.length > 0 ? existingFood.tags : foodToSave.tags,
            // Garder le meilleur baseScore
            baseScore: Math.max(existingFood.baseScore || 0, foodToSave.baseScore || 0),
          };
          await addCustomFood(updatedFood, currentUserId !== 'guest' ? currentUserId : undefined);
          foodsUpdated++;
        } else {
          // Nouvel aliment, l'ajouter
          await addCustomFood(foodToSave, currentUserId !== 'guest' ? currentUserId : undefined);
          existingNamesMap.set(normalizedName, foodToSave); // Ajouter au map pour éviter doublons dans la même session
          foodsAdded++;
        }
      }

      // 2. Créer l'entrée de repas
      const items: FoodItemRef[] = detectedItems.map(item => item.itemRef);
      const classification = classifyMealByItems(items);
      
      // Générer un label automatique
      const label = detectedItems
        .map(item => item.matchedItem?.name || item.estimatedItem?.name || item.originalName)
        .join(', ');

      // Calculer le temps de parsing (depuis handleParse jusqu'à maintenant)
      const parsingTimeMs = parsingStartTimeRef.current 
        ? Date.now() - parsingStartTimeRef.current 
        : undefined;

      const newEntry: MealEntry = {
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        label,
        category: classification.category,
        score: classification.score,
        items,
        parsingTimeMs, // Stocker le temps de parsing
      };

      // 3. Sauvegarder dans AsyncStorage
      const entriesKey = `feedtoki_entries_${currentUserId}_v1`;
      const existingRaw = await AsyncStorage.getItem(entriesKey);
      const existing: MealEntry[] = existingRaw ? JSON.parse(existingRaw) : [];
      const updated = [newEntry, ...existing];
      await AsyncStorage.setItem(entriesKey, JSON.stringify(updated));

      // 4. Synchroniser avec Firestore
      if (currentUserId !== 'guest') {
        console.log('[AI Logger] 🔄 Synchronisation du repas vers Firestore...', { 
          userId: currentUserId, 
          entryId: newEntry.id,
          label: newEntry.label
        });
        await syncMealEntryToFirestore(currentUserId, newEntry);
        console.log('[AI Logger] ✅ Repas synchronisé vers Firestore');
      } else {
        console.log('[AI Logger] ⚠️ Mode guest, pas de synchronisation Firestore');
      }

      // 5. Recharger les custom foods (incluant ceux qu'on vient de sauvegarder)
      const customFoods = await loadCustomFoods(currentUserId !== 'guest' ? currentUserId : undefined);
      
      // Tracker le repas logué avec IA
      trackMealLogged({
        mealId: newEntry.id,
        category: classification.category,
        itemsCount: items.length,
        score: classification.score,
        hasAiParser: true,
      });
      
      // Logger l'événement
      const { userLogger } = await import('../lib/user-logger');
      await userLogger.info(
        currentUserId,
        `Repas enregistré via AI: ${detectedItems.length} item(s)`,
        'ai-logger',
        { itemsCount: detectedItems.length }
      );

      // 6. Retourner à l'écran principal avec succès
      // Construire le message avec les informations sur les aliments sauvegardés
      let successMessage = `✅ Repas enregistré!\n${detectedItems.length} aliment(s) enregistré(s).`;
      if (foodsAdded > 0 || foodsUpdated > 0) {
        const foodsInfo = [];
        if (foodsAdded > 0) {
          foodsInfo.push(`${foodsAdded} ajouté${foodsAdded > 1 ? 's' : ''}`);
        }
        if (foodsUpdated > 0) {
          foodsInfo.push(`${foodsUpdated} mis à jour`);
        }
        successMessage += `\n\n📦 ${foodsInfo.join(', ')} dans ta base de données. Tu pourras les réutiliser la prochaine fois !`;
      }

      // Sur le web, Alert.alert ne fonctionne pas, donc on redirige directement
      if (typeof window !== 'undefined' && Platform.OS === 'web') {
        // Sur le web, afficher un message puis rediriger
        window.alert(successMessage);
        router.replace('/');
      } else {
        Alert.alert(
          '✅ Repas enregistré!',
          successMessage,
          [{ 
            text: 'OK', 
            onPress: () => {
              router.replace('/(tabs)');
            }
          }]
        );
      }
    } catch (error: any) {
      console.error('[AI Logger] Erreur enregistrement:', error);
      Alert.alert(
        'Erreur',
        `Impossible d'enregistrer le repas: ${error.message || 'Erreur inconnue'}`
      );
    }
  };

  const handleEditItem = (index: number) => {
    // TODO: Ouvrir un modal pour éditer l'item
    Alert.alert('Édition', 'Fonctionnalité d\'édition à venir');
  };

  const handleEditQuantity = (index: number) => {
    const item = detectedItems[index];
    if (!item) return;
    
    setQuantityInput(item.quantity || '1 portion');
    setEditingQuantityIndex(index);
  };

  const handleSaveQuantity = (index: number) => {
    const item = detectedItems[index];
    if (!item) return;

    const foodItem = item.matchedItem || item.offItem || item.estimatedItem;
    if (!foodItem) return;

    // Parser la quantité entrée
    const quantityLower = quantityInput.toLowerCase().trim();
    let newQuantityNumber: number | undefined;
    
    // Extraire le nombre
    const numberMatch = quantityInput.match(/(\d+(?:\.\d+)?)/);
    if (numberMatch) {
      newQuantityNumber = parseFloat(numberMatch[1]);
    } else {
      newQuantityNumber = 1; // Par défaut
    }

    // Calculer le nouveau multiplier
    const defaultPortion = getDefaultPortion(foodItem.tags);
    const newMultiplier = convertQuantityToMultiplier(
      newQuantityNumber,
      quantityInput,
      foodItem,
      defaultPortion
    );

    // Créer une nouvelle portion avec le multiplier
    const newPortion = {
      ...defaultPortion,
      size: 'custom' as const,
      label: 'Personnalisée',
      multiplier: newMultiplier,
      grams: defaultPortion.grams * newMultiplier,
      visualRef: quantityInput,
    };

    // Recalculer le FoodItemRef et les points
    const newItemRef = createFoodItemRef(foodItem, newPortion);
    const newPointsCost = Math.round(computeFoodPoints(foodItem) * Math.sqrt(newMultiplier));

    // Mettre à jour l'item
    const updatedItems = [...detectedItems];
    updatedItems[index] = {
      ...item,
      portion: newPortion,
      itemRef: newItemRef,
      pointsCost: newPointsCost,
      quantity: quantityInput,
      quantityNumber: newQuantityNumber,
    };

    setDetectedItems(updatedItems);
    setEditingQuantityIndex(null);
    setQuantityInput('');
  };

  const handleRemoveItem = (index: number) => {
    setDetectedItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleRerollItem = async (index: number) => {
    const item = detectedItems[index];
    if (!item) return;

    // Demander à l'utilisateur ce qui ne va pas
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const problem = window.prompt(
        `Que veut-tu améliorer pour "${item.originalName}"?\n\n` +
        `1 = Ce n'est pas le bon aliment/match\n` +
        `2 = Les valeurs nutritionnelles sont incorrectes\n` +
        `3 = Les deux\n\n` +
        `Tape 1, 2 ou 3:`
      );
      
      if (!problem || !['1', '2', '3'].includes(problem)) return;
      
      await rerollSingleItem(index, item.originalName, parseInt(problem));
    } else {
      Alert.alert(
        'Améliorer cet aliment',
        `Que veut-tu améliorer pour "${item.originalName}"?`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Le match est incorrect',
            onPress: () => rerollSingleItem(index, item.originalName, 1),
          },
          {
            text: 'Les valeurs nutritionnelles',
            onPress: () => rerollSingleItem(index, item.originalName, 2),
          },
          {
            text: 'Les deux',
            onPress: () => rerollSingleItem(index, item.originalName, 3),
          },
        ]
      );
    }
  };

  const rerollSingleItem = async (index: number, foodName: string, problemType: number) => {
    setIsProcessing(true);
    setError('');

    try {
      // Réanalyser seulement cet aliment
      const currentUserId = user?.uid || undefined;
      const isEmailVerified = user?.emailVerified ?? false;
      const parseResult = await parseMealDescription(foodName, currentUserId, isEmailVerified);

      if (!parseResult || parseResult.error || parseResult.items.length === 0) {
        setError(`Impossible de réanalyser "${foodName}"`);
        setIsProcessing(false);
        return;
      }

      // Prendre le premier item analysé
      const parsedItem = parseResult.items[0];
      
      // Essayer de trouver un meilleur match si le problème est le match (1 ou 3)
      let match: FoodItem | null = null;
      if (problemType === 1 || problemType === 3) {
        // Matching intelligent : si isComposite = false, être très strict
        if (parsedItem.isComposite === false) {
          const strictMatch = findBestMatch(parsedItem.name, 0.85);
          if (strictMatch) {
            const matchWords = strictMatch.name.toLowerCase().split(/\s+/).length;
            const searchWords = parsedItem.name.toLowerCase().split(/\s+/).length;
            if (matchWords <= searchWords + 1) {
              match = strictMatch;
            }
          }
        } else {
          // Pour un plat composé, chercher avec threshold normal
          match = findBestMatch(parsedItem.name, 0.7);
        }
        
        // Si toujours pas de match, essayer avec threshold plus bas
        if (!match) {
          const matches = findMultipleMatches(parsedItem.name, 5, 0.4);
          // Filtrer les matches qui sont trop longs (plats composés pour ingrédients simples)
          const filteredMatches = parsedItem.isComposite === false
            ? matches.filter(m => {
                const matchWords = m.item.name.toLowerCase().split(/\s+/).length;
                const searchWords = parsedItem.name.toLowerCase().split(/\s+/).length;
                return matchWords <= searchWords + 1;
              })
            : matches;
          match = filteredMatches.length > 0 ? filteredMatches[0].item : null;
        }
      } else {
        // Garder le match actuel si le problème est juste les valeurs nutritionnelles
        match = detectedItems[index].matchedItem || null;
      }

      let foodItem: FoodItem;
      let portion = getDefaultPortion([]);

      if (match) {
        foodItem = match;
        portion = getDefaultPortion(match.tags);
        
        // Si le problème inclut les valeurs nutritionnelles (2 ou 3), utiliser celles d'OpenAI
        if ((problemType === 2 || problemType === 3) && parsedItem.calories_kcal !== undefined) {
          // Créer un item avec les valeurs nutritionnelles d'OpenAI mais garder les tags du match
          foodItem = {
            ...match,
            calories_kcal: parsedItem.calories_kcal,
            protein_g: parsedItem.protein_g,
            carbs_g: parsedItem.carbs_g,
            fat_g: parsedItem.fat_g,
          };
        }
      } else {
        // Créer une estimation avec les valeurs d'OpenAI
        foodItem = createEstimatedFoodItem(
          parsedItem.name,
          foodName,
          parsedItem.category,
          parsedItem.calories_kcal !== undefined || parsedItem.protein_g !== undefined
            ? {
                calories_kcal: parsedItem.calories_kcal,
                protein_g: parsedItem.protein_g,
                carbs_g: parsedItem.carbs_g,
                fat_g: parsedItem.fat_g,
              }
            : undefined
        );
        portion = getDefaultPortion(foodItem.tags);
      }

      // Créer le FoodItemRef
      const itemRef = createFoodItemRef(foodItem, portion);

      // Calculer le coût en points
      const pointsCost = computeFoodPoints(foodItem) * Math.sqrt(portion.multiplier);

      // Calculer le multiplier depuis la quantité prédite par l'IA
      let finalPortion = portion;
      if (parsedItem.quantityNumber !== undefined && parsedItem.quantity) {
        const calculatedMultiplier = convertQuantityToMultiplier(
          parsedItem.quantityNumber,
          parsedItem.quantity,
          foodItem,
          portion
        );
        
        // Créer une portion personnalisée avec le multiplier calculé
        finalPortion = {
          ...portion,
          size: 'custom' as const,
          label: 'Personnalisée',
          multiplier: calculatedMultiplier,
          grams: portion.grams * calculatedMultiplier,
          visualRef: parsedItem.quantity,
        };
      }

      // Recalculer le FoodItemRef et les points avec la portion ajustée
      const finalItemRef = createFoodItemRef(foodItem, finalPortion);
      const finalPointsCost = Math.round(computeFoodPoints(foodItem) * Math.sqrt(finalPortion.multiplier));

      // Remplacer l'item à l'index donné
      const updatedItems = [...detectedItems];
      updatedItems[index] = {
        originalName: parsedItem.name || foodName,
        matchedItem: match || null,
        estimatedItem: match ? undefined : foodItem,
        offItem: undefined,
        portion: finalPortion,
        itemRef: finalItemRef,
        pointsCost: finalPointsCost,
        source: match ? 'db' : 'estimated',
        quantity: parsedItem.quantity,
        quantityNumber: parsedItem.quantityNumber,
      };

      setDetectedItems(updatedItems);
    } catch (err: any) {
      console.error('Erreur reroll item:', err);
      setError(`Erreur lors de la réanalyse: ${err.message || 'Erreur inconnue'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.push('/(tabs)')} style={styles.backButton}>
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

      {!canUseAI && currentUserId && currentUserId !== 'guest' && (
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>
            ⚠️ Vérification email requise. Veuillez vérifier votre adresse email avant d'utiliser l'analyse IA.
          </Text>
        </View>
      )}
      
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.parseButton, (isProcessing || !canUseAI) && styles.parseButtonDisabled]}
          onPress={handleParse}
          disabled={isProcessing || !canUseAI}
        >
          {isProcessing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.parseButtonText}>
              {canUseAI ? 'Analyser 🚀' : 'Vérification email requise'}
            </Text>
          )}
        </TouchableOpacity>
        
        {/* Bouton de diagnostic pour mobile */}
        <TouchableOpacity
          style={styles.diagnosticButton}
          onPress={() => setShowDiagnostics(!showDiagnostics)}
        >
          <Text style={styles.diagnosticButtonText}>
            {showDiagnostics ? '🔧 Cacher diagnostic' : '🔧 Afficher diagnostic'}
          </Text>
        </TouchableOpacity>

      </View>

      {/* Panneau de diagnostic visible (sans console) */}
      {showDiagnostics && (
        <Card variant="outlined" style={{ marginBottom: spacing.md, backgroundColor: '#1e293b' }}>
          <Text style={styles.diagnosticTitle}>🔧 Diagnostic Système</Text>
          
          <View style={styles.diagnosticSection}>
            <Text style={styles.diagnosticLabel}>📱 Plateforme:</Text>
            <Text style={styles.diagnosticValue}>{diagnosticInfo.platform}</Text>
          </View>
          
          <View style={styles.diagnosticSection}>
            <Text style={styles.diagnosticLabel}>🤖 Mode de parsing:</Text>
            <Text style={styles.diagnosticValue}>
              {diagnosticInfo.parserMode || 'Pas encore analysé'}
              {diagnosticInfo.parserMode === 'Fallback' && ' ⚠️ (règles basiques)'}
            </Text>
          </View>
          
          {diagnosticInfo.itemsResolved.length > 0 && (
            <>
              <Text style={styles.diagnosticSubtitle}>📊 Détails de résolution:</Text>
              {diagnosticInfo.itemsResolved.map((item, idx) => (
                <View key={idx} style={styles.diagnosticItemBox}>
                  <Text style={styles.diagnosticItemText}>
                    <Text style={{ fontWeight: 'bold' }}>Input:</Text> {item.input}
                  </Text>
                  <Text style={styles.diagnosticItemText}>
                    <Text style={{ fontWeight: 'bold' }}>Matched:</Text> {item.matched}
                  </Text>
                  <Text style={styles.diagnosticItemText}>
                    <Text style={{ fontWeight: 'bold' }}>Source:</Text> {item.source.toUpperCase()}
                  </Text>
                  <Text style={styles.diagnosticItemText}>
                    <Text style={{ fontWeight: 'bold' }}>Base calories:</Text> {item.baseCalories} kcal
                  </Text>
                  <Text style={styles.diagnosticItemText}>
                    <Text style={{ fontWeight: 'bold' }}>Multiplier:</Text> {item.multiplier.toFixed(2)}x
                  </Text>
                  <Text style={[styles.diagnosticItemText, { color: '#22c55e', fontWeight: 'bold' }]}>
                    Final: {item.finalCalories} kcal
                  </Text>
                </View>
              ))}
            </>
          )}
        </Card>
      )}

      {detectedItems.length > 0 && (
        <View style={styles.resultsContainer}>
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsTitle}>Aliments détectés ({detectedItems.length})</Text>
            <TouchableOpacity
              style={styles.rerollButton}
              onPress={handleParse}
              disabled={isProcessing}
            >
              <Text style={styles.rerollButtonText}>🔄 Réanalyser</Text>
            </TouchableOpacity>
          </View>

              {detectedItems.map((item, index) => (
                <Card key={index} variant="outlined" style={{ marginBottom: spacing.md }}>
                  <View style={styles.itemHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{item.originalName}</Text>
                      {/* Badge source nutritionnelle */}
                      <View style={[
                        styles.sourceBadge, 
                        item.source === 'db' && styles.sourceBadgeDb,
                        item.source === 'off' && styles.sourceBadgeOff,
                        item.source === 'estimated' && styles.sourceBadgeEstimated,
                        item.source === 'custom' && styles.sourceBadgeCustom,
                      ]}>
                        <Text style={styles.sourceBadgeText}>
                          {item.source === 'db' && '📊 Base de données'}
                          {item.source === 'off' && '🌐 Open Food Facts'}
                          {item.source === 'estimated' && '⚠️ Estimation IA'}
                          {item.source === 'custom' && '👤 Personnalisé'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.itemPoints}>{item.pointsCost} pts</Text>
                  </View>

                  {item.source === 'off' && item.offItem ? (
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemOff}>
                        ✓ Produit OFF: {item.offItem.name}
                      </Text>
                      {item.quantity && (
                        <Text style={styles.itemQuantity}>
                          📏 Quantité: {item.quantity}{item.portion.multiplier !== 1.0 ? ` (×${item.portion.multiplier.toFixed(1)})` : ''}
                        </Text>
                      )}
                      <Text style={styles.itemDetails}>
                        🔥 {Math.round((item.offItem.calories_kcal || 0) * item.portion.multiplier)} cal {item.portion.multiplier !== 1.0 ? `(${Math.round(item.offItem.calories_kcal || 0)}×${item.portion.multiplier.toFixed(1)})` : ''} · 💪 {Math.round((item.offItem.protein_g || 0) * item.portion.multiplier * 10) / 10}g prot · 🍞 {Math.round((item.offItem.carbs_g || 0) * item.portion.multiplier * 10) / 10}g gluc · 🧈 {Math.round((item.offItem.fat_g || 0) * item.portion.multiplier * 10) / 10}g lipides
                      </Text>
                    </View>
                  ) : item.source === 'db' && item.matchedItem ? (
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemMatch}>
                        ✓ Match DB: {item.matchedItem.name}
                      </Text>
                      {item.quantity && (
                        <Text style={styles.itemQuantity}>
                          📏 Quantité: {item.quantity}{item.portion.multiplier !== 1.0 ? ` (×${item.portion.multiplier.toFixed(1)})` : ''}
                        </Text>
                      )}
                      <Text style={styles.itemDetails}>
                        🔥 {Math.round((item.matchedItem.calories_kcal || 0) * item.portion.multiplier)} cal {item.portion.multiplier !== 1.0 ? `(${Math.round(item.matchedItem.calories_kcal || 0)}×${item.portion.multiplier.toFixed(1)})` : ''} · 💪 {Math.round((item.matchedItem.protein_g || 0) * item.portion.multiplier * 10) / 10}g prot · 🍞 {Math.round((item.matchedItem.carbs_g || 0) * item.portion.multiplier * 10) / 10}g gluc · 🧈 {Math.round((item.matchedItem.fat_g || 0) * item.portion.multiplier * 10) / 10}g lipides
                      </Text>
                    </View>
                  ) : item.source === 'estimated' && item.estimatedItem ? (
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemEstimate}>
                        ⚠ Estimé (non trouvé)
                      </Text>
                      {item.quantity && (
                        <Text style={styles.itemQuantity}>
                          📏 Quantité: {item.quantity}{item.portion.multiplier !== 1.0 ? ` (×${item.portion.multiplier.toFixed(1)})` : ''}
                        </Text>
                      )}
                      <Text style={styles.itemDetails}>
                        🔥 {Math.round((item.estimatedItem.calories_kcal || 0) * item.portion.multiplier)} cal {item.portion.multiplier !== 1.0 ? `(${Math.round(item.estimatedItem.calories_kcal || 0)}×${item.portion.multiplier.toFixed(1)})` : ''} · 💪 {Math.round((item.estimatedItem.protein_g || 0) * item.portion.multiplier * 10) / 10}g prot · 🍞 {Math.round((item.estimatedItem.carbs_g || 0) * item.portion.multiplier * 10) / 10}g gluc · 🧈 {Math.round((item.estimatedItem.fat_g || 0) * item.portion.multiplier * 10) / 10}g lipides
                      </Text>
                    </View>
                  ) : null}

                  <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                    <Button
                      label="🔄 Réanalyser"
                      variant="secondary"
                      size="small"
                      onPress={() => handleRerollItem(index)}
                      style={{ flex: 1 }}
                      isDisabled={isProcessing}
                    />
                    <Button
                      label={item.quantity ? "✏️ Modifier quantité" : "✏️ Modifier"}
                      variant="ghost"
                      size="small"
                      onPress={() => handleEditQuantity(index)}
                      style={{ flex: 1 }}
                    />
                    <Button
                      label="🗑️ Supprimer"
                      variant="danger"
                      size="small"
                      onPress={() => handleRemoveItem(index)}
                      style={{ flex: 1 }}
                    />
                  </View>
                </Card>
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

      {/* Modal pour modifier la quantité */}
      <Modal
        visible={editingQuantityIndex !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setEditingQuantityIndex(null);
          setQuantityInput('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Modifier la quantité</Text>
            {editingQuantityIndex !== null && detectedItems[editingQuantityIndex] && (
              <>
                <Text style={styles.modalSubtitle}>
                  {detectedItems[editingQuantityIndex].originalName}
                </Text>
                <TextInput
                  style={styles.quantityInput}
                  placeholder="Ex: 200g, 2 portions, 1 tasse"
                  value={quantityInput}
                  onChangeText={setQuantityInput}
                  autoFocus
                />
                <Text style={styles.modalHint}>
                  Exemples: 200g, 1.5 portions, 2 toasts, 250ml
                </Text>
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonCancel]}
                    onPress={() => {
                      setEditingQuantityIndex(null);
                      setQuantityInput('');
                    }}
                  >
                    <Text style={styles.modalButtonTextCancel}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonSave]}
                    onPress={() => editingQuantityIndex !== null && handleSaveQuantity(editingQuantityIndex)}
                  >
                    <Text style={styles.modalButtonTextSave}>Enregistrer</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      </ScrollView>
    </KeyboardAvoidingView>
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
  warningBox: {
    backgroundColor: '#78350f',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  warningText: {
    color: '#fcd34d',
    fontSize: 14,
    lineHeight: 20,
  },
  actionButtons: {
    gap: 12,
    marginBottom: 24,
  },
  parseButton: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  parseButtonDisabled: {
    opacity: 0.6,
  },
  parseButtonText: {
    color: '#022c22',
    fontSize: 18,
    fontWeight: 'bold',
  },
  diagnosticButton: {
    backgroundColor: '#475569',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#64748b',
  },
  diagnosticButtonText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600',
  },
  diagnosticTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fbbf24',
    marginBottom: 12,
  },
  diagnosticSubtitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#60a5fa',
    marginTop: 16,
    marginBottom: 8,
  },
  diagnosticSection: {
    marginBottom: 8,
  },
  diagnosticLabel: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '600',
  },
  diagnosticValue: {
    fontSize: 15,
    color: '#e2e8f0',
    marginTop: 2,
  },
  diagnosticItemBox: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  diagnosticItemText: {
    fontSize: 13,
    color: '#cbd5e1',
    marginBottom: 4,
  },
  scanButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#60a5fa',
  },
  scanButtonDisabled: {
    opacity: 0.6,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#020617',
    padding: 16,
    justifyContent: 'center',
  },
  cameraPermissionBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  cameraPermissionText: {
    color: '#e5e7eb',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  cameraPermissionButton: {
    backgroundColor: '#8b5cf6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  cameraPermissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cameraCloseButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  cameraCloseText: {
    color: '#93c5fd',
    fontSize: 16,
  },
  cameraBox: {
    flex: 1,
    justifyContent: 'center',
  },
  cameraView: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  cameraPreviewBox: {
    flex: 1,
    justifyContent: 'center',
  },
  cameraPreviewImage: {
    width: '100%',
    height: 420,
    borderRadius: 16,
    marginBottom: 16,
    backgroundColor: '#111827',
  },
  cameraActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cameraPrimaryButton: {
    flex: 1,
    backgroundColor: '#22c55e',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraPrimaryButtonText: {
    color: '#0b1220',
    fontSize: 16,
    fontWeight: '700',
  },
  cameraSecondaryButton: {
    flex: 1,
    backgroundColor: '#1f2937',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  cameraSecondaryButtonText: {
    color: '#e5e7eb',
    fontSize: 16,
    fontWeight: '600',
  },
  resultsContainer: {
    marginTop: 8,
    marginBottom: 24,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  resultsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#e5e7eb',
    flex: 1,
  },
  rerollButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#60a5fa',
  },
  rerollButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
  itemOff: {
    fontSize: 14,
    color: '#3b82f6',
    marginBottom: 4,
    fontWeight: '600',
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
  itemQuantity: {
    color: '#60a5fa',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 4,
  },
  sourceBadge: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  sourceBadgeDb: {
    backgroundColor: '#065f46',
  },
  sourceBadgeOff: {
    backgroundColor: '#1e3a8a',
  },
  sourceBadgeEstimated: {
    backgroundColor: '#78350f',
  },
  sourceBadgeCustom: {
    backgroundColor: '#581c87',
  },
  sourceBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  modalOverlay: {
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
  modalContent: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#374151',
    ...(Platform.OS === 'web' && {
      position: 'relative' as any,
      margin: 'auto',
      zIndex: 10000,
    }),
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#e5e7eb',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#9ca3af',
    marginBottom: 16,
  },
  quantityInput: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#e5e7eb',
    borderWidth: 1,
    borderColor: '#374151',
    marginBottom: 8,
  },
  modalHint: {
    color: '#6b7280',
    fontSize: 12,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#374151',
    borderWidth: 1,
    borderColor: '#4b5563',
  },
  modalButtonSave: {
    backgroundColor: '#22c55e',
  },
  modalButtonTextCancel: {
    color: '#e5e7eb',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextSave: {
    color: '#0b1220',
    fontSize: 16,
    fontWeight: '700',
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


