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
    const storageKey = getCustomFoodsKey(userId);
    
    // D'abord charger depuis AsyncStorage (par utilisateur si userId fourni)
    const raw = await AsyncStorage.getItem(storageKey);
    const localFoods: FoodItem[] = raw ? JSON.parse(raw) : [];
    
    console.log(`[Custom Foods] Chargés depuis AsyncStorage (${storageKey}):`, localFoods.length, 'aliments');
    
    // Si on a un userId et Firebase est activé, charger depuis Firestore aussi
    if (userId && FIREBASE_ENABLED && db) {
      try {
        const firestoreFoods = await loadCustomFoodsFromFirestore(userId);
        console.log(`[Custom Foods] Chargés depuis Firestore (${userId}):`, firestoreFoods.length, 'aliments');
        
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
        console.log(`[Custom Foods] Après fusion:`, mergedFoods.length, 'aliments');
        
        // Sauvegarder la version fusionnée dans AsyncStorage pour la prochaine fois
        if (mergedFoods.length > 0) {
          await AsyncStorage.setItem(storageKey, JSON.stringify(mergedFoods));
        }
        
        return mergedFoods;
      } catch (error) {
        console.error('[Custom Foods] Erreur chargement Firestore, utilisation locale:', error);
        // En cas d'erreur, retourner les aliments locaux
        return localFoods;
      }
    }
    
    return localFoods;
  } catch (error) {
    console.error('[Custom Foods] Erreur chargement:', error);
    return [];
  }
}

/**
 * Charger les aliments personnalisés depuis Firestore
 */
export async function loadCustomFoodsFromFirestore(userId: string): Promise<FoodItem[]> {
  if (!FIREBASE_ENABLED || !db) return [];

  try {
    const customFoodsRef = collection(db, 'users', userId, 'customFoods');
    const snapshot = await getDocs(customFoodsRef);
    return snapshot.docs.map(doc => doc.data() as FoodItem);
  } catch (error) {
    console.error('[Custom Foods] Erreur chargement Firestore:', error);
    return [];
  }
}

/**
 * Ajouter un aliment personnalisé
 */
export async function addCustomFood(food: FoodItem, userId?: string): Promise<void> {
  const storageKey = getCustomFoodsKey(userId);
  
  // Charger les aliments existants (incluant Firestore si userId fourni)
  const existing = await loadCustomFoods(userId);
  const updated = [...existing.filter(f => f.id !== food.id), food];
  
  console.log(`[Custom Foods] Ajout de "${food.name}" (${food.id}), total:`, updated.length, 'aliments');
  
  // Sauvegarder dans AsyncStorage (par utilisateur)
  await AsyncStorage.setItem(storageKey, JSON.stringify(updated));

  // Sauvegarder dans Firestore si disponible
  if (FIREBASE_ENABLED && db && userId) {
    try {
      const customFoodRef = doc(db, 'users', userId, 'customFoods', food.id);
      await setDoc(customFoodRef, {
        ...food,
        createdAt: new Date().toISOString(), // Ajouter timestamp pour référence
      });
      console.log(`[Custom Foods] Sauvegardé dans Firestore: ${food.id}`);
    } catch (error) {
      console.error('[Custom Foods] Erreur sauvegarde Firestore:', error);
      // Continue même si Firestore échoue
    }
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

