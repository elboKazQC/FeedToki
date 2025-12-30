/**
 * Firebase Functions pour FeedToki
 * 
 * Fonction: decodeBarcodeCloud
 * Décode un code-barres depuis une image en utilisant Google Cloud Vision API
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { ImageAnnotatorClient } from '@google-cloud/vision';

// Initialiser Firebase Admin (une seule fois)
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Décode un code-barres depuis une image base64 en utilisant Google Cloud Vision API
 * 
 * @param imageBase64 - Image en format base64 (sans le préfixe data:image/...;base64,)
 * @returns Le code-barres détecté (EAN/UPC) ou null si aucun n'est trouvé
 */
async function decodeBarcodeWithVisionAPI(imageBase64: string): Promise<string | null> {
  try {
    console.log('[decodeBarcodeCloud] Démarrage décodage avec Google Cloud Vision API');
    console.log('[decodeBarcodeCloud] Taille image base64:', imageBase64.length, 'caractères');
    
    const client = new ImageAnnotatorClient();
    console.log('[decodeBarcodeCloud] Client Vision API initialisé');
    
    // Convertir base64 en Buffer
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    console.log('[decodeBarcodeCloud] Image convertie en Buffer, taille:', imageBuffer.length, 'bytes');
    
    // Appeler l'API Vision pour détecter les codes-barres
    // Utiliser annotateImage avec le type de feature BARCODE_DETECTION
    const request = {
      image: { content: imageBuffer },
      features: [{ type: 'BARCODE_DETECTION' as const }],
    };
    
    console.log('[decodeBarcodeCloud] Appel à Vision API en cours...');
    const [result] = await client.annotateImage(request);
    console.log('[decodeBarcodeCloud] Réponse Vision API reçue');
    
    // @ts-ignore - barcodeAnnotations existe mais n'est pas dans les types
    const barcodes = result.barcodeAnnotations || [];
    console.log('[decodeBarcodeCloud] Nombre de codes-barres détectés:', barcodes.length);
    
    if (barcodes.length === 0) {
      console.log('[decodeBarcodeCloud] ❌ Aucun code-barres détecté dans l\'image');
      return null;
    }
    
    // Logger tous les codes détectés
    barcodes.forEach((barcode: any, index: number) => {
      console.log(`[decodeBarcodeCloud] Code ${index + 1}:`, {
        format: barcode.format,
        rawValue: barcode.rawValue,
        displayValue: barcode.displayValue,
      });
    });
    
    // Prendre le premier code-barres détecté
    // Filtrer pour EAN/UPC uniquement (formats alimentaires)
    const validBarcode = barcodes.find((barcode: any) => {
      const format = barcode.format || '';
      return (
        format.includes('EAN_13') ||
        format.includes('EAN_8') ||
        format.includes('UPC_A') ||
        format.includes('UPC_E')
      );
    });
    
    if (validBarcode && validBarcode.rawValue) {
      console.log('[decodeBarcodeCloud] ✅ Code-barres valide trouvé:', validBarcode.rawValue, 'format:', validBarcode.format);
      return validBarcode.rawValue;
    }
    
    // Si aucun format valide, prendre le premier quand même
    if (barcodes[0]?.rawValue) {
      console.log('[decodeBarcodeCloud] ⚠️ Format non standard, utilisation du premier code:', barcodes[0].rawValue, 'format:', barcodes[0].format);
      return barcodes[0].rawValue;
    }
    
    console.log('[decodeBarcodeCloud] ❌ Aucun code-barres valide trouvé');
    return null;
  } catch (error: any) {
    console.error('[decodeBarcodeCloud] ❌ Erreur Vision API:', {
      code: error.code,
      message: error.message,
      details: error.details,
    });
    throw error;
  }
}

/**
 * Firebase Function HTTP callable
 * Reçoit une image base64 et retourne le code-barres détecté
 */
export const decodeBarcodeCloud = functions.https.onCall(async (data, context) => {
  console.log('[decodeBarcodeCloud] ════════════════════════════════════');
  console.log('[decodeBarcodeCloud] Nouvelle requête reçue');
  console.log('[decodeBarcodeCloud] User:', context.auth?.uid || 'anonymous');
  console.log('[decodeBarcodeCloud] Timestamp:', new Date().toISOString());
  
  // Vérifier l'authentification (optionnel mais recommandé)
  // if (!context.auth) {
  //   throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  // }
  
  const { imageBase64 } = data;
  
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    console.error('[decodeBarcodeCloud] ❌ Argument invalide: imageBase64 manquant ou invalide');
    throw new functions.https.HttpsError(
      'invalid-argument',
      'imageBase64 must be a non-empty string'
    );
  }
  
  console.log('[decodeBarcodeCloud] Image base64 reçue, longueur:', imageBase64.length);
  
  // Nettoyer le base64 (enlever le préfixe data:image/...;base64, si présent)
  const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
  console.log('[decodeBarcodeCloud] Base64 nettoyé, longueur:', cleanBase64.length);
  
  try {
    const startTime = Date.now();
    const barcode = await decodeBarcodeWithVisionAPI(cleanBase64);
    const duration = Date.now() - startTime;
    
    if (!barcode) {
      console.log('[decodeBarcodeCloud] ❌ Aucun code-barres détecté (durée:', duration, 'ms)');
      return { success: false, barcode: null, error: 'No barcode detected' };
    }
    
    console.log('[decodeBarcodeCloud] ✅ Succès! Code-barres:', barcode, '(durée:', duration, 'ms)');
    console.log('[decodeBarcodeCloud] ════════════════════════════════════');
    return { success: true, barcode, error: null };
  } catch (error: any) {
    console.error('[decodeBarcodeCloud] ❌ Erreur fatale:', {
      code: error.code,
      message: error.message,
      details: error.details,
    });
    
    // Gérer les erreurs spécifiques de l'API
    if (error.code === 8) {
      // PERMISSION_DENIED - Vision API non activée ou permissions manquantes
      console.error('[decodeBarcodeCloud] ❌ PERMISSION_DENIED - Vision API non activée ou permissions manquantes');
      throw new functions.https.HttpsError(
        'permission-denied',
        'Google Cloud Vision API is not enabled or permissions are missing'
      );
    }
    
    if (error.code === 3) {
      // INVALID_ARGUMENT - Image invalide
      console.error('[decodeBarcodeCloud] ❌ INVALID_ARGUMENT - Format d\'image invalide');
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Invalid image format'
      );
    }
    
    // Erreur générique
    console.error('[decodeBarcodeCloud] ❌ Erreur générique:', error.message);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to decode barcode: ' + (error.message || 'Unknown error')
    );
  }
});
