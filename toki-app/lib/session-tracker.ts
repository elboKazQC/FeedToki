// Service de tracking des sessions utilisateur
// Une session se termine après 30 minutes d'inactivité

import { collection, addDoc, query, where, getDocs, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db, FIREBASE_ENABLED, getDb } from './firebase-config';
import { normalizeDate } from './stats';

export const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes en millisecondes

export type UserSession = {
  userId: string;
  startTime: Date;
  endTime?: Date;
  durationMs?: number;
  date: string; // YYYY-MM-DD
};

/**
 * Vérifier si Firebase est disponible
 */
function isFirebaseAvailable(): boolean {
  return FIREBASE_ENABLED && db !== null;
}

/**
 * Démarrer une nouvelle session pour un utilisateur
 * @returns ID de la session créée ou null si erreur
 */
export async function startSession(userId: string): Promise<string | null> {
  if (!isFirebaseAvailable() || !userId || userId === 'guest') {
    return null;
  }

  try {
    const now = new Date();
    const date = normalizeDate(now.toISOString());
    
    const sessionData = {
      userId,
      startTime: Timestamp.fromDate(now),
      date,
    };

    const sessionsRef = collection(getDb(), 'user_sessions');
    const docRef = await addDoc(sessionsRef, sessionData);
    
    console.log('[Session Tracker] Nouvelle session démarrée:', {
      sessionId: docRef.id,
      userId: userId.substring(0, 8) + '...',
      date,
    });
    
    return docRef.id;
  } catch (error: any) {
    // Ignorer silencieusement les erreurs de permissions (non-bloquant)
    // Les erreurs de permissions sont normales si les règles Firestore ne permettent pas l'écriture
    if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
      if (__DEV__) {
        console.warn('[Session Tracker] Permissions insuffisantes pour démarrer session (non-bloquant)');
      }
    } else {
      console.error('[Session Tracker] Erreur démarrage session:', error);
    }
    return null;
  }
}

/**
 * Terminer une session (appelé après 30 min d'inactivité ou à la fermeture de l'app)
 */
export async function endSession(sessionId: string | null): Promise<void> {
  if (!isFirebaseAvailable() || !sessionId) {
    return;
  }

  try {
    // Récupérer la session directement par son ID
    const { doc, getDoc, updateDoc } = await import('firebase/firestore');
    const sessionRef = doc(getDb(), 'user_sessions', sessionId);
    const sessionSnap = await getDoc(sessionRef);
    
    if (!sessionSnap.exists()) {
      console.warn('[Session Tracker] Session non trouvée pour terminaison:', sessionId);
      return;
    }

    const sessionData = sessionSnap.data();
    const startTime = sessionData.startTime?.toDate();
    
    if (!startTime) {
      console.warn('[Session Tracker] Pas de startTime pour la session:', sessionId);
      return;
    }

    const endTime = new Date();
    const durationMs = endTime.getTime() - startTime.getTime();

    // Mettre à jour la session avec endTime et duration
    await updateDoc(sessionRef, {
      endTime: Timestamp.fromDate(endTime),
      durationMs,
    });

    console.log('[Session Tracker] Session terminée:', {
      sessionId,
      durationMs: Math.round(durationMs / 1000) + 's',
    });
  } catch (error: any) {
    // Ignorer silencieusement les erreurs de permissions (non-bloquant)
    if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
      if (__DEV__) {
        console.warn('[Session Tracker] Permissions insuffisantes pour terminer session (non-bloquant)');
      }
    } else {
      console.error('[Session Tracker] Erreur terminaison session:', error);
    }
  }
}

/**
 * Récupérer les sessions d'un utilisateur pour une période donnée
 */
export async function getUserSessions(
  userId: string,
  startDate?: Date,
  endDate?: Date
): Promise<UserSession[]> {
  if (!isFirebaseAvailable() || !userId || userId === 'guest') {
    return [];
  }

  try {
    const sessionsRef = collection(getDb(), 'user_sessions');
    let q = query(
      sessionsRef,
      where('userId', '==', userId),
      orderBy('startTime', 'desc'),
      limit(1000) // Limiter à 1000 sessions max
    );

    // Si des dates sont fournies, filtrer par date
    // Note: On filtre côté client car Firestore ne permet qu'une seule clause where par champ
    // et on a déjà where('userId', '==', userId)

    const snapshot = await getDocs(q);
    
    let sessions = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        userId: data.userId,
        startTime: data.startTime?.toDate() || new Date(),
        endTime: data.endTime?.toDate(),
        durationMs: data.durationMs,
        date: data.date || normalizeDate(data.startTime?.toDate().toISOString() || new Date().toISOString()),
      };
    });

    // Filtrer par date côté client si nécessaire
    if (startDate || endDate) {
      sessions = sessions.filter(session => {
        const sessionDate = new Date(session.date + 'T00:00:00');
        if (startDate && sessionDate < startDate) return false;
        if (endDate && sessionDate > endDate) return false;
        return true;
      });
    }
    
    return sessions;
  } catch (error) {
    console.error('[Session Tracker] Erreur récupération sessions:', error);
    return [];
  }
}

/**
 * Calculer le nombre moyen de sessions par jour pour un utilisateur (30 derniers jours)
 */
export async function calculateAverageSessionsPerDay(userId: string): Promise<number> {
  if (!isFirebaseAvailable() || !userId || userId === 'guest') {
    return 0;
  }

  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const sessions = await getUserSessions(userId, thirtyDaysAgo, new Date());
    
    if (sessions.length === 0) {
      return 0;
    }

    // Grouper les sessions par date
    const sessionsByDate: Record<string, number> = {};
    sessions.forEach(session => {
      const date = session.date;
      sessionsByDate[date] = (sessionsByDate[date] || 0) + 1;
    });

    // Calculer la moyenne
    const dates = Object.keys(sessionsByDate);
    const totalSessions = sessions.length;
    const daysWithSessions = dates.length;
    
    // Moyenne = nombre total de sessions / nombre de jours avec sessions
    // Si on veut la moyenne sur 30 jours (même sans sessions), utiliser: totalSessions / 30
    // Ici, on utilise la moyenne sur les jours avec sessions pour être plus représentatif
    return daysWithSessions > 0 ? Math.round((totalSessions / daysWithSessions) * 10) / 10 : 0;
  } catch (error) {
    console.error('[Session Tracker] Erreur calcul moyenne sessions:', error);
    return 0;
  }
}

/**
 * Calculer le nombre total de sessions pour un utilisateur
 */
export async function getTotalSessions(userId: string): Promise<number> {
  if (!isFirebaseAvailable() || !userId || userId === 'guest') {
    return 0;
  }

  try {
    const sessions = await getUserSessions(userId);
    return sessions.length;
  } catch (error) {
    console.error('[Session Tracker] Erreur calcul total sessions:', error);
    return 0;
  }
}
