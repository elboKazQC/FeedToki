/**
 * Helper pour nettoyer les caches web persistants
 * (Service Workers, Cache Storage API)
 * 
 * Résout le problème de versions bloquées sur le web où un ancien bundle
 * reste servi même après déploiement d'une nouvelle version.
 */

import { Platform } from 'react-native';
import { logger } from './logger';

const CACHE_BUST_FLAG = 'feedtoki_cache_busted';
const CACHE_BUST_VERSION = '1.0.3'; // Incrémenter pour forcer un nouveau bust

/**
 * Unregister tous les Service Workers actifs
 */
async function unregisterServiceWorkers(): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) {
    return;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    
    if (registrations.length > 0) {
      logger.info(`[Cache Buster] Found ${registrations.length} service worker(s), unregistering...`);
      
      for (const registration of registrations) {
        await registration.unregister();
      }
      
      logger.info('[Cache Buster] All service workers unregistered');
    }
  } catch (error) {
    logger.warn('[Cache Buster] Failed to unregister service workers:', error);
  }
}

/**
 * Supprimer toutes les entrées du Cache Storage API
 */
async function clearCacheStorage(): Promise<void> {
  if (typeof caches === 'undefined') {
    return;
  }

  try {
    const cacheNames = await caches.keys();
    
    if (cacheNames.length > 0) {
      logger.info(`[Cache Buster] Found ${cacheNames.length} cache(s), deleting...`);
      
      for (const cacheName of cacheNames) {
        await caches.delete(cacheName);
      }
      
      logger.info('[Cache Buster] All caches cleared');
    }
  } catch (error) {
    logger.warn('[Cache Buster] Failed to clear cache storage:', error);
  }
}

/**
 * Vérifier si un cache bust est nécessaire pour cette version
 */
function shouldCacheBust(): boolean {
  if (typeof sessionStorage === 'undefined') {
    return false;
  }

  const lastBustedVersion = sessionStorage.getItem(CACHE_BUST_FLAG);
  return lastBustedVersion !== CACHE_BUST_VERSION;
}

/**
 * Marquer le cache bust comme effectué pour cette session
 */
function markCacheBusted(): void {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(CACHE_BUST_FLAG, CACHE_BUST_VERSION);
  }
}

/**
 * Nettoyer les caches web et recharger la page (une seule fois)
 * 
 * @param forceReload - Si true, force le reload même si déjà effectué cette session
 */
export async function bustWebCache(forceReload: boolean = false): Promise<void> {
  // Web uniquement
  if (Platform.OS !== 'web') {
    return;
  }

  // Éviter la boucle infinie: ne recharger qu'une fois par session
  if (!forceReload && !shouldCacheBust()) {
    logger.debug('[Cache Buster] Already busted in this session, skipping');
    return;
  }

  logger.info('[Cache Buster] Starting cache cleanup...');

  // Nettoyer les service workers et caches
  await Promise.all([
    unregisterServiceWorkers(),
    clearCacheStorage(),
  ]);

  // Marquer comme effectué
  markCacheBusted();

  // Recharger la page pour récupérer le nouveau bundle
  if (forceReload || shouldCacheBust()) {
    logger.info('[Cache Buster] Reloading page to fetch fresh bundle...');
    
    // Délai court pour laisser les logs s'afficher
    setTimeout(() => {
      window.location.reload();
    }, 100);
  }
}

/**
 * Auto-cleanup au démarrage de l'app (appelé depuis _layout.tsx)
 * Ne reload que si nécessaire (première visite ou nouvelle version)
 */
export async function autoCleanupWebCache(): Promise<void> {
  if (Platform.OS !== 'web') {
    return;
  }

  // Vérifier si on doit faire le cleanup
  if (!shouldCacheBust()) {
    return;
  }

  // Nettoyer silencieusement sans reload (pour ne pas perturber l'UX)
  await Promise.all([
    unregisterServiceWorkers(),
    clearCacheStorage(),
  ]);

  markCacheBusted();
}

/**
 * Diagnostics: récupérer l'état des caches
 */
export async function getCacheStatus(): Promise<{
  hasServiceWorker: boolean;
  serviceWorkerCount: number;
  cacheNames: string[];
  lastBustedVersion: string | null;
}> {
  const status = {
    hasServiceWorker: false,
    serviceWorkerCount: 0,
    cacheNames: [] as string[],
    lastBustedVersion: null as string | null,
  };

  if (Platform.OS !== 'web') {
    return status;
  }

  // Service Workers
  if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      status.hasServiceWorker = registrations.length > 0;
      status.serviceWorkerCount = registrations.length;
    } catch (error) {
      logger.warn('[Cache Status] Failed to check service workers:', error);
    }
  }

  // Cache Storage
  if (typeof caches !== 'undefined') {
    try {
      status.cacheNames = await caches.keys();
    } catch (error) {
      logger.warn('[Cache Status] Failed to check cache storage:', error);
    }
  }

  // Session flag
  if (typeof sessionStorage !== 'undefined') {
    status.lastBustedVersion = sessionStorage.getItem(CACHE_BUST_FLAG);
  }

  return status;
}
