// Système de logging centralisé pour déboguer les problèmes utilisateurs
// Les logs sont envoyés à Firestore pour être consultables par utilisateur

import { FIREBASE_ENABLED, db } from './firebase-config';
import { collection, addDoc, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface UserLog {
  userId: string;
  level: LogLevel;
  message: string;
  context?: string; // Ex: 'onboarding', 'add-entry', 'points-calculation'
  data?: any; // Données supplémentaires (objets, erreurs, etc.)
  timestamp: Date;
  userAgent?: string;
  platform?: string;
}

// Cache des logs en mémoire pour éviter trop d'écritures
const logCache: UserLog[] = [];
const MAX_CACHE_SIZE = 50;
const FLUSH_INTERVAL = 30000; // 30 secondes

// Flush automatique des logs en cache
setInterval(() => {
  if (logCache.length > 0 && FIREBASE_ENABLED && db) {
    flushLogs().catch(console.error);
  }
}, FLUSH_INTERVAL);

/**
 * Logger un événement pour un utilisateur
 */
export async function logUserEvent(
  userId: string,
  level: LogLevel,
  message: string,
  context?: string,
  data?: any
): Promise<void> {
  // Toujours logger dans la console en développement
  const logMessage = `[${level.toUpperCase()}] [${context || 'app'}] ${message}`;
  
  switch (level) {
    case 'debug':
      console.log(logMessage, data || '');
      break;
    case 'info':
      console.log(logMessage, data || '');
      break;
    case 'warn':
      console.warn(logMessage, data || '');
      break;
    case 'error':
      console.error(logMessage, data || '');
      break;
  }

  // En production avec Firebase, envoyer à Firestore
  if (FIREBASE_ENABLED && db && userId && userId !== 'guest') {
    try {
      const userLog: UserLog = {
        userId,
        level,
        message,
        context: context || 'app',
        data: data ? (typeof data === 'object' ? JSON.stringify(data) : String(data)) : undefined,
        timestamp: new Date(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        platform: typeof window !== 'undefined' ? 'web' : 'mobile',
      };

      // Ajouter au cache
      logCache.push(userLog);

      // Si le cache est plein, flush immédiatement
      if (logCache.length >= MAX_CACHE_SIZE) {
        await flushLogs();
      }
    } catch (error) {
      // Ne pas bloquer l'app si le logging échoue
      console.error('[Logger] Erreur lors de l\'enregistrement du log:', error);
    }
  }
}

/**
 * Envoyer tous les logs en cache à Firestore
 */
async function flushLogs(): Promise<void> {
  if (!FIREBASE_ENABLED || !db || logCache.length === 0) return;

  try {
    const logsRef = collection(db, 'user_logs');
    const batch: Promise<void>[] = [];

    // Créer les documents Firestore
    for (const log of logCache) {
      batch.push(
        addDoc(logsRef, {
          ...log,
          timestamp: Timestamp.fromDate(log.timestamp),
        }).then(() => {}) // Convertir en Promise<void>
      );
    }

    await Promise.all(batch);
    
    // Vider le cache
    logCache.length = 0;
    
    console.log('[Logger] Logs envoyés à Firestore');
  } catch (error) {
    console.error('[Logger] Erreur lors de l\'envoi des logs:', error);
  }
}

/**
 * Récupérer les logs d'un utilisateur depuis Firestore
 * (Utile pour le debugging côté admin)
 */
export async function getUserLogs(
  userId: string,
  limitCount: number = 100,
  level?: LogLevel
): Promise<UserLog[]> {
  if (!FIREBASE_ENABLED || !db) {
    console.warn('[Logger] Firebase non activé, impossible de récupérer les logs');
    return [];
  }

  try {
    const logsRef = collection(db, 'user_logs');
    let q = query(
      logsRef,
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );

    if (level) {
      q = query(q, where('level', '==', level));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        timestamp: data.timestamp?.toDate() || new Date(),
      } as UserLog;
    });
  } catch (error) {
    console.error('[Logger] Erreur lors de la récupération des logs:', error);
    return [];
  }
}

/**
 * Fonctions helper pour les différents niveaux de log
 */
export const userLogger = {
  debug: (userId: string, message: string, context?: string, data?: any) =>
    logUserEvent(userId, 'debug', message, context, data),
  
  info: (userId: string, message: string, context?: string, data?: any) =>
    logUserEvent(userId, 'info', message, context, data),
  
  warn: (userId: string, message: string, context?: string, data?: any) =>
    logUserEvent(userId, 'warn', message, context, data),
  
  error: (userId: string, message: string, context?: string, error?: any) =>
    logUserEvent(userId, 'error', message, context, error),
};

/**
 * Logger une erreur avec stack trace
 */
export async function logError(
  userId: string,
  error: Error | unknown,
  context?: string,
  additionalData?: any
): Promise<void> {
  let errorMessage = 'Erreur inconnue';
  let stackTrace: string | undefined;
  let errorData: any = additionalData;

  if (error instanceof Error) {
    errorMessage = error.message;
    stackTrace = error.stack;
    errorData = {
      ...additionalData,
      name: error.name,
      stack: error.stack,
    };
  } else if (typeof error === 'string') {
    errorMessage = error;
  } else {
    errorData = { ...additionalData, error };
  }

  await logUserEvent(userId, 'error', errorMessage, context, errorData);
}

/**
 * Forcer l'envoi immédiat des logs (utile avant une action critique)
 */
export async function flushLogsNow(): Promise<void> {
  await flushLogs();
}

