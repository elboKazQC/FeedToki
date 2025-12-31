/**
 * Wrapper unifié pour toutes les méthodes de décodage de codes-barres
 * Sélection automatique de la meilleure méthode selon l'appareil/navigateur
 * 
 * Stratégie:
 * - iOS Safari: Cloud Vision API uniquement (rapide, fiable)
 * - Autres navigateurs: Cloud Vision API → QuaggaJS → ZXing (fallback)
 * - Tous: OpenAI Vision en dernier recours (dans le composant parent)
 */

import { decodeBarcodeFromDataUrl, isIOSSafari } from './barcode-decode-web';
import { extractBarcodeWithOpenAI } from './openai-parser';
import { logger } from './logger';
import { trackEvent } from './analytics';

export type DecoderMethod = 'cloud_vision' | 'quaggajs' | 'zxing' | 'openai_vision' | 'none';

export interface DecodeResult {
  barcode: string | null;
  method: DecoderMethod;
  duration: number;
  attempts: number;
}

export interface DecoderConfig {
  /**
   * Forcer l'utilisation d'une méthode spécifique (pour tests)
   */
  forceMethod?: DecoderMethod;
  
  /**
   * Désactiver certaines méthodes (pour tests ou optimisation)
   */
  disabledMethods?: DecoderMethod[];
  
  /**
   * Timeout maximum en millisecondes
   */
  timeout?: number;
  
  /**
   * User ID pour logging (optionnel)
   */
  userId?: string;
  
  /**
   * Email vérifié pour OpenAI Vision (optionnel)
   */
  emailVerified?: boolean;
}

/**
 * Décode un code-barres depuis une data URL avec sélection automatique de la méthode
 * 
 * @param dataUrl - Image en format data:image/...;base64,...
 * @param config - Configuration du décodage
 * @returns Résultat du décodage avec méthode utilisée
 */
export async function decodeBarcodeUnified(
  dataUrl: string,
  config: DecoderConfig = {}
): Promise<DecodeResult> {
  const startTime = Date.now();
  const {
    forceMethod,
    disabledMethods = [],
    timeout = 20000,
    userId,
    emailVerified = false
  } = config;
  
  const isIOS = isIOSSafari();
  
  // Déterminer la stratégie de décodage selon l'appareil
  let strategy: DecoderMethod[];
  
  if (forceMethod && !disabledMethods.includes(forceMethod)) {
    // Mode forcé (pour tests)
    strategy = [forceMethod];
  } else if (isIOS) {
    // iOS: Cloud Vision uniquement (QuaggaJS/ZXing trop lourds)
    strategy = ['cloud_vision'];
    logger.info('[BarcodeDecoder] Mode iOS détecté - Utilisation Cloud Vision uniquement');
  } else {
    // Autres navigateurs: Toutes les méthodes (Cloud Vision → QuaggaJS → ZXing)
    strategy = ['cloud_vision', 'quaggajs', 'zxing'].filter(
      m => !disabledMethods.includes(m as DecoderMethod)
    ) as DecoderMethod[];
    logger.info('[BarcodeDecoder] Mode non-iOS - Utilisation de toutes les méthodes', { strategy });
  }
  
  // Essayer chaque méthode dans l'ordre
  for (let attempt = 0; attempt < strategy.length; attempt++) {
    const method = strategy[attempt];
    const elapsed = Date.now() - startTime;
    
    if (elapsed > timeout - 2000) {
      logger.warn('[BarcodeDecoder] Timeout approchant, arrêt des tentatives', { elapsed, timeout });
      break;
    }
    
    // Skip si méthode désactivée
    if (disabledMethods.includes(method)) {
      logger.debug('[BarcodeDecoder] Méthode désactivée, skip', { method });
      continue;
    }
    
    try {
      logger.info(`[BarcodeDecoder] Tentative ${attempt + 1}/${strategy.length} avec méthode: ${method}`);
      
      let result: string | null = null;
      
      if (method === 'cloud_vision' || method === 'quaggajs' || method === 'zxing') {
        // Utiliser decodeBarcodeFromDataUrl qui gère déjà la sélection interne
        // Note: Sur iOS, cette fonction utilisera uniquement Cloud Vision (QuaggaJS/ZXing désactivés)
        // Sur non-iOS, elle essaiera Cloud Vision → QuaggaJS → ZXing dans l'ordre
        result = await decodeBarcodeFromDataUrl(dataUrl);
        
        // Si résultat trouvé, déterminer quelle méthode a réussi
        if (result) {
          const duration = Date.now() - startTime;
          
          // Sur iOS, on sait que c'est Cloud Vision car QuaggaJS/ZXing sont désactivés
          // Sur non-iOS, on assume que c'est la méthode demandée (même si decodeBarcodeFromDataUrl
          // peut avoir utilisé une autre méthode en interne, on respecte la stratégie)
          const actualMethod = isIOS ? 'cloud_vision' : method;
          
          trackEvent('barcode_scan_success', {
            method: actualMethod,
            platform: isIOS ? 'ios' : 'other',
            duration_ms: duration,
            attempts: attempt + 1
          });
          
          return {
            barcode: result,
            method: actualMethod,
            duration,
            attempts: attempt + 1
          };
        }
      } else if (method === 'openai_vision') {
        // OpenAI Vision nécessite userId et emailVerified
        if (!userId || !emailVerified) {
          logger.warn('[BarcodeDecoder] OpenAI Vision nécessite userId et emailVerified, skip');
          continue;
        }
        
        result = await extractBarcodeWithOpenAI(dataUrl, userId, emailVerified);
        
        if (result) {
          const duration = Date.now() - startTime;
          trackEvent('barcode_scan_success', {
            method: 'openai_vision',
            platform: isIOS ? 'ios' : 'other',
            duration_ms: duration,
            attempts: attempt + 1
          });
          return {
            barcode: result,
            method: 'openai_vision',
            duration,
            attempts: attempt + 1
          };
        }
      }
      
      // Si cette méthode a échoué, continuer avec la suivante
      logger.debug(`[BarcodeDecoder] Méthode ${method} n'a pas trouvé de code-barres, tentative suivante...`);
      
    } catch (error: any) {
      logger.error(`[BarcodeDecoder] Erreur avec méthode ${method}`, {
        error: error?.message || String(error),
        stack: error?.stack
      });
      // Continuer avec la méthode suivante
      continue;
    }
  }
  
  // Toutes les méthodes ont échoué
  const duration = Date.now() - startTime;
  logger.warn('[BarcodeDecoder] Toutes les méthodes ont échoué', {
    strategy,
    duration,
    platform: isIOS ? 'ios' : 'other'
  });
  
  trackEvent('barcode_scan_failure', {
    methods_tried: strategy.join(','),
    duration_ms: duration,
    platform: isIOS ? 'ios' : 'other',
    total_attempts: strategy.length
  });
  
  return {
    barcode: null,
    method: 'none',
    duration,
    attempts: strategy.length
  };
}

/**
 * Obtient la meilleure stratégie de décodage pour l'appareil actuel
 * 
 * @returns Liste des méthodes recommandées dans l'ordre de priorité
 */
export function getRecommendedStrategy(): DecoderMethod[] {
  const isIOS = isIOSSafari();
  
  if (isIOS) {
    return ['cloud_vision'];
  } else {
    return ['cloud_vision', 'quaggajs', 'zxing'];
  }
}

/**
 * Vérifie si une méthode est disponible sur l'appareil actuel
 * 
 * @param method - Méthode à vérifier
 * @returns true si la méthode est disponible
 */
export function isMethodAvailable(method: DecoderMethod): boolean {
  const isIOS = isIOSSafari();
  
  switch (method) {
    case 'cloud_vision':
      return true; // Toujours disponible (via Firebase Functions)
    case 'quaggajs':
    case 'zxing':
      return !isIOS; // Désactivé sur iOS
    case 'openai_vision':
      return true; // Disponible si userId et emailVerified fournis
    case 'none':
      return false;
    default:
      return false;
  }
}
