/**
 * Décodage de codes-barres sur le web (fallback pour iPhone Safari)
 * Utilise Google Cloud Vision API (principal), puis QuaggaJS, puis ZXing (fallback)
 * 
 * Améliorations v1.1.0:
 * - Google Cloud Vision API comme méthode principale (taux de détection > 95%)
 * - QuaggaJS en fallback si API cloud échoue
 * - ZXing en dernier recours
 */

// @ts-ignore - QuaggaJS n'a pas de types officiels
import Quagga from 'quagga';
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from '@zxing/library';
import { getFunctions, httpsCallable } from 'firebase/functions';
import EXIF from 'exifreader';
import { app } from './firebase-config';
import { logger } from './logger';
import { trackEvent } from './analytics';

// Configuration des formats supportés (alimentaire uniquement)
const SUPPORTED_FORMATS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
];

// Configuration QuaggaJS pour EAN/UPC
// Optimisée pour iOS (numOfWorkers: 0 car webworkers instables sur iOS Safari)
function getQuaggaConfig() {
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
  
  return {
    inputStream: {
      size: 800, // Taille optimale pour performance
    },
    locator: {
      patchSize: 'medium' as const, // Medium pour meilleur équilibre performance/détection
      halfSample: false,
    },
    decoder: {
      readers: ['ean_reader', 'ean_8_reader', 'upc_reader', 'upc_e_reader'],
    },
    locate: true,
    // Désactiver webworkers sur iOS (instables)
    numOfWorkers: isIOS ? 0 : 2,
  };
}

/**
 * Normalise un code-barres pour comparaison et stockage
 * Enlève les espaces et les zéros de tête superflus pour les codes EAN-13/UPC-A
 * 
 * @param barcode - Code-barres à normaliser (peut contenir des espaces)
 * @returns Code-barres normalisé (sans espaces, zéros de tête enlevés si nécessaire)
 */
function normalizeBarcode(barcode: string | null): string | null {
  if (!barcode) return null;
  
  // Enlever espaces
  let normalized = barcode.replace(/\s/g, '');
  
  // Enlever les zéros de tête pour les codes EAN-13/UPC-A
  // Si le code a 14 chiffres et commence par 0, enlever le zéro (→ 13 chiffres)
  if (normalized.length === 14 && normalized.startsWith('0')) {
    normalized = normalized.substring(1);
  }
  // Si le code a 13 chiffres et commence par 0, enlever le zéro (→ 12 chiffres)
  if (normalized.length === 13 && normalized.startsWith('0')) {
    normalized = normalized.substring(1);
  }
  
  return normalized;
}

/**
 * Décode un code-barres depuis une data URL (base64)
 * Ordre de priorité: Google Cloud Vision API → QuaggaJS → ZXing
 * Avec tentatives multiples: crops, rotations, preprocessing
 * 
 * @param dataUrl - Image en format data:image/...;base64,...
 * @returns Le code-barres détecté, ou null si aucun n'est trouvé
 */
export async function decodeBarcodeFromDataUrl(dataUrl: string): Promise<string | null> {
  const startTime = Date.now();
  const TIMEOUT_MS = 20000; // 20 secondes maximum (augmenté pour laisser le temps à l'API de répondre)
  
  // Log initial avec détection iOS
  const isIOS = isIOSSafari();
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';
  console.log('[barcode-decode-web] 🚀 DÉMARRAGE DÉCODAGE', {
    isIOS,
    userAgent,
    platform: typeof navigator !== 'undefined' ? navigator.platform : 'unknown'
  });
  logger.info('[barcode-decode-web] 🚀 DÉMARRAGE DÉCODAGE', {
    isIOS,
    userAgent,
    platform: typeof navigator !== 'undefined' ? navigator.platform : 'unknown'
  });
  
  const logWithTime = (message: string, data?: any) => {
    const elapsed = Date.now() - startTime;
    logger.info(`[barcode-decode-web] [${elapsed}ms] ${message}`, data || {});
    // Logs critiques aussi dans console pour diagnostic
    if (message.includes('iOS') || message.includes('Mode') || message.includes('Cloud API')) {
      console.log(`[barcode-decode-web] [${elapsed}ms] ${message}`, data || {});
    }
  };
  
  // Fonction de décodage principale
  const decodePromise = (async () => {
    try {
      logWithTime('════════════════════════════════════');
      logWithTime('Démarrage du décodage avec stratégies multiples');
      
      // Normaliser l'orientation EXIF AVANT de charger l'image
      logWithTime('Étape 1/5: Début normalisation orientation EXIF...');
      const exifStartTime = Date.now();
      const normalizedDataUrl = await normalizeImageOrientation(dataUrl);
      logWithTime('Étape 1/5: Normalisation EXIF terminée', { 
        duration: Date.now() - exifStartTime 
      });
      
      // Charger l'image une fois (maintenant avec orientation correcte)
      logWithTime('Étape 2/5: Début chargement de l\'image...');
      const loadStartTime = Date.now();
      const img = await loadImage(normalizedDataUrl);
      logWithTime('Étape 2/5: Image chargée', { 
        width: img.width, 
        height: img.height,
        duration: Date.now() - loadStartTime
      });
      
      // Stratégies de décodage: différentes zones de l'image
      // Crop ultra agressif EN PREMIER pour Quagga/ZXing (ils aiment les codes-barres qui occupent beaucoup de place)
      const cropStrategies = [
        { name: 'ultra_aggressive', x: 0, y: 0.35, w: 1.0, h: 0.3 }, // Zone centrale ultra serrée (35% haut, 30% hauteur) - TESTÉ EN PREMIER
        { name: 'full', x: 0, y: 0, w: 1.0, h: 1.0 }, // Image complète
        { name: 'center_horizontal', x: 0, y: 0.3, w: 1.0, h: 0.4 }, // Bande horizontale centrale (30% haut, 40% hauteur)
        { name: 'center_wide', x: 0, y: 0.25, w: 1.0, h: 0.5 }, // Bande plus large (25% haut, 50% hauteur)
        { name: 'upper_third', x: 0, y: 0, w: 1.0, h: 0.33 }, // Tiers supérieur
        { name: 'middle_third', x: 0, y: 0.33, w: 1.0, h: 0.33 }, // Tiers central
      ];
      
      // Détecter si on est sur iOS Safari (déjà détecté au début, mais on vérifie à nouveau)
      const isIOSDetected = isIOSSafari();
      const userAgentInfo = typeof navigator !== 'undefined' ? {
        userAgent: navigator.userAgent,
        platform: navigator.platform
      } : {};
      
      console.log('[barcode-decode-web] 🔍 VÉRIFICATION iOS', {
        isIOSDetected,
        isIOSFromStart: isIOS,
        ...userAgentInfo
      });
      
      if (isIOSDetected) {
        // OPTIMISATION iOS: Utiliser uniquement Cloud Vision API (plus rapide et fiable)
        // QuaggaJS et ZXing sont trop lourds et causent des timeouts sur iOS Safari
        logWithTime('Étape 3/5: ✅ Mode iOS détecté - Utilisation uniquement Cloud Vision API (QuaggaJS/ZXing désactivés)', {
          userAgent: userAgentInfo.userAgent,
          platform: userAgentInfo.platform
        });
        console.log('[barcode-decode-web] ✅ MODE iOS ACTIVÉ - QuaggaJS/ZXing désactivés');
        
        // Stratégies de crop simplifiées pour iOS (moins de tentatives = plus rapide)
        const iosCropStrategies = [
          { name: 'full', x: 0, y: 0, w: 1.0, h: 1.0 }, // Image complète d'abord
          { name: 'center_horizontal', x: 0, y: 0.3, w: 1.0, h: 0.4 }, // Bande centrale
          { name: 'ultra_aggressive', x: 0, y: 0.35, w: 1.0, h: 0.3 }, // Zone ultra serrée
        ];
        
        for (const cropStrategy of iosCropStrategies) {
          const elapsed = Date.now() - startTime;
          if (elapsed > TIMEOUT_MS - 2000) {
            logWithTime(`Timeout approchant (${elapsed}ms), arrêt des tentatives iOS`);
            break;
          }
          
          logWithTime(`[iOS] Essai avec crop: ${cropStrategy.name}`);
          
          // Créer une image cropée
          const cropStartTime = Date.now();
          const croppedDataUrl = await createCroppedImage(img, cropStrategy);
          logWithTime(`[iOS] Crop créé: ${cropStrategy.name}`, { 
            duration: Date.now() - cropStartTime 
          });
          
          // Essayer uniquement Cloud Vision API
          logWithTime(`[iOS] [CROP ${cropStrategy.name}] Cloud Vision API...`);
          console.log(`[barcode-decode-web] [iOS] 🔵 Appel Cloud Vision API pour crop: ${cropStrategy.name}`);
          const cloudStartTime = Date.now();
          const cloudResult = await decodeBarcodeWithCloudAPI(croppedDataUrl);
          const cloudDuration = Date.now() - cloudStartTime;
          logWithTime(`[iOS] [CROP ${cropStrategy.name}] Cloud API terminé`, { 
            success: !!cloudResult,
            duration: cloudDuration,
            barcode: cloudResult || null
          });
          console.log(`[barcode-decode-web] [iOS] 🔵 Cloud API résultat:`, {
            success: !!cloudResult,
            barcode: cloudResult || null,
            duration: cloudDuration,
            crop: cropStrategy.name
          });
          
          if (cloudResult) {
            const totalDuration = Date.now() - startTime;
            const normalized = normalizeBarcode(cloudResult);
            logWithTime('✅ [iOS] Code-barres détecté avec Cloud API', { 
              barcode: cloudResult,
              normalized,
              crop: cropStrategy.name,
              totalDuration
            });
            // Métriques de succès
            trackEvent('barcode_scan_success', {
              method: 'cloud_vision',
              platform: 'ios',
              crop_strategy: cropStrategy.name,
              duration_ms: totalDuration,
              attempts: iosCropStrategies.indexOf(cropStrategy) + 1
            });
            return normalized;
          }
        }
        
        // Si Cloud Vision API a échoué sur iOS, retourner null (OpenAI Vision sera essayé dans le composant parent)
        logWithTime('❌ [iOS] Cloud Vision API n\'a pas détecté de code-barres (OpenAI Vision sera essayé dans le composant parent)');
        return null;
      } else {
        // MODE NON-IOS: Utiliser toutes les méthodes (Cloud Vision + QuaggaJS + ZXing)
        logWithTime('Étape 3/5: Mode non-iOS - Utilisation de toutes les méthodes (Cloud Vision + QuaggaJS + ZXing)', {
          userAgent: userAgentInfo.userAgent,
          platform: userAgentInfo.platform
        });
        console.log('[barcode-decode-web] 🌐 MODE NON-IOS - Toutes les méthodes activées');
        
        // Pour chaque stratégie de crop, essayer toutes les méthodes
        for (const cropStrategy of cropStrategies) {
        const elapsed = Date.now() - startTime;
        if (elapsed > TIMEOUT_MS - 1000) {
          logWithTime(`Timeout approchant (${elapsed}ms), arrêt des tentatives`);
          break;
        }
        
        logWithTime(`Début essai avec crop: ${cropStrategy.name}`);
        
        // Créer une image cropée pour cette stratégie
        const cropStartTime = Date.now();
        const croppedDataUrl = await createCroppedImage(img, cropStrategy);
        logWithTime(`Crop créé: ${cropStrategy.name}`, { 
          duration: Date.now() - cropStartTime 
        });
        
        // Étape 1: Essayer Google Cloud Vision API avec ce crop
        logWithTime(`[CROP ${cropStrategy.name}] Étape 1/3: Cloud API...`);
        const cloudStartTime = Date.now();
        const cloudResult = await decodeBarcodeWithCloudAPI(croppedDataUrl);
        const cloudDuration = Date.now() - cloudStartTime;
        logWithTime(`[CROP ${cropStrategy.name}] Cloud API terminé`, { 
          success: !!cloudResult,
          duration: cloudDuration,
          barcode: cloudResult || null
        });
        if (cloudResult) {
          const totalDuration = Date.now() - startTime;
          const normalized = normalizeBarcode(cloudResult);
          logWithTime('✅ Code-barres détecté avec Cloud API', { 
            barcode: cloudResult,
            normalized,
            crop: cropStrategy.name,
            totalDuration
          });
          // Métriques de succès
          trackEvent('barcode_scan_success', {
            method: 'cloud_vision',
            crop_strategy: cropStrategy.name,
            duration_ms: totalDuration,
            attempts: cropStrategies.indexOf(cropStrategy) + 1
          });
          return normalized;
        }
        
        // Étape 2: Essayer QuaggaJS avec ce crop (crop ultra agressif testé en premier)
        // Upscale x2 pour améliorer la détection
        logWithTime(`[CROP ${cropStrategy.name}] Étape 2/3: QuaggaJS (upscale + decode)...`);
        const upscaleQuaggaStartTime = Date.now();
        const upscaledForQuagga = await upscaleImage(croppedDataUrl);
        logWithTime(`[CROP ${cropStrategy.name}] Upscale QuaggaJS terminé`, { 
          duration: Date.now() - upscaleQuaggaStartTime 
        });
        const quaggaStartTime = Date.now();
        const quaggaResult = await decodeBarcodeWithQuagga(upscaledForQuagga);
        const quaggaDuration = Date.now() - quaggaStartTime;
        logWithTime(`[CROP ${cropStrategy.name}] QuaggaJS terminé`, { 
          success: !!quaggaResult,
          duration: quaggaDuration,
          barcode: quaggaResult || null
        });
        if (quaggaResult) {
          const totalDuration = Date.now() - startTime;
          const normalized = normalizeBarcode(quaggaResult);
          logWithTime('✅ Code-barres détecté avec QuaggaJS', { 
            barcode: quaggaResult,
            normalized,
            crop: cropStrategy.name,
            totalDuration
          });
          // Métriques de succès
          trackEvent('barcode_scan_success', {
            method: 'quaggajs',
            crop_strategy: cropStrategy.name,
            duration_ms: totalDuration,
            attempts: cropStrategies.indexOf(cropStrategy) + 1
          });
          return normalized;
        }
        
        // Étape 3: Essayer ZXing avec ce crop (crop ultra agressif testé en premier)
        // Upscale x2 pour améliorer la détection
        logWithTime(`[CROP ${cropStrategy.name}] Étape 3/3: ZXing (upscale + decode)...`);
        const upscaleZXingStartTime = Date.now();
        const upscaledForZXing = await upscaleImage(croppedDataUrl);
        logWithTime(`[CROP ${cropStrategy.name}] Upscale ZXing terminé`, { 
          duration: Date.now() - upscaleZXingStartTime 
        });
        const zxingStartTime = Date.now();
        const zxingResult = await decodeBarcodeWithZXing(upscaledForZXing);
        const zxingDuration = Date.now() - zxingStartTime;
        logWithTime(`[CROP ${cropStrategy.name}] ZXing terminé`, { 
          success: !!zxingResult,
          duration: zxingDuration,
          barcode: zxingResult || null
        });
        if (zxingResult) {
          const totalDuration = Date.now() - startTime;
          const normalized = normalizeBarcode(zxingResult);
          logWithTime('✅ Code-barres détecté avec ZXing', { 
            barcode: zxingResult,
            normalized,
            crop: cropStrategy.name,
            totalDuration
          });
          // Métriques de succès
          trackEvent('barcode_scan_success', {
            method: 'zxing',
            crop_strategy: cropStrategy.name,
            duration_ms: totalDuration,
            attempts: cropStrategies.indexOf(cropStrategy) + 1
          });
          return normalized;
        }
        logWithTime(`Crop ${cropStrategy.name} terminé sans résultat`);
        }
        
        // Si aucun crop n'a fonctionné, essayer avec rotations (uniquement pour non-iOS)
        logWithTime('Étape 4/5: Aucun crop n\'a fonctionné, début essai avec rotations...');
        const rotations = [90, 180, 270];
      
      for (const rotation of rotations) {
        const elapsed = Date.now() - startTime;
        if (elapsed > TIMEOUT_MS - 2000) {
          logWithTime(`Timeout approchant (${elapsed}ms), arrêt des rotations`);
          break;
        }
        
        logWithTime(`Début essai avec rotation: ${rotation}°`);
        const rotateStartTime = Date.now();
        const rotatedDataUrl = await createRotatedImage(img, rotation);
        logWithTime(`Rotation ${rotation}° créée`, { 
          duration: Date.now() - rotateStartTime 
        });
        
        // Essayer Cloud API avec rotation
        logWithTime(`Avant appel Cloud API (rotation: ${rotation}°)`);
        const cloudRotStartTime = Date.now();
        const cloudResult = await decodeBarcodeWithCloudAPI(rotatedDataUrl);
        const cloudRotDuration = Date.now() - cloudRotStartTime;
        logWithTime(`Après appel Cloud API (rotation: ${rotation}°)`, { 
          success: !!cloudResult,
          duration: cloudRotDuration
        });
        if (cloudResult) {
          const totalDuration = Date.now() - startTime;
          const normalized = normalizeBarcode(cloudResult);
          logWithTime('✅ Code-barres détecté avec Cloud API (rotation)', { 
            barcode: cloudResult,
            normalized,
            rotation,
            totalDuration
          });
          // Métriques de succès
          trackEvent('barcode_scan_success', {
            method: 'cloud_vision',
            rotation_degrees: rotation,
            duration_ms: totalDuration,
            attempts: cropStrategies.length + rotations.indexOf(rotation) + 1
          });
          return normalized;
        }
        
        // Essayer QuaggaJS avec rotation
        logWithTime(`Avant appel QuaggaJS (rotation: ${rotation}°)`);
        const quaggaRotStartTime = Date.now();
        const quaggaResult = await decodeBarcodeWithQuagga(rotatedDataUrl);
        const quaggaRotDuration = Date.now() - quaggaRotStartTime;
        logWithTime(`Après appel QuaggaJS (rotation: ${rotation}°)`, { 
          success: !!quaggaResult,
          duration: quaggaRotDuration
        });
        if (quaggaResult) {
          const totalDuration = Date.now() - startTime;
          const normalized = normalizeBarcode(quaggaResult);
          logWithTime('✅ Code-barres détecté avec QuaggaJS (rotation)', { 
            barcode: quaggaResult,
            normalized,
            rotation,
            totalDuration
          });
          // Métriques de succès
          trackEvent('barcode_scan_success', {
            method: 'quaggajs',
            rotation_degrees: rotation,
            duration_ms: totalDuration,
            attempts: cropStrategies.length + rotations.indexOf(rotation) + 1
          });
          return normalized;
        }
        logWithTime(`Rotation ${rotation}° terminée sans résultat`);
        }
      }
      
      const totalDuration = Date.now() - startTime;
      logWithTime('Étape 5/5: ❌ Aucun code-barres détecté après toutes les stratégies', {
        totalDuration
      });
      // Métriques d'échec
      const totalAttempts = isIOS 
        ? 3 // iOS: seulement 3 crops
        : cropStrategies.length + (isIOS ? 0 : 3); // Non-iOS: crops + rotations
      trackEvent('barcode_scan_failure', {
        total_attempts: totalAttempts,
        duration_ms: totalDuration,
        methods_tried: isIOS ? 'cloud_vision' : 'cloud_vision,quaggajs,zxing',
        platform: isIOS ? 'ios' : 'other'
      });
      return null;

    } catch (error: any) {
      const totalDuration = Date.now() - startTime;
      logWithTime('❌ Erreur fatale lors du décodage', { 
        error: error?.message || String(error),
        stack: error?.stack,
        totalDuration
      });
      return null;
    }
  })();
  
  // Timeout de sécurité avec heartbeat pour diagnostiquer les blocages
  // Note: Le heartbeat ne peut pas envoyer à Firebase car on n'a pas accès à userId ici
  // Les logs seront visibles dans la console et dans les logs du composant parent
  let lastHeartbeat = Date.now();
  const heartbeatInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const timeSinceLastHeartbeat = Date.now() - lastHeartbeat;
    logWithTime(`💓 Heartbeat (${elapsed}ms écoulés, ${timeSinceLastHeartbeat}ms depuis dernier heartbeat)`);
    // Forcer l'affichage dans la console pour diagnostic
    console.log(`[barcode-decode-web] [${elapsed}ms] 💓 Heartbeat (${timeSinceLastHeartbeat}ms depuis dernier)`);
    lastHeartbeat = Date.now();
  }, 2000); // Heartbeat toutes les 2 secondes
  
  const timeoutPromise = new Promise<string | null>((resolve) => {
    setTimeout(() => {
      clearInterval(heartbeatInterval);
      const elapsed = Date.now() - startTime;
      logWithTime(`⏱️ Timeout global de ${TIMEOUT_MS}ms atteint, arrêt du décodage`, {
        elapsed
      });
      resolve(null);
    }, TIMEOUT_MS);
  });
  
  // Race entre le décodage et le timeout
  logWithTime('Début Promise.race entre décodage et timeout');
  try {
    const result = await Promise.race([decodePromise, timeoutPromise]);
    clearInterval(heartbeatInterval);
    logWithTime('Promise.race terminé', { 
      result: result ? 'succès' : 'échec',
      totalDuration: Date.now() - startTime
    });
    return result;
  } catch (error: any) {
    clearInterval(heartbeatInterval);
    const totalDuration = Date.now() - startTime;
    logWithTime('❌ Erreur dans Promise.race', {
      error: error?.message || String(error),
      stack: error?.stack,
      totalDuration
    });
    return null;
  }
}

/**
 * Crée une image cropée selon une stratégie
 */
async function createCroppedImage(
  img: HTMLImageElement,
  strategy: { name: string; x: number; y: number; w: number; h: number }
): Promise<string> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Impossible de créer le contexte canvas');
  }
  
  const cropX = Math.floor(img.width * strategy.x);
  const cropY = Math.floor(img.height * strategy.y);
  const cropW = Math.floor(img.width * strategy.w);
  const cropH = Math.floor(img.height * strategy.h);
  
  canvas.width = cropW;
  canvas.height = cropH;
  
  ctx.drawImage(
    img,
    cropX, cropY, cropW, cropH,
    0, 0, cropW, cropH
  );
  
  return canvas.toDataURL('image/jpeg', 0.95);
}

/**
 * Crée une image tournée
 */
async function createRotatedImage(img: HTMLImageElement, degrees: number): Promise<string> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Impossible de créer le contexte canvas');
  }
  
  // Calculer les dimensions après rotation
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const newWidth = Math.floor(img.width * cos + img.height * sin);
  const newHeight = Math.floor(img.width * sin + img.height * cos);
  
  canvas.width = newWidth;
  canvas.height = newHeight;
  
  // Centrer et tourner
  ctx.translate(newWidth / 2, newHeight / 2);
  ctx.rotate(rad);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  
  return canvas.toDataURL('image/jpeg', 0.95);
}

/**
 * Décode un code-barres avec Google Cloud Vision API via Firebase Functions
 * C'est la méthode la plus fiable (> 95% de taux de détection)
 */
async function decodeBarcodeWithCloudAPI(dataUrl: string): Promise<string | null> {
  const startTime = Date.now();
  const logWithTime = (message: string, data?: any) => {
    const elapsed = Date.now() - startTime;
    logger.info(`[barcode-decode-web] [CloudAPI ${elapsed}ms] ${message}`, data || {});
  };
  
  try {
    logWithTime('Début decodeBarcodeWithCloudAPI');
    
    // Vérifier que Firebase est initialisé
    if (!app) {
      logWithTime('❌ Firebase non initialisé, skip Cloud API');
      return null;
    }
    
    logWithTime('Firebase initialisé, début connexion à Functions...');
    const functionsStartTime = Date.now();
    
    let functions: ReturnType<typeof getFunctions>;
    let decodeBarcodeCloud: ReturnType<typeof httpsCallable>;
    
    try {
      functions = getFunctions(app);
      decodeBarcodeCloud = httpsCallable(functions, 'decodeBarcodeCloud');
      logWithTime('✅ Function decodeBarcodeCloud chargée avec succès', {
        duration: Date.now() - functionsStartTime
      });
    } catch (functionsError: any) {
      logWithTime('❌ Erreur chargement Firebase Functions', {
        error: functionsError?.message || String(functionsError),
        code: functionsError?.code,
        duration: Date.now() - functionsStartTime
      });
      logWithTime('⚠️ Cloud API non disponible, utilisation des fallbacks locaux uniquement');
      return null;
    }
    
    // Extraire le base64 de la data URL
    logWithTime('Début extraction base64 de la data URL');
    let base64Data = dataUrl.replace(/^data:image\/[a-z]+;base64,/, '');
    const originalSize = base64Data.length;
    const sizeKB = Math.round(originalSize / 1024);
    const sizeMB = (sizeKB / 1024).toFixed(2);
    
    logWithTime('Image préparée, taille base64 calculée', {
      originalSize,
      sizeKB,
      sizeMB
    });
    
    // Réduire la taille si payload trop gros (> 2MB)
    // Firebase Functions a une limite de ~10MB mais on réduit pour éviter timeout
    const MAX_PAYLOAD_SIZE = 2 * 1024 * 1024; // 2MB
    if (originalSize > MAX_PAYLOAD_SIZE) {
      logWithTime('⚠️ Payload trop gros, début réduction de la résolution...', {
        originalSizeMB: sizeMB
      });
      const reduceStartTime = Date.now();
      
      // Charger l'image et réduire la résolution
      const img = await loadImage(dataUrl);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Impossible de créer le contexte canvas');
      }
      
      // Réduire à 50% de la taille originale
      canvas.width = Math.floor(img.width * 0.5);
      canvas.height = Math.floor(img.height * 0.5);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      base64Data = canvas.toDataURL('image/jpeg', 0.8).replace(/^data:image\/[a-z]+;base64,/, '');
      const newSizeKB = Math.round(base64Data.length / 1024);
      logWithTime('✅ Image réduite', {
        newSizeKB,
        duration: Date.now() - reduceStartTime
      });
    }
    
    // Appeler la Firebase Function avec timeout (20 secondes pour laisser le temps à l'API)
    const apiStartTime = Date.now();
    logWithTime('Avant création timeout promise (20s)');
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => {
        const elapsed = Date.now() - startTime;
        logWithTime('⏱️ Timeout Cloud API (20s) atteint', { elapsed });
        resolve(null);
      }, 20000); // 20 secondes pour laisser le temps à l'API de répondre
    });
    
    logWithTime('Avant appel decodeBarcodeCloud');
    const apiPromise = decodeBarcodeCloud({ imageBase64: base64Data })
      .then((result: any) => {
        const apiDuration = Date.now() - apiStartTime;
        const totalDuration = Date.now() - startTime;
        logWithTime('Réponse Cloud API reçue', {
          apiDuration,
          totalDuration,
          hasData: !!result?.data
        });
        
        if (result.data?.success && result.data?.barcode) {
          const normalized = normalizeBarcode(result.data.barcode);
          logWithTime('✅ Cloud API: Code-barres détecté', {
            barcode: result.data.barcode,
            normalized,
            totalDuration
          });
          return normalized;
        }
        
        logWithTime('Cloud API: Aucun code-barres dans la réponse', {
          totalDuration
        });
        return null;
      })
      .catch((error: any) => {
        const totalDuration = Date.now() - startTime;
        const errorDetails = {
          code: error.code,
          message: error.message,
          details: error.details,
          status: error.status || 'unknown',
        };
        
        logWithTime('❌ Cloud API erreur', {
          ...errorDetails,
          stack: error?.stack,
          totalDuration
        });
        
        // Gérer les erreurs spécifiques avec logs détaillés
        if (error.code === 'functions/permission-denied' || error.code === 'permission-denied') {
          logWithTime('❌ PERMISSION_DENIED - Vision API non activée ou permissions manquantes');
        } else if (error.code === 'functions/invalid-argument' || error.code === 'invalid-argument') {
          logWithTime('❌ INVALID_ARGUMENT - Format d\'image invalide', { sizeKB });
        } else if (error.code === 'functions/unavailable' || error.code === 'unavailable') {
          logWithTime('❌ UNAVAILABLE - Function non déployée ou plan Blaze non activé');
        } else if (error.code === 'functions/deadline-exceeded' || error.code === 'deadline-exceeded') {
          logWithTime('❌ DEADLINE_EXCEEDED - Timeout (payload trop gros ou réseau lent)', { sizeKB });
        } else if (error.status === 401 || error.status === 403) {
          logWithTime(`❌ AUTH_ERROR (${error.status}) - Problème d'authentification`);
        }
        
        return null;
      });
    
    logWithTime('Avant Promise.race entre API et timeout');
    const raceStartTime = Date.now();
    const result = await Promise.race([apiPromise, timeoutPromise]);
    const raceDuration = Date.now() - raceStartTime;
    logWithTime('Promise.race terminé', {
      result: result ? 'succès' : 'échec',
      raceDuration,
      totalDuration: Date.now() - startTime
    });
    
    return result;
  } catch (error: any) {
    const totalDuration = Date.now() - startTime;
    logWithTime('❌ Erreur fatale Cloud API (fallback vers local)', { 
      error: error?.message || String(error),
      stack: error?.stack,
      totalDuration
    });
    return null;
  }
}

/**
 * Décode un code-barres avec QuaggaJS (méthode principale)
 * QuaggaJS est spécialement optimisé pour EAN/UPC sur web mobile
 */
async function decodeBarcodeWithQuagga(dataUrl: string): Promise<string | null> {
  const startTime = Date.now();
  const logWithTime = (message: string, data?: any) => {
    const elapsed = Date.now() - startTime;
    logger.info(`[barcode-decode-web] [QuaggaJS ${elapsed}ms] ${message}`, data || {});
  };
  
  try {
    logWithTime('Début decodeBarcodeWithQuagga');
    
    // Charger l'image
    logWithTime('Début chargement de l\'image');
    const loadStartTime = Date.now();
    const img = await loadImage(dataUrl);
    logWithTime('Image chargée', {
      width: img.width,
      height: img.height,
      duration: Date.now() - loadStartTime
    });
    
    // Créer un canvas pour QuaggaJS
    logWithTime('Début création canvas');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      logWithTime('❌ Impossible de créer le contexte canvas pour QuaggaJS');
      return null;
    }

    // Downscale si nécessaire (QuaggaJS fonctionne mieux avec images < 1024px)
    const maxWidth = 1024;
    let width = img.width;
    let height = img.height;
    
    if (width > maxWidth) {
      const ratio = maxWidth / width;
      width = maxWidth;
      height = Math.floor(height * ratio);
      logWithTime('Image downscalée', { width, height });
    }

    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(img, 0, 0, width, height);
    logWithTime('Canvas préparé', { width, height });

    // Essayer plusieurs crops (centre 30%, centre 50%, image complète)
    const crops = [
      { name: 'full', x: 0, y: 0, w: width, h: height },
      { name: 'center_30', x: 0, y: Math.floor(height * 0.35), w: width, h: Math.floor(height * 0.3) },
      { name: 'center_50', x: 0, y: Math.floor(height * 0.25), w: width, h: Math.floor(height * 0.5) },
    ];

    logWithTime(`Début essai avec ${crops.length} crops`);
    for (const crop of crops) {
      try {
        logWithTime(`Début crop: ${crop.name}`);
        const cropStartTime = Date.now();
        
        // Créer un canvas pour ce crop
        const cropCanvas = document.createElement('canvas');
        const cropCtx = cropCanvas.getContext('2d');
        if (!cropCtx) {
          logWithTime(`❌ Impossible de créer contexte pour crop ${crop.name}`);
          continue;
        }

        cropCanvas.width = crop.w;
        cropCanvas.height = crop.h;
        cropCtx.drawImage(
          canvas,
          crop.x, crop.y, crop.w, crop.h,
          0, 0, crop.w, crop.h
        );
        logWithTime(`Crop ${crop.name} créé`, {
          width: crop.w,
          height: crop.h,
          duration: Date.now() - cropStartTime
        });

        // Décoder avec QuaggaJS (API callback) avec timeout de 3 secondes
        logWithTime(`Avant appel Quagga.decodeSingle (crop: ${crop.name})`);
        const decodeStartTime = Date.now();
        const quaggaConfig = getQuaggaConfig();
        const quaggaPromise = new Promise<string | null>((resolve) => {
          Quagga.decodeSingle(
            {
              ...quaggaConfig,
              src: cropCanvas.toDataURL(),
            },
            (result: any) => {
              if (result && result.codeResult && result.codeResult.code) {
                const normalized = normalizeBarcode(result.codeResult.code);
                resolve(normalized);
              } else {
                resolve(null);
              }
            }
          );
        });
        
        const quaggaTimeout = new Promise<string | null>((resolve) => {
          setTimeout(() => {
            logWithTime(`Timeout QuaggaJS (3s) pour crop ${crop.name}`);
            resolve(null);
          }, 3000); // 3 secondes max par crop
        });
        
        const result = await Promise.race([quaggaPromise, quaggaTimeout]);
        const decodeDuration = Date.now() - decodeStartTime;
        logWithTime(`Après appel Quagga.decodeSingle (crop: ${crop.name})`, {
          success: !!result,
          duration: decodeDuration
        });

        if (result) {
          const normalized = normalizeBarcode(result);
          logWithTime(`✅ QuaggaJS détecté avec crop: ${crop.name}`, { 
            barcode: result,
            normalized,
            totalDuration: Date.now() - startTime
          });
          return normalized;
        }
        logWithTime(`Crop ${crop.name} terminé sans résultat`);
      } catch (error: any) {
        // Continuer avec le crop suivant
        logWithTime(`❌ QuaggaJS échec avec crop ${crop.name}`, { 
          error: error?.message,
          stack: error?.stack
        });
      }
    }

    logWithTime('Tous les crops terminés sans résultat', {
      totalDuration: Date.now() - startTime
    });
    return null;
  } catch (error: any) {
    const totalDuration = Date.now() - startTime;
    logWithTime('❌ Erreur QuaggaJS', { 
      error: error?.message || String(error),
      stack: error?.stack,
      totalDuration
    });
    return null;
  }
}

/**
 * Décode un code-barres avec ZXing (fallback)
 * Utilise les multi-tentatives et preprocessing de la v1.0.8
 */
async function decodeBarcodeWithZXing(dataUrl: string): Promise<string | null> {
  const startTime = Date.now();
  const logWithTime = (message: string, data?: any) => {
    const elapsed = Date.now() - startTime;
    logger.info(`[barcode-decode-web] [ZXing ${elapsed}ms] ${message}`, data || {});
  };
  
  try {
    logWithTime('Début decodeBarcodeWithZXing');
    
    // Charger l'image originale
    logWithTime('Début chargement de l\'image');
    const loadStartTime = Date.now();
    const img = await loadImage(dataUrl);
    logWithTime('Image chargée pour ZXing', { 
      width: img.width, 
      height: img.height,
      duration: Date.now() - loadStartTime
    });

    // Downscale si nécessaire
    const maxWidth = 1024;
    let width = img.width;
    let height = img.height;
    
    if (width > maxWidth) {
      const ratio = maxWidth / width;
      width = maxWidth;
      height = Math.floor(height * ratio);
      logWithTime('Downscale appliqué pour ZXing', { width, height });
    }

    // Essayer plusieurs stratégies (simplifiées pour fallback)
    const strategies = [
      { name: 'crop_center_30', cropPercent: 0.3, preprocessing: 'standard' as const },
      { name: 'full_image', cropPercent: undefined, preprocessing: 'standard' as const },
      { name: 'crop_center_30_aggressive', cropPercent: 0.3, preprocessing: 'aggressive' as const },
    ];

    logWithTime(`Début essai avec ${strategies.length} stratégies`);
    for (const strategy of strategies) {
      try {
        logWithTime(`Début stratégie: ${strategy.name}`);
        const strategyStartTime = Date.now();
        const result = await tryDecodeWithZXingStrategy(img, width, height, strategy);
        const strategyDuration = Date.now() - strategyStartTime;
        logWithTime(`Après stratégie: ${strategy.name}`, {
          success: !!result,
          duration: strategyDuration
        });
        
        if (result) {
          logWithTime(`✅ ZXing détecté avec stratégie: ${strategy.name}`, { 
            barcode: result,
            totalDuration: Date.now() - startTime
          });
          return result;
        }
      } catch (error: any) {
        if (error?.name === 'NotFoundException') {
          logWithTime(`NotFoundException pour stratégie ${strategy.name} (normal)`);
          continue;
        }
        logWithTime(`❌ ZXing erreur avec stratégie ${strategy.name}`, { 
          error: error?.message,
          stack: error?.stack
        });
      }
    }

    logWithTime('Toutes les stratégies terminées sans résultat', {
      totalDuration: Date.now() - startTime
    });
    return null;
  } catch (error: any) {
    const totalDuration = Date.now() - startTime;
    logWithTime('❌ Erreur ZXing', { 
      error: error?.message || String(error),
      stack: error?.stack,
      totalDuration
    });
    return null;
  }
}

/**
 * Essaie de décoder avec ZXing avec une stratégie spécifique
 */
async function tryDecodeWithZXingStrategy(
  img: HTMLImageElement,
  maxWidth: number,
  maxHeight: number,
  strategy: { name: string; cropPercent?: number; preprocessing: 'standard' | 'aggressive' }
): Promise<string | null> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Impossible de créer le contexte canvas');
  }

  // Calculer les dimensions du crop en préservant le ratio
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = img.width;
  let sourceHeight = img.height;

  // Calculer les dimensions du crop source
  if (strategy.cropPercent !== undefined) {
    sourceHeight = Math.floor(img.height * strategy.cropPercent);
    sourceY = Math.floor((img.height - sourceHeight) / 2);
  }

  // Calculer les dimensions du canvas en préservant le ratio de l'image source
  const sourceRatio = sourceWidth / sourceHeight;
  let canvasWidth = maxWidth;
  let canvasHeight = Math.floor(canvasWidth / sourceRatio);

  // Si la hauteur calculée dépasse maxHeight, ajuster
  if (canvasHeight > maxHeight) {
    canvasHeight = maxHeight;
    canvasWidth = Math.floor(canvasHeight * sourceRatio);
  }

  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  // Désactiver l'alpha pour ZXing (améliore la détection)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Dessiner l'image en préservant le ratio (pas de stretching)
  ctx.drawImage(
    img,
    sourceX, sourceY, sourceWidth, sourceHeight,
    0, 0, canvasWidth, canvasHeight
  );

  // Appliquer le preprocessing
  applyPreprocessing(ctx, canvasWidth, canvasHeight, strategy.preprocessing);

  // Décoder avec ZXing avec timeout de 3 secondes
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, SUPPORTED_FORMATS);
  hints.set(DecodeHintType.TRY_HARDER, true);

  const reader = new BrowserMultiFormatReader(hints);
  
  const zxingPromise = (reader as any).decodeFromCanvas(canvas).then((result: any) => {
    if (result && result.getText()) {
      return normalizeBarcode(result.getText());
    }
    return null;
  }).catch((error: any) => {
    // NotFoundException est normal, les autres erreurs sont loggées
    if (error?.name !== 'NotFoundException') {
      logger.debug(`[barcode-decode-web] Erreur ZXing decodeFromCanvas:`, error?.message);
    }
    return null;
  });
  
  const zxingTimeout = new Promise<string | null>((resolve) => {
    setTimeout(() => {
      logger.debug(`[barcode-decode-web] Timeout ZXing (3s) pour stratégie ${strategy.name}`);
      resolve(null);
    }, 3000); // 3 secondes max par stratégie
  });
  
  const result = await Promise.race([zxingPromise, zxingTimeout]);
  
  if (result) {
    return result;
  }

  return null;
}

/**
 * Applique le preprocessing d'image pour améliorer la détection (ZXing uniquement)
 */
function applyPreprocessing(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  mode: 'standard' | 'aggressive'
): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Conversion en niveaux de gris + amélioration contraste
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    
    let enhanced: number;
    if (mode === 'aggressive') {
      enhanced = Math.max(0, Math.min(255, (gray - 50) * 1.5 + 50));
    } else {
      enhanced = Math.max(0, Math.min(255, (gray - 30) * 1.2 + 30));
    }
    
    data[i] = enhanced;
    data[i + 1] = enhanced;
    data[i + 2] = enhanced;
  }

  if (mode === 'aggressive') {
    applyAdaptiveThreshold(data, width, height);
  }

  applySharpening(data, width, height, mode === 'aggressive' ? 0.5 : 0.3);
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Applique un seuillage adaptatif
 */
function applyAdaptiveThreshold(data: Uint8ClampedArray, width: number, height: number): void {
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum += data[i];
  }
  const threshold = Math.floor(sum / (data.length / 4));

  for (let i = 0; i < data.length; i += 4) {
    const value = data[i];
    const binary = value > threshold ? 255 : 0;
    data[i] = binary;
    data[i + 1] = binary;
    data[i + 2] = binary;
  }
}

/**
 * Upscale une image x2 avec amélioration contraste + sharpen
 * Utile pour améliorer la détection sur images floues
 */
async function upscaleImage(dataUrl: string): Promise<string> {
  try {
    const img = await loadImage(dataUrl);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      throw new Error('Impossible de créer le contexte canvas');
    }

    // Doubler les dimensions
    canvas.width = img.width * 2;
    canvas.height = img.height * 2;

    // Utiliser imageSmoothingEnabled pour un meilleur upscale
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Dessiner l'image upscalée
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Appliquer amélioration contraste + sharpen
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Amélioration contraste
    const contrast = 1.2;
    const intercept = 128 * (1 - contrast);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.max(0, Math.min(255, data[i] * contrast + intercept)); // R
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] * contrast + intercept)); // G
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] * contrast + intercept)); // B
    }

    // Appliquer sharpen
    applySharpening(data, canvas.width, canvas.height, 0.4);
    
    ctx.putImageData(imageData, 0, 0);

    logger.info('[barcode-decode-web] Image upscalée x2 avec contraste + sharpen', {
      original: `${img.width}x${img.height}`,
      upscaled: `${canvas.width}x${canvas.height}`
    });

    return canvas.toDataURL('image/jpeg', 0.95);
  } catch (error: any) {
    logger.warn('[barcode-decode-web] Erreur upscale, utilisation image originale:', error?.message);
    return dataUrl;
  }
}

/**
 * Applique un filtre de netteté
 */
function applySharpening(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  strength: number
): void {
  const original = new Uint8ClampedArray(data);
  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sum = 0;
      
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 4;
          const kernelIdx = (ky + 1) * 3 + (kx + 1);
          sum += original[idx] * kernel[kernelIdx] * strength;
        }
      }
      
      const idx = (y * width + x) * 4;
      const originalValue = original[idx];
      const sharpened = Math.max(0, Math.min(255, originalValue + sum));
      const final = Math.round(originalValue * (1 - strength) + sharpened * strength);
      
      data[idx] = final;
      data[idx + 1] = final;
      data[idx + 2] = final;
    }
  }
}

/**
 * Normalise l'orientation EXIF d'une image
 * Corrige les problèmes d'orientation sur iPhone Safari
 * @param dataUrl Image en format data:image/...;base64,...
 * @returns Image normalisée avec orientation = 1
 */
async function normalizeImageOrientation(dataUrl: string): Promise<string> {
  try {
    // Extraire le base64
    const base64Data = dataUrl.replace(/^data:image\/[a-z]+;base64,/, '');
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Lire les métadonnées EXIF
    const tags = EXIF.load(bytes.buffer);
    const orientation = tags.Orientation?.value || 1;

    logger.info('[barcode-decode-web] EXIF Orientation détectée:', orientation);

    // Si orientation = 1, pas de transformation nécessaire
    if (orientation === 1) {
      return dataUrl;
    }

    // Charger l'image pour appliquer la transformation
    const img = await loadImage(dataUrl);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Impossible de créer le contexte canvas');
    }

    // Appliquer la transformation selon l'orientation EXIF
    // Orientation values: 1=normal, 2=flip-h, 3=rotate-180, 4=flip-v, 5=rotate-90+flip-h, 6=rotate-90, 7=rotate-90+flip-v, 8=rotate-270
    let width = img.width;
    let height = img.height;
    let needSwap = false;

    if (orientation >= 5 && orientation <= 8) {
      needSwap = true;
      [width, height] = [height, width];
    }

    canvas.width = width;
    canvas.height = height;

    // Appliquer les transformations
    ctx.save();
    
    switch (orientation) {
      case 2: // Flip horizontal
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
        break;
      case 3: // Rotate 180
        ctx.translate(width, height);
        ctx.rotate(Math.PI);
        break;
      case 4: // Flip vertical
        ctx.translate(0, height);
        ctx.scale(1, -1);
        break;
      case 5: // Rotate 90 + flip horizontal
        ctx.translate(height, 0);
        ctx.rotate(Math.PI / 2);
        ctx.scale(-1, 1);
        break;
      case 6: // Rotate 90
        ctx.translate(height, 0);
        ctx.rotate(Math.PI / 2);
        break;
      case 7: // Rotate 90 + flip vertical
        ctx.translate(0, width);
        ctx.rotate(-Math.PI / 2);
        ctx.scale(1, -1);
        break;
      case 8: // Rotate 270
        ctx.translate(0, width);
        ctx.rotate(-Math.PI / 2);
        break;
    }

    ctx.drawImage(img, 0, 0);
    ctx.restore();

    logger.info('[barcode-decode-web] ✅ Image normalisée (orientation:', orientation, '→ 1)');
    return canvas.toDataURL('image/jpeg', 0.95);
  } catch (error: any) {
    // Si erreur EXIF, retourner l'image originale
    logger.warn('[barcode-decode-web] Erreur normalisation EXIF, utilisation image originale:', error?.message);
    return dataUrl;
  }
}

/**
 * Charge une image depuis une data URL avec normalisation EXIF
 */
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = dataUrl;
  });
}

/**
 * Détecte si le navigateur supporte le scan live (BarcodeDetector)
 * Sur iPhone Safari web, cette API n'est pas supportée
 */
export function isBarcodeDetectorSupported(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  
  // @ts-ignore - BarcodeDetector n'est pas dans tous les types
  const supported = 'BarcodeDetector' in window;
  
  logger.debug('[barcode-decode-web] BarcodeDetector supporté?', { supported });
  return supported;
}

/**
 * Détecte si on est sur iOS Safari (ou iOS in-app browser)
 */
export function isIOSSafari(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isInAppBrowser = /FB|FBAN|Instagram|Twitter/.test(ua);
  
  const result = isIOS && !isInAppBrowser;
  
  logger.debug('[barcode-decode-web] Détection iOS Safari', { 
    isIOS, 
    isInAppBrowser, 
    result 
  });
  
  return result;
}
