// Script de migration des données AsyncStorage vers Firestore
// À exécuter une seule fois lors de l'activation de Firebase

import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, doc, setDoc, getDoc, writeBatch } from 'firebase/firestore';
import { db, getDb } from './firebase-config';
import { MealEntry } from './stats';
import { UserProfile } from './types';
import { WeightEntry } from './weight';

const MIGRATION_FLAG_KEY = 'toki_firestore_migration_completed';

export type MigrationResult = {
  success: boolean;
  entriesMigrated: number;
  targetsMigrated: boolean;
  weightsMigrated: number;
  profileMigrated: boolean;
  error?: string;
};

/**
 * Vérifier si la migration a déjà été effectuée
 */
export async function isMigrationCompleted(): Promise<boolean> {
  try {
    const flag = await AsyncStorage.getItem(MIGRATION_FLAG_KEY);
    return flag === 'true';
  } catch {
    return false;
  }
}

/**
 * Marquer la migration comme complétée
 */
async function markMigrationCompleted(): Promise<void> {
  await AsyncStorage.setItem(MIGRATION_FLAG_KEY, 'true');
}

/**
 * Migrer toutes les données locales vers Firestore
 */
export async function migrateToFirestore(userId: string): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    entriesMigrated: 0,
    targetsMigrated: false,
    weightsMigrated: 0,
    profileMigrated: false,
  };

  try {
    // Vérifier si Firebase est activé
    if (!db) {
      throw new Error('Firebase non activé. Activez Firebase avant de migrer.');
    }

    // Vérifier si déjà migré
    if (await isMigrationCompleted()) {
      result.success = true;
      result.error = 'Migration déjà effectuée';
      return result;
    }

    const batch = writeBatch(getDb());

    // 1. Migrer les repas (entries)
    try {
      const entriesKey = `feedtoki_entries_${userId}_v1`;
      const entriesRaw = await AsyncStorage.getItem(entriesKey);
      if (entriesRaw) {
        const entries: MealEntry[] = JSON.parse(entriesRaw);
        if (Array.isArray(entries) && entries.length > 0) {
          const mealsRef = collection(getDb(), 'users', userId, 'meals');
          for (const entry of entries) {
            const mealRef = doc(mealsRef, entry.id);
            batch.set(mealRef, {
              ...entry,
              createdAt: entry.createdAt,
            });
          }
          result.entriesMigrated = entries.length;
        }
      }
    } catch (e: any) {
      console.error('Erreur migration entries:', e);
    }

    // 2. Migrer les targets nutrition
    try {
      const targetsKey = `feedtoki_targets_${userId}_v1`;
      const targetsRaw = await AsyncStorage.getItem(targetsKey);
      if (targetsRaw) {
        const targets = JSON.parse(targetsRaw);
        const targetsRef = doc(getDb(), 'users', userId, 'targets', 'nutrition');
        batch.set(targetsRef, targets);
        result.targetsMigrated = true;
      }
    } catch (e: any) {
      console.error('Erreur migration targets:', e);
    }

    // 4. Migrer les poids
    try {
      const weightsKey = `feedtoki_weights_${userId}_v1`;
      const weightsRaw = await AsyncStorage.getItem(weightsKey);
      if (weightsRaw) {
        const weights: WeightEntry[] = JSON.parse(weightsRaw);
        if (Array.isArray(weights) && weights.length > 0) {
          const weightsRef = collection(getDb(), 'users', userId, 'weights');
          for (const weight of weights) {
            const weightRef = doc(weightsRef, weight.date);
            batch.set(weightRef, weight);
          }
          result.weightsMigrated = weights.length;
        }
      }

      // Migrer aussi le baseline
      const baselineKey = `feedtoki_weight_baseline_${userId}_v1`;
      const baselineRaw = await AsyncStorage.getItem(baselineKey);
      if (baselineRaw) {
        const baseline = JSON.parse(baselineRaw);
        const baselineRef = doc(db, 'users', userId, 'weights', 'baseline');
        batch.set(baselineRef, baseline);
      }
    } catch (e: any) {
      console.error('Erreur migration weights:', e);
    }

    // 5. Migrer le profil utilisateur
    try {
      const profileKey = `toki_user_profile_${userId}`;
      const profileRaw = await AsyncStorage.getItem(profileKey);
      if (profileRaw) {
        const profile: UserProfile = JSON.parse(profileRaw);
        const profileRef = doc(db, 'users', userId);
        batch.set(profileRef, profile, { merge: true });
        result.profileMigrated = true;
      }
    } catch (e: any) {
      console.error('Erreur migration profile:', e);
    }

    // Exécuter toutes les écritures en batch
    await batch.commit();
    await markMigrationCompleted();
    result.success = true;

    return result;
  } catch (error: any) {
    result.error = error.message || 'Erreur inconnue lors de la migration';
    console.error('Erreur migration complète:', error);
    return result;
  }
}

/**
 * Fonction helper pour migrer automatiquement au premier login Firebase
 */
export async function autoMigrateIfNeeded(userId: string): Promise<void> {
  try {
    if (!db) return; // Firebase non activé, skip
    if (await isMigrationCompleted()) return; // Déjà migré

    const result = await migrateToFirestore(userId);
    if (result.success) {
      console.log('[Migration] Données migrées avec succès:', {
        entries: result.entriesMigrated,
        targets: result.targetsMigrated,
        weights: result.weightsMigrated,
        profile: result.profileMigrated,
      });
    } else {
      console.warn('[Migration] Migration échouée:', result.error);
    }
  } catch (error) {
    console.error('[Migration] Erreur auto-migration:', error);
  }
}

/**
 * Forcer la migration (ignore le flag de migration complétée)
 * Utile si la migration a échoué ou si tu veux re-migrer
 */
export async function forceMigration(userId: string): Promise<MigrationResult> {
  try {
    if (!db) {
      throw new Error('Firebase non activé');
    }

    // Réinitialiser le flag de migration
    await AsyncStorage.removeItem(MIGRATION_FLAG_KEY);
    console.log('[Migration] Flag de migration réinitialisé, lancement de la migration...');

    // Lancer la migration
    const result = await migrateToFirestore(userId);
    
    if (result.success) {
      console.log('[Migration] ✅ Migration forcée réussie:', {
        entries: result.entriesMigrated,
        targets: result.targetsMigrated,
        weights: result.weightsMigrated,
        profile: result.profileMigrated,
      });
    } else {
      console.error('[Migration] ❌ Migration forcée échouée:', result.error);
    }
    
    return result;
  } catch (error: any) {
    console.error('[Migration] Erreur migration forcée:', error);
    return {
      success: false,
      entriesMigrated: 0,
      targetsMigrated: false,
      weightsMigrated: 0,
      profileMigrated: false,
      error: error.message || 'Erreur inconnue',
    };
  }
}

