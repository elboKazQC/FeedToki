/**
 * Décodage de codes-barres sur le web (fallback pour iPhone Safari)
 * Utilise ZXing pour décoder des images statiques localement
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

/**
 * Décode un code-barres depuis une data URL (base64)
 * Applique des optimisations (crop, downscale) pour améliorer la performance
 * 
 * @param dataUrl - Image en format data:image/...;base64,...
 * @returns Le code-barres détecté, ou null si aucun n'est trouvé
 */
export async function decodeBarcodeFromDataUrl(dataUrl: string): Promise<string | null> {
  try {
    logger.info('[barcode-decode-web] Démarrage du décodage ZXing');
    
    // Créer une image depuis la data URL
    const img = await loadImage(dataUrl);
    logger.debug('[barcode-decode-web] Image chargée', { 
      width: img.width, 
      height: img.height 
    });

    // Optimisation 1: Downscale si l'image est trop grande
    const maxWidth = 1024;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      logger.error('[barcode-decode-web] Impossible de créer le contexte canvas');
      return null;
    }

    let width = img.width;
    let height = img.height;
    
    if (width > maxWidth) {
      const ratio = maxWidth / width;
      width = maxWidth;
      height = Math.floor(height * ratio);
      logger.debug('[barcode-decode-web] Downscale appliqué', { width, height });
    }

    // Optimisation 2: Crop au centre (bande horizontale ~30% de hauteur)
    // Les codes-barres sont généralement au centre de l'image
    const cropHeight = Math.floor(height * 0.3);
    const cropY = Math.floor((height - cropHeight) / 2);
    
    canvas.width = width;
    canvas.height = cropHeight;
    
    // Dessiner la portion centrale de l'image
    ctx.drawImage(
      img,
      0, cropY, img.width, Math.floor(img.height * 0.3), // Source (crop)
      0, 0, width, cropHeight // Destination
    );
    
    logger.debug('[barcode-decode-web] Crop appliqué', { 
      cropHeight, 
      cropY,
      finalWidth: width,
      finalHeight: cropHeight
    });

    // Configuration du lecteur ZXing
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, SUPPORTED_FORMATS);
    hints.set(DecodeHintType.TRY_HARDER, true);

    const reader = new BrowserMultiFormatReader(hints);
    
    // Décoder depuis le canvas
    const result = await reader.decodeFromCanvas(canvas);
    
    if (result && result.getText()) {
      const barcode = result.getText();
      logger.info('[barcode-decode-web] Code-barres détecté', { 
        barcode, 
        format: result.getBarcodeFormat() 
      });
      return barcode;
    }

    logger.warn('[barcode-decode-web] Aucun code-barres détecté dans l\'image');
    return null;

  } catch (error: any) {
    // NotFoundException est normal si aucun code n'est trouvé
    if (error?.name === 'NotFoundException') {
      logger.warn('[barcode-decode-web] Aucun code-barres trouvé (NotFoundException)');
      return null;
    }
    
    logger.error('[barcode-decode-web] Erreur lors du décodage', { 
      error: error?.message || String(error) 
    });
    return null;
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
