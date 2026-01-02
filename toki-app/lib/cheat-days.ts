// Gestion des journées "cheat" - permet de logger tous les repas même sans points
// Les repas ajoutés en mode cheat ne consomment pas de points mais sont trackés

import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, doc, setDoc, getDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from './firebase-config';

const CHEAT_DAYS_KEY_PREFIX = 'feedtoki_cheat_days_';

/**
 * Vérifier si Firebase est disponible
 */
function isFirebaseAvailable(): boolean {
  return db !== null;
}

/**
 * Obtenir la clé AsyncStorage pour les cheat days d'un utilisateur
 */
function getCheatDaysKey(userId: string): string {
  return `${CHEAT_DAYS_KEY_PREFIX}${userId}_v1`;
}

/**
 * Vérifier si une date donnée est un cheat day
 */
export async function isCheatDay(userId: string, date: string): Promise<boolean> {
  try {
    // Charger depuis AsyncStorage
    const key = getCheatDaysKey(userId);
    const raw = await AsyncStorage.getItem(key);
    
    if (raw) {
      const cheatDays: Record<string, boolean> = JSON.parse(raw);
      return cheatDays[date] === true;
    }
    
    // Si pas dans AsyncStorage, essayer Firestore
    if (isFirebaseAvailable() && userId !== 'guest') {
      try {
        const cheatDayRef = doc(db, 'users', userId, 'cheatDays', date);
        const cheatDaySnap = await getDoc(cheatDayRef);
        
        if (cheatDaySnap.exists()) {
          const data = cheatDaySnap.data();
          return data.isCheat === true;
        }
      } catch (error) {
        console.warn('[CheatDays] Erreur lecture Firestore:', error);
      }
    }
    
    return false;
  } catch (error) {
    console.error('[CheatDays] Erreur isCheatDay:', error);
    return false;
  }
}

/**
 * Définir si une date est un cheat day
 */
export async function setCheatDay(userId: string, date: string, isCheat: boolean): Promise<void> {
  try {
    // Mettre à jour AsyncStorage
    const key = getCheatDaysKey(userId);
    const raw = await AsyncStorage.getItem(key);
    const cheatDays: Record<string, boolean> = raw ? JSON.parse(raw) : {};
    
    if (isCheat) {
      cheatDays[date] = true;
    } else {
      delete cheatDays[date];
    }
    
    await AsyncStorage.setItem(key, JSON.stringify(cheatDays));
    
    // Synchroniser avec Firestore
    if (isFirebaseAvailable() && userId !== 'guest') {
      try {
        const cheatDayRef = doc(db, 'users', userId, 'cheatDays', date);
        
        if (isCheat) {
          await setDoc(cheatDayRef, {
            date,
            isCheat: true,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        } else {
          // Supprimer le document si on désactive le cheat day
          const cheatDaySnap = await getDoc(cheatDayRef);
          if (cheatDaySnap.exists()) {
            await deleteDoc(cheatDayRef);
          }
        }
        
        console.log('[CheatDays] ✅ Synchronisé avec Firestore:', { userId, date, isCheat });
      } catch (error) {
        console.error('[CheatDays] Erreur sync Firestore:', error);
        // Ne pas throw - on continue avec AsyncStorage
      }
    }
  } catch (error) {
    console.error('[CheatDays] Erreur setCheatDay:', error);
    throw error;
  }
}

/**
 * Obtenir tous les cheat days d'un utilisateur
 */
export async function getCheatDays(userId: string): Promise<Record<string, boolean>> {
  try {
    // Charger depuis AsyncStorage
    const key = getCheatDaysKey(userId);
    const raw = await AsyncStorage.getItem(key);
    
    if (raw) {
      return JSON.parse(raw);
    }
    
    // Si pas dans AsyncStorage, essayer Firestore
    if (isFirebaseAvailable() && userId !== 'guest') {
      try {
        const cheatDaysRef = collection(db, 'users', userId, 'cheatDays');
        const snapshot = await getDocs(cheatDaysRef);
        
        const cheatDays: Record<string, boolean> = {};
        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.isCheat === true) {
            cheatDays[data.date || docSnap.id] = true;
          }
        });
        
        // Sauvegarder dans AsyncStorage pour cache
        if (Object.keys(cheatDays).length > 0) {
          await AsyncStorage.setItem(key, JSON.stringify(cheatDays));
        }
        
        return cheatDays;
      } catch (error) {
        console.warn('[CheatDays] Erreur lecture Firestore:', error);
      }
    }
    
    return {};
  } catch (error) {
    console.error('[CheatDays] Erreur getCheatDays:', error);
    return {};
  }
}

/**
 * Synchroniser les cheat days depuis Firestore vers AsyncStorage
 */
export async function syncCheatDaysFromFirestore(userId: string): Promise<void> {
  if (!isFirebaseAvailable() || userId === 'guest') {
    return;
  }
  
  try {
    const cheatDaysRef = collection(db, 'users', userId, 'cheatDays');
    const snapshot = await getDocs(cheatDaysRef);
    
    const cheatDays: Record<string, boolean> = {};
    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.isCheat === true) {
        cheatDays[data.date || docSnap.id] = true;
      }
    });
    
    // Sauvegarder dans AsyncStorage
    const key = getCheatDaysKey(userId);
    await AsyncStorage.setItem(key, JSON.stringify(cheatDays));
    
    console.log('[CheatDays] ✅ Synchronisé depuis Firestore:', Object.keys(cheatDays).length, 'jours');
  } catch (error) {
    console.error('[CheatDays] Erreur sync depuis Firestore:', error);
  }
}
