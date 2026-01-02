// Système de synchronisation automatique AsyncStorage ↔ Firestore
// Permet un fonctionnement hybride: local-first avec backup cloud

import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, doc, setDoc, getDoc, getDocs, writeBatch, Timestamp, deleteDoc } from 'firebase/firestore';
import { db } from './firebase-config';
import { MealEntry } from './stats';
import { UserProfile } from './types';
import { WeightEntry } from './weight';
import { NutritionTargets } from './nutrition';
import { computeFoodPoints } from './points-utils';
import { FoodItem } from './food-db';
import { syncCheatDaysFromFirestore, getCheatDays, setCheatDay } from './cheat-days';

const SYNC_FLAG_KEY = 'toki_last_sync_timestamp';

/**
 * Vérifier si Firebase est disponible
 */
function isFirebaseAvailable(): boolean {
  return db !== null;
}

/**
 * Sauvegarder un seul repas dans Firestore
 */
export async function syncMealEntryToFirestore(userId: string, entry: MealEntry): Promise<void> {
  if (!isFirebaseAvailable()) {
    console.warn('[Sync] Firebase non disponible, skip sync meal entry');
    return;
  }

  try {
    console.log('[Sync] 📤 Envoi du repas vers Firestore...', {
      userId,
      entryId: entry.id,
      label: entry.label,
      itemsCount: entry.items?.length || 0,
    });
    
    const mealsRef = collection(db, 'users', userId, 'meals');
    const mealRef = doc(mealsRef, entry.id);
    await setDoc(mealRef, {
      ...entry,
      createdAt: entry.createdAt,
      updatedAt: Timestamp.now(),
    });
    
    console.log('[Sync] ✅ Repas sauvegardé dans Firestore avec succès', {
      path: `users/${userId}/meals/${entry.id}`,
    });
  } catch (error) {
    console.error('[Sync] ❌ Erreur sync meal entry:', error);
    // Ne pas throw - on continue avec AsyncStorage
  }
}

/**
 * Supprimer un repas de Firestore
 */
export async function deleteMealEntryFromFirestore(userId: string, entryId: string): Promise<void> {
  if (!isFirebaseAvailable() || !db) return;

  try {
    const mealsRef = collection(db, 'users', userId, 'meals');
    const mealRef = doc(mealsRef, entryId);
    await deleteDoc(mealRef);
    console.log('[Sync] Entrée supprimée de Firestore:', entryId);
  } catch (error) {
    console.error('[Sync] Erreur suppression meal entry:', error);
    // Ne pas throw - on continue avec AsyncStorage
  }
}

/**
 * Sauvegarder les repas dans Firestore
 */
export async function syncMealsToFirestore(userId: string, entries: MealEntry[]): Promise<void> {
  if (!isFirebaseAvailable()) return;

  try {
    const batch = writeBatch(db);
    const mealsRef = collection(db, 'users', userId, 'meals');

    // Sauvegarder tous les repas
    for (const entry of entries) {
      const mealRef = doc(mealsRef, entry.id);
      batch.set(mealRef, {
        ...entry,
        createdAt: entry.createdAt,
        updatedAt: Timestamp.now(),
      });
    }

    await batch.commit();
  } catch (error) {
    console.error('[Sync] Erreur sync meals:', error);
    // Ne pas throw - on continue avec AsyncStorage
  }
}

/**
 * Charger les repas depuis Firestore
 */
export async function loadMealsFromFirestore(userId: string): Promise<MealEntry[]> {
  if (!isFirebaseAvailable()) return [];

  try {
    const mealsRef = collection(db, 'users', userId, 'meals');
    const snapshot = await getDocs(mealsRef);
    
    return snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        ...data,
        id: docSnap.id,
        createdAt: data.createdAt || data.updatedAt?.toDate().toISOString() || new Date().toISOString(),
      } as MealEntry;
    });
  } catch (error) {
    console.error('[Sync] Erreur load meals:', error);
    return [];
  }
}

/**
 * Sauvegarder les points dans Firestore
 */
export async function syncPointsToFirestore(
  userId: string,
  balance: number,
  lastClaimDate: string,
  totalPoints: number
): Promise<void> {
  if (!isFirebaseAvailable()) {
    console.warn('[Sync] Firebase non disponible, skip sync points');
    return;
  }

  try {
    console.log('[Sync] 📤 Envoi des points vers Firestore...', {
      userId,
      balance,
      lastClaimDate,
      totalPoints,
    });
    
    const pointsRef = doc(db, 'users', userId, 'points', 'current');
    
    // IMPORTANT: Ne jamais écraser avec une valeur plus basse
    // (pour préserver les remboursements et corrections manuelles)
    const existingSnap = await getDoc(pointsRef);
    const existingData = existingSnap.exists() ? existingSnap.data() : null;
    const today = new Date().toISOString().slice(0, 10);
    
    let finalBalance = balance;
    if (existingData && existingData.lastClaimDate === today && lastClaimDate === today) {
      // Même jour: prendre la valeur la plus haute
      finalBalance = Math.max(balance, existingData.balance || 0);
      if (finalBalance !== balance) {
        console.log('[Sync] ⚠️ Points: garde la valeur Firestore plus haute:', existingData.balance, 'vs local:', balance);
      }
    }
    
    await setDoc(pointsRef, {
      balance: finalBalance,
      lastClaimDate,
      updatedAt: Timestamp.now(),
    });
    
    console.log('[Sync] ✅ Points balance sauvegardé dans Firestore', {
      path: `users/${userId}/points/current`,
      finalBalance,
    });

    const totalPointsRef = doc(db, 'users', userId, 'points', 'total');
    await setDoc(totalPointsRef, {
      value: totalPoints,
      updatedAt: Timestamp.now(),
    });
    
    console.log('[Sync] ✅ Points total sauvegardé dans Firestore', {
      path: `users/${userId}/points/total`,
      totalPoints,
    });
  } catch (error) {
    console.error('[Sync] ❌ Erreur sync points:', error);
  }
}

/**
 * Sauvegarder les targets nutrition dans Firestore
 */
export async function syncTargetsToFirestore(userId: string, targets: NutritionTargets): Promise<void> {
  if (!isFirebaseAvailable()) return;

  try {
    const targetsRef = doc(db, 'users', userId, 'targets', 'nutrition');
    await setDoc(targetsRef, {
      ...targets,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('[Sync] Erreur sync targets:', error);
  }
}

/**
 * Sauvegarder les poids dans Firestore
 */
export async function syncWeightsToFirestore(userId: string, weights: WeightEntry[], baseline: WeightEntry | null): Promise<void> {
  if (!isFirebaseAvailable()) return;

  try {
    const batch = writeBatch(db);
    const weightsRef = collection(db, 'users', userId, 'weights');

    // Sauvegarder tous les poids
    for (const weight of weights) {
      const weightRef = doc(weightsRef, weight.date);
      batch.set(weightRef, {
        ...weight,
        updatedAt: Timestamp.now(),
      });
    }

    // Sauvegarder le baseline
    if (baseline) {
      const baselineRef = doc(weightsRef, 'baseline');
      batch.set(baselineRef, {
        ...baseline,
        updatedAt: Timestamp.now(),
      });
    }

    await batch.commit();
  } catch (error) {
    console.error('[Sync] Erreur sync weights:', error);
  }
}

/**
 * Synchronisation complète: AsyncStorage → Firestore
 * À appeler périodiquement ou après modifications importantes
 */
export async function syncAllToFirestore(userId: string): Promise<void> {
  if (!isFirebaseAvailable()) return;

  try {
    // 1. Sync meals
    const entriesKey = `feedtoki_entries_${userId}_v1`;
    const entriesRaw = await AsyncStorage.getItem(entriesKey);
    if (entriesRaw) {
      const entries: MealEntry[] = JSON.parse(entriesRaw);
      await syncMealsToFirestore(userId, entries);
    }

    // 2. Sync points
    const pointsKey = `feedtoki_points_${userId}_v2`;
    const pointsRaw = await AsyncStorage.getItem(pointsKey);
    if (pointsRaw) {
      const pointsData = JSON.parse(pointsRaw);
      const totalPointsKey = `feedtoki_total_points_${userId}_v1`;
      const totalPointsRaw = await AsyncStorage.getItem(totalPointsKey);
      const totalPoints = totalPointsRaw ? JSON.parse(totalPointsRaw) : 0;
      await syncPointsToFirestore(userId, pointsData.balance || 0, pointsData.lastClaimDate || '', totalPoints);
    }

    // 3. Sync targets
    const targetsKey = `feedtoki_targets_${userId}_v1`;
    const targetsRaw = await AsyncStorage.getItem(targetsKey);
    if (targetsRaw) {
      const targets = JSON.parse(targetsRaw);
      await syncTargetsToFirestore(userId, targets);
    }

    // 4. Sync weights
    const weightsKey = `feedtoki_weights_${userId}_v1`;
    const weightsRaw = await AsyncStorage.getItem(weightsKey);
    if (weightsRaw) {
      const weights: WeightEntry[] = JSON.parse(weightsRaw);
      const baselineKey = `feedtoki_weight_baseline_${userId}_v1`;
      const baselineRaw = await AsyncStorage.getItem(baselineKey);
      const baseline = baselineRaw ? JSON.parse(baselineRaw) : null;
      await syncWeightsToFirestore(userId, weights, baseline);
    }

    // 5. Sync cheat days
    const cheatDays = await getCheatDays(userId);
    for (const [date, isCheat] of Object.entries(cheatDays)) {
      if (isCheat) {
        await setCheatDay(userId, date, true);
      }
    }

    // Marquer la dernière sync
    await AsyncStorage.setItem(SYNC_FLAG_KEY, Date.now().toString());
  } catch (error) {
    console.error('[Sync] Erreur sync complète:', error);
  }
}

/**
 * Synchroniser les données entre Firestore et AsyncStorage (fusion intelligente)
 * Fusionne les données des deux sources pour une vraie synchronisation multi-appareils
 */
export async function syncFromFirestore(userId: string): Promise<{
  mealsMerged: number;
  pointsRestored: boolean;
  targetsRestored: boolean;
  weightsMerged: number;
}> {
  const result = {
    mealsMerged: 0,
    pointsRestored: false,
    targetsRestored: false,
    weightsMerged: 0,
  };

  if (!isFirebaseAvailable()) {
    console.warn('[Sync] Firebase non disponible, skip syncFromFirestore');
    return result;
  }

  try {
    console.log('[Sync] 📥 Démarrage synchronisation depuis Firestore...', { userId });
    
    // 1. Synchroniser meals - FUSIONNER les deux sources
    const entriesKey = `feedtoki_entries_${userId}_v1`;
    const localEntriesRaw = await AsyncStorage.getItem(entriesKey);
    const localEntries: MealEntry[] = localEntriesRaw ? JSON.parse(localEntriesRaw) : [];
    console.log('[Sync] Repas locaux:', localEntries.length);
    
    // Log détaillé des repas locaux (pour diagnostic)
    if (__DEV__ && localEntries.length > 0) {
      console.log('[Sync] 📋 Détail repas locaux:');
      localEntries.slice(0, 5).forEach(entry => {
        console.log(`  - ${entry.label || entry.id}: ${entry.items?.length || 0} items`, 
          entry.items?.map(i => i.foodId).join(', ') || 'aucun');
      });
    }
    
    const firestoreMeals = await loadMealsFromFirestore(userId);
    console.log('[Sync] Repas Firestore:', firestoreMeals.length);
    
    // Log détaillé des repas Firestore (pour diagnostic)
    if (__DEV__ && firestoreMeals.length > 0) {
      console.log('[Sync] 📋 Détail repas Firestore:');
      firestoreMeals.slice(0, 5).forEach(meal => {
        console.log(`  - ${meal.label || meal.id}: ${meal.items?.length || 0} items`, 
          meal.items?.map(i => i.foodId).join(', ') || 'aucun');
      });
    }
    
    // Fusionner: créer un Map par ID, Firestore prend priorité (plus récent)
    const mealsMap = new Map<string, MealEntry>();
    
    // D'abord ajouter les locaux
    for (const entry of localEntries) {
      mealsMap.set(entry.id, entry);
    }
    
    // Ensuite ajouter/remplacer par Firestore (priorité)
    let replacedCount = 0;
    let addedCount = 0;
    for (const meal of firestoreMeals) {
      const existing = mealsMap.get(meal.id);
      if (existing) {
        replacedCount++;
        if (__DEV__) {
          console.log(`[Sync] 🔄 Remplacement repas "${meal.label || meal.id}": local=${existing.items?.length || 0} items, firestore=${meal.items?.length || 0} items`);
        }
      } else {
        addedCount++;
        if (__DEV__) {
          console.log(`[Sync] ➕ Ajout repas depuis Firestore: "${meal.label || meal.id}" avec ${meal.items?.length || 0} items`);
        }
      }
      mealsMap.set(meal.id, meal);
    }
    
    const mergedMeals = Array.from(mealsMap.values());
    // Trier par date décroissante (plus récent en premier)
    mergedMeals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    if (mergedMeals.length > 0) {
      await AsyncStorage.setItem(entriesKey, JSON.stringify(mergedMeals));
      result.mealsMerged = mergedMeals.length;
      console.log('[Sync] ✅ Repas fusionnés:', mergedMeals.length, '(local:', localEntries.length, ', firestore:', firestoreMeals.length, `, ajoutés: ${addedCount}, remplacés: ${replacedCount})`);
    } else {
      console.log('[Sync] ℹ️ Aucun repas à fusionner');
    }

    // 2. Synchroniser points - recalculer à partir des repas pour éviter les duplications
    // Au lieu de simplement fusionner les balances, on recalcule les points à partir des repas synchronisés
    const pointsKey = `feedtoki_points_${userId}_v2`;
    const localPointsRaw = await AsyncStorage.getItem(pointsKey);
    const localPointsData = localPointsRaw ? JSON.parse(localPointsRaw) : null;
    console.log('[Sync] Points locaux:', localPointsData);
    
    const pointsRef = doc(db, 'users', userId, 'points', 'current');
    const pointsSnap = await getDoc(pointsRef);
    
    const today = new Date().toISOString().slice(0, 10);
    
    // IMPORTANT: Au lieu de fusionner les balances, on va recalculer les points
    // à partir des repas synchronisés. Cela évite les duplications.
    // Le recalcul complet sera fait dans index.tsx après la synchronisation.
    // Ici, on fait juste une fusion basique pour éviter de perdre des données.
    
    if (pointsSnap.exists()) {
      const firestorePointsData = pointsSnap.data();
      console.log('[Sync] Points Firestore:', firestorePointsData);
      
      // Déterminer quelle balance utiliser (fusion basique)
      let finalBalance: number;
      let finalLastClaimDate: string;
      
      if (!localPointsData) {
        // Pas de données locales, utiliser Firestore
        finalBalance = firestorePointsData.balance || 0;
        finalLastClaimDate = firestorePointsData.lastClaimDate || '';
        console.log('[Sync] Pas de points locaux, utilisation Firestore:', finalBalance);
      } else if (localPointsData.lastClaimDate === today && firestorePointsData.lastClaimDate === today) {
        // Même jour sur les deux sources - prendre la plus HAUTE balance
        // (pour préserver les remboursements de points après suppression d'entrées
        // et les corrections manuelles dans Firebase)
        finalBalance = Math.max(localPointsData.balance || 0, firestorePointsData.balance || 0);
        finalLastClaimDate = today;
        console.log('[Sync] Points fusion (même jour): local=', localPointsData.balance, 'firestore=', firestorePointsData.balance, '-> final=', finalBalance);
        console.log('[Sync] ⚠️ Note: Les points seront recalculés à partir des repas après la sync pour éviter les duplications');
      } else if (localPointsData.lastClaimDate === today) {
        // Local est plus récent (a réclamé les points aujourd'hui)
        finalBalance = localPointsData.balance;
        finalLastClaimDate = localPointsData.lastClaimDate;
        console.log('[Sync] Local plus récent (aujourd\'hui):', finalBalance);
      } else if (firestorePointsData.lastClaimDate === today) {
        // Firestore est plus récent
        finalBalance = firestorePointsData.balance || 0;
        finalLastClaimDate = firestorePointsData.lastClaimDate || '';
        console.log('[Sync] Firestore plus récent (aujourd\'hui):', finalBalance);
      } else {
        // Aucun n'est d'aujourd'hui, utiliser le plus récent
        const localDate = localPointsData.lastClaimDate || '';
        const firestoreDate = firestorePointsData.lastClaimDate || '';
        if (localDate >= firestoreDate) {
          finalBalance = localPointsData.balance;
          finalLastClaimDate = localDate;
          console.log('[Sync] Local plus récent (date):', finalBalance, localDate);
        } else {
          finalBalance = firestorePointsData.balance || 0;
          finalLastClaimDate = firestoreDate;
          console.log('[Sync] Firestore plus récent (date):', finalBalance, firestoreDate);
        }
      }
      
      await AsyncStorage.setItem(pointsKey, JSON.stringify({
        balance: finalBalance,
        lastClaimDate: finalLastClaimDate,
      }));
      console.log('[Sync] ✅ Points fusionnés et sauvegardés localement (sera recalculé après):', finalBalance);

      const totalPointsRef = doc(db, 'users', userId, 'points', 'total');
      const totalPointsSnap = await getDoc(totalPointsRef);
      if (totalPointsSnap.exists()) {
        const totalPointsKey = `feedtoki_total_points_${userId}_v1`;
        const localTotalRaw = await AsyncStorage.getItem(totalPointsKey);
        const localTotal = localTotalRaw ? JSON.parse(localTotalRaw) : 0;
        const firestoreTotal = totalPointsSnap.data().value || 0;
        // Prendre le plus grand total (car il ne peut qu'augmenter)
        const finalTotal = Math.max(localTotal, firestoreTotal);
        await AsyncStorage.setItem(totalPointsKey, JSON.stringify(finalTotal));
        console.log('[Sync] ✅ Total points fusionné:', finalTotal, '(local:', localTotal, ', firestore:', firestoreTotal, ')');
      }

      result.pointsRestored = true;
    } else {
      console.log('[Sync] ℹ️ Aucun point dans Firestore');
    }

    // 3. Restore targets - ne remplace que si local est vide
    const targetsKey = `feedtoki_targets_${userId}_v1`;
    const localTargetsRaw = await AsyncStorage.getItem(targetsKey);
    
    if (!localTargetsRaw) {
      const targetsRef = doc(db, 'users', userId, 'targets', 'nutrition');
      const targetsSnap = await getDoc(targetsRef);
      if (targetsSnap.exists()) {
        const targets = targetsSnap.data();
        await AsyncStorage.setItem(targetsKey, JSON.stringify(targets));
        result.targetsRestored = true;
      }
    }

    // 4. Synchroniser cheat days depuis Firestore
    await syncCheatDaysFromFirestore(userId);

    // 5. Synchroniser weights - fusionner les deux sources
    const weightsKey = `feedtoki_weights_${userId}_v1`;
    const localWeightsRaw = await AsyncStorage.getItem(weightsKey);
    const localWeights: WeightEntry[] = localWeightsRaw ? JSON.parse(localWeightsRaw) : [];
    
    const weightsRef = collection(db, 'users', userId, 'weights');
    const weightsSnap = await getDocs(weightsRef);
    const firestoreWeights: WeightEntry[] = [];
    let baseline: WeightEntry | null = null;

    weightsSnap.docs.forEach((docSnap) => {
      if (docSnap.id === 'baseline') {
        baseline = docSnap.data() as WeightEntry;
      } else {
        firestoreWeights.push(docSnap.data() as WeightEntry);
      }
    });

    // Fusionner les poids par date
    const weightsMap = new Map<string, WeightEntry>();
    for (const w of localWeights) {
      weightsMap.set(w.date, w);
    }
    for (const w of firestoreWeights) {
      weightsMap.set(w.date, w); // Firestore prend priorité
    }
    
    const mergedWeights = Array.from(weightsMap.values());
    if (mergedWeights.length > 0 || baseline) {
      await AsyncStorage.setItem(weightsKey, JSON.stringify(mergedWeights));
      result.weightsMerged = mergedWeights.length;
      
      if (baseline) {
        const baselineKey = `feedtoki_weight_baseline_${userId}_v1`;
        await AsyncStorage.setItem(baselineKey, JSON.stringify(baseline));
      }
    }

    return result;
  } catch (error) {
    console.error('[Sync] Erreur restore:', error);
    return result;
  }
}

/**
 * Valider et corriger les entrées de repas pour s'assurer que tous les foodId existent
 * @param entries Les entrées de repas à valider
 * @param allFoods Tous les aliments disponibles (DB + custom foods)
 * @returns Les entrées validées (avec les items invalides retirés)
 */
export function validateAndFixMealEntries(
  entries: MealEntry[],
  allFoods: { id: string; name: string }[]
): MealEntry[] {
  const foodIdsSet = new Set(allFoods.map(f => f.id));
  let totalInvalidItems = 0;
  let totalFixedEntries = 0;

  const validatedEntries = entries.map(entry => {
    if (!entry.items || entry.items.length === 0) {
      return entry; // Pas d'items à valider
    }

    // Filtrer les items avec des foodId valides
    const validItems = entry.items.filter(itemRef => {
      const foodExists = foodIdsSet.has(itemRef.foodId);
      if (!foodExists) {
        totalInvalidItems++;
        console.warn(`[Sync Validation] ⚠️ FoodId introuvable dans l'entrée "${entry.label || entry.id}": ${itemRef.foodId}`);
      }
      return foodExists;
    });

    // Si des items ont été retirés, c'est une entrée corrigée
    if (validItems.length !== entry.items.length) {
      totalFixedEntries++;
      console.warn(`[Sync Validation] ⚠️ Entrée "${entry.label || entry.id}": ${entry.items.length - validItems.length} item(s) invalide(s) retiré(s)`);
    }

    return {
      ...entry,
      items: validItems,
    };
  });

  if (totalInvalidItems > 0 || totalFixedEntries > 0) {
    console.log(`[Sync Validation] ✅ Validation terminée: ${totalFixedEntries} entrée(s) corrigée(s), ${totalInvalidItems} item(s) invalide(s) retiré(s)`);
  }

  return validatedEntries;
}


