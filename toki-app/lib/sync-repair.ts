// Scripts de réparation et nettoyage pour la synchronisation
// Permet de corriger les incohérences entre appareils

import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from './firebase-config';
import { collection, doc, getDoc, getDocs, setDoc, writeBatch } from 'firebase/firestore';
import { FIREBASE_ENABLED } from './firebase-config';
import { FoodItem } from './food-db';
import { MealEntry } from './stats';
import { loadCustomFoods, loadCustomFoodsFromFirestore, mergeFoodsWithCustom } from './custom-foods';
import { FOOD_DB } from './food-db';
import { computeFoodPoints } from './points-utils';
import { validateAndFixMealEntries } from './data-sync';

/**
 * Réparer les points en recalculant à partir des repas
 * @param userId ID de l'utilisateur
 * @param dailyPointsBudget Budget quotidien de points
 * @param maxPointsCap Cap maximum de points
 * @returns Résultat de la réparation
 */
export async function repairPoints(
  userId: string,
  dailyPointsBudget: number,
  maxPointsCap: number
): Promise<{
  success: boolean;
  oldBalance: number;
  newBalance: number;
  totalSpent: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let oldBalance = 0;
  let newBalance = 0;
  let totalSpent = 0;

  try {
    console.log('[Sync Repair] 🔧 Démarrage réparation des points...');
    
    // 1. Charger les points actuels
    const pointsKey = `feedtoki_points_${userId}_v2`;
    const pointsRaw = await AsyncStorage.getItem(pointsKey);
    if (!pointsRaw) {
      errors.push('Aucun point trouvé localement');
      return { success: false, oldBalance: 0, newBalance: 0, totalSpent: 0, errors };
    }

    const pointsData = JSON.parse(pointsRaw);
    oldBalance = pointsData.balance || 0;
    const lastClaimDate = pointsData.lastClaimDate || '';
    const today = new Date().toISOString().slice(0, 10);

    // 2. Charger les repas
    const entriesKey = `feedtoki_entries_${userId}_v1`;
    const entriesRaw = await AsyncStorage.getItem(entriesKey);
    if (!entriesRaw) {
      errors.push('Aucun repas trouvé');
      return { success: false, oldBalance, newBalance: oldBalance, totalSpent: 0, errors };
    }

    const entries: MealEntry[] = JSON.parse(entriesRaw);
    
    // 3. Charger les custom foods
    const customFoods = await loadCustomFoods(userId);
    const allFoods = mergeFoodsWithCustom(FOOD_DB, customFoods);

    // 4. Calculer les points dépensés aujourd'hui
    const todayEntries = entries.filter(e => {
      const entryDate = new Date(e.createdAt).toISOString().slice(0, 10);
      return entryDate === today;
    });

    for (const entry of todayEntries) {
      if (entry.items && entry.items.length > 0) {
        const entryCost = entry.items.reduce((sum, itemRef) => {
          const fi = allFoods.find(f => f.id === itemRef.foodId);
          if (!fi) {
            errors.push(`Aliment introuvable: ${itemRef.foodId} dans "${entry.label}"`);
            return sum;
          }
          const multiplier = itemRef.multiplier || 1.0;
          const baseCost = computeFoodPoints(fi);
          const cost = Math.round(baseCost * Math.sqrt(multiplier));
          return sum + cost;
        }, 0);
        totalSpent += entryCost;
      }
    }

    // 5. Calculer le nouveau solde
    let startOfDayBalance = pointsData.startOfDayBalance;
    if (startOfDayBalance === undefined) {
      startOfDayBalance = Math.min(maxPointsCap, oldBalance + totalSpent);
    }

    newBalance = Math.max(0, startOfDayBalance - totalSpent);

    // 6. Sauvegarder les points corrigés
    await AsyncStorage.setItem(pointsKey, JSON.stringify({
      ...pointsData,
      balance: newBalance,
      startOfDayBalance,
    }));

    // 7. Synchroniser vers Firestore
    if (FIREBASE_ENABLED && db) {
      try {
        const { syncPointsToFirestore } = await import('./data-sync');
        const totalPointsKey = `feedtoki_total_points_${userId}_v1`;
        const totalRaw = await AsyncStorage.getItem(totalPointsKey);
        const totalPointsVal = totalRaw ? JSON.parse(totalRaw) : 0;
        await syncPointsToFirestore(userId, newBalance, lastClaimDate, totalPointsVal);
        console.log('[Sync Repair] ✅ Points synchronisés vers Firestore');
      } catch (syncError) {
        errors.push(`Erreur sync Firestore: ${syncError}`);
      }
    }

    console.log('[Sync Repair] ✅ Points réparés:', {
      oldBalance,
      newBalance,
      totalSpent,
      startOfDayBalance,
    });

    return { success: true, oldBalance, newBalance, totalSpent, errors };
  } catch (error: any) {
    errors.push(`Erreur réparation: ${error?.message || error}`);
    console.error('[Sync Repair] ❌ Erreur:', error);
    return { success: false, oldBalance, newBalance: oldBalance, totalSpent, errors };
  }
}

/**
 * Synchroniser tous les custom foods manquants entre local et Firestore
 * @param userId ID de l'utilisateur
 * @returns Résultat de la synchronisation
 */
export async function syncMissingCustomFoods(userId: string): Promise<{
  success: boolean;
  localToFirestore: number;
  firestoreToLocal: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let localToFirestore = 0;
  let firestoreToLocal = 0;

  try {
    console.log('[Sync Repair] 🔄 Synchronisation des custom foods manquants...');

    if (!FIREBASE_ENABLED || !db) {
      errors.push('Firebase non disponible');
      return { success: false, localToFirestore: 0, firestoreToLocal: 0, errors };
    }

    // 1. Charger les custom foods locaux
    const storageKey = 'feedtoki_custom_foods_global_v1';
    const localRaw = await AsyncStorage.getItem(storageKey);
    const localFoods: FoodItem[] = localRaw ? JSON.parse(localRaw) : [];
    console.log(`[Sync Repair] 📥 Custom foods locaux: ${localFoods.length}`);

    // 2. Charger les custom foods depuis Firestore
    const firestoreFoods = await loadCustomFoodsFromFirestore();
    console.log(`[Sync Repair] 📥 Custom foods Firestore: ${firestoreFoods.length}`);

    // 3. Créer des Maps pour comparaison rapide
    const localMap = new Map<string, FoodItem>();
    const firestoreMap = new Map<string, FoodItem>();

    for (const food of localFoods) {
      localMap.set(food.id, food);
    }

    for (const food of firestoreFoods) {
      firestoreMap.set(food.id, food);
    }

    // 4. Trouver les aliments locaux qui ne sont pas dans Firestore
    const missingInFirestore: FoodItem[] = [];
    for (const food of localFoods) {
      if (!firestoreMap.has(food.id)) {
        missingInFirestore.push(food);
      }
    }

    // 5. Trouver les aliments Firestore qui ne sont pas locaux
    const missingInLocal: FoodItem[] = [];
    for (const food of firestoreFoods) {
      if (!localMap.has(food.id)) {
        missingInLocal.push(food);
      }
    }

    console.log(`[Sync Repair] 🔍 Manquants dans Firestore: ${missingInFirestore.length}`);
    console.log(`[Sync Repair] 🔍 Manquants localement: ${missingInLocal.length}`);

    // 6. Envoyer les aliments locaux vers Firestore
    if (missingInFirestore.length > 0) {
      const batch = writeBatch(db);
      for (const food of missingInFirestore) {
        try {
          const globalFoodRef = doc(db, 'globalFoods', food.id);
          batch.set(globalFoodRef, {
            ...food,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            syncedAt: new Date().toISOString(), // Marquer comme synchronisé
          });
          localToFirestore++;
        } catch (error: any) {
          errors.push(`Erreur sync "${food.name}" vers Firestore: ${error?.message}`);
        }
      }
      try {
        await batch.commit();
        console.log(`[Sync Repair] ✅ ${localToFirestore} aliments envoyés vers Firestore`);
      } catch (batchError: any) {
        errors.push(`Erreur batch commit: ${batchError?.message}`);
      }
    }

    // 7. Ajouter les aliments Firestore manquants au local
    if (missingInLocal.length > 0) {
      const updatedLocalFoods = [...localFoods, ...missingInLocal];
      await AsyncStorage.setItem(storageKey, JSON.stringify(updatedLocalFoods));
      firestoreToLocal = missingInLocal.length;
      console.log(`[Sync Repair] ✅ ${firestoreToLocal} aliments ajoutés localement`);
    }

    // 8. Si aucun changement, tout est synchronisé
    if (localToFirestore === 0 && firestoreToLocal === 0) {
      console.log('[Sync Repair] ✅ Tous les custom foods sont déjà synchronisés');
    }

    return {
      success: errors.length === 0,
      localToFirestore,
      firestoreToLocal,
      errors,
    };
  } catch (error: any) {
    errors.push(`Erreur sync custom foods: ${error?.message || error}`);
    console.error('[Sync Repair] ❌ Erreur:', error);
    return { success: false, localToFirestore, firestoreToLocal, errors };
  }
}

/**
 * Réparer et valider tous les repas (retirer les items invalides)
 * @param userId ID de l'utilisateur
 * @returns Résultat de la réparation
 */
export async function repairMealEntries(userId: string): Promise<{
  success: boolean;
  entriesFixed: number;
  itemsRemoved: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let entriesFixed = 0;
  let itemsRemoved = 0;

  try {
    console.log('[Sync Repair] 🔧 Réparation des entrées de repas...');

    // 1. Charger les repas
    const entriesKey = `feedtoki_entries_${userId}_v1`;
    const entriesRaw = await AsyncStorage.getItem(entriesKey);
    if (!entriesRaw) {
      errors.push('Aucun repas trouvé');
      return { success: false, entriesFixed: 0, itemsRemoved: 0, errors };
    }

    const entries: MealEntry[] = JSON.parse(entriesRaw);
    console.log(`[Sync Repair] 📥 ${entries.length} repas trouvés`);

    // 2. Charger les custom foods
    const customFoods = await loadCustomFoods(userId);
    const allFoods = mergeFoodsWithCustom(FOOD_DB, customFoods);

    // 3. Valider et corriger les repas
    const validatedEntries = validateAndFixMealEntries(entries, allFoods);

    // 4. Compter les changements
    for (let i = 0; i < entries.length; i++) {
      const original = entries[i];
      const validated = validatedEntries[i];
      
      if (original.items && validated.items) {
        const originalCount = original.items.length;
        const validatedCount = validated.items.length;
        
        if (originalCount !== validatedCount) {
          entriesFixed++;
          itemsRemoved += (originalCount - validatedCount);
        }
      }
    }

    // 5. Sauvegarder les repas corrigés
    if (entriesFixed > 0) {
      await AsyncStorage.setItem(entriesKey, JSON.stringify(validatedEntries));
      
      // Synchroniser vers Firestore
      if (FIREBASE_ENABLED && db) {
        try {
          const { syncMealsToFirestore } = await import('./data-sync');
          await syncMealsToFirestore(userId, validatedEntries);
          console.log('[Sync Repair] ✅ Repas synchronisés vers Firestore');
        } catch (syncError) {
          errors.push(`Erreur sync Firestore: ${syncError}`);
        }
      }
    }

    console.log('[Sync Repair] ✅ Réparation terminée:', {
      entriesFixed,
      itemsRemoved,
    });

    return { success: true, entriesFixed, itemsRemoved, errors };
  } catch (error: any) {
    errors.push(`Erreur réparation repas: ${error?.message || error}`);
    console.error('[Sync Repair] ❌ Erreur:', error);
    return { success: false, entriesFixed, itemsRemoved, errors };
  }
}

/**
 * Réparation complète : points, custom foods, et repas
 * @param userId ID de l'utilisateur
 * @param dailyPointsBudget Budget quotidien de points
 * @param maxPointsCap Cap maximum de points
 * @returns Résultat complet de la réparation
 */
export async function fullRepair(
  userId: string,
  dailyPointsBudget: number,
  maxPointsCap: number
): Promise<{
  success: boolean;
  points: { success: boolean; oldBalance: number; newBalance: number; totalSpent: number };
  customFoods: { success: boolean; localToFirestore: number; firestoreToLocal: number };
  meals: { success: boolean; entriesFixed: number; itemsRemoved: number };
  errors: string[];
}> {
  console.log('[Sync Repair] 🔧 Démarrage réparation complète...');
  
  const errors: string[] = [];

  // 1. Réparer les points
  const pointsResult = await repairPoints(userId, dailyPointsBudget, maxPointsCap);
  if (!pointsResult.success) {
    errors.push(...pointsResult.errors);
  }

  // 2. Synchroniser les custom foods
  const customFoodsResult = await syncMissingCustomFoods(userId);
  if (!customFoodsResult.success) {
    errors.push(...customFoodsResult.errors);
  }

  // 3. Réparer les repas
  const mealsResult = await repairMealEntries(userId);
  if (!mealsResult.success) {
    errors.push(...mealsResult.errors);
  }

  const success = errors.length === 0;

  console.log('[Sync Repair] ✅ Réparation complète terminée:', {
    success,
    points: pointsResult.success,
    customFoods: customFoodsResult.success,
    meals: mealsResult.success,
    errorsCount: errors.length,
  });

  return {
    success,
    points: {
      success: pointsResult.success,
      oldBalance: pointsResult.oldBalance,
      newBalance: pointsResult.newBalance,
      totalSpent: pointsResult.totalSpent,
    },
    customFoods: {
      success: customFoodsResult.success,
      localToFirestore: customFoodsResult.localToFirestore,
      firestoreToLocal: customFoodsResult.firestoreToLocal,
    },
    meals: {
      success: mealsResult.success,
      entriesFixed: mealsResult.entriesFixed,
      itemsRemoved: mealsResult.itemsRemoved,
    },
    errors,
  };
}
