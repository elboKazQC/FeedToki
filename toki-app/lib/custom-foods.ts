// Gestion des aliments personnalisés créés par l'utilisateur
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FoodItem } from './food-db';
import { db } from './firebase-config';
import { collection, doc, setDoc, getDocs, query, where } from 'firebase/firestore';
import { FIREBASE_ENABLED } from './firebase-config';

const getCustomFoodsKey = (userId?: string) => 
  userId ? `feedtoki_custom_foods_${userId}_v1` : 'feedtoki_custom_foods_v1';

/**
 * Charger les aliments personnalisés depuis AsyncStorage
 */
export async function loadCustomFoods(userId?: string): Promise<FoodItem[]> {
  try {
    // Utiliser une clé globale pour le cache local (partagée par tous les utilisateurs)
    const storageKey = 'feedtoki_custom_foods_global_v1';
    
    // D'abord charger depuis AsyncStorage (cache local global)
    const raw = await AsyncStorage.getItem(storageKey);
    const localFoods: FoodItem[] = raw ? JSON.parse(raw) : [];
    
    console.log(`[Custom Foods] 📥 Chargés depuis AsyncStorage (${storageKey}):`, localFoods.length, 'aliments');
    
    // Charger depuis Firestore (collection globale partagée)
    if (FIREBASE_ENABLED && db) {
      try {
        console.log(`[Custom Foods] 📥 Chargement depuis Firestore (globalFoods)...`);
        const firestoreFoods = await loadCustomFoodsFromFirestore();
        console.log(`[Custom Foods] Chargés depuis Firestore:`, firestoreFoods.length, 'aliments');
        
        // Fusionner: Firestore prend priorité (plus récent)
        const foodMap = new Map<string, FoodItem>();
        
        // D'abord ajouter les aliments locaux
        for (const food of localFoods) {
          foodMap.set(food.id, food);
        }
        
        // Ensuite ajouter/remplacer par les aliments Firestore
        for (const food of firestoreFoods) {
          foodMap.set(food.id, food);
        }
        
        const mergedFoods = Array.from(foodMap.values());
        console.log(`[Custom Foods] ✅ Après fusion:`, mergedFoods.length, 'aliments (local:', localFoods.length, ', firestore:', firestoreFoods.length, ')');
        
        // Sauvegarder la version fusionnée dans AsyncStorage pour la prochaine fois
        if (mergedFoods.length > 0) {
          await AsyncStorage.setItem(storageKey, JSON.stringify(mergedFoods));
        }
        
        return mergedFoods;
      } catch (error) {
        console.error('[Custom Foods] ❌ Erreur chargement Firestore, utilisation locale:', error);
        // En cas d'erreur, retourner les aliments locaux
        return localFoods;
      }
    } else {
      console.warn('[Custom Foods] ⚠️ Firebase non activé, utilisation locale uniquement');
    }
    
    return localFoods;
  } catch (error) {
    console.error('[Custom Foods] ❌ Erreur chargement:', error);
    return [];
  }
}

/**
 * Charger les aliments personnalisés depuis Firestore (collection globale partagée)
 */
export async function loadCustomFoodsFromFirestore(): Promise<FoodItem[]> {
  if (!FIREBASE_ENABLED || !db) {
    console.log('[Custom Foods] ⚠️ Firebase non disponible (FIREBASE_ENABLED:', FIREBASE_ENABLED, ', db:', !!db, ')');
    return [];
  }

  try {
    console.log('[Custom Foods] 🔍 Démarrage chargement depuis Firestore (globalFoods)...');
    const globalFoodsRef = collection(db, 'globalFoods');
    const snapshot = await getDocs(globalFoodsRef);
    const foods = snapshot.docs.map(doc => {
      const data = doc.data() as FoodItem;
      console.log(`[Custom Foods]   - ${data.name} (${data.id})`);
      return data;
    });
    console.log(`[Custom Foods] ✅ Chargement Firestore réussi: ${foods.length} aliments trouvés`);
    return foods;
  } catch (error: any) {
    console.error('[Custom Foods] ❌ Erreur chargement Firestore:', error);
    console.error('[Custom Foods]   Détails:', {
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
    });
    return [];
  }
}

/**
 * Ajouter un aliment personnalisé (dans la collection globale partagée)
 */
export async function addCustomFood(food: FoodItem, userId?: string): Promise<void> {
  // Utiliser une clé globale pour le cache local (partagée par tous les utilisateurs)
  const storageKey = 'feedtoki_custom_foods_global_v1';
  
  // Charger les aliments existants (collection globale)
  const existing = await loadCustomFoods(userId);
  const updated = [...existing.filter(f => f.id !== food.id), food];
  
  console.log(`[Custom Foods] 💾 Ajout de "${food.name}" (${food.id}), total:`, updated.length, 'aliments');
  
  // Sauvegarder dans AsyncStorage (cache local global)
  await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
  console.log(`[Custom Foods] ✅ Sauvegardé dans AsyncStorage`);

  // Sauvegarder dans Firestore (collection globale partagée)
  if (FIREBASE_ENABLED && db) {
    try {
      console.log(`[Custom Foods] 📤 Envoi vers Firestore (globalFoods)...`, { 
        foodId: food.id, 
        name: food.name,
        calories: food.calories_kcal,
        protein: food.protein_g,
        carbs: food.carbs_g,
        fat: food.fat_g,
      });
      const globalFoodRef = doc(db, 'globalFoods', food.id);
      const foodData = {
        ...food,
        createdAt: new Date().toISOString(), // Ajouter timestamp pour référence
        updatedAt: new Date().toISOString(), // Timestamp de mise à jour
      };
      await setDoc(globalFoodRef, foodData, { merge: true });
      console.log(`[Custom Foods] ✅ Sauvegardé dans Firestore (globalFoods/${food.id}) - Partagé avec tous les utilisateurs`);
    } catch (error: any) {
      console.error('[Custom Foods] ❌ Erreur sauvegarde Firestore:', error);
      console.error('[Custom Foods]   Détails:', {
        message: error?.message,
        code: error?.code,
        foodId: food.id,
        foodName: food.name,
        stack: error?.stack,
      });
      // Continue même si Firestore échoue (l'aliment est quand même dans AsyncStorage)
      console.warn('[Custom Foods] ⚠️ L\'aliment est sauvegardé localement mais pas synchronisé. Il sera synchronisé au prochain chargement.');
    }
  } else {
    console.warn('[Custom Foods] ⚠️ Firebase non activé (FIREBASE_ENABLED:', FIREBASE_ENABLED, ', db:', !!db, '), pas de sync Firestore');
  }
}

/**
 * Obtenir tous les aliments (DB + personnalisés)
 */
export async function getAllFoods(): Promise<FoodItem[]> {
  const customFoods = await loadCustomFoods();
  return customFoods;
}

/**
 * Fusionner les aliments personnalisés avec la DB principale
 * (pour utilisation dans les composants)
 */
export function mergeFoodsWithCustom(baseFoods: FoodItem[], customFoods: FoodItem[]): FoodItem[] {
  // Créer un Map pour éviter les doublons (priorité aux personnalisés)
  const foodMap = new Map<string, FoodItem>();
  
  // D'abord ajouter les aliments de base
  for (const food of baseFoods) {
    foodMap.set(food.id, food);
  }
  
  // Ensuite ajouter/remplacer par les personnalisés
  for (const food of customFoods) {
    foodMap.set(food.id, food);
  }
  
  return Array.from(foodMap.values());
}

