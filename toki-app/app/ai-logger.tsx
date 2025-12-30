// Écran de logging alimentaire via IA
// Permet de décrire un repas en texte ou voix, et l'IA extrait les aliments

import React, { useState, useRef } from 'react';
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
  Image,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { parseMealDescription } from '../lib/ai-meal-parser';
import { findBestMatch, createFoodItemRef, findMultipleMatches } from '../lib/food-matcher';
import { createEstimatedFoodItem } from '../lib/nutrition-estimator';
import { validateMealDescription } from '../lib/validation';
import { FoodItem, FOOD_DB } from '../lib/food-db';
import { FoodItemRef } from '../lib/stats';
import { getPortionsForItem, getDefaultPortion } from '../lib/portions';
import { computeFoodPoints } from '../lib/points-utils';
import { useAuth } from '../lib/auth-context';
import { addCustomFood, loadCustomFoods, mergeFoodsWithCustom } from '../lib/custom-foods';
import { MealEntry } from '../lib/stats';
import { classifyMealByItems } from '../lib/classifier';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncMealEntryToFirestore, syncPointsToFirestore } from '../lib/data-sync';
import { trackAIParserUsed, trackMealLogged } from '../lib/analytics';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { spacing } from '../constants/design-tokens';
import { searchAndMapBestProduct } from '../lib/open-food-facts';
import { logger } from '../lib/logger';
import { parseMealPhotoWithOpenAI } from '../lib/openai-parser';

type ItemSource = 'db' | 'off' | 'estimated';

type DetectedItem = {
  originalName: string;
  matchedItem: FoodItem | null;
  estimatedItem?: FoodItem;
  offItem?: FoodItem;
  portion: ReturnType<typeof getDefaultPortion>;
  itemRef: FoodItemRef;
  pointsCost: number;
  source: ItemSource;
};

export default function AILoggerScreen() {
  const params = useLocalSearchParams<{ initialText?: string; mode?: string; reason?: string }>();
  const [inputMode, setInputMode] = useState<'text' | 'photo'>(params.mode === 'photo' ? 'photo' : 'text');
  const [description, setDescription] = useState(params.initialText || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedItems, setDetectedItems] = useState<DetectedItem[]>([]);
  const [error, setError] = useState<string>('');
  
  // États pour le mode Photo
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [showCamera, setShowCamera] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<{ uri: string; base64: string } | null>(null);
  const cameraRef = useRef<any>(null);

  const handleParse = async () => {
    // Validation de la description
    const validation = validateMealDescription(description);
    if (!validation.isValid) {
      setError(validation.error || 'Veuillez décrire ce que vous avez mangé');
      return;
    }

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

          // Créer le FoodItemRef
          const itemRef = createFoodItemRef(foodItem!, portion);

          // Calculer le coût en points
          const pointsCost = computeFoodPoints(foodItem!) * Math.sqrt(portion.multiplier);

          items.push({
            originalName: parsedItem.name || 'Aliment inconnu',
            matchedItem: match || null,
            estimatedItem: (!offItem && !match) ? foodItem : undefined,
            offItem: offItem || undefined,
            portion,
            itemRef,
            pointsCost: Math.round(pointsCost),
            source,
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

  const { profile, user } = useAuth();
  const currentUserId = profile?.userId || (user as any)?.uid || (user as any)?.id || 'guest';
  const isEmailVerified = user?.emailVerified ?? false;
  const canUseAI = !currentUserId || currentUserId === 'guest' || isEmailVerified;

  const handleOpenCamera = async () => {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert(
          'Accès caméra requis',
          'Pour analyser une photo, FeedToki a besoin d\'accéder à ta caméra. Autorise la permission dans ton navigateur/app.',
          [{ text: 'OK' }]
        );
        return;
      }
    }

    setCapturedPhoto(null);
    setShowCamera(true);
    setInputMode('photo');
  };

  const handleTakePhoto = async () => {
    try {
      if (!cameraRef.current?.takePictureAsync) {
        Alert.alert('Erreur', 'Caméra non prête. Réessaie dans un instant.');
        return;
      }

      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.7,
      });

      if (!photo?.base64 || !photo?.uri) {
        Alert.alert('Erreur', 'Impossible de récupérer la photo. Réessaie.');
        return;
      }

      setCapturedPhoto({ uri: photo.uri, base64: photo.base64 });
    } catch (e: any) {
      console.error('[AI Logger] Erreur capture photo:', e);
      Alert.alert('Erreur', e?.message || 'Impossible de prendre la photo.');
    }
  };

  const handleAnalyzePhoto = async () => {
    if (!capturedPhoto?.base64) {
      Alert.alert('Erreur', 'Aucune photo à analyser.');
      return;
    }

    // Vérifier email si nécessaire
    if (currentUserId && currentUserId !== 'guest' && !isEmailVerified) {
      setError('Veuillez vérifier votre adresse email avant d\'utiliser l\'analyse IA. Consultez vos emails pour le lien de vérification.');
      return;
    }

    setIsProcessing(true);
    setError('');
    setDetectedItems([]);

    try {
      const parseResult = await parseMealPhotoWithOpenAI(capturedPhoto.base64, currentUserId, isEmailVerified);

      if (!parseResult || parseResult.error || parseResult.items.length === 0) {
        setError(parseResult?.error || 'Aucun aliment détecté sur la photo. Essaie une photo plus claire.');
        return;
      }

      // Réutiliser exactement le même pipeline de résolution (OFF -> DB -> estimé)
      const items: DetectedItem[] = [];
      for (const parsedItem of parseResult.items) {
        try {
          let foodItem: FoodItem;
          let portion = getDefaultPortion([]);
          let source: ItemSource = 'estimated';
          let match: FoodItem | null = null;
          let offItem: FoodItem | null = null;

          // Étape 1: Open Food Facts
          try {
            logger.info('[AI Logger] (Photo) Recherche OFF pour:', parsedItem.name);
            offItem = await searchAndMapBestProduct(parsedItem.name);
            if (offItem) {
              logger.info('[AI Logger] (Photo) Produit OFF trouvé:', offItem.name, {
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
                logger.info('[AI Logger] (Photo) Fusion des valeurs: OFF a des valeurs à 0, utilisation des valeurs IA');
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
            logger.warn('[AI Logger] (Photo) Erreur recherche OFF:', offError);
          }

          // Étape 2: DB locale
          if (!offItem) {
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
              match = findBestMatch(parsedItem.name, 0.7);
            }

            if (match) {
              foodItem = match;
              portion = getDefaultPortion(match.tags);
              source = 'db';
            }
          }

          // Étape 3: estimation
          if (!offItem && !match) {
            foodItem = createEstimatedFoodItem(
              parsedItem.name,
              'photo',
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

          const itemRef = createFoodItemRef(foodItem!, portion);
          const pointsCost = computeFoodPoints(foodItem!) * Math.sqrt(portion.multiplier);

          items.push({
            originalName: parsedItem.name || 'Aliment inconnu',
            matchedItem: match || null,
            estimatedItem: (!offItem && !match) ? foodItem : undefined,
            offItem: offItem || undefined,
            portion,
            itemRef,
            pointsCost: Math.round(pointsCost),
            source,
          });
        } catch (itemError: any) {
          console.error('Erreur traitement item photo:', itemError);
        }
      }

      if (items.length === 0) {
        setError('Impossible d\'analyser les aliments. Essaie une autre photo.');
      } else {
        setDetectedItems(items);
      }
    } catch (e: any) {
      console.error('[AI Logger] Erreur analyse photo:', e);
      setError(e?.message || 'Erreur lors de l\'analyse photo. Réessaie.');
    } finally {
      setIsProcessing(false);
      setShowCamera(false);
    }
  };

  const handleConfirm = async () => {
    if (detectedItems.length === 0) {
      Alert.alert('Erreur', 'Aucun aliment à enregistrer');
      return;
    }

    try {
      // 1. Sauvegarder les aliments personnalisés (estimés) dans la DB
      for (const item of detectedItems) {
        if (item.estimatedItem && !item.matchedItem) {
          // C'est un nouvel aliment, l'ajouter à la DB personnalisée
          await addCustomFood(item.estimatedItem, currentUserId !== 'guest' ? currentUserId : undefined);
        }
      }

      // 2. Créer l'entrée de repas
      const items: FoodItemRef[] = detectedItems.map(item => item.itemRef);
      const classification = classifyMealByItems(items);
      
      // Générer un label automatique
      const label = detectedItems
        .map(item => item.matchedItem?.name || item.estimatedItem?.name || item.originalName)
        .join(', ');

      const newEntry: MealEntry = {
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        label,
        category: classification.category,
        score: classification.score,
        items,
      };

      // 3. Sauvegarder dans AsyncStorage
      const entriesKey = `feedtoki_entries_${currentUserId}_v1`;
      const existingRaw = await AsyncStorage.getItem(entriesKey);
      const existing: MealEntry[] = existingRaw ? JSON.parse(existingRaw) : [];
      const updated = [newEntry, ...existing];
      await AsyncStorage.setItem(entriesKey, JSON.stringify(updated));

      // 4. Synchroniser avec Firestore
      if (currentUserId !== 'guest') {
        await syncMealEntryToFirestore(currentUserId, newEntry);
      }

      // 5. Recharger les custom foods (incluant ceux qu'on vient de sauvegarder) et recalculer les points
      const customFoods = await loadCustomFoods(currentUserId !== 'guest' ? currentUserId : undefined);
      const allFoods = mergeFoodsWithCustom(FOOD_DB, customFoods);
      
      // Recalculer les points avec les custom foods à jour
      const totalPoints = items.reduce((sum, itemRef) => {
        const fi = allFoods.find(f => f.id === itemRef.foodId);
        if (!fi) return sum;
        const multiplier = itemRef.multiplier || 1.0;
        const baseCost = computeFoodPoints(fi);
        const cost = Math.round(baseCost * Math.sqrt(multiplier));
        return sum + cost;
      }, 0);
      
      // Tracker le repas logué avec IA
      trackMealLogged({
        mealId: newEntry.id,
        category: classification.category,
        itemsCount: items.length,
        score: classification.score,
        pointsCost: totalPoints,
        hasAiParser: true,
      });
      
      if (totalPoints > 0) {
        const pointsKey = `feedtoki_points_${currentUserId}_v2`;
        const pointsRaw = await AsyncStorage.getItem(pointsKey);
        const pointsData = pointsRaw ? JSON.parse(pointsRaw) : { balance: 0, lastClaimDate: '' };
        const newBalance = Math.max(0, pointsData.balance - totalPoints);
        await AsyncStorage.setItem(pointsKey, JSON.stringify({
          ...pointsData,
          balance: newBalance,
        }));
        
        // Synchroniser les points avec Firestore
        if (currentUserId !== 'guest') {
          const totalPointsKey = `feedtoki_total_points_${currentUserId}_v1`;
          const totalPointsRaw = await AsyncStorage.getItem(totalPointsKey);
          const totalPointsEarned = totalPointsRaw ? JSON.parse(totalPointsRaw) : 0;
          await syncPointsToFirestore(currentUserId, newBalance, pointsData.lastClaimDate, totalPointsEarned);
        }
        
        // Logger l'événement
        const { userLogger } = await import('../lib/user-logger');
        await userLogger.info(
          currentUserId,
          `Repas enregistré via AI: ${detectedItems.length} item(s), -${totalPoints} pts`,
          'ai-logger',
          { itemsCount: detectedItems.length, pointsDeducted: totalPoints, newBalance }
        );
      } else {
        const { userLogger } = await import('../lib/user-logger');
        await userLogger.warn(
          currentUserId,
          `Repas enregistré via AI mais aucun point déduit`,
          'ai-logger',
          { itemsCount: detectedItems.length, items: items.map(i => i.foodId) }
        );
      }

      // 6. Retourner à l'écran principal avec succès
      // Sur le web, Alert.alert ne fonctionne pas, donc on redirige directement
      if (typeof window !== 'undefined' && Platform.OS === 'web') {
        // Sur le web, afficher un message puis rediriger
        window.alert(`✅ Repas enregistré!\n${detectedItems.length} aliment(s) enregistré(s). ${totalPoints > 0 ? `-${totalPoints} points` : ''}`);
        router.replace('/');
      } else {
        Alert.alert(
          '✅ Repas enregistré!',
          `${detectedItems.length} aliment(s) enregistré(s). ${totalPoints > 0 ? `-${totalPoints} points` : ''}`,
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

      // Remplacer l'item à l'index donné
      const updatedItems = [...detectedItems];
      updatedItems[index] = {
        originalName: parsedItem.name || foodName,
        matchedItem: match || null,
        estimatedItem: match ? undefined : foodItem,
        portion,
        itemRef,
        pointsCost: Math.round(pointsCost),
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

        <TouchableOpacity
          style={[styles.scanButton, (isProcessing || !canUseAI) && styles.scanButtonDisabled]}
          onPress={handleOpenCamera}
          disabled={isProcessing || !canUseAI}
        >
          <Text style={styles.scanButtonText}>📷 Log avec une photo</Text>
        </TouchableOpacity>
      </View>

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
                    <Text style={styles.itemName}>{item.originalName}</Text>
                    <Text style={styles.itemPoints}>{item.pointsCost} pts</Text>
                  </View>

                  {item.source === 'off' && item.offItem ? (
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemOff}>
                        ✓ Produit OFF: {item.offItem.name}
                      </Text>
                      <Text style={styles.itemDetails}>
                        🔥 {item.offItem.calories_kcal || 0} cal · 💪 {item.offItem.protein_g || 0}g prot · 🍞 {item.offItem.carbs_g || 0}g gluc · 🧈 {item.offItem.fat_g || 0}g lipides
                      </Text>
                    </View>
                  ) : item.source === 'db' && item.matchedItem ? (
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemMatch}>
                        ✓ Match DB: {item.matchedItem.name}
                      </Text>
                      <Text style={styles.itemDetails}>
                        🔥 {item.matchedItem.calories_kcal || 0} cal · 💪 {item.matchedItem.protein_g || 0}g prot · 🍞 {item.matchedItem.carbs_g || 0}g gluc · 🧈 {item.matchedItem.fat_g || 0}g lipides
                      </Text>
                    </View>
                  ) : item.source === 'estimated' && item.estimatedItem ? (
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemEstimate}>
                        ⚠ Estimé (non trouvé)
                      </Text>
                      <Text style={styles.itemDetails}>
                        🔥 {item.estimatedItem.calories_kcal || 0} cal · 💪 {item.estimatedItem.protein_g || 0}g prot · 🍞 {item.estimatedItem.carbs_g || 0}g gluc · 🧈 {item.estimatedItem.fat_g || 0}g lipides
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
                      label="✏️ Modifier"
                      variant="ghost"
                      size="small"
                      onPress={() => handleEditItem(index)}
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
          Tu peux aussi prendre une photo de ton repas pour aider l'IA à détecter les aliments.
          {Platform.OS === 'web' && ' (Sur web: autorise l\'accès caméra dans ton navigateur)'}
        </Text>
      </View>

      {/* Modal caméra (photo) */}
      <Modal
        visible={showCamera}
        animationType="slide"
        onRequestClose={() => setShowCamera(false)}
      >
        <View style={styles.cameraContainer}>
          {!cameraPermission?.granted ? (
            <View style={styles.cameraPermissionBox}>
              <Text style={styles.cameraPermissionText}>
                Autorise l'accès caméra pour prendre une photo.
              </Text>
              <TouchableOpacity style={styles.cameraPermissionButton} onPress={requestCameraPermission}>
                <Text style={styles.cameraPermissionButtonText}>Autoriser la caméra</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cameraCloseButton} onPress={() => setShowCamera(false)}>
                <Text style={styles.cameraCloseText}>Fermer</Text>
              </TouchableOpacity>
            </View>
          ) : capturedPhoto ? (
            <View style={styles.cameraPreviewBox}>
              <Image source={{ uri: capturedPhoto.uri }} style={styles.cameraPreviewImage} />
              <View style={styles.cameraActionsRow}>
                <TouchableOpacity
                  style={styles.cameraSecondaryButton}
                  onPress={() => setCapturedPhoto(null)}
                  disabled={isProcessing}
                >
                  <Text style={styles.cameraSecondaryButtonText}>Reprendre</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cameraPrimaryButton}
                  onPress={handleAnalyzePhoto}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.cameraPrimaryButtonText}>Analyser la photo</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.cameraBox}>
              <CameraView ref={cameraRef} style={styles.cameraView} facing="back" />
              <View style={styles.cameraActionsRow}>
                <TouchableOpacity style={styles.cameraSecondaryButton} onPress={() => setShowCamera(false)}>
                  <Text style={styles.cameraSecondaryButtonText}>Fermer</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cameraPrimaryButton} onPress={handleTakePhoto}>
                  <Text style={styles.cameraPrimaryButtonText}>Prendre la photo</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>
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


