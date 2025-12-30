// Helper pour récupérer la version de l'app
import Constants from 'expo-constants';

// Version injectée au build-time (voir scripts/build-production.sh)
// @ts-ignore - Ce fichier est généré automatiquement
import { BUILD_VERSION } from './build-version';

/**
 * Récupérer la version de l'app depuis expo-constants
 * Fallback sur BUILD_VERSION (injecté au build) si non disponible
 */
export function getAppVersion(): string {
  // Essayer d'abord expo-constants (fonctionne en dev et sur mobile)
  const expoVersion = Constants.expoConfig?.version || Constants.manifest2?.extra?.expoClient?.version;
  
  if (expoVersion) {
    return expoVersion;
  }
  
  // Fallback sur la version injectée au build (web static export)
  if (BUILD_VERSION) {
    return BUILD_VERSION;
  }
  
  // Dernier fallback (ne devrait jamais arriver)
  return '1.0.2';
}

/**
 * Récupérer la version formatée pour affichage
 */
export function getFormattedAppVersion(): string {
  return `v${getAppVersion()}`;
}
