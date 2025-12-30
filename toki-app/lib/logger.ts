// Logger centralisé pour la production
// Remplace console.log/error/warn avec gestion automatique selon l'environnement

const isDevelopment = __DEV__ || process.env.NODE_ENV === 'development';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Logger centralisé qui mute les logs en production sauf les erreurs critiques
 */
class Logger {
  private shouldLog(level: LogLevel): boolean {
    // En production, logger seulement les warnings et erreurs
    if (!isDevelopment) {
      return level === 'warn' || level === 'error';
    }
    // En développement, logger tout
    return true;
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.log(`[INFO] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    // Les erreurs sont toujours loggées
    console.error(`[ERROR] ${message}`, ...args);
  }
}

// Export singleton
export const logger = new Logger();

// Export fonctions pour compatibilité avec code existant
export const logDebug = (message: string, ...args: any[]) => logger.debug(message, ...args);
export const logInfo = (message: string, ...args: any[]) => logger.info(message, ...args);
export const logWarn = (message: string, ...args: any[]) => logger.warn(message, ...args);
export const logError = (message: string, ...args: any[]) => logger.error(message, ...args);


