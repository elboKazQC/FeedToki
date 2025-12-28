// Gestion centralisée des erreurs
// Logging et affichage d'erreurs utilisateur

type ErrorLevel = 'info' | 'warning' | 'error' | 'critical';

export type AppError = {
  message: string;
  level: ErrorLevel;
  timestamp: string;
  context?: string;
  stack?: string;
};

/**
 * Logger une erreur
 */
export function logError(
  error: Error | string,
  level: ErrorLevel = 'error',
  context?: string
): void {
  const errorMessage = typeof error === 'string' ? error : error.message;
  const errorStack = typeof error === 'string' ? undefined : error.stack;

  const appError: AppError = {
    message: errorMessage,
    level,
    timestamp: new Date().toISOString(),
    context,
    stack: errorStack,
  };

  // Log dans la console (en dev)
  if (__DEV__) {
    console.error(`[${level.toUpperCase()}]`, appError);
  }

  // TODO: En production, envoyer à Firebase Crashlytics ou Sentry
  // if (!__DEV__) {
  //   crashlytics().recordError(error);
  // }
}

/**
 * Afficher une erreur à l'utilisateur de manière user-friendly
 */
export function showUserError(
  error: Error | string,
  title: string = 'Erreur'
): void {
  const message = typeof error === 'string' ? error : error.message;
  
  // En React Native, on utilise Alert
  // En web, on pourrait utiliser un toast
  if (typeof alert !== 'undefined') {
    alert(`${title}\n\n${message}`);
  }
  
  // Logger l'erreur
  logError(error, 'error', 'user-facing');
}

/**
 * Wrapper pour les fonctions async avec gestion d'erreur automatique
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  errorMessage: string = 'Une erreur est survenue'
): Promise<T | null> {
  try {
    return await fn();
  } catch (error: any) {
    logError(error, 'error');
    showUserError(error, errorMessage);
    return null;
  }
}

/**
 * Retry automatique pour opérations critiques
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      logError(error, attempt === maxRetries ? 'error' : 'warning', `Retry attempt ${attempt}/${maxRetries}`);
      
      if (attempt < maxRetries) {
        // Attendre avant de réessayer
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
      }
    }
  }

  throw lastError || new Error('Tous les essais ont échoué');
}

