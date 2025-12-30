// Rate limiting par utilisateur pour l'API OpenAI
// Empêche le spam en limitant le nombre d'appels par jour par utilisateur

import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from './firebase-config';

const DAILY_LIMIT = 50; // Nombre maximum d'appels OpenAI par jour par utilisateur
const MIN_TIME_BETWEEN_CALLS_MS = 2000; // Délai minimum de 2 secondes entre appels

export interface APIUsage {
  userId: string;
  callsToday: number;
  dailyLimit: number;
  lastCallTimestamp: Timestamp | null;
  lastResetDate: string; // YYYY-MM-DD
}

/**
 * Obtenir la date d'aujourd'hui au format YYYY-MM-DD (timezone local)
 */
function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Réinitialiser le compteur quotidien si nécessaire
 */
async function resetDailyLimitIfNeeded(userId: string): Promise<void> {
  if (!db) return;

  try {
    const usageRef = doc(db, 'api_usage', userId);
    const usageDoc = await getDoc(usageRef);
    
    const today = getTodayDateString();
    
    if (!usageDoc.exists()) {
      // Premier usage - créer le document
      await setDoc(usageRef, {
        userId,
        callsToday: 0,
        dailyLimit: DAILY_LIMIT,
        lastCallTimestamp: null,
        lastResetDate: today,
      });
      return;
    }
    
    const data = usageDoc.data() as APIUsage;
    
    // Si c'est un nouveau jour, réinitialiser le compteur
    if (data.lastResetDate !== today) {
      await setDoc(usageRef, {
        ...data,
        callsToday: 0,
        lastResetDate: today,
        lastCallTimestamp: null,
      }, { merge: true });
    }
  } catch (error) {
    console.error('[API Rate Limit] Erreur reset limite:', error);
    // Ne pas bloquer si le reset échoue
  }
}

/**
 * Vérifier si l'utilisateur peut faire un appel API
 * Vérifie aussi le délai minimum entre appels
 */
export async function checkUserAPILimit(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  if (!db || !userId || userId === 'guest') {
    return { allowed: false, reason: 'Utilisateur non authentifié' };
  }

  try {
    // Réinitialiser si nécessaire
    await resetDailyLimitIfNeeded(userId);
    
    const usageRef = doc(db, 'api_usage', userId);
    const usageDoc = await getDoc(usageRef);
    
    if (!usageDoc.exists()) {
      // Premier appel - autoriser
      return { allowed: true };
    }
    
    const data = usageDoc.data() as APIUsage;
    
    // Vérifier la limite quotidienne
    if (data.callsToday >= data.dailyLimit) {
      return {
        allowed: false,
        reason: `Limite quotidienne atteinte (${data.dailyLimit} appels/jour). Réessayez demain.`,
      };
    }
    
    // Vérifier le délai minimum entre appels
    if (data.lastCallTimestamp) {
      const lastCallTime = data.lastCallTimestamp.toMillis();
      const now = Date.now();
      const timeSinceLastCall = now - lastCallTime;
      
      if (timeSinceLastCall < MIN_TIME_BETWEEN_CALLS_MS) {
        const remainingMs = MIN_TIME_BETWEEN_CALLS_MS - timeSinceLastCall;
        return {
          allowed: false,
          reason: `Veuillez patienter ${Math.ceil(remainingMs / 1000)} seconde(s) avant de réessayer.`,
        };
      }
    }
    
    return { allowed: true };
  } catch (error) {
    console.error('[API Rate Limit] Erreur vérification limite:', error);
    // En cas d'erreur, autoriser (ne pas bloquer l'utilisateur)
    return { allowed: true };
  }
}

/**
 * Incrémenter le compteur d'appels API pour un utilisateur
 */
export async function incrementAPICall(userId: string): Promise<void> {
  if (!db || !userId || userId === 'guest') return;

  try {
    await resetDailyLimitIfNeeded(userId);
    
    const usageRef = doc(db, 'api_usage', userId);
    const usageDoc = await getDoc(usageRef);
    
    const today = getTodayDateString();
    
    if (!usageDoc.exists()) {
      // Créer le document avec le premier appel
      await setDoc(usageRef, {
        userId,
        callsToday: 1,
        dailyLimit: DAILY_LIMIT,
        lastCallTimestamp: Timestamp.now(),
        lastResetDate: today,
      });
    } else {
      const data = usageDoc.data() as APIUsage;
      await setDoc(usageRef, {
        ...data,
        callsToday: data.callsToday + 1,
        lastCallTimestamp: Timestamp.now(),
      }, { merge: true });
    }
  } catch (error) {
    console.error('[API Rate Limit] Erreur incrément appel:', error);
    // Ne pas bloquer si l'incrément échoue
  }
}

/**
 * Obtenir les statistiques d'usage API pour un utilisateur
 */
export async function getAPIUsageStats(userId: string): Promise<APIUsage | null> {
  if (!db || !userId || userId === 'guest') return null;

  try {
    await resetDailyLimitIfNeeded(userId);
    
    const usageRef = doc(db, 'api_usage', userId);
    const usageDoc = await getDoc(usageRef);
    
    if (!usageDoc.exists()) {
      return {
        userId,
        callsToday: 0,
        dailyLimit: DAILY_LIMIT,
        lastCallTimestamp: null,
        lastResetDate: getTodayDateString(),
      };
    }
    
    return usageDoc.data() as APIUsage;
  } catch (error) {
    console.error('[API Rate Limit] Erreur récupération stats:', error);
    return null;
  }
}

