// Helper pour récupérer la version de l'app
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Version injectée au build-time (voir scripts/build-production.sh)
// @ts-ignore - Ce fichier est généré automatiquement
import { BUILD_VERSION } from './build-version';

/**
 * Récupérer la version de l'app depuis expo-constants
 * Sur web: prioriser BUILD_VERSION (car expo-constants peut être stale)
 * Sur mobile: utiliser expo-constants (plus fiable)
 */
export function getAppVersion(): string {
  const expoVersion = Constants.expoConfig?.version || Constants.manifest2?.extra?.expoClient?.version;
  
  // Sur web, toujours prioriser BUILD_VERSION (injecté au build-time)
  if (Platform.OS === 'web') {
    if (__DEV__) {
      console.log(`[AppVersion] Web - expoVersion: ${expoVersion}, BUILD_VERSION: ${BUILD_VERSION}, chosen: ${BUILD_VERSION}`);
    }
    return BUILD_VERSION || expoVersion || '1.0.4';
  }
  
  // Sur mobile, utiliser expo-constants en priorité (plus fiable)
  if (expoVersion) {
    if (__DEV__) {
      console.log(`[AppVersion] Mobile - expoVersion: ${expoVersion}, BUILD_VERSION: ${BUILD_VERSION}, chosen: ${expoVersion}`);
    }
    return expoVersion;
  }
  
  // Fallback sur BUILD_VERSION
  if (BUILD_VERSION) {
    return BUILD_VERSION;
  }
  
  // Dernier fallback (ne devrait jamais arriver)
  return '1.0.4';
}

/**
 * Récupérer la version formatée pour affichage
 */
export function getFormattedAppVersion(): string {
  return `v${getAppVersion()}`;
}
