// Helper pour récupérer la version de l'app
import Constants from 'expo-constants';

/**
 * Récupérer la version de l'app depuis expo-constants
 * Fallback sur package.json si non disponible
 */
export function getAppVersion(): string {
  // Essayer d'abord expo-constants
  const expoVersion = Constants.expoConfig?.version || Constants.manifest2?.extra?.expoClient?.version;
  
  if (expoVersion) {
    return expoVersion;
  }
  
  // Fallback hardcodé (sera mis à jour lors du bump)
  return '1.0.2';
}

/**
 * Récupérer la version formatée pour affichage
 */
export function getFormattedAppVersion(): string {
  return `v${getAppVersion()}`;
}
