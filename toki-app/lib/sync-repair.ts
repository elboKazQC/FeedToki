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
    .replace(/[^a-z0-9\s]/g, ''); // Enlever caractères spéciaux
}

/**
 * Score de similarité entre deux chaînes (simplifié pour la détection dans les titres)
 */
function similarityScore(str1: string, str2: string): number {
  const s1 = normalizeFoodName(str1);
  const s2 = normalizeFoodName(str2);
  
  // Match exact
  if (s1 === s2) return 1.0;
  
  // Contient l'un ou l'autre (mais seulement si significatif)
  if (s1.length >= 3 && s2.length >= 3) {
    if (s1.includes(s2) || s2.includes(s1)) {
      // Vérifier que la différence de longueur n'est pas trop grande
      const lengthRatio = Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length);
      if (lengthRatio >= 0.7) {
        return 0.8;
      }
    }
  }
  
  // Mots communs - amélioration pour les noms composés
  const words1 = s1.split(/\s+/).filter(w => w.length > 2);
  const words2 = s2.split(/\s+/).filter(w => w.length > 2);
  const commonWords = words1.filter(w => words2.includes(w));
  
  // Si tous les mots sont communs, c'est un très bon match
  if (commonWords.length === words1.length && commonWords.length === words2.length && words1.length > 0) {
    return 0.9; // Match presque parfait
  }
  
  if (commonWords.length >= 2) {
    return 0.7;
  } else if (commonWords.length === 1) {
    // Pour les noms composés (2 mots), un seul mot commun peut suffire si c'est un mot significatif
    // Ex: "sauce blanche" vs "sauce blanche" -> "sauce" et "blanche" sont communs -> score 0.9
    // Mais si on compare "sauce blanche" avec "sauce tomate", on a "sauce" en commun
    if (words1.length === 2 && words2.length === 2) {
      // Deux mots dans les deux : si un mot commun, c'est déjà un bon indice
      return 0.55; // Légèrement au-dessus du seuil de 0.5
    } else if (words1.length <= 2 && words2.length <= 2) {
      return 0.55;
    }
  }
  
  return 0;
}

/**
 * Réparer les repas en ajoutant les items manquants mentionnés dans le titre
 * @param userId ID de l'utilisateur
 * @returns Résultat de la réparation
 */
export async function repairMissingItemsInMeals(userId: string): Promise<{
  success: boolean;
  mealsFixed: number;
  itemsAdded: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let mealsFixed = 0;
  let itemsAdded = 0;

  try {
    console.log('[Sync Repair] 🔧 Réparation des items manquants dans les repas...');

    // 1. Charger les repas
    const entriesKey = `feedtoki_entries_${userId}_v1`;
    const entriesRaw = await AsyncStorage.getItem(entriesKey);
    if (!entriesRaw) {
      errors.push('Aucun repas trouvé');
      return { success: false, mealsFixed: 0, itemsAdded: 0, errors };
    }

    const entries: MealEntry[] = JSON.parse(entriesRaw);
    console.log(`[Sync Repair] 📥 ${entries.length} repas à analyser`);
    
    if (entries.length === 0) {
      console.log('[Sync Repair] ℹ️ Aucun repas à analyser');
      return { success: true, mealsFixed: 0, itemsAdded: 0, errors };
    }

    // 2. Charger les custom foods
    const customFoods = await loadCustomFoods(userId);
    const allFoods = mergeFoodsWithCustom(FOOD_DB, customFoods);
    console.log(`[Sync Repair] 📥 ${allFoods.length} aliments disponibles (DB: ${FOOD_DB.length}, custom: ${customFoods.length})`);

    // 3. Pour chaque repas, détecter les items manquants
    const fixedEntries: MealEntry[] = [];
    let hasChanges = false;

    for (const entry of entries) {
      if (!entry.label || entry.label.trim().length === 0) {
        fixedEntries.push(entry);
        continue;
      }

      const currentItems = entry.items || [];
      const currentFoodIds = new Set(currentItems.map(item => item.foodId));
      
      // Extraire les mots du titre (séparés par virgules, espaces)
      // Amélioration : ignorer les nombres au début des mots (ex: "5 dates" -> "dates")
      const titleWords = entry.label
        .split(/[,;]/) // Séparer par virgules ou points-virgules
        .map(w => w.trim())
        .map(w => {
          // Enlever les nombres au début du mot (ex: "5 dates" -> "dates", "2 toast" -> "toast")
          // Mais garder les nombres dans le mot (ex: "vitamine B12" reste "vitamine B12")
          const withoutLeadingNumbers = w.replace(/^\d+\s+/, '').trim();
          return withoutLeadingNumbers.length > 0 ? withoutLeadingNumbers : w;
        })
        .filter(w => w.length > 0);
      
      // Toujours logger pour le diagnostic (même en production)
      if (titleWords.length > 0) {
        console.log(`[Sync Repair] 📋 Analyse du repas "${entry.label}":`, {
          titleWords,
          currentItemsCount: currentItems.length,
          currentFoodIds: Array.from(currentFoodIds),
        });
      }

      let entryModified = false;
      const newItems = [...currentItems];

      // Pour chaque mot/phrase du titre, chercher un aliment correspondant
      for (const titleWord of titleWords) {
        if (titleWord.length < 3) continue; // Ignorer les mots trop courts

        // Chercher dans tous les aliments
        let bestMatch: FoodItem | null = null;
        let bestScore = 0.5; // Seuil minimum pour accepter un match (abaissé pour mieux détecter)

        // Toujours logger pour le diagnostic (même en production)
        console.log(`[Sync Repair] 🔍 Recherche correspondance pour "${titleWord}" dans le repas "${entry.label}"`);

        for (const food of allFoods) {
          const score = similarityScore(titleWord, food.name);
          if (score > bestScore) {
            bestScore = score;
            bestMatch = food;
            console.log(`[Sync Repair]   ✓ Match trouvé: "${food.name}" (score: ${score.toFixed(2)})`);
          }
        }

        if (!bestMatch) {
          console.log(`[Sync Repair]   ✗ Aucun match trouvé pour "${titleWord}" (seuil: 0.5)`);
        }

        // Si on a trouvé un match et qu'il n'est pas déjà dans les items
        if (bestMatch && !currentFoodIds.has(bestMatch.id)) {
          console.log(`[Sync Repair] ➕ Ajout "${bestMatch.name}" (${bestMatch.id}) au repas "${entry.label}" (score: ${bestScore.toFixed(2)})`);
          
          // Ajouter l'item avec portion par défaut (1.0)
          newItems.push({
            foodId: bestMatch.id,
            multiplier: 1.0,
          });
          
          currentFoodIds.add(bestMatch.id); // Éviter les doublons dans le même repas
          itemsAdded++;
          entryModified = true;
        } else if (bestMatch && currentFoodIds.has(bestMatch.id)) {
          console.log(`[Sync Repair]   ℹ️ "${bestMatch.name}" déjà présent dans les items, ignoré`);
        }
      }

      if (entryModified) {
        fixedEntries.push({
          ...entry,
          items: newItems,
        });
        mealsFixed++;
        hasChanges = true;
        console.log(`[Sync Repair] ✅ Repas "${entry.label}" réparé: ${newItems.length - currentItems.length} item(s) ajouté(s)`);
      } else {
        fixedEntries.push(entry);
      }
    }

    // 4. Sauvegarder les repas modifiés
    if (hasChanges) {
      await AsyncStorage.setItem(entriesKey, JSON.stringify(fixedEntries));
      console.log(`[Sync Repair] ✅ ${mealsFixed} repas modifiés, ${itemsAdded} items ajoutés`);

      // 5. Synchroniser vers Firestore
      if (FIREBASE_ENABLED && db) {
        try {
          const { syncMealsToFirestore } = await import('./data-sync');
          await syncMealsToFirestore(userId, fixedEntries);
          console.log('[Sync Repair] ✅ Repas réparés synchronisés vers Firestore');
        } catch (syncError) {
          errors.push(`Erreur sync Firestore: ${syncError}`);
        }
      }
    } else {
      console.log('[Sync Repair] ✅ Aucun item manquant détecté dans les repas');
    }

    return { success: errors.length === 0, mealsFixed, itemsAdded, errors };
  } catch (error: any) {
    errors.push(`Erreur réparation items manquants: ${error?.message || error}`);
    console.error('[Sync Repair] ❌ Erreur:', error);
    return { success: false, mealsFixed, itemsAdded, errors };
  }
}

/**
 * Synchroniser les repas manquants entre local et Firestore
 * @param userId ID de l'utilisateur
 * @returns Résultat de la synchronisation
 */
export async function syncMissingMeals(userId: string): Promise<{
  success: boolean;
  localToFirestore: number;
  firestoreToLocal: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let localToFirestore = 0;
  let firestoreToLocal = 0;

  try {
    console.log('[Sync Repair] 🔄 Synchronisation des repas manquants...');

    if (!FIREBASE_ENABLED || !db) {
      errors.push('Firebase non disponible');
      return { success: false, localToFirestore: 0, firestoreToLocal: 0, errors };
    }

    // 1. Charger les repas locaux
    const entriesKey = `feedtoki_entries_${userId}_v1`;
    const localRaw = await AsyncStorage.getItem(entriesKey);
    const localMeals: MealEntry[] = localRaw ? JSON.parse(localRaw) : [];
    console.log(`[Sync Repair] 📥 Repas locaux: ${localMeals.length}`);

    // 2. Charger les repas depuis Firestore
    const { loadMealsFromFirestore } = await import('./data-sync');
    const firestoreMeals = await loadMealsFromFirestore(userId);
    console.log(`[Sync Repair] 📥 Repas Firestore: ${firestoreMeals.length}`);

    // 3. Créer des Maps pour comparaison rapide
    const localMap = new Map<string, MealEntry>();
    const firestoreMap = new Map<string, MealEntry>();

    for (const meal of localMeals) {
      localMap.set(meal.id, meal);
    }

    for (const meal of firestoreMeals) {
      firestoreMap.set(meal.id, meal);
    }

    // 4. Trouver les repas locaux qui ne sont pas dans Firestore
    const missingInFirestore: MealEntry[] = [];
    for (const meal of localMeals) {
      if (!firestoreMap.has(meal.id)) {
        missingInFirestore.push(meal);
      }
    }

    // 5. Trouver les repas Firestore qui ne sont pas locaux OU qui ont plus d'items
    const missingInLocal: MealEntry[] = [];
    for (const meal of firestoreMeals) {
      const localMeal = localMap.get(meal.id);
      if (!localMeal) {
        // Repas manquant localement
        missingInLocal.push(meal);
        console.log(`[Sync Repair] 🔍 Repas manquant localement: "${meal.label || meal.id}" avec ${meal.items?.length || 0} items`);
      } else if (meal.items && localMeal.items) {
        // Vérifier si le repas Firestore a plus d'items
        if (meal.items.length > localMeal.items.length) {
          console.log(`[Sync Repair] 🔄 Repas "${meal.label || meal.id}" a plus d'items dans Firestore (${meal.items.length} vs ${localMeal.items.length})`);
          missingInLocal.push(meal); // Forcer le remplacement
        }
      } else if (meal.items && (!localMeal.items || localMeal.items.length === 0)) {
        // Repas Firestore a des items mais local n'en a pas
        console.log(`[Sync Repair] 🔄 Repas "${meal.label || meal.id}" a des items dans Firestore mais pas localement`);
        missingInLocal.push(meal);
      }
    }

    console.log(`[Sync Repair] 🔍 Manquants dans Firestore: ${missingInFirestore.length}`);
    console.log(`[Sync Repair] 🔍 Manquants localement: ${missingInLocal.length}`);

    // 6. Envoyer les repas locaux vers Firestore
    if (missingInFirestore.length > 0) {
      const { syncMealsToFirestore } = await import('./data-sync');
      await syncMealsToFirestore(userId, missingInFirestore);
      localToFirestore = missingInFirestore.length;
      console.log(`[Sync Repair] ✅ ${localToFirestore} repas envoyés vers Firestore`);
    }

    // 7. Ajouter les repas Firestore manquants au local
    if (missingInLocal.length > 0) {
      const updatedMeals = [...localMeals, ...missingInLocal];
      // Trier par date décroissante
      updatedMeals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      await AsyncStorage.setItem(entriesKey, JSON.stringify(updatedMeals));
      firestoreToLocal = missingInLocal.length;
      console.log(`[Sync Repair] ✅ ${firestoreToLocal} repas ajoutés localement`);
    }

    // 8. Si aucun changement, tout est synchronisé
    if (localToFirestore === 0 && firestoreToLocal === 0) {
      console.log('[Sync Repair] ✅ Tous les repas sont déjà synchronisés');
    }

    return {
      success: errors.length === 0,
      localToFirestore,
      firestoreToLocal,
      errors,
    };
  } catch (error: any) {
    errors.push(`Erreur sync repas: ${error?.message || error}`);
    console.error('[Sync Repair] ❌ Erreur:', error);
    return { success: false, localToFirestore, firestoreToLocal, errors };
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
  meals: { 
    success: boolean; 
    entriesFixed: number; 
    itemsRemoved: number;
    itemsAdded?: number;
    mealsWithItemsAdded?: number;
    syncedFromFirestore?: number;
    syncedToFirestore?: number;
  };
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

  // 3. Synchroniser les repas manquants
  const syncMealsResult = await syncMissingMeals(userId);
  if (!syncMealsResult.success) {
    errors.push(...syncMealsResult.errors);
  }

  // 4. Réparer les items manquants dans les repas (ajouter les items mentionnés dans le titre)
  const repairItemsResult = await repairMissingItemsInMeals(userId);
  if (!repairItemsResult.success) {
    errors.push(...repairItemsResult.errors);
  }

  // 5. Réparer les repas (validation et nettoyage)
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
      success: mealsResult.success && syncMealsResult.success && repairItemsResult.success,
      entriesFixed: mealsResult.entriesFixed,
      itemsRemoved: mealsResult.itemsRemoved,
      itemsAdded: repairItemsResult.itemsAdded,
      mealsWithItemsAdded: repairItemsResult.mealsFixed,
      syncedFromFirestore: syncMealsResult.firestoreToLocal,
      syncedToFirestore: syncMealsResult.localToFirestore,
    },
    errors,
  };
}
