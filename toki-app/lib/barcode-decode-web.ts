/**
 * Décodage de codes-barres sur le web (fallback pour iPhone Safari)
 * Utilise ZXing pour décoder des images statiques localement
 * 
 * Améliorations v1.0.8:
 * - Multi-tentatives avec différentes stratégies (crops + image complète)
 * - Preprocessing d'image (contraste, netteté, niveaux de gris, seuillage)
 * - Logs détaillés pour diagnostic
 */

import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from '@zxing/library';
import { logger } from './logger';

// Configuration des formats supportés (alimentaire uniquement)
const SUPPORTED_FORMATS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
];

// Types pour les stratégies de décodage
type DecodeStrategy = {
  name: string;
  cropPercent?: number; // Pourcentage de hauteur à cropper (undefined = image complète)
  preprocessing: 'standard' | 'aggressive';
};

// Stratégies dans l'ordre de priorité (arrêt dès qu'un code est trouvé)
const DECODE_STRATEGIES: DecodeStrategy[] = [
  { name: 'crop_center_30_standard', cropPercent: 0.3, preprocessing: 'standard' },
  { name: 'crop_center_50_standard', cropPercent: 0.5, preprocessing: 'standard' },
  { name: 'full_image_standard', preprocessing: 'standard' },
  { name: 'crop_center_30_aggressive', cropPercent: 0.3, preprocessing: 'aggressive' },
  { name: 'full_image_aggressive', preprocessing: 'aggressive' },
];

/**
 * Décode un code-barres depuis une data URL (base64)
 * Essaie plusieurs stratégies (crops + preprocessing) pour maximiser le taux de détection
 * 
 * @param dataUrl - Image en format data:image/...;base64,...
 * @returns Le code-barres détecté, ou null si aucun n'est trouvé
 */
export async function decodeBarcodeFromDataUrl(dataUrl: string): Promise<string | null> {
  try {
    logger.info('[barcode-decode-web] Démarrage du décodage ZXing avec multi-tentatives');
    
    // Charger l'image originale
    const img = await loadImage(dataUrl);
    logger.debug('[barcode-decode-web] Image chargée', { 
      width: img.width, 
      height: img.height 
    });

    // Downscale si nécessaire (pour performance)
    const maxWidth = 1024;
    let width = img.width;
    let height = img.height;
    
    if (width > maxWidth) {
      const ratio = maxWidth / width;
      width = maxWidth;
      height = Math.floor(height * ratio);
      logger.debug('[barcode-decode-web] Downscale appliqué', { width, height });
    }

    // Essayer chaque stratégie jusqu'à trouver un code
    let attemptCount = 0;
    for (const strategy of DECODE_STRATEGIES) {
      attemptCount++;
      logger.info(`[barcode-decode-web] Tentative ${attemptCount}/${DECODE_STRATEGIES.length}: ${strategy.name}`);
      
      try {
        const result = await tryDecodeWithStrategy(img, width, height, strategy);
        
        if (result) {
          logger.info(`[barcode-decode-web] ✅ Code-barres détecté avec stratégie: ${strategy.name}`, { 
            barcode: result,
            attempts: attemptCount
          });
          return result;
        }
        
        logger.debug(`[barcode-decode-web] ❌ Aucun code avec stratégie: ${strategy.name}`);
      } catch (error: any) {
        // NotFoundException est normal, on continue
        if (error?.name === 'NotFoundException') {
          logger.debug(`[barcode-decode-web] NotFoundException avec stratégie: ${strategy.name}`);
          continue;
        }
        // Autres erreurs: logger mais continuer quand même
        logger.warn(`[barcode-decode-web] Erreur avec stratégie ${strategy.name}`, { 
          error: error?.message || String(error) 
        });
      }
    }

    logger.warn(`[barcode-decode-web] ❌ Aucun code-barres détecté après ${attemptCount} tentatives`);
    return null;

  } catch (error: any) {
    logger.error('[barcode-decode-web] Erreur fatale lors du décodage', { 
      error: error?.message || String(error) 
    });
    return null;
  }
}

/**
 * Essaie de décoder avec une stratégie spécifique (crop + preprocessing)
 */
async function tryDecodeWithStrategy(
  img: HTMLImageElement,
  maxWidth: number,
  maxHeight: number,
  strategy: DecodeStrategy
): Promise<string | null> {
  // Créer le canvas pour cette tentative
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Impossible de créer le contexte canvas');
  }

  // Calculer les dimensions du crop
  let canvasWidth = maxWidth;
  let canvasHeight = maxHeight;
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = img.width;
  let sourceHeight = img.height;

  if (strategy.cropPercent !== undefined) {
    // Crop au centre
    canvasHeight = Math.floor(maxHeight * strategy.cropPercent);
    sourceHeight = Math.floor(img.height * strategy.cropPercent);
    sourceY = Math.floor((img.height - sourceHeight) / 2);
  }

  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  // Étape 1: Dessiner l'image (avec crop si nécessaire)
  ctx.drawImage(
    img,
    sourceX, sourceY, sourceWidth, sourceHeight, // Source
    0, 0, canvasWidth, canvasHeight // Destination
  );

  // Étape 2: Appliquer le preprocessing
  applyPreprocessing(ctx, canvasWidth, canvasHeight, strategy.preprocessing);

  // Sauvegarder le canvas en dev pour inspection visuelle
  if (__DEV__) {
    saveCanvasForDebug(canvas, strategy.name);
  }

  // Étape 3: Décoder avec ZXing
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, SUPPORTED_FORMATS);
  hints.set(DecodeHintType.TRY_HARDER, true);

  const reader = new BrowserMultiFormatReader(hints);
  const result = await reader.decodeFromCanvas(canvas);
  
  if (result && result.getText()) {
    return result.getText();
  }

  return null;
}

/**
 * Applique le preprocessing d'image pour améliorer la détection
 */
function applyPreprocessing(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  mode: 'standard' | 'aggressive'
): void {
  // Récupérer les pixels de l'image
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Conversion en niveaux de gris + amélioration contraste
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    // Conversion en niveaux de gris (luminance)
    const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    
    // Amélioration contraste (étirement histogramme)
    let enhanced: number;
    if (mode === 'aggressive') {
      // Contraste agressif: étirement plus fort
      enhanced = Math.max(0, Math.min(255, (gray - 50) * 1.5 + 50));
    } else {
      // Contraste standard: étirement modéré
      enhanced = Math.max(0, Math.min(255, (gray - 30) * 1.2 + 30));
    }
    
    data[i] = enhanced;     // R
    data[i + 1] = enhanced;  // G
    data[i + 2] = enhanced;  // B
    // Alpha reste inchangé
  }

  // Appliquer le seuillage adaptatif si mode agressif
  if (mode === 'aggressive') {
    applyAdaptiveThreshold(data, width, height);
  }

  // Appliquer un filtre de netteté (unsharp mask simplifié)
  applySharpening(data, width, height, mode === 'aggressive' ? 0.5 : 0.3);

  // Réécrire les pixels modifiés
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Applique un seuillage adaptatif (Otsu simplifié) pour codes-barres mal éclairés
 */
function applyAdaptiveThreshold(data: Uint8ClampedArray, width: number, height: number): void {
  // Calculer le seuil moyen (Otsu simplifié)
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum += data[i]; // On utilise R (qui est déjà en niveaux de gris)
  }
  const threshold = Math.floor(sum / (data.length / 4));

  // Appliquer le seuillage
  for (let i = 0; i < data.length; i += 4) {
    const value = data[i];
    const binary = value > threshold ? 255 : 0;
    data[i] = binary;
    data[i + 1] = binary;
    data[i + 2] = binary;
  }
}

/**
 * Applique un filtre de netteté (unsharp mask simplifié)
 */
function applySharpening(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  strength: number
): void {
  // Créer une copie pour le calcul
  const original = new Uint8ClampedArray(data);
  
  // Kernel de netteté (3x3)
  const kernel = [
    0, -1, 0,
    -1, 5, -1,
    0, -1, 0
  ];
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sum = 0;
      
      // Appliquer le kernel
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 4;
          const kernelIdx = (ky + 1) * 3 + (kx + 1);
          sum += original[idx] * kernel[kernelIdx] * strength;
        }
      }
      
      // Appliquer le résultat avec mélange
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
 * Sauvegarde le canvas traité dans localStorage pour inspection en dev
 */
function saveCanvasForDebug(canvas: HTMLCanvasElement, strategyName: string): void {
  try {
    const dataUrl = canvas.toDataURL('image/png');
    const key = `barcode_debug_${strategyName}_${Date.now()}`;
    localStorage.setItem(key, dataUrl);
    logger.debug(`[barcode-decode-web] Canvas sauvegardé pour debug: ${key}`);
    
    // Garder seulement les 5 dernières images (nettoyage)
    const keys = Object.keys(localStorage).filter(k => k.startsWith('barcode_debug_'));
    if (keys.length > 5) {
      keys.sort().slice(0, keys.length - 5).forEach(k => localStorage.removeItem(k));
    }
  } catch (error) {
    // Ignorer les erreurs de localStorage (quota, etc.)
  }
}

/**
 * Charge une image depuis une data URL
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
  
  // On considère iOS Safari si iOS ET pas un in-app browser connu
  const result = isIOS && !isInAppBrowser;
  
  logger.debug('[barcode-decode-web] Détection iOS Safari', { 
    isIOS, 
    isInAppBrowser, 
    result 
  });
  
  return result;
}
