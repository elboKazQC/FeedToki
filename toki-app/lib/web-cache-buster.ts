/**
 * Helper pour nettoyer les caches web persistants
 * (Service Workers, Cache Storage API)
 * 
 * Résout le problème de versions bloquées sur le web où un ancien bundle
 * reste servi même après déploiement d'une nouvelle version.
 * 
 * STRATÉGIE:
 * - Utilise localStorage (persistant entre sessions) pour tracker la version
 * - Si BUILD_VERSION != localStorage version -> hard reload automatique
 * - Logs détaillés à chaque étape pour diagnostic
 * - Protection contre boucles infinies (max 3 reloads)
 */

import { Platform } from 'react-native';
import { logger } from './logger';

const CACHE_BUST_VERSION_KEY = 'feedtoki_cached_version';
const CACHE_BUST_RELOAD_COUNT_KEY = 'feedtoki_reload_count';
const MAX_RELOAD_ATTEMPTS = 3;

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
 * Récupérer la version en cache (localStorage)
 */
function getCachedVersion(): string | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  return localStorage.getItem(CACHE_BUST_VERSION_KEY);
}

/**
 * Mettre à jour la version en cache
 */
function setCachedVersion(version: string): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(CACHE_BUST_VERSION_KEY, version);
    console.log(`[Cache Buster] Version cached: ${version}`);
  }
}

/**
 * Gérer le compteur de reload pour éviter les boucles infinies
 */
function getReloadCount(): number {
  if (typeof localStorage === 'undefined') {
    return 0;
  }
  const count = localStorage.getItem(CACHE_BUST_RELOAD_COUNT_KEY);
  return count ? parseInt(count, 10) : 0;
}

function incrementReloadCount(): void {
  if (typeof localStorage !== 'undefined') {
    const count = getReloadCount() + 1;
    localStorage.setItem(CACHE_BUST_RELOAD_COUNT_KEY, count.toString());
    console.log(`[Cache Buster] Reload count: ${count}/${MAX_RELOAD_ATTEMPTS}`);
  }
}

function resetReloadCount(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(CACHE_BUST_RELOAD_COUNT_KEY);
    console.log('[Cache Buster] Reload count reset');
  }
}

/**
 * Nettoyer les caches web et recharger la page (appel manuel depuis /version)
 * 
 * @param currentVersion - La version actuelle du build
 */
export async function bustWebCache(currentVersion: string): Promise<void> {
  // Web uniquement
  if (Platform.OS !== 'web') {
    console.log('[Cache Buster] Skipping: not web platform');
    return;
  }

  console.log('[Cache Buster] === MANUAL CACHE BUST START ===');
  console.log(`[Cache Buster] Current version: ${currentVersion}`);

  // Nettoyer les service workers et caches
  console.log('[Cache Buster] 🧹 Cleaning all caches...');
  await Promise.all([
    unregisterServiceWorkers(),
    clearCacheStorage(),
  ]);

  // Reset le compteur de reload
  resetReloadCount();

  // Mettre à jour la version en cache
  setCachedVersion(currentVersion);

  // Hard reload agressif
  console.warn('[Cache Buster] 🔄 Forcing hard reload...');
  
  try {
    // Vider le cache du navigateur si possible
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      for (const cacheName of cacheNames) {
        await caches.delete(cacheName);
      }
    }
    
    // Forcer un hard reload avec query string
    setTimeout(() => {
      const url = new URL(window.location.href);
      url.searchParams.set('_force_reload', Date.now().toString());
      window.location.replace(url.toString());
    }, 100);
  } catch (error) {
    console.error('[Cache Buster] Error during hard reload:', error);
    setTimeout(() => {
      window.location.reload();
    }, 500);
  }
}

/**
 * Auto-cleanup au démarrage de l'app (appelé depuis _layout.tsx)
 * Vérifie la version et force un hard reload si nécessaire
 */
export async function autoCleanupWebCache(currentVersion: string): Promise<void> {
  if (Platform.OS !== 'web') {
    console.log('[Cache Buster] Skipping: not web platform');
    return;
  }

  // Extraire le hash du bundle depuis le script chargé (si disponible)
  let bundleHash = 'unknown';
  if (typeof document !== 'undefined') {
    const scripts = document.querySelectorAll('script[src*="entry-"]');
    if (scripts.length > 0) {
      const src = (scripts[0] as HTMLScriptElement).src;
      const hashMatch = src.match(/entry-([a-f0-9]+)\.js/);
      if (hashMatch) {
        bundleHash = hashMatch[1];
      }
    }
  }

  console.log(`[Cache Buster] === AUTO CLEANUP START ===`);
  console.log(`[Cache Buster] Current BUILD_VERSION: ${currentVersion}`);
  console.log(`[Cache Buster] Bundle hash: ${bundleHash}`);

  const cachedVersion = getCachedVersion();
  console.log(`[Cache Buster] Cached version: ${cachedVersion || 'none'}`);

  // Si les versions correspondent, tout va bien
  if (cachedVersion === currentVersion) {
    console.log('[Cache Buster] ✅ Versions match, no action needed');
    resetReloadCount(); // Reset le compteur si on a la bonne version
    return;
  }
  
  // Warning si la version détectée ne correspond pas à celle attendue
  if (currentVersion && cachedVersion && cachedVersion !== currentVersion) {
    console.warn(`[Cache Buster] ⚠️  Version mismatch détectée!`);
    console.warn(`[Cache Buster]    Version attendue: ${currentVersion}`);
    console.warn(`[Cache Buster]    Version en cache: ${cachedVersion}`);
    console.warn(`[Cache Buster]    Bundle hash: ${bundleHash}`);
    console.warn(`[Cache Buster]    💡 Si tu vois toujours une ancienne version, utilise le bouton "Forcer la mise à jour" dans Paramètres → Version`);
  }

  // Nouvelle version détectée!
  console.warn(`[Cache Buster] ⚠️  Version mismatch! Cached: ${cachedVersion}, Current: ${currentVersion}`);

  // Vérifier qu'on n'est pas dans une boucle infinie
  const reloadCount = getReloadCount();
  console.log(`[Cache Buster] Reload attempt ${reloadCount + 1}/${MAX_RELOAD_ATTEMPTS}`);

  if (reloadCount >= MAX_RELOAD_ATTEMPTS) {
    console.error(`[Cache Buster] ❌ Max reload attempts reached. Giving up and updating cached version.`);
    setCachedVersion(currentVersion);
    resetReloadCount();
    return;
  }

  // Nettoyer les caches
  console.log('[Cache Buster] 🧹 Cleaning caches...');
  await Promise.all([
    unregisterServiceWorkers(),
    clearCacheStorage(),
  ]);

  // Incrémenter le compteur AVANT le reload
  incrementReloadCount();

  // Mettre à jour la version en cache
  setCachedVersion(currentVersion);

  // Hard reload pour récupérer le nouveau bundle
  console.warn('[Cache Buster] 🔄 Forcing hard reload...');
  
  // Méthode agressive : vider le cache et forcer un rechargement avec query string
  try {
    // Vider le cache du navigateur si possible
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      for (const cacheName of cacheNames) {
        await caches.delete(cacheName);
      }
    }
    
    // Vider localStorage sauf la version (pour éviter les boucles)
    const versionToKeep = currentVersion;
    const keysToKeep = [CACHE_BUST_VERSION_KEY, CACHE_BUST_RELOAD_COUNT_KEY];
    if (typeof localStorage !== 'undefined') {
      const allKeys = Object.keys(localStorage);
      for (const key of allKeys) {
        if (!keysToKeep.includes(key)) {
          localStorage.removeItem(key);
        }
      }
    }
    
    // Forcer un hard reload avec plusieurs méthodes
    setTimeout(() => {
      // Méthode 1: Ajouter un query string pour forcer le rechargement
      const url = new URL(window.location.href);
      url.searchParams.set('_v', currentVersion);
      url.searchParams.set('_t', Date.now().toString());
      
      // Méthode 2: Utiliser location.replace pour éviter l'historique
      window.location.replace(url.toString());
    }, 100);
  } catch (error) {
    console.error('[Cache Buster] Error during hard reload:', error);
    // Fallback: méthode simple
    setTimeout(() => {
      window.location.reload();
    }, 500);
  }
}

/**
 * Diagnostics: récupérer l'état des caches
 */
export async function getCacheStatus(): Promise<{
  hasServiceWorker: boolean;
  serviceWorkerCount: number;
  cacheNames: string[];
  lastBustedVersion: string | null;
  reloadCount: number;
}> {
  const status = {
    hasServiceWorker: false,
    serviceWorkerCount: 0,
    cacheNames: [] as string[],
    lastBustedVersion: null as string | null,
    reloadCount: 0,
  };

  if (Platform.OS !== 'web') {
    return status;
  }

  console.log('[Cache Status] Checking cache status...');

  // Service Workers
  if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      status.hasServiceWorker = registrations.length > 0;
      status.serviceWorkerCount = registrations.length;
      console.log(`[Cache Status] Service Workers: ${registrations.length}`);
    } catch (error) {
      console.warn('[Cache Status] Failed to check service workers:', error);
    }
  }

  // Cache Storage
  if (typeof caches !== 'undefined') {
    try {
      status.cacheNames = await caches.keys();
      console.log(`[Cache Status] Cache Storage: ${status.cacheNames.length} cache(s)`);
    } catch (error) {
      console.warn('[Cache Status] Failed to check cache storage:', error);
    }
  }

  // localStorage
  status.lastBustedVersion = getCachedVersion();
  status.reloadCount = getReloadCount();
  console.log(`[Cache Status] Cached version: ${status.lastBustedVersion}, Reload count: ${status.reloadCount}`);

  return status;
}

/**
 * Forcer une mise à jour complète (vide tout localStorage sauf données utilisateur)
 * Plus agressif que bustWebCache - à utiliser si le cache busting normal ne fonctionne pas
 */
export async function forceUpdate(currentVersion: string): Promise<void> {
  if (Platform.OS !== 'web') {
    console.log('[Force Update] Skipping: not web platform');
    return;
  }

  console.log('[Force Update] === FORCE UPDATE START ===');
  console.log(`[Force Update] Current version: ${currentVersion}`);

  try {
    // 1. Nettoyer tous les service workers
    await unregisterServiceWorkers();
    
    // 2. Nettoyer tous les caches
    await clearCacheStorage();
    
    // 3. Vider localStorage (sauf données utilisateur importantes)
    if (typeof localStorage !== 'undefined') {
      const keysToKeep = [
        // Données utilisateur importantes
        'toki_user_profile_v1',
        'toki_user_v1',
        // Clés de cache busting (on les reset)
      ];
      
      const allKeys = Object.keys(localStorage);
      let deletedCount = 0;
      
      for (const key of allKeys) {
        // Garder seulement les données utilisateur
        if (!keysToKeep.some(keepKey => key.startsWith(keepKey))) {
          localStorage.removeItem(key);
          deletedCount++;
        }
      }
      
      console.log(`[Force Update] Deleted ${deletedCount} localStorage entries`);
      
      // Reset les clés de cache busting
      localStorage.removeItem(CACHE_BUST_VERSION_KEY);
      localStorage.removeItem(CACHE_BUST_RELOAD_COUNT_KEY);
    }
    
    // 4. Forcer un hard reload avec query string unique
    console.warn('[Force Update] 🔄 Forcing hard reload with cache bypass...');
    
    setTimeout(() => {
      const url = new URL(window.location.href);
      // Enlever les anciens paramètres
      url.searchParams.delete('_v');
      url.searchParams.delete('_t');
      url.searchParams.delete('_force_reload');
      // Ajouter un nouveau paramètre unique
      url.searchParams.set('_force_update', currentVersion);
      url.searchParams.set('_timestamp', Date.now().toString());
      
      // Utiliser replace pour éviter l'historique
      window.location.replace(url.toString());
    }, 200);
  } catch (error) {
    console.error('[Force Update] Error:', error);
    // Fallback: simple reload
    setTimeout(() => {
      window.location.reload();
    }, 500);
  }
}
