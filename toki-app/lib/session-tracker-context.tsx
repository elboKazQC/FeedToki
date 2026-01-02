// Context React pour gérer le tracking des sessions utilisateur
// Détecte l'inactivité (30 min) et démarre/termine les sessions automatiquement

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { useAuth } from './auth-context';
import { startSession, endSession, SESSION_TIMEOUT_MS } from './session-tracker';

type SessionTrackerContextType = {
  currentSessionId: string | null;
};

const SessionTrackerContext = createContext<SessionTrackerContextType>({
  currentSessionId: null,
});

export function useSessionTracker() {
  return useContext(SessionTrackerContext);
}

export function SessionTrackerProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const currentUserId = profile?.userId || (user as any)?.uid || (user as any)?.id || 'guest';

  // Fonction pour démarrer une nouvelle session
  const handleStartSession = async () => {
    if (currentUserId === 'guest') {
      return;
    }

    try {
      const sessionId = await startSession(currentUserId);
      if (sessionId) {
        setCurrentSessionId(sessionId);
        lastActivityRef.current = Date.now();
        console.log('[Session Tracker] Session démarrée:', sessionId);
      }
    } catch (error) {
      console.error('[Session Tracker] Erreur démarrage session:', error);
    }
  };

  // Fonction pour terminer la session actuelle
  const handleEndSession = async () => {
    if (currentSessionId) {
      try {
        await endSession(currentSessionId);
        setCurrentSessionId(null);
        console.log('[Session Tracker] Session terminée:', currentSessionId);
      } catch (error) {
        console.error('[Session Tracker] Erreur terminaison session:', error);
      }
    }
  };

  // Fonction pour réinitialiser le timeout d'inactivité
  const resetInactivityTimeout = () => {
    // Annuler le timeout précédent
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Si on a une session active, vérifier si on doit la terminer
    if (currentSessionId) {
      const timeSinceLastActivity = Date.now() - lastActivityRef.current;
      
      // Si plus de 30 min d'inactivité, terminer la session
      if (timeSinceLastActivity >= SESSION_TIMEOUT_MS) {
        handleEndSession();
        // Démarrer une nouvelle session
        handleStartSession();
      } else {
        // Programmer la vérification dans le temps restant
        const remainingTime = SESSION_TIMEOUT_MS - timeSinceLastActivity;
        timeoutRef.current = setTimeout(() => {
          handleEndSession();
          handleStartSession(); // Démarrer une nouvelle session après timeout
        }, remainingTime);
      }
    } else {
      // Pas de session active, en démarrer une nouvelle
      handleStartSession();
    }

    // Mettre à jour le timestamp de dernière activité
    lastActivityRef.current = Date.now();
  };

  // Détecter les changements d'état de l'app (React Native)
  useEffect(() => {
    if (Platform.OS === 'web') {
      return; // Géré séparément pour le web
    }

    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      const previousAppState = appStateRef.current;
      appStateRef.current = nextAppState;

      // Si l'app passe de background/inactive à active
      if (previousAppState.match(/inactive|background/) && nextAppState === 'active') {
        const timeSinceLastActivity = Date.now() - lastActivityRef.current;
        
        // Si plus de 30 min d'inactivité, terminer l'ancienne session et en démarrer une nouvelle
        if (timeSinceLastActivity >= SESSION_TIMEOUT_MS) {
          handleEndSession();
          handleStartSession();
        } else {
          // Sinon, juste réinitialiser le timeout
          resetInactivityTimeout();
        }
      } else if (nextAppState.match(/inactive|background/)) {
        // L'app passe en background, on garde la session active mais on arrête le timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      }
    });

    return () => {
      subscription.remove();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [currentUserId, currentSessionId]);

  // Détecter les changements de visibilité (Web)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const timeSinceLastActivity = Date.now() - lastActivityRef.current;
        
        // Si plus de 30 min d'inactivité, terminer l'ancienne session et en démarrer une nouvelle
        if (timeSinceLastActivity >= SESSION_TIMEOUT_MS) {
          handleEndSession();
          handleStartSession();
        } else {
          // Sinon, juste réinitialiser le timeout
          resetInactivityTimeout();
        }
      } else {
        // Page cachée, arrêter le timeout mais garder la session
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [currentUserId, currentSessionId]);

  // Démarrer une session au chargement si l'utilisateur est connecté
  useEffect(() => {
    if (currentUserId && currentUserId !== 'guest') {
      // Attendre un peu pour s'assurer que tout est initialisé
      const timer = setTimeout(() => {
        handleStartSession();
      }, 1000);

      return () => {
        clearTimeout(timer);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    } else {
      // Utilisateur déconnecté, terminer la session si elle existe
      if (currentSessionId) {
        handleEndSession();
      }
    }
  }, [currentUserId]);

  // Réinitialiser le timeout d'inactivité lors des interactions utilisateur
  // (scroll, touch, click, etc.)
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
      
      const handleActivity = () => {
        resetInactivityTimeout();
      };

      events.forEach(event => {
        window.addEventListener(event, handleActivity, { passive: true });
      });

      return () => {
        events.forEach(event => {
          window.removeEventListener(event, handleActivity);
        });
      };
    }
  }, [currentSessionId]);

  // Nettoyer à la fermeture
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (currentSessionId) {
        endSession(currentSessionId).catch(console.error);
      }
    };
  }, []);

  return (
    <SessionTrackerContext.Provider value={{ currentSessionId }}>
      {children}
    </SessionTrackerContext.Provider>
  );
}
