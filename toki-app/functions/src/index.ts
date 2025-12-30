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
    const client = new ImageAnnotatorClient();
    
    // Convertir base64 en Buffer
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    
    // Appeler l'API Vision pour détecter les codes-barres
    // Utiliser annotateImage avec le type de feature BARCODE_DETECTION
    const request = {
      image: { content: imageBuffer },
      features: [{ type: 'BARCODE_DETECTION' as const }],
    };
    
    const [result] = await client.annotateImage(request);
    
    // @ts-ignore - barcodeAnnotations existe mais n'est pas dans les types
    const barcodes = result.barcodeAnnotations || [];
    
    if (barcodes.length === 0) {
      return null;
    }
    
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
      return validBarcode.rawValue;
    }
    
    // Si aucun format valide, prendre le premier quand même
    if (barcodes[0]?.rawValue) {
      return barcodes[0].rawValue;
    }
    
    return null;
  } catch (error: any) {
    console.error('[decodeBarcodeCloud] Erreur Vision API:', error);
    throw error;
  }
}

/**
 * Firebase Function HTTP callable
 * Reçoit une image base64 et retourne le code-barres détecté
 */
export const decodeBarcodeCloud = functions.https.onCall(async (data, context) => {
  // Vérifier l'authentification (optionnel mais recommandé)
  // if (!context.auth) {
  //   throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  // }
  
  const { imageBase64 } = data;
  
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'imageBase64 must be a non-empty string'
    );
  }
  
  // Nettoyer le base64 (enlever le préfixe data:image/...;base64, si présent)
  const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
  
  try {
    const barcode = await decodeBarcodeWithVisionAPI(cleanBase64);
    
    if (!barcode) {
      return { success: false, barcode: null, error: 'No barcode detected' };
    }
    
    return { success: true, barcode, error: null };
  } catch (error: any) {
    console.error('[decodeBarcodeCloud] Erreur:', error);
    
    // Gérer les erreurs spécifiques de l'API
    if (error.code === 8) {
      // PERMISSION_DENIED - Vision API non activée ou permissions manquantes
      throw new functions.https.HttpsError(
        'permission-denied',
        'Google Cloud Vision API is not enabled or permissions are missing'
      );
    }
    
    if (error.code === 3) {
      // INVALID_ARGUMENT - Image invalide
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Invalid image format'
      );
    }
    
    // Erreur générique
    throw new functions.https.HttpsError(
      'internal',
      'Failed to decode barcode: ' + (error.message || 'Unknown error')
    );
  }
});
