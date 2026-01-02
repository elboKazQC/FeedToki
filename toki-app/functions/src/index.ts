/**
 * Firebase Functions pour FeedToki
 * 
 * Fonctions:
 * - decodeBarcodeCloud: Décode un code-barres depuis une image en utilisant Google Cloud Vision API
 * - createCheckoutSession: Crée une session Stripe Checkout pour un abonnement
 * - handleStripeWebhook: Gère les webhooks Stripe pour mettre à jour les abonnements
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { ImageAnnotatorClient } from '@google-cloud/vision';

// Initialiser Firebase Admin (une seule fois)
if (!admin.apps.length) {
  admin.initializeApp();
}

// Stripe - Les clés sont dans les variables d'environnement Firebase Functions
// Configurer via: firebase functions:config:set stripe.secret_key="sk_live_..."
// OU via Firebase Console > Functions > Configuration > Secrets
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || functions.config().stripe?.secret_key;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || functions.config().stripe?.webhook_secret;

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

/**
 * Créer une session Stripe Checkout pour un abonnement
 * 
 * TODO: Configurer Stripe avec les clés API dans les variables d'environnement Firebase Functions
 * 1. Aller dans Firebase Console > Functions > Configuration
 * 2. Ajouter STRIPE_SECRET_KEY et STRIPE_WEBHOOK_SECRET
 * 3. Installer stripe: npm install stripe dans functions/
 * 4. Décommenter le code ci-dessous
 */
export const createCheckoutSession = functions.https.onCall(async (data, context) => {
  console.log('[createCheckoutSession] Nouvelle requête');
  
  // Vérifier l'authentification
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'L\'utilisateur doit être authentifié'
    );
  }

  const userId = context.auth.uid;
  console.log('[createCheckoutSession] User:', userId);

  if (!STRIPE_SECRET_KEY) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Stripe n\'est pas configuré. Veuillez configurer STRIPE_SECRET_KEY dans Firebase Functions.'
    );
  }

  try {
    const stripe = require('stripe')(STRIPE_SECRET_KEY);
    
    // Détecter automatiquement le mode (test vs production) selon la clé Stripe
    const isTestMode = STRIPE_SECRET_KEY?.startsWith('sk_test_');
    
    // Price ID du produit FeedToki Premium
    // MODE TEST: price_1SkUYTGdme3i0KJAuhn1rPXJ (Product: prod_ThuNPX3yPxQ5Aa)
    // MODE PRODUCTION: price_1SkU52Gdme3i0KJAgTp4COAz (Product: prod_ThtsixtBHuyS06)
    let PRICE_ID = isTestMode 
      ? 'price_1SkUYTGdme3i0KJAuhn1rPXJ' // TEST - $10.00 CAD/mois
      : 'price_1SkU52Gdme3i0KJAgTp4COAz'; // PRODUCTION - $10.00 CAD/mois
    
    console.log(`[createCheckoutSession] Mode: ${isTestMode ? 'TEST' : 'PRODUCTION'}, Price ID: ${PRICE_ID}`);
    
    // Vérifier si le prix existe, sinon le créer
    try {
      await stripe.prices.retrieve(PRICE_ID);
      console.log(`[createCheckoutSession] ✅ Price ID ${PRICE_ID} existe`);
    } catch (priceError: any) {
      if (priceError.code === 'resource_missing') {
        console.error(`[createCheckoutSession] ❌ Price ID ${PRICE_ID} n'existe pas. Création d'un nouveau prix...`);
        
        // Créer le produit s'il n'existe pas
        const PRODUCT_ID = isTestMode ? 'prod_ThuNPX3yPxQ5Aa' : 'prod_ThtsixtBHuyS06';
        try {
          await stripe.products.retrieve(PRODUCT_ID);
          console.log(`[createCheckoutSession] ✅ Produit ${PRODUCT_ID} existe`);
        } catch (productError: any) {
          if (productError.code === 'resource_missing') {
            console.log(`[createCheckoutSession] Création du produit ${PRODUCT_ID}...`);
            await stripe.products.create({
              id: PRODUCT_ID,
              name: 'FeedToki Premium',
              description: 'Abonnement mensuel FeedToki Premium - 50 analyses IA par jour',
            });
            console.log(`[createCheckoutSession] ✅ Produit créé: ${PRODUCT_ID}`);
          } else {
            throw productError;
          }
        }
        
        // Créer le prix
        const newPrice = await stripe.prices.create({
          product: PRODUCT_ID,
          unit_amount: 1000, // $10.00 CAD = 1000 centimes
          currency: 'cad',
          recurring: {
            interval: 'month',
          },
        });
        
        PRICE_ID = newPrice.id;
        console.log(`[createCheckoutSession] ✅ Nouveau prix créé: ${PRICE_ID}`);
        console.warn(`[createCheckoutSession] ⚠️ IMPORTANT: Mettez à jour le code avec le nouveau Price ID: ${PRICE_ID}`);
      } else {
        throw priceError;
      }
    }
    
    // Créer la session Checkout
    const session = await stripe.checkout.sessions.create({
      customer_email: context.auth.token.email,
      payment_method_types: ['card'],
      line_items: [
        {
          price: PRICE_ID,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${data.successUrl || 'https://feed-toki.firebaseapp.com/subscription?success=true'}`,
      cancel_url: `${data.cancelUrl || 'https://feed-toki.firebaseapp.com/subscription?canceled=true'}`,
      metadata: {
        userId: userId,
      },
      // Ajouter metadata aussi au subscription pour customer.subscription.created
      subscription_data: {
        metadata: {
          userId: userId,
        },
      },
    });

    console.log('[createCheckoutSession] ✅ Session créée:', session.id);
    return { url: session.url };
  } catch (error: any) {
    console.error('[createCheckoutSession] ❌ Erreur:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Erreur lors de la création de la session: ' + error.message
    );
  }
});

/**
 * Gérer les webhooks Stripe pour mettre à jour les abonnements
 * 
 * TODO: Configurer le webhook dans Stripe Dashboard:
 * 1. Aller dans Stripe Dashboard > Developers > Webhooks
 * 2. Ajouter endpoint: https://[region]-[project-id].cloudfunctions.net/handleStripeWebhook
 * 3. Sélectionner les événements: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted
 * 4. Copier le webhook secret dans STRIPE_WEBHOOK_SECRET
 * 
 * IMPORTANT: Utiliser functions.https.onRequest directement (pas Express) pour accéder au body brut
 * Firebase Functions parse automatiquement le body, donc on doit utiliser req.rawBody si disponible
 * Sinon, on convertit req.body en string (mais la vérification de signature peut échouer)
 */
export const handleStripeWebhook = functions.https.onRequest(async (req: functions.https.Request, res: functions.Response) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log('[handleStripeWebhook] ════════════════════════════════════');
  console.log('[handleStripeWebhook] 🎯 NOUVEAU WEBHOOK REÇU');
  console.log('[handleStripeWebhook] Request ID:', requestId);
  console.log('[handleStripeWebhook] Timestamp:', new Date().toISOString());
  console.log('[handleStripeWebhook] Method:', req.method);
  console.log('[handleStripeWebhook] URL:', req.url);
  console.log('[handleStripeWebhook] Path:', req.path);
  console.log('[handleStripeWebhook] Route:', req.route?.path || 'N/A');
  
  // Logs détaillés des headers
  console.log('[handleStripeWebhook] 📋 Headers complets:', JSON.stringify(req.headers, null, 2));
  console.log('[handleStripeWebhook] Content-Type:', req.headers['content-type']);
  console.log('[handleStripeWebhook] Content-Length:', req.headers['content-length']);
  console.log('[handleStripeWebhook] Stripe-Signature header présent:', !!req.headers['stripe-signature']);
  const stripeSignatureHeader = req.headers['stripe-signature'];
  if (stripeSignatureHeader) {
    const sigStr = Array.isArray(stripeSignatureHeader) ? stripeSignatureHeader[0] : stripeSignatureHeader;
    console.log('[handleStripeWebhook] Stripe-Signature (premiers 50 chars):', sigStr.substring(0, 50));
  }
  
  // Logs détaillés du body
  console.log('[handleStripeWebhook] 📦 Body Analysis:');
  console.log('[handleStripeWebhook] req.body type:', typeof req.body);
  console.log('[handleStripeWebhook] req.body is Buffer:', Buffer.isBuffer(req.body));
  console.log('[handleStripeWebhook] req.body is String:', typeof req.body === 'string');
  console.log('[handleStripeWebhook] req.body is Object:', typeof req.body === 'object' && !Buffer.isBuffer(req.body));
  console.log('[handleStripeWebhook] req.body constructor:', req.body?.constructor?.name || 'N/A');
  
  // Vérifier req.rawBody (propriété Firebase Functions)
  const rawBodyValue = (req as any).rawBody;
  console.log('[handleStripeWebhook] 🔍 Vérification req.rawBody (Firebase Functions):');
  console.log('[handleStripeWebhook] req.rawBody présent:', !!rawBodyValue);
  console.log('[handleStripeWebhook] req.rawBody type:', typeof rawBodyValue);
  console.log('[handleStripeWebhook] req.rawBody is Buffer:', Buffer.isBuffer(rawBodyValue));
  console.log('[handleStripeWebhook] req.rawBody is String:', typeof rawBodyValue === 'string');
  
  // Taille du body
  if (Buffer.isBuffer(req.body)) {
    console.log('[handleStripeWebhook] req.body length (Buffer):', req.body.length, 'bytes');
    console.log('[handleStripeWebhook] req.body (premiers 200 chars):', req.body.toString('utf8').substring(0, 200));
  } else if (typeof req.body === 'string') {
    console.log('[handleStripeWebhook] req.body length (String):', req.body.length, 'chars');
    console.log('[handleStripeWebhook] req.body (premiers 200 chars):', req.body.substring(0, 200));
  } else {
    console.log('[handleStripeWebhook] req.body length (JSON):', JSON.stringify(req.body).length, 'chars');
    console.log('[handleStripeWebhook] req.body keys:', req.body ? Object.keys(req.body) : 'null');
    console.log('[handleStripeWebhook] req.body (premiers 200 chars):', JSON.stringify(req.body).substring(0, 200));
  }
  
  // Taille du rawBody si disponible
  if (rawBodyValue) {
    if (Buffer.isBuffer(rawBodyValue)) {
      console.log('[handleStripeWebhook] req.rawBody length (Buffer):', rawBodyValue.length, 'bytes');
      console.log('[handleStripeWebhook] req.rawBody (premiers 200 chars):', rawBodyValue.toString('utf8').substring(0, 200));
    } else if (typeof rawBodyValue === 'string') {
      console.log('[handleStripeWebhook] req.rawBody length (String):', rawBodyValue.length, 'chars');
      console.log('[handleStripeWebhook] req.rawBody (premiers 200 chars):', rawBodyValue.substring(0, 200));
    }
  }
  
  // Vérification des clés Stripe
  console.log('[handleStripeWebhook] 🔑 Vérification clés Stripe:');
  console.log('[handleStripeWebhook] STRIPE_WEBHOOK_SECRET présent:', !!STRIPE_WEBHOOK_SECRET);
  if (STRIPE_WEBHOOK_SECRET) {
    console.log('[handleStripeWebhook] STRIPE_WEBHOOK_SECRET (premiers 10 chars):', STRIPE_WEBHOOK_SECRET.substring(0, 10) + '...');
    console.log('[handleStripeWebhook] STRIPE_WEBHOOK_SECRET longueur:', STRIPE_WEBHOOK_SECRET.length);
  }
  console.log('[handleStripeWebhook] STRIPE_SECRET_KEY présent:', !!STRIPE_SECRET_KEY);
  if (STRIPE_SECRET_KEY) {
    console.log('[handleStripeWebhook] STRIPE_SECRET_KEY (premiers 10 chars):', STRIPE_SECRET_KEY.substring(0, 10) + '...');
    console.log('[handleStripeWebhook] STRIPE_SECRET_KEY longueur:', STRIPE_SECRET_KEY.length);
    console.log('[handleStripeWebhook] STRIPE_SECRET_KEY mode:', STRIPE_SECRET_KEY.startsWith('sk_test_') ? 'TEST' : STRIPE_SECRET_KEY.startsWith('sk_live_') ? 'PRODUCTION' : 'INCONNU');
  }
  
  if (!STRIPE_WEBHOOK_SECRET) {
    console.error('[handleStripeWebhook] ❌ STRIPE_WEBHOOK_SECRET non configuré');
    console.error('[handleStripeWebhook] Request ID:', requestId);
    console.error('[handleStripeWebhook] Status code: 500');
    res.status(500).send('Webhook secret non configuré');
    return;
  }

  if (!STRIPE_SECRET_KEY) {
    console.error('[handleStripeWebhook] ❌ STRIPE_SECRET_KEY non configuré');
    console.error('[handleStripeWebhook] Request ID:', requestId);
    console.error('[handleStripeWebhook] Status code: 500');
    res.status(500).send('Stripe secret key non configuré');
    return;
  }

  console.log('[handleStripeWebhook] ✅ Clés Stripe configurées');
  
  const stripe = require('stripe')(STRIPE_SECRET_KEY);
  const sigHeader = req.headers['stripe-signature'];
  const sig = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;
  console.log('[handleStripeWebhook] 🔐 Signature Stripe:');
  console.log('[handleStripeWebhook] Signature présente:', sig ? 'OUI' : 'NON');
  if (sig) {
    console.log('[handleStripeWebhook] Signature longueur:', sig.length);
    console.log('[handleStripeWebhook] Signature (premiers 50 chars):', sig.substring(0, 50));
  }

  let event;
  try {
    console.log('[handleStripeWebhook] 🔐 DÉBUT Vérification signature webhook...');
    
    // Utiliser req.rawBody si disponible (Firebase Functions), sinon convertir req.body en Buffer/String
    let rawBody: Buffer | string;
    const rawBodyValue = (req as any).rawBody;
    
    if (rawBodyValue) {
      console.log('[handleStripeWebhook] ✅ Utilisation req.rawBody (Firebase Functions)');
      rawBody = rawBodyValue;
    } else if (Buffer.isBuffer(req.body)) {
      console.log('[handleStripeWebhook] ✅ req.body est déjà un Buffer');
      rawBody = req.body;
    } else if (typeof req.body === 'string') {
      console.log('[handleStripeWebhook] ✅ req.body est une String');
      rawBody = req.body;
    } else {
      // Convertir l'objet JSON en string pour la vérification de signature
      console.log('[handleStripeWebhook] ⚠️ req.body est un objet, conversion en string...');
      rawBody = JSON.stringify(req.body);
      console.log('[handleStripeWebhook] ⚠️ ATTENTION: La vérification de signature peut échouer si le body a été modifié par le parsing JSON');
    }
    
    console.log('[handleStripeWebhook] Body passé à constructEvent:');
    console.log('[handleStripeWebhook] - Type:', typeof rawBody);
    console.log('[handleStripeWebhook] - Is Buffer:', Buffer.isBuffer(rawBody));
    console.log('[handleStripeWebhook] - Is String:', typeof rawBody === 'string');
    if (Buffer.isBuffer(rawBody)) {
      console.log('[handleStripeWebhook] - Buffer length:', rawBody.length);
      console.log('[handleStripeWebhook] - Buffer (premiers 100 bytes):', rawBody.toString('utf8').substring(0, 100));
    } else if (typeof rawBody === 'string') {
      console.log('[handleStripeWebhook] - String length:', rawBody.length);
      console.log('[handleStripeWebhook] - String (premiers 100 chars):', rawBody.substring(0, 100));
    }
    console.log('[handleStripeWebhook] Signature passée:', sig ? 'OUI' : 'NON');
    console.log('[handleStripeWebhook] Secret utilisé (premiers 10 chars):', STRIPE_WEBHOOK_SECRET.substring(0, 10) + '...');
    
    // Utiliser rawBody pour la vérification de signature
    event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
    
    console.log('[handleStripeWebhook] ✅✅✅ Signature vérifiée avec succès!');
    console.log('[handleStripeWebhook] Type d\'événement:', event.type);
    console.log('[handleStripeWebhook] ID événement:', event.id);
    console.log('[handleStripeWebhook] Événement créé:', event.created);
    console.log('[handleStripeWebhook] Événement livemode:', event.livemode);
    console.log('[handleStripeWebhook] Événement API version:', event.api_version);
  } catch (err: any) {
    console.error('[handleStripeWebhook] ❌❌❌ ERREUR Vérification signature webhook ❌❌❌');
    console.error('[handleStripeWebhook] Request ID:', requestId);
    console.error('[handleStripeWebhook] Erreur type:', err?.constructor?.name || typeof err);
    console.error('[handleStripeWebhook] Erreur message:', err.message);
    console.error('[handleStripeWebhook] Erreur code:', err.code);
    console.error('[handleStripeWebhook] Erreur stack complète:', err.stack);
    console.error('[handleStripeWebhook] Body au moment de l\'erreur:');
    console.error('[handleStripeWebhook] req.body - Type:', typeof req.body);
    console.error('[handleStripeWebhook] req.body - Is Buffer:', Buffer.isBuffer(req.body));
    console.error('[handleStripeWebhook] req.body - Constructor:', req.body?.constructor?.name);
    const rawBodyValue = (req as any).rawBody;
    console.error('[handleStripeWebhook] req.rawBody présent:', !!rawBodyValue);
    console.error('[handleStripeWebhook] req.rawBody - Type:', typeof rawBodyValue);
    console.error('[handleStripeWebhook] req.rawBody - Is Buffer:', Buffer.isBuffer(rawBodyValue));
    if (Buffer.isBuffer(req.body)) {
      console.error('[handleStripeWebhook] req.body - Buffer length:', req.body.length);
    } else {
      console.error('[handleStripeWebhook] req.body - Value:', JSON.stringify(req.body).substring(0, 500));
    }
    if (rawBodyValue) {
      if (Buffer.isBuffer(rawBodyValue)) {
        console.error('[handleStripeWebhook] req.rawBody - Buffer length:', rawBodyValue.length);
      } else {
        console.error('[handleStripeWebhook] req.rawBody - String length:', rawBodyValue.length);
      }
    }
    console.error('[handleStripeWebhook] Status code: 400');
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  try {
    console.log('[handleStripeWebhook] 🔄 DÉBUT Traitement événement...');
    console.log('[handleStripeWebhook] Événement complet (JSON):', JSON.stringify(event, null, 2));
    console.log('[handleStripeWebhook] Événement type:', event.type);
    console.log('[handleStripeWebhook] Événement ID:', event.id);
    
    switch (event.type) {
      case 'checkout.session.completed': {
        console.log('[handleStripeWebhook] 📦 Événement: checkout.session.completed');
        console.log('[handleStripeWebhook] Request ID:', requestId);
        const session = event.data.object;
        console.log('[handleStripeWebhook] Session complète:', JSON.stringify(session, null, 2));
        console.log('[handleStripeWebhook] Session ID:', session.id);
        console.log('[handleStripeWebhook] Session mode:', session.mode);
        console.log('[handleStripeWebhook] Session payment_status:', session.payment_status);
        console.log('[handleStripeWebhook] Session customer_email:', session.customer_email);
        console.log('[handleStripeWebhook] Session metadata:', JSON.stringify(session.metadata, null, 2));
        console.log('[handleStripeWebhook] Session subscription:', session.subscription);
        console.log('[handleStripeWebhook] Session customer:', session.customer);
        
        const userId = session.metadata?.userId;
        console.log('[handleStripeWebhook] UserId extrait:', userId);
        
        if (!userId) {
          console.error('[handleStripeWebhook] ❌ userId manquant dans metadata');
          console.error('[handleStripeWebhook] Metadata complet:', session.metadata);
          break;
        }

        // Récupérer la subscription depuis Stripe
        const subscriptionId = session.subscription;
        console.log('[handleStripeWebhook] Subscription ID extrait:', subscriptionId);
        
        if (!subscriptionId) {
          console.error('[handleStripeWebhook] ❌❌❌ subscriptionId manquant dans session ❌❌❌');
          console.error('[handleStripeWebhook] Request ID:', requestId);
          console.error('[handleStripeWebhook] Session complète:', JSON.stringify(session, null, 2));
          console.error('[handleStripeWebhook] ⚠️ Arrêt du traitement - subscriptionId requis');
          break;
        }

        console.log('[handleStripeWebhook] 🔍 Récupération subscription depuis Stripe...');
        console.log('[handleStripeWebhook] Subscription ID à récupérer:', subscriptionId);
        let subscription;
        try {
          subscription = await stripe.subscriptions.retrieve(subscriptionId);
          console.log('[handleStripeWebhook] ✅✅✅ Subscription récupérée depuis Stripe avec succès!');
          console.log('[handleStripeWebhook] Subscription complète:', JSON.stringify(subscription, null, 2));
          console.log('[handleStripeWebhook] Subscription ID:', subscription.id);
          console.log('[handleStripeWebhook] Subscription status:', subscription.status);
          console.log('[handleStripeWebhook] Subscription customer:', subscription.customer);
          console.log('[handleStripeWebhook] Subscription current_period_start:', subscription.current_period_start);
          console.log('[handleStripeWebhook] Subscription current_period_end:', subscription.current_period_end);
          console.log('[handleStripeWebhook] Subscription metadata:', JSON.stringify(subscription.metadata, null, 2));
        } catch (stripeError: any) {
          console.error('[handleStripeWebhook] ❌❌❌ ERREUR Récupération subscription depuis Stripe ❌❌❌');
          console.error('[handleStripeWebhook] Request ID:', requestId);
          console.error('[handleStripeWebhook] Subscription ID:', subscriptionId);
          console.error('[handleStripeWebhook] Erreur type:', stripeError?.constructor?.name || typeof stripeError);
          console.error('[handleStripeWebhook] Erreur message:', stripeError.message);
          console.error('[handleStripeWebhook] Erreur code:', stripeError.code);
          console.error('[handleStripeWebhook] Erreur stack:', stripeError.stack);
          throw stripeError; // Re-throw pour être capturé par le catch final
        }
        
        // Mettre à jour la subscription dans Firestore
        const userRef = admin.firestore().doc(`users/${userId}`);
        console.log('[handleStripeWebhook] 📝 PRÉPARATION Données subscription pour Firestore...');
        console.log('[handleStripeWebhook] UserId:', userId);
        console.log('[handleStripeWebhook] Chemin Firestore:', `users/${userId}`);
        
        const subscriptionData = {
          subscription: {
            tier: 'paid',
            status: subscription.status === 'active' ? 'active' : 'past_due',
            subscriptionStartDate: new Date(subscription.current_period_start * 1000).toISOString(),
            subscriptionEndDate: new Date(subscription.current_period_end * 1000).toISOString(),
            stripeCustomerId: subscription.customer,
            stripeSubscriptionId: subscription.id,
            createdAt: new Date().toISOString(),
          },
        };
        
        console.log('[handleStripeWebhook] Données subscription préparées:', JSON.stringify(subscriptionData, null, 2));
        console.log('[handleStripeWebhook] Subscription tier:', subscriptionData.subscription.tier);
        console.log('[handleStripeWebhook] Subscription status:', subscriptionData.subscription.status);
        console.log('[handleStripeWebhook] Subscription startDate:', subscriptionData.subscription.subscriptionStartDate);
        console.log('[handleStripeWebhook] Subscription endDate:', subscriptionData.subscription.subscriptionEndDate);
        console.log('[handleStripeWebhook] Subscription stripeCustomerId:', subscriptionData.subscription.stripeCustomerId);
        console.log('[handleStripeWebhook] Subscription stripeSubscriptionId:', subscriptionData.subscription.stripeSubscriptionId);
        
        // Vérifier si le document existe, sinon créer avec userId
        console.log('[handleStripeWebhook] 🔍 VÉRIFICATION Existence document utilisateur dans Firestore...');
        console.log('[handleStripeWebhook] Chemin Firestore:', `users/${userId}`);
        let userDoc;
        try {
          userDoc = await userRef.get();
          console.log('[handleStripeWebhook] ✅ Requête Firestore get() réussie');
          console.log('[handleStripeWebhook] Document existe:', userDoc.exists);
          if (userDoc.exists) {
            const currentData = userDoc.data();
            console.log('[handleStripeWebhook] Document actuel (complet):', JSON.stringify(currentData, null, 2));
            console.log('[handleStripeWebhook] Clés présentes dans document:', Object.keys(currentData || {}));
            if (currentData?.subscription) {
              console.log('[handleStripeWebhook] Subscription existante:', JSON.stringify(currentData.subscription, null, 2));
            } else {
              console.log('[handleStripeWebhook] ⚠️ Aucune subscription existante dans le document');
            }
          } else {
            console.log('[handleStripeWebhook] ⚠️ Document utilisateur n\'existe pas encore - sera créé');
          }
        } catch (firestoreError: any) {
          console.error('[handleStripeWebhook] ❌❌❌ ERREUR Firestore get() ❌❌❌');
          console.error('[handleStripeWebhook] Request ID:', requestId);
          console.error('[handleStripeWebhook] UserId:', userId);
          console.error('[handleStripeWebhook] Erreur type:', firestoreError?.constructor?.name || typeof firestoreError);
          console.error('[handleStripeWebhook] Erreur message:', firestoreError.message);
          console.error('[handleStripeWebhook] Erreur code:', firestoreError.code);
          console.error('[handleStripeWebhook] Erreur stack:', firestoreError.stack);
          throw firestoreError; // Re-throw pour être capturé par le catch final
        }
        
        // TOUJOURS utiliser set() avec merge: true pour garantir la création ou mise à jour
        const finalData = userDoc.exists 
          ? subscriptionData 
          : {
              userId: userId,
              email: session.customer_email || null,
              createdAt: new Date().toISOString(),
              ...subscriptionData,
            };
        
        console.log('[handleStripeWebhook] 📝 Données finales à écrire dans Firestore:');
        console.log('[handleStripeWebhook] Document existe avant écriture:', userDoc.exists);
        console.log('[handleStripeWebhook] Données complètes:', JSON.stringify(finalData, null, 2));
        console.log('[handleStripeWebhook] 🔧 ÉCRITURE Firestore avec set(..., { merge: true })...');
        console.log('[handleStripeWebhook] Chemin Firestore:', `users/${userId}`);
        
        try {
          await userRef.set(finalData, { merge: true });
          console.log('[handleStripeWebhook] ✅✅✅ Écriture Firestore réussie!');
          console.log(`[handleStripeWebhook] Écriture terminée pour userId: ${userId}`);
        } catch (writeError: any) {
          console.error('[handleStripeWebhook] ❌❌❌ ERREUR Écriture Firestore ❌❌❌');
          console.error('[handleStripeWebhook] Request ID:', requestId);
          console.error('[handleStripeWebhook] UserId:', userId);
          console.error('[handleStripeWebhook] Données tentées:', JSON.stringify(finalData, null, 2));
          console.error('[handleStripeWebhook] Erreur type:', writeError?.constructor?.name || typeof writeError);
          console.error('[handleStripeWebhook] Erreur message:', writeError.message);
          console.error('[handleStripeWebhook] Erreur code:', writeError.code);
          console.error('[handleStripeWebhook] Erreur stack:', writeError.stack);
          throw writeError; // Re-throw pour être capturé par le catch final
        }
        
        // Vérifier que ça a bien été écrit
        console.log('[handleStripeWebhook] 🔍 VÉRIFICATION Écriture Firestore...');
        let verifyDoc;
        try {
          verifyDoc = await userRef.get();
          console.log('[handleStripeWebhook] ✅ Requête Firestore get() (vérification) réussie');
          console.log('[handleStripeWebhook] Document après écriture existe:', verifyDoc.exists);
          if (verifyDoc.exists) {
            const verifyData = verifyDoc.data();
            console.log('[handleStripeWebhook] Document après écriture (complet):', JSON.stringify(verifyData, null, 2));
            console.log('[handleStripeWebhook] Clés présentes après écriture:', Object.keys(verifyData || {}));
            
            // Vérifier spécifiquement la subscription
            if (verifyData?.subscription) {
              console.log('[handleStripeWebhook] ✅✅✅ SUBSCRIPTION TROUVÉE DANS LE DOCUMENT! ✅✅✅');
              console.log('[handleStripeWebhook] Subscription complète:', JSON.stringify(verifyData.subscription, null, 2));
              console.log('[handleStripeWebhook] Subscription tier:', verifyData.subscription.tier);
              console.log('[handleStripeWebhook] Subscription status:', verifyData.subscription.status);
              console.log('[handleStripeWebhook] Subscription startDate:', verifyData.subscription.subscriptionStartDate);
              console.log('[handleStripeWebhook] Subscription endDate:', verifyData.subscription.subscriptionEndDate);
              console.log('[handleStripeWebhook] Subscription stripeCustomerId:', verifyData.subscription.stripeCustomerId);
              console.log('[handleStripeWebhook] Subscription stripeSubscriptionId:', verifyData.subscription.stripeSubscriptionId);
            } else {
              console.error('[handleStripeWebhook] ❌❌❌ SUBSCRIPTION NON TROUVÉE DANS LE DOCUMENT! ❌❌❌');
              console.error('[handleStripeWebhook] Request ID:', requestId);
              console.error('[handleStripeWebhook] UserId:', userId);
              console.error('[handleStripeWebhook] Clés présentes:', Object.keys(verifyData || {}));
              console.error('[handleStripeWebhook] Document complet:', JSON.stringify(verifyData, null, 2));
            }
          } else {
            console.error('[handleStripeWebhook] ❌❌❌ DOCUMENT N\'EXISTE TOUJOURS PAS APRÈS ÉCRITURE! ❌❌❌');
            console.error('[handleStripeWebhook] Request ID:', requestId);
            console.error('[handleStripeWebhook] UserId:', userId);
            console.error('[handleStripeWebhook] Chemin Firestore:', `users/${userId}`);
          }
        } catch (verifyError: any) {
          console.error('[handleStripeWebhook] ❌❌❌ ERREUR Vérification Firestore ❌❌❌');
          console.error('[handleStripeWebhook] Request ID:', requestId);
          console.error('[handleStripeWebhook] UserId:', userId);
          console.error('[handleStripeWebhook] Erreur type:', verifyError?.constructor?.name || typeof verifyError);
          console.error('[handleStripeWebhook] Erreur message:', verifyError.message);
          console.error('[handleStripeWebhook] Erreur code:', verifyError.code);
          console.error('[handleStripeWebhook] Erreur stack:', verifyError.stack);
          // Ne pas throw ici - on continue même si la vérification échoue
        }
        
        console.log(`[handleStripeWebhook] ✅✅✅ Subscription créée/mise à jour pour ${userId} ✅✅✅`);
        console.log('[handleStripeWebhook] Request ID:', requestId);
        break;
      }

      case 'customer.subscription.created': {
        console.log('[handleStripeWebhook] 📦 Événement: customer.subscription.created');
        console.log('[handleStripeWebhook] Request ID:', requestId);
        const subscription = event.data.object;
        console.log('[handleStripeWebhook] Subscription complète:', JSON.stringify(subscription, null, 2));
        console.log('[handleStripeWebhook] Subscription ID:', subscription.id);
        console.log('[handleStripeWebhook] Subscription status:', subscription.status);
        console.log('[handleStripeWebhook] Subscription customer:', subscription.customer);
        console.log('[handleStripeWebhook] Subscription current_period_start:', subscription.current_period_start);
        console.log('[handleStripeWebhook] Subscription current_period_end:', subscription.current_period_end);
        console.log('[handleStripeWebhook] Subscription metadata:', JSON.stringify(subscription.metadata, null, 2));
        
        // Essayer d'obtenir userId depuis metadata ou depuis Firestore via customerId
        let userId = subscription.metadata?.userId;
        console.log('[handleStripeWebhook] 🔍 RECHERCHE userId...');
        console.log('[handleStripeWebhook] userId depuis metadata:', userId || 'NON TROUVÉ');
        
        if (!userId) {
          console.log('[handleStripeWebhook] ⚠️ userId non trouvé dans metadata, recherche par customerId dans Firestore...');
          console.log('[handleStripeWebhook] Customer ID à rechercher:', subscription.customer);
          console.log('[handleStripeWebhook] Requête Firestore: collection("users").where("subscription.stripeCustomerId", "==", customerId)');
          
          let usersSnapshot;
          try {
            usersSnapshot = await admin.firestore()
              .collection('users')
              .where('subscription.stripeCustomerId', '==', subscription.customer)
              .limit(1)
              .get();
            
            console.log('[handleStripeWebhook] ✅ Requête Firestore réussie');
            console.log('[handleStripeWebhook] Nombre de résultats:', usersSnapshot.size);
            
            if (!usersSnapshot.empty) {
              userId = usersSnapshot.docs[0].id;
              console.log('[handleStripeWebhook] ✅✅✅ Utilisateur trouvé par customerId!');
              console.log('[handleStripeWebhook] UserId trouvé:', userId);
              console.log('[handleStripeWebhook] Document utilisateur:', JSON.stringify(usersSnapshot.docs[0].data(), null, 2));
            } else {
              console.error('[handleStripeWebhook] ❌❌❌ Utilisateur non trouvé pour customer ❌❌❌');
              console.error('[handleStripeWebhook] Request ID:', requestId);
              console.error('[handleStripeWebhook] Customer ID:', subscription.customer);
              console.error('[handleStripeWebhook] ⚠️ Impossible de créer l\'abonnement sans userId');
              console.error('[handleStripeWebhook] ⚠️ Arrêt du traitement');
              break;
            }
          } catch (searchError: any) {
            console.error('[handleStripeWebhook] ❌❌❌ ERREUR Recherche utilisateur par customerId ❌❌❌');
            console.error('[handleStripeWebhook] Request ID:', requestId);
            console.error('[handleStripeWebhook] Customer ID:', subscription.customer);
            console.error('[handleStripeWebhook] Erreur type:', searchError?.constructor?.name || typeof searchError);
            console.error('[handleStripeWebhook] Erreur message:', searchError.message);
            console.error('[handleStripeWebhook] Erreur code:', searchError.code);
            console.error('[handleStripeWebhook] Erreur stack:', searchError.stack);
            throw searchError; // Re-throw pour être capturé par le catch final
          }
        } else {
          console.log('[handleStripeWebhook] ✅ userId trouvé dans metadata:', userId);
        }
        
        // Mettre à jour la subscription dans Firestore (même logique que checkout.session.completed)
        const userRef = admin.firestore().doc(`users/${userId}`);
        console.log('[handleStripeWebhook] 📝 PRÉPARATION Données subscription pour Firestore...');
        console.log('[handleStripeWebhook] UserId:', userId);
        console.log('[handleStripeWebhook] Chemin Firestore:', `users/${userId}`);
        
        const subscriptionData = {
          subscription: {
            tier: 'paid',
            status: subscription.status === 'active' ? 'active' : 'past_due',
            subscriptionStartDate: new Date(subscription.current_period_start * 1000).toISOString(),
            subscriptionEndDate: new Date(subscription.current_period_end * 1000).toISOString(),
            stripeCustomerId: subscription.customer,
            stripeSubscriptionId: subscription.id,
            createdAt: new Date().toISOString(),
          },
        };
        
        console.log('[handleStripeWebhook] Données subscription préparées:', JSON.stringify(subscriptionData, null, 2));
        console.log('[handleStripeWebhook] Subscription tier:', subscriptionData.subscription.tier);
        console.log('[handleStripeWebhook] Subscription status:', subscriptionData.subscription.status);
        console.log('[handleStripeWebhook] Subscription startDate:', subscriptionData.subscription.subscriptionStartDate);
        console.log('[handleStripeWebhook] Subscription endDate:', subscriptionData.subscription.subscriptionEndDate);
        
        console.log('[handleStripeWebhook] 🔍 VÉRIFICATION Existence document utilisateur...');
        let userDoc;
        try {
          userDoc = await userRef.get();
          console.log('[handleStripeWebhook] ✅ Requête Firestore get() réussie');
          console.log('[handleStripeWebhook] Document existe:', userDoc.exists);
          if (userDoc.exists) {
            const currentData = userDoc.data();
            console.log('[handleStripeWebhook] Document actuel:', JSON.stringify(currentData, null, 2));
          }
        } catch (getError: any) {
          console.error('[handleStripeWebhook] ❌❌❌ ERREUR Firestore get() ❌❌❌');
          console.error('[handleStripeWebhook] Request ID:', requestId);
          console.error('[handleStripeWebhook] Erreur type:', getError?.constructor?.name || typeof getError);
          console.error('[handleStripeWebhook] Erreur message:', getError.message);
          console.error('[handleStripeWebhook] Erreur stack:', getError.stack);
          throw getError;
        }
        
        const finalData = userDoc.exists 
          ? subscriptionData 
          : {
              userId: userId,
              createdAt: new Date().toISOString(),
              ...subscriptionData,
            };
        
        console.log('[handleStripeWebhook] 📝 Données finales à écrire:', JSON.stringify(finalData, null, 2));
        console.log('[handleStripeWebhook] 🔧 ÉCRITURE Firestore avec set(..., { merge: true })...');
        
        try {
          await userRef.set(finalData, { merge: true });
          console.log('[handleStripeWebhook] ✅✅✅ Écriture Firestore réussie!');
        } catch (writeError: any) {
          console.error('[handleStripeWebhook] ❌❌❌ ERREUR Écriture Firestore ❌❌❌');
          console.error('[handleStripeWebhook] Request ID:', requestId);
          console.error('[handleStripeWebhook] Erreur type:', writeError?.constructor?.name || typeof writeError);
          console.error('[handleStripeWebhook] Erreur message:', writeError.message);
          console.error('[handleStripeWebhook] Erreur stack:', writeError.stack);
          throw writeError;
        }
        
        // Vérification
        console.log('[handleStripeWebhook] 🔍 VÉRIFICATION Écriture...');
        try {
          const verifyDoc = await userRef.get();
          if (verifyDoc.exists) {
            const verifyData = verifyDoc.data();
            if (verifyData?.subscription) {
              console.log('[handleStripeWebhook] ✅✅✅ SUBSCRIPTION TROUVÉE DANS LE DOCUMENT! ✅✅✅');
              console.log('[handleStripeWebhook] Subscription:', JSON.stringify(verifyData.subscription, null, 2));
            } else {
              console.error('[handleStripeWebhook] ❌❌❌ SUBSCRIPTION NON TROUVÉE DANS LE DOCUMENT! ❌❌❌');
            }
          }
        } catch (verifyError: any) {
          console.error('[handleStripeWebhook] ❌ ERREUR Vérification:', verifyError.message);
        }
        
        console.log(`[handleStripeWebhook] ✅✅✅ Subscription créée/mise à jour pour ${userId} via customer.subscription.created ✅✅✅`);
        console.log('[handleStripeWebhook] Request ID:', requestId);
        break;
      }

      case 'customer.subscription.updated': {
        console.log('[handleStripeWebhook] 📦 Événement: customer.subscription.updated');
        console.log('[handleStripeWebhook] Request ID:', requestId);
        const subscription = event.data.object;
        console.log('[handleStripeWebhook] Subscription complète:', JSON.stringify(subscription, null, 2));
        console.log('[handleStripeWebhook] Subscription ID:', subscription.id);
        console.log('[handleStripeWebhook] Subscription status:', subscription.status);
        const customerId = subscription.customer;
        console.log('[handleStripeWebhook] Customer ID:', customerId);
        
        console.log('[handleStripeWebhook] 🔍 RECHERCHE Utilisateur par customerId...');
        let usersSnapshot;
        try {
          usersSnapshot = await admin.firestore()
            .collection('users')
            .where('subscription.stripeCustomerId', '==', customerId)
            .limit(1)
            .get();
          
          console.log('[handleStripeWebhook] ✅ Requête Firestore réussie');
          console.log('[handleStripeWebhook] Nombre de résultats:', usersSnapshot.size);
        } catch (searchError: any) {
          console.error('[handleStripeWebhook] ❌❌❌ ERREUR Recherche utilisateur ❌❌❌');
          console.error('[handleStripeWebhook] Request ID:', requestId);
          console.error('[handleStripeWebhook] Erreur type:', searchError?.constructor?.name || typeof searchError);
          console.error('[handleStripeWebhook] Erreur message:', searchError.message);
          console.error('[handleStripeWebhook] Erreur stack:', searchError.stack);
          throw searchError;
        }

        if (usersSnapshot.empty) {
          console.error('[handleStripeWebhook] ❌❌❌ Utilisateur non trouvé pour customer ❌❌❌');
          console.error('[handleStripeWebhook] Request ID:', requestId);
          console.error('[handleStripeWebhook] Customer ID:', customerId);
          break;
        }

        const userDoc = usersSnapshot.docs[0];
        console.log('[handleStripeWebhook] ✅ Utilisateur trouvé:', userDoc.id);
        console.log('[handleStripeWebhook] Document utilisateur:', JSON.stringify(userDoc.data(), null, 2));
        
        const subscriptionData = {
          status: subscription.status === 'active' ? 'active' : 'past_due',
          subscriptionEndDate: new Date(subscription.current_period_end * 1000).toISOString(),
        };
        
        console.log('[handleStripeWebhook] 📝 Données à mettre à jour:', JSON.stringify(subscriptionData, null, 2));
        console.log('[handleStripeWebhook] 🔧 MISE À JOUR Firestore avec update()...');
        
        try {
          await userDoc.ref.update({
            'subscription.status': subscriptionData.status,
            'subscription.subscriptionEndDate': subscriptionData.subscriptionEndDate,
          });
          console.log('[handleStripeWebhook] ✅✅✅ Mise à jour Firestore réussie!');
          console.log(`[handleStripeWebhook] ✅ Subscription mise à jour pour ${userDoc.id}`);
        } catch (updateError: any) {
          console.error('[handleStripeWebhook] ❌❌❌ ERREUR Mise à jour Firestore ❌❌❌');
          console.error('[handleStripeWebhook] Request ID:', requestId);
          console.error('[handleStripeWebhook] UserId:', userDoc.id);
          console.error('[handleStripeWebhook] Erreur type:', updateError?.constructor?.name || typeof updateError);
          console.error('[handleStripeWebhook] Erreur message:', updateError.message);
          console.error('[handleStripeWebhook] Erreur stack:', updateError.stack);
          throw updateError;
        }
        
        console.log('[handleStripeWebhook] Request ID:', requestId);
        break;
      }

      case 'customer.subscription.deleted': {
        console.log('[handleStripeWebhook] 📦 Événement: customer.subscription.deleted');
        console.log('[handleStripeWebhook] Request ID:', requestId);
        const subscription = event.data.object;
        console.log('[handleStripeWebhook] Subscription complète:', JSON.stringify(subscription, null, 2));
        const customerId = subscription.customer;
        console.log('[handleStripeWebhook] Customer ID:', customerId);
        
        console.log('[handleStripeWebhook] 🔍 RECHERCHE Utilisateur par customerId...');
        let usersSnapshot;
        try {
          usersSnapshot = await admin.firestore()
            .collection('users')
            .where('subscription.stripeCustomerId', '==', customerId)
            .limit(1)
            .get();
          
          console.log('[handleStripeWebhook] ✅ Requête Firestore réussie');
          console.log('[handleStripeWebhook] Nombre de résultats:', usersSnapshot.size);
        } catch (searchError: any) {
          console.error('[handleStripeWebhook] ❌❌❌ ERREUR Recherche utilisateur ❌❌❌');
          console.error('[handleStripeWebhook] Request ID:', requestId);
          console.error('[handleStripeWebhook] Erreur type:', searchError?.constructor?.name || typeof searchError);
          console.error('[handleStripeWebhook] Erreur message:', searchError.message);
          console.error('[handleStripeWebhook] Erreur stack:', searchError.stack);
          throw searchError;
        }

        if (usersSnapshot.empty) {
          console.error('[handleStripeWebhook] ❌❌❌ Utilisateur non trouvé pour customer ❌❌❌');
          console.error('[handleStripeWebhook] Request ID:', requestId);
          console.error('[handleStripeWebhook] Customer ID:', customerId);
          break;
        }

        const userDoc = usersSnapshot.docs[0];
        console.log('[handleStripeWebhook] ✅ Utilisateur trouvé:', userDoc.id);
        console.log('[handleStripeWebhook] 🔧 MISE À JOUR Firestore pour annuler subscription...');
        
        try {
          await userDoc.ref.update({
            'subscription.status': 'canceled',
            'subscription.tier': 'expired',
          });
          console.log('[handleStripeWebhook] ✅✅✅ Mise à jour Firestore réussie!');
          console.log(`[handleStripeWebhook] ✅ Subscription annulée pour ${userDoc.id}`);
        } catch (updateError: any) {
          console.error('[handleStripeWebhook] ❌❌❌ ERREUR Mise à jour Firestore ❌❌❌');
          console.error('[handleStripeWebhook] Request ID:', requestId);
          console.error('[handleStripeWebhook] UserId:', userDoc.id);
          console.error('[handleStripeWebhook] Erreur type:', updateError?.constructor?.name || typeof updateError);
          console.error('[handleStripeWebhook] Erreur message:', updateError.message);
          console.error('[handleStripeWebhook] Erreur stack:', updateError.stack);
          throw updateError;
        }
        
        console.log('[handleStripeWebhook] Request ID:', requestId);
        break;
      }

      default:
        console.log(`[handleStripeWebhook] ⚠️ Événement non géré: ${event.type}`);
        console.log('[handleStripeWebhook] Request ID:', requestId);
        console.log('[handleStripeWebhook] Événement complet:', JSON.stringify(event, null, 2));
    }

    console.log('[handleStripeWebhook] ✅✅✅ Traitement événement terminé avec succès ✅✅✅');
    console.log('[handleStripeWebhook] Request ID:', requestId);
    console.log('[handleStripeWebhook] 📤 ENVOI Réponse HTTP 200...');
    const responseBody = { received: true, requestId: requestId };
    console.log('[handleStripeWebhook] Response body:', JSON.stringify(responseBody, null, 2));
    res.json(responseBody);
    console.log('[handleStripeWebhook] ✅ Réponse HTTP envoyée avec succès');
    console.log('[handleStripeWebhook] Status code: 200');
  } catch (error: any) {
    console.error('[handleStripeWebhook] ❌❌❌ ERREUR CRITIQUE Traitement webhook ❌❌❌');
    console.error('[handleStripeWebhook] Request ID:', requestId);
    console.error('[handleStripeWebhook] Erreur type:', error?.constructor?.name || typeof error);
    console.error('[handleStripeWebhook] Erreur message:', error.message);
    console.error('[handleStripeWebhook] Erreur code:', error.code);
    console.error('[handleStripeWebhook] Erreur name:', error.name);
    console.error('[handleStripeWebhook] Erreur stack complète:', error.stack);
    console.error('[handleStripeWebhook] Erreur complète (JSON):', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    console.error('[handleStripeWebhook] 📤 ENVOI Réponse HTTP 500...');
    console.error('[handleStripeWebhook] Status code: 500');
    res.status(500).send('Erreur traitement webhook');
    console.error('[handleStripeWebhook] ✅ Réponse HTTP 500 envoyée');
  }
});

/**
 * Créer manuellement un abonnement pour un utilisateur (pour tests/debug)
 * Cette fonction permet de créer un abonnement dans Firestore si le webhook n'a pas fonctionné
 * Seuls les admins peuvent l'exécuter
 */
export const createSubscriptionManually = functions.https.onCall(async (data, context) => {
  console.log('[createSubscriptionManually] Nouvelle requête');
  
  // Vérifier que l'utilisateur est authentifié
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'L\'utilisateur doit être authentifié'
    );
  }

  const adminUserId = context.auth.uid;
  const userDoc = await admin.firestore().collection('users').doc(adminUserId).get();
  const userData = userDoc.data();
  if (!userDoc.exists || !userData?.isAdmin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Seuls les admins peuvent créer des abonnements manuellement'
    );
  }

  const { userId, subscriptionId } = data;
  
  if (!userId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'userId est requis'
    );
  }

  if (!STRIPE_SECRET_KEY) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Stripe n\'est pas configuré'
    );
  }

  try {
    const stripe = require('stripe')(STRIPE_SECRET_KEY);
    
    // Si subscriptionId est fourni, récupérer depuis Stripe
    let subscription;
    if (subscriptionId) {
      subscription = await stripe.subscriptions.retrieve(subscriptionId);
    } else {
      // Sinon, chercher la dernière subscription pour cet utilisateur
      // On va chercher par email ou créer une subscription de test
      throw new functions.https.HttpsError(
        'invalid-argument',
        'subscriptionId est requis pour créer un abonnement manuellement'
      );
    }

    // Mettre à jour la subscription dans Firestore
    // Utiliser set() avec merge: true pour créer le document s'il n'existe pas
    const userRef = admin.firestore().doc(`users/${userId}`);
    const subscriptionData = {
      subscription: {
        tier: 'paid',
        status: subscription.status === 'active' ? 'active' : 'past_due',
        subscriptionStartDate: new Date(subscription.current_period_start * 1000).toISOString(),
        subscriptionEndDate: new Date(subscription.current_period_end * 1000).toISOString(),
        stripeCustomerId: subscription.customer,
        stripeSubscriptionId: subscription.id,
        createdAt: new Date().toISOString(),
      },
    };
    
    // Vérifier si le document existe, sinon créer avec userId
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      console.log(`[createSubscriptionManually] ⚠️ Document utilisateur n'existe pas, création...`);
      await userRef.set({
        userId: userId,
        ...subscriptionData,
      });
    } else {
      await userRef.update(subscriptionData);
    }
    console.log(`[createSubscriptionManually] ✅ Subscription créée manuellement pour ${userId}`);
    
    return { 
      success: true, 
      subscription: subscriptionData 
    };
  } catch (error: any) {
    console.error('[createSubscriptionManually] ❌ Erreur:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Erreur lors de la création de l\'abonnement: ' + error.message
    );
  }
});

/**
 * Migrer les userRank pour tous les utilisateurs existants
 * Cette fonction doit être appelée manuellement via Firebase Console ou CLI
 * Seuls les admins peuvent l'exécuter
 */
export const migrateUserRanks = functions.https.onCall(async (data, context) => {
  console.log('[migrateUserRanks] Démarrage migration...');

  // Vérifier que l'utilisateur est authentifié
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'L\'utilisateur doit être authentifié'
    );
  }

  const userId = context.auth.uid;
  const userDoc = await admin.firestore().collection('users').doc(userId).get();
  const userData = userDoc.data();
  if (!userDoc.exists || !userData?.isAdmin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Seuls les admins peuvent exécuter cette migration'
    );
  }

  try {
    const usersRef = admin.firestore().collection('users');
    const usersSnapshot = await usersRef.orderBy('createdAt', 'asc').get();

    console.log(`[migrateUserRanks] ${usersSnapshot.docs.length} utilisateurs trouvés`);

    let rank = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const userDoc of usersSnapshot.docs) {
      rank++;
      const userId = userDoc.id;
      const userData = userDoc.data();

      // Vérifier si userRank existe déjà
      if (userData.userRank && typeof userData.userRank === 'number') {
        skipped++;
        continue;
      }

      // Vérifier si createdAt existe
      if (!userData.createdAt) {
        skipped++;
        continue;
      }

      try {
        // Mettre à jour le profil avec le rank
        await admin.firestore().collection('users').doc(userId).update({ userRank: rank });
        updated++;
        console.log(`[migrateUserRanks] ✅ Utilisateur ${userId}: userRank = ${rank}`);
      } catch (error: any) {
        console.error(`[migrateUserRanks] ❌ Erreur pour utilisateur ${userId}:`, error);
        errors++;
      }
    }

    const result = {
      total: usersSnapshot.docs.length,
      updated,
      skipped,
      errors,
    };

    console.log(`[migrateUserRanks] ✅ Migration terminée:`, result);
    return result;
  } catch (error: any) {
    console.error('[migrateUserRanks] ❌ Erreur générale:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Erreur lors de la migration: ' + error.message
    );
  }
});
