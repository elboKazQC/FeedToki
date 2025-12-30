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
import { app } from './firebase-config';
import { logger } from './logger';

// Configuration des formats supportés (alimentaire uniquement)
const SUPPORTED_FORMATS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
];

// Configuration QuaggaJS pour EAN/UPC
const QUAGGA_CONFIG = {
  inputStream: {
    size: 800, // Taille optimale pour performance
  },
  locator: {
    patchSize: 'medium',
    halfSample: false,
  },
  decoder: {
    readers: ['ean_reader', 'ean_8_reader', 'upc_reader', 'upc_e_reader'],
  },
  locate: true,
};

/**
 * Décode un code-barres depuis une data URL (base64)
 * Ordre de priorité: Google Cloud Vision API → QuaggaJS → ZXing
 * 
 * @param dataUrl - Image en format data:image/...;base64,...
 * @returns Le code-barres détecté, ou null si aucun n'est trouvé
 */
export async function decodeBarcodeFromDataUrl(dataUrl: string): Promise<string | null> {
  try {
    logger.info('[barcode-decode-web] Démarrage du décodage (Cloud API → QuaggaJS → ZXing)');
    
    // Étape 1: Essayer Google Cloud Vision API (le plus fiable)
    logger.info('[barcode-decode-web] Tentative avec Google Cloud Vision API...');
    const cloudResult = await decodeBarcodeWithCloudAPI(dataUrl);
    
    if (cloudResult) {
      logger.info('[barcode-decode-web] ✅ Code-barres détecté avec Cloud API', { 
        barcode: cloudResult 
      });
      return cloudResult;
    }
    
    logger.warn('[barcode-decode-web] Cloud API n\'a pas détecté de code, essai avec QuaggaJS...');
    
    // Étape 2: Fallback QuaggaJS (meilleur pour web mobile)
    const quaggaResult = await decodeBarcodeWithQuagga(dataUrl);
    
    if (quaggaResult) {
      logger.info('[barcode-decode-web] ✅ Code-barres détecté avec QuaggaJS (fallback)', { 
        barcode: quaggaResult 
      });
      return quaggaResult;
    }
    
    logger.warn('[barcode-decode-web] QuaggaJS n\'a pas détecté de code, essai avec ZXing...');
    
    // Étape 3: Fallback ZXing (dernier recours)
    const zxingResult = await decodeBarcodeWithZXing(dataUrl);
    
    if (zxingResult) {
      logger.info('[barcode-decode-web] ✅ Code-barres détecté avec ZXing (fallback)', { 
        barcode: zxingResult 
      });
      return zxingResult;
    }
    
    logger.warn('[barcode-decode-web] ❌ Aucun code-barres détecté (Cloud API + QuaggaJS + ZXing ont échoué)');
    return null;

  } catch (error: any) {
    logger.error('[barcode-decode-web] Erreur fatale lors du décodage', { 
      error: error?.message || String(error) 
    });
    return null;
  }
}

/**
 * Décode un code-barres avec Google Cloud Vision API via Firebase Functions
 * C'est la méthode la plus fiable (> 95% de taux de détection)
 */
async function decodeBarcodeWithCloudAPI(dataUrl: string): Promise<string | null> {
  try {
    // Vérifier que Firebase est initialisé
    if (!app) {
      logger.warn('[barcode-decode-web] Firebase non initialisé, skip Cloud API');
      return null;
    }
    
    const functions = getFunctions(app);
    const decodeBarcodeCloud = httpsCallable(functions, 'decodeBarcodeCloud');
    
    // Extraire le base64 de la data URL
    const base64Data = dataUrl.replace(/^data:image\/[a-z]+;base64,/, '');
    
    // Appeler la Firebase Function avec timeout (10 secondes)
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), 10000);
    });
    
    const apiPromise = decodeBarcodeCloud({ imageBase64: base64Data })
      .then((result: any) => {
        if (result.data?.success && result.data?.barcode) {
          return result.data.barcode;
        }
        return null;
      })
      .catch((error: any) => {
        // Gérer les erreurs spécifiques
        if (error.code === 'functions/permission-denied') {
          logger.warn('[barcode-decode-web] Cloud API: Vision API non activée ou permissions manquantes');
        } else if (error.code === 'functions/invalid-argument') {
          logger.warn('[barcode-decode-web] Cloud API: Image invalide');
        } else {
          logger.warn('[barcode-decode-web] Cloud API erreur:', { 
            code: error.code, 
            message: error.message 
          });
        }
        return null;
      });
    
    const result = await Promise.race([apiPromise, timeoutPromise]);
    
    return result;
  } catch (error: any) {
    logger.warn('[barcode-decode-web] Erreur Cloud API (fallback vers local):', { 
      error: error?.message || String(error) 
    });
    return null;
  }
}

/**
 * Décode un code-barres avec QuaggaJS (méthode principale)
 * QuaggaJS est spécialement optimisé pour EAN/UPC sur web mobile
 */
async function decodeBarcodeWithQuagga(dataUrl: string): Promise<string | null> {
  try {
    // Charger l'image
    const img = await loadImage(dataUrl);
    
    // Créer un canvas pour QuaggaJS
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      logger.error('[barcode-decode-web] Impossible de créer le contexte canvas pour QuaggaJS');
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
    }

    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(img, 0, 0, width, height);

    // Essayer plusieurs crops (centre 30%, centre 50%, image complète)
    const crops = [
      { name: 'full', x: 0, y: 0, w: width, h: height },
      { name: 'center_30', x: 0, y: Math.floor(height * 0.35), w: width, h: Math.floor(height * 0.3) },
      { name: 'center_50', x: 0, y: Math.floor(height * 0.25), w: width, h: Math.floor(height * 0.5) },
    ];

    for (const crop of crops) {
      try {
        // Créer un canvas pour ce crop
        const cropCanvas = document.createElement('canvas');
        const cropCtx = cropCanvas.getContext('2d');
        if (!cropCtx) continue;

        cropCanvas.width = crop.w;
        cropCanvas.height = crop.h;
        cropCtx.drawImage(
          canvas,
          crop.x, crop.y, crop.w, crop.h,
          0, 0, crop.w, crop.h
        );

        // Décoder avec QuaggaJS (API callback)
        const result = await new Promise<string | null>((resolve) => {
          Quagga.decodeSingle(
            {
              ...QUAGGA_CONFIG,
              src: cropCanvas.toDataURL(),
            },
            (result: any) => {
              if (result && result.codeResult && result.codeResult.code) {
                resolve(result.codeResult.code);
              } else {
                resolve(null);
              }
            }
          );
        });

        if (result) {
          logger.info(`[barcode-decode-web] QuaggaJS détecté avec crop: ${crop.name}`, { 
            barcode: result 
          });
          return result;
        }
      } catch (error: any) {
        // Continuer avec le crop suivant
        logger.debug(`[barcode-decode-web] QuaggaJS échec avec crop ${crop.name}`, { 
          error: error?.message 
        });
      }
    }

    return null;
  } catch (error: any) {
    logger.warn('[barcode-decode-web] Erreur QuaggaJS', { 
      error: error?.message || String(error) 
    });
    return null;
  }
}

/**
 * Décode un code-barres avec ZXing (fallback)
 * Utilise les multi-tentatives et preprocessing de la v1.0.8
 */
async function decodeBarcodeWithZXing(dataUrl: string): Promise<string | null> {
  try {
    logger.info('[barcode-decode-web] Démarrage du décodage ZXing (fallback)');
    
    // Charger l'image originale
    const img = await loadImage(dataUrl);
    logger.debug('[barcode-decode-web] Image chargée pour ZXing', { 
      width: img.width, 
      height: img.height 
    });

    // Downscale si nécessaire
    const maxWidth = 1024;
    let width = img.width;
    let height = img.height;
    
    if (width > maxWidth) {
      const ratio = maxWidth / width;
      width = maxWidth;
      height = Math.floor(height * ratio);
      logger.debug('[barcode-decode-web] Downscale appliqué pour ZXing', { width, height });
    }

    // Essayer plusieurs stratégies (simplifiées pour fallback)
    const strategies = [
      { name: 'crop_center_30', cropPercent: 0.3, preprocessing: 'standard' as const },
      { name: 'full_image', cropPercent: undefined, preprocessing: 'standard' as const },
      { name: 'crop_center_30_aggressive', cropPercent: 0.3, preprocessing: 'aggressive' as const },
    ];

    for (const strategy of strategies) {
      try {
        logger.debug(`[barcode-decode-web] ZXing tentative: ${strategy.name}`);
        const result = await tryDecodeWithZXingStrategy(img, width, height, strategy);
        
        if (result) {
          logger.info(`[barcode-decode-web] ZXing détecté avec stratégie: ${strategy.name}`, { 
            barcode: result 
          });
          return result;
        }
      } catch (error: any) {
        if (error?.name === 'NotFoundException') {
          continue;
        }
        logger.debug(`[barcode-decode-web] ZXing erreur avec stratégie ${strategy.name}`, { 
          error: error?.message 
        });
      }
    }

    return null;
  } catch (error: any) {
    logger.warn('[barcode-decode-web] Erreur ZXing', { 
      error: error?.message || String(error) 
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

  // Calculer les dimensions du crop
  let canvasWidth = maxWidth;
  let canvasHeight = maxHeight;
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = img.width;
  let sourceHeight = img.height;

  if (strategy.cropPercent !== undefined) {
    canvasHeight = Math.floor(maxHeight * strategy.cropPercent);
    sourceHeight = Math.floor(img.height * strategy.cropPercent);
    sourceY = Math.floor((img.height - sourceHeight) / 2);
  }

  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  // Dessiner l'image
  ctx.drawImage(
    img,
    sourceX, sourceY, sourceWidth, sourceHeight,
    0, 0, canvasWidth, canvasHeight
  );

  // Appliquer le preprocessing
  applyPreprocessing(ctx, canvasWidth, canvasHeight, strategy.preprocessing);

  // Décoder avec ZXing
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
  
  const result = isIOS && !isInAppBrowser;
  
  logger.debug('[barcode-decode-web] Détection iOS Safari', { 
    isIOS, 
    isInAppBrowser, 
    result 
  });
  
  return result;
}
