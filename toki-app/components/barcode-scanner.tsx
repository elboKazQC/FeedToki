// Composant de scan de code-barres
// Utilise expo-camera pour scanner les codes-barres de produits
// Fallback photo + ZXing pour iPhone Safari web (scan live non supporté)

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, TextInput, ActivityIndicator, Image, ScrollView, Modal } from 'react-native';
import { CameraView, Camera, BarcodeScanningResult } from 'expo-camera';
import { decodeBarcodeFromDataUrl, isIOSSafari } from '../lib/barcode-decode-web';
import { decodeBarcodeUnified, getRecommendedStrategy, isMethodAvailable, type DecoderConfig } from '../lib/barcode-decoder-wrapper';
import { extractBarcodeWithOpenAI } from '../lib/openai-parser';
import { useAuth } from '../lib/auth-context';
import { logger } from '../lib/logger';
import { userLogger, flushLogsNow } from '../lib/user-logger';
import { trackEvent } from '../lib/analytics';

type BarcodeScannerProps = {
  onBarcodeScanned: (barcode: string) => void;
  onClose: () => void;
};

export function BarcodeScanner({ onBarcodeScanned, onClose }: BarcodeScannerProps) {
  const { user: authUser, profile: authProfile } = useAuth();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  
  // États pour le mode photo (fallback iPhone Safari)
  const [isDecoding, setIsDecoding] = useState(false);
  const [decodingError, setDecodingError] = useState<string | null>(null);
  const [usePhotoMode, setUsePhotoMode] = useState(false);
  const [decodingStatus, setDecodingStatus] = useState<string>(''); // Status: 'cloud', 'local', 'openai', ''
  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | null>(null); // URI de la photo capturée pour aperçu
  const [showPhotoPreview, setShowPhotoPreview] = useState(false); // Afficher l'aperçu de la photo
  const cameraRef = useRef<CameraView>(null);
  
  // Mode debug
  const [debugMode, setDebugMode] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [capturedPhotoData, setCapturedPhotoData] = useState<string | null>(null); // Base64 pour debug
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [debugInfo, setDebugInfo] = useState<{
    userAgent?: string;
    isIOSSafari?: boolean;
    imageWidth?: number;
    imageHeight?: number;
    base64Size?: number;
    canvasWidth?: number;
    canvasHeight?: number;
    exifOrientation?: number;
    cloudVisionResult?: { success: boolean; code?: string; barcode?: string };
    quaggaResult?: { success: boolean; barcode?: string };
    zxingResult?: { success: boolean; barcode?: string };
  }>({});
  const [blurScore, setBlurScore] = useState<number | null>(null);
  const [isBlurCheckActive, setIsBlurCheckActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(`[DEBUG] ${message}`);
  };

  // Calculer le score de netteté (variance du Laplacian)
  // Score 0-100, > 50 = net, < 30 = flou
  const calculateBlurScore = (imageData: ImageData): number => {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    
    if (width < 3 || height < 3) {
      // Image trop petite pour calculer la netteté
      return 50; // Score neutre
    }
    
    let sum = 0;
    let sumSquared = 0;
    let count = 0;

    // Kernel Laplacian pour détecter les bords
    const laplacianKernel = [0, -1, 0, -1, 4, -1, 0, -1, 0];
    
    // Échantillonner tous les 2 pixels pour performance (sauf si image très petite)
    const step = width > 200 ? 2 : 1;
    
    for (let y = 1; y < height - 1; y += step) {
      for (let x = 1; x < width - 1; x += step) {
        let laplacian = 0;
        
        // Appliquer le kernel Laplacian
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4;
            const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
            const kernelIdx = (ky + 1) * 3 + (kx + 1);
            laplacian += gray * laplacianKernel[kernelIdx];
          }
        }
        
        // Utiliser la valeur absolue pour éviter les annulations
        const absLaplacian = Math.abs(laplacian);
        sum += absLaplacian;
        sumSquared += absLaplacian * absLaplacian;
        count++;
      }
    }
    
    if (count === 0) {
      return 50; // Score neutre si aucun pixel analysé
    }
    
    // Variance du Laplacian (utiliser valeur absolue)
    const mean = sum / count;
    const variance = (sumSquared / count) - (mean * mean);
    
    // Normaliser en score 0-100
    // Variance typique: 0-5000 pour images très nettes, 0-500 pour images floues
    // Ajuster le scaling pour donner des scores plus réalistes
    // Utiliser une échelle logarithmique pour mieux distinguer les images nettes
    const normalizedVariance = Math.max(0, variance);
    
    // Échelle logarithmique: log10(variance + 1) pour éviter log(0)
    // Variance de 1000+ = image nette (score > 50)
    // Variance de 100-1000 = image moyenne (score 20-50)
    // Variance < 100 = image floue (score < 20)
    const logVariance = Math.log10(normalizedVariance + 1);
    const score = Math.min(100, Math.max(0, (logVariance / 2) * 100)); // log10(1000) ≈ 3, donc 3/2 * 100 = 150, mais on limite à 100
    
    const finalScore = Math.round(score);
    
    if (debugMode) {
      console.log('[BarcodeScanner] Calcul netteté détaillé:', {
        variance: normalizedVariance.toFixed(2),
        logVariance: logVariance.toFixed(2),
        score: finalScore,
      });
    }
    
    return finalScore;
  };

  // Vérifier la netteté d'une image
  const checkImageSharpness = async (dataUrl: string): Promise<number> => {
    try {
      if (typeof window === 'undefined' || typeof document === 'undefined') {
        // Not running in a browser environment — return neutral score
        return 50;
      }

      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new (window as any).Image();
        image.onload = () => resolve(image as HTMLImageElement);
        image.onerror = reject;
        image.src = dataUrl;
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return 0;

      // Redimensionner pour performance (max 400px)
      const maxSize = 400;
      let width = img.width;
      let height = img.height;
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height);
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;
      
      // S'assurer que l'image est bien dessinée avant de lire les données
      ctx.drawImage(img, 0, 0, width, height);
      
      // Attendre un peu pour que le canvas soit prêt
      await new Promise(resolve => setTimeout(resolve, 10));

      const imageData = ctx.getImageData(0, 0, width, height);
      const score = calculateBlurScore(imageData);
      
      if (debugMode) {
        console.log('[BarcodeScanner] Calcul netteté:', {
          imageSize: `${img.width}x${img.height}`,
          canvasSize: `${width}x${height}`,
          score,
        });
      }
      
      return score;
    } catch (error: any) {
      logger.warn('[BarcodeScanner] Erreur calcul netteté:', error?.message);
      if (debugMode) {
        console.error('[BarcodeScanner] Détails erreur netteté:', error);
      }
      return 50; // Score neutre au lieu de 0
    }
  };
  
  // Récupérer les infos utilisateur pour OpenAI
  const currentUserId = authProfile?.userId || (authUser as any)?.uid || (authUser as any)?.id || 'guest';
  const userEmailVerified = (authUser as any)?.emailVerified || false;

  useEffect(() => {
    (async () => {
      // Toujours utiliser le mode photo natif (plus fiable sur tous les appareils)
      // Le mode live ne fonctionne pas bien sur iPhone Safari et peut être instable
      logger.info('[BarcodeScanner] Mode photo natif activé (recommandé)');
      setUsePhotoMode(true);
      
      // Demander la permission caméra quand même (pour le fallback)
      try {
        const { status } = await Camera.requestCameraPermissionsAsync();
        setHasPermission(status === 'granted');
      } catch (error) {
        // Sur web, la permission peut ne pas être disponible
        logger.warn('[BarcodeScanner] Permission caméra non disponible (normal sur web)');
      }
      
      // Initialiser les infos de debug
      if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
        setDebugInfo({
          userAgent: navigator.userAgent,
          isIOSSafari: isIOSSafari(),
        });
      }
    })();
  }, []);
  
  // Mécanisme de sécurité: réinitialiser isDecoding après 25 secondes maximum
  // Évite que le scanner reste bloqué indéfiniment (timeout de décodage = 20s, donc 25s laisse une marge)
  useEffect(() => {
    if (!isDecoding) return;
    
    const safetyTimeout = setTimeout(() => {
      logger.warn('[BarcodeScanner] ⚠️ Mécanisme de sécurité: isDecoding bloqué depuis 25s, réinitialisation forcée');
      setIsDecoding(false);
      setDecodingStatus('');
      setDecodingError('Le décodage a pris trop de temps. Réessayez ou entrez le code manuellement.');
      
      // Logger l'incident dans Firebase
      if (currentUserId !== 'guest') {
        userLogger.warn(
          currentUserId,
          'Scanner bloqué pendant 25s, réinitialisation forcée',
          'barcode-scanner',
          { action: 'safety_timeout', userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined }
        ).then(() => {
          flushLogsNow().catch(err => console.warn('[BarcodeScanner] Erreur flush logs:', err));
        }).catch(err => console.warn('[BarcodeScanner] Erreur logging Firebase:', err));
      }
    }, 25000); // 25 secondes maximum (timeout décodage = 20s, marge de 5s)
    
    return () => {
      clearTimeout(safetyTimeout);
    };
  }, [isDecoding, currentUserId]);

  const handleBarCodeScanned = ({ type, data }: BarcodeScanningResult) => {
    if (scanned) return;
    
    setScanned(true);
    onBarcodeScanned(data);
  };

  const handleManualSubmit = () => {
    if (manualBarcode.trim().length === 0) return;
    setScanned(true);
    onBarcodeScanned(manualBarcode.trim());
  };

  // Fallback natif iPhone Safari : utiliser <input type="file"> pour une vraie photo caméra
  const handleNativePhotoCapture = () => {
    if (Platform.OS === 'web' && isIOSSafari() && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleNativeFileSelected = async (event: any) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsDecoding(true);
      setDecodingError(null);
      if (debugMode) {
        setDebugLogs([]);
        addDebugLog('📷 Photo sélectionnée via input natif (iPhone Safari)');
      }
      logger.info('[BarcodeScanner] Photo sélectionnée via input natif');

      // Lire le fichier en base64
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      if (debugMode) {
        setCapturedPhotoData(dataUrl);
        addDebugLog(`Photo chargée: ${file.size} bytes, type: ${file.type}`);
      }

      // Afficher l'aperçu
      setCapturedPhotoUri(dataUrl);
      setShowPhotoPreview(true);
      await new Promise(resolve => setTimeout(resolve, 500));

      // Décoder avec le pipeline existant
      if (debugMode) addDebugLog('Décodage en cours (Cloud API → QuaggaJS → ZXing)...');
      setDecodingStatus('cloud');
      const decodePromise = decodeBarcodeFromDataUrl(dataUrl).then((barcode) => {
        setDecodingStatus('');
        return barcode;
      });
      const timeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => {
          setDecodingStatus('');
          resolve(null);
        }, 15000);
      });

      const barcode = await Promise.race([decodePromise, timeoutPromise]);

      if (barcode) {
        if (debugMode) addDebugLog(`✅ Code-barres décodé avec succès: ${barcode}`);
        logger.info('[BarcodeScanner] ✅ Code-barres décodé (mode natif)', { barcode });
        setShowPhotoPreview(false);
        setCapturedPhotoUri(null);
        setScanned(true);
        onBarcodeScanned(barcode);
        return;
      }

      // Si échec, essayer OpenAI Vision
      if (debugMode) addDebugLog('Tentative finale avec OpenAI Vision...');
      setDecodingStatus('openai');
      const base64Data = dataUrl.replace(/^data:image\/[a-z]+;base64,/, '');
      const openaiBarcode = await extractBarcodeWithOpenAI(
        base64Data,
        currentUserId !== 'guest' ? currentUserId : undefined,
        userEmailVerified
      );

      if (openaiBarcode) {
        if (debugMode) addDebugLog(`✅ Code-barres extrait avec OpenAI: ${openaiBarcode}`);
        logger.info('[BarcodeScanner] ✅ Code-barres extrait avec OpenAI Vision (mode natif)', { barcode: openaiBarcode });
        setShowPhotoPreview(false);
        setCapturedPhotoUri(null);
        setScanned(true);
        onBarcodeScanned(openaiBarcode);
        return;
      }

      // Échec total
      if (debugMode) addDebugLog('❌ Détection automatique échouée');
      logger.warn('[BarcodeScanner] ❌ Détection automatique échouée (mode natif)');
      setShowPhotoPreview(false);
      setCapturedPhotoUri(null);
      setShowManualInput(true);
    } catch (error: any) {
      if (debugMode) addDebugLog(`Erreur: ${error?.message || String(error)}`);
      logger.error('[BarcodeScanner] Erreur mode natif:', error);
      setDecodingError('Erreur lors du traitement de la photo. Réessayez ou entrez le code manuellement.');
      setShowManualInput(true);
    } finally {
      setIsDecoding(false);
      setDecodingStatus('');
      // Réinitialiser l'input pour permettre une nouvelle sélection
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Mode photo: capturer une image et la décoder avec plusieurs tentatives
  const handleTakePhoto = async () => {
    if (!cameraRef.current || isDecoding) return;
    
    const scanStartTime = Date.now();
    
    try {
      setIsDecoding(true);
      setDecodingError(null);
      if (debugMode) {
        setDebugLogs([]);
        addDebugLog('Démarrage capture avec tentatives multiples...');
      }
      
      logger.info('[BarcodeScanner] 📸 Démarrage capture avec tentatives multiples...');
      
      // Logger le début du scan dans Firebase
      if (currentUserId !== 'guest') {
        userLogger.info(
          currentUserId,
          'Démarrage scan code-barres',
          'barcode-scanner',
          { action: 'scan_started', timestamp: new Date().toISOString() }
        ).catch(err => console.warn('[BarcodeScanner] Erreur logging Firebase:', err));
      }
      
      // Prendre 3 photos en rafale pour maximiser les chances de succès
      const maxAttempts = 3;
      let lastError: string | null = null;
      
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          if (debugMode) addDebugLog(`Tentative ${attempt}/${maxAttempts}...`);
          logger.info(`[BarcodeScanner] Tentative ${attempt}/${maxAttempts}...`);
          
          // Délai de stabilisation pour éviter le flou de mouvement
          if (attempt > 1) {
            if (debugMode) addDebugLog('Attente stabilisation (500ms)...');
            logger.info('[BarcodeScanner] Attente stabilisation (500ms)...');
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          
          // Amélioration qualité: quality 1.0 (maximum) pour meilleure détection
          if (debugMode) addDebugLog(`📸 Capture photo ${attempt}/${maxAttempts} (qualité maximale)...`);
          logger.info(`[BarcodeScanner] Capture photo ${attempt}/${maxAttempts} (qualité maximale)...`);
          
          const captureStartTime = Date.now();
          logger.info(`[BarcodeScanner] 📷 Début capture photo ${attempt}...`);
          const photo = await cameraRef.current.takePictureAsync({
            base64: true,
            quality: 1.0, // Qualité maximale pour meilleure détection
            skipProcessing: false, // Laisser le traitement natif (améliore la netteté)
            exif: false, // Pas besoin d'EXIF pour le décodage
          });
          const captureDuration = Date.now() - captureStartTime;
          
          logger.info(`[BarcodeScanner] ✅ Photo capturée en ${captureDuration}ms`, {
            width: photo?.width,
            height: photo?.height,
            base64Size: photo?.base64?.length || 0,
            attempt
          });
          
          if (debugMode) {
            addDebugLog(`⏱️ Capture terminée en ${captureDuration}ms`);
          }
          
          if (!photo || !photo.base64) {
            logger.error('[BarcodeScanner] ❌ Photo non capturée ou base64 manquant');
            throw new Error('Photo non capturée ou base64 manquant');
          }
          
          // Déduire un alias non-nullable pour simplifier le reste du code
          const p = photo as { width: number; height: number; base64: string; uri?: string };

          // Mode debug: sauvegarder la photo capturée et infos détaillées
          const base64SizeKB = Math.round(p.base64.length / 1024);
          const base64SizeMB = (base64SizeKB / 1024).toFixed(2);
          if (debugMode) {
            setCapturedPhotoData(`data:image/jpeg;base64,${p.base64}`);
            addDebugLog(`Photo capturée: ${p.width}x${p.height}`);
            addDebugLog(`Taille base64: ${base64SizeKB} KB (${base64SizeMB} MB)`);
            setDebugInfo(prev => ({
              ...prev,
              imageWidth: p.width,
              imageHeight: p.height,
              base64Size: p.base64.length,
            }));
          }
          
          // Afficher l'aperçu de la photo
          setCapturedPhotoUri(p.uri ?? null);
          setShowPhotoPreview(true);
          
          // Logger la capture réussie
          if (currentUserId !== 'guest') {
            userLogger.debug(
              currentUserId,
              `Photo capturée avec succès (tentative ${attempt})`,
              'barcode-scanner',
              { attempt, width: p.width, height: p.height, base64Size: p.base64.length, captureDuration }
            ).catch(() => {}); // Ignorer les erreurs de logging debug
          }
          
      // Vérifier la netteté de l'image (en arrière-plan pour ne pas bloquer)
      setIsBlurCheckActive(true);
      const dataUrl = `data:image/jpeg;base64,${p.base64}`;
      checkImageSharpness(dataUrl).then((sharpness) => {
        setBlurScore(sharpness);
        setIsBlurCheckActive(false);
        if (debugMode) {
          addDebugLog(`Score de netteté: ${sharpness}/100 ${sharpness >= 30 ? '✅' : '❌'}`);
        }
        // Si image trop floue (< 30), avertir mais continuer quand même
        if (sharpness < 30) {
          if (debugMode) addDebugLog('⚠️ Image floue détectée, décodage peut échouer');
          logger.warn('[BarcodeScanner] Image floue détectée (score:', sharpness, ')');
        }
      }).catch((error) => {
        setIsBlurCheckActive(false);
        setBlurScore(null);
        if (debugMode) {
          addDebugLog(`Erreur calcul netteté: ${error?.message || String(error)}`);
        }
      });
          
          // Attendre un peu pour voir l'aperçu
          await new Promise(resolve => setTimeout(resolve, 500));
          
          if (debugMode) {
            addDebugLog('🔍 Démarrage décodage (Cloud API → QuaggaJS → ZXing)...');
            addDebugLog(`📐 Image: ${photo.width}x${photo.height}px`);
            addDebugLog(`💾 Base64: ${base64SizeKB} KB`);
          }
          const elapsedBeforeDecode = Date.now() - scanStartTime;
          logger.info(`[BarcodeScanner] [${elapsedBeforeDecode}ms] Photo capturée, décodage en cours (Cloud API → QuaggaJS → ZXing)...`, {
            width: photo.width,
            height: photo.height,
            base64Size: photo.base64.length,
            attempt,
            elapsed: elapsedBeforeDecode
          });
          
          // Log critique AVANT le décodage avec flush immédiat
          console.log(`[BarcodeScanner] [${elapsedBeforeDecode}ms] ⚠️ TRACE: Avant decodeBarcodeFromDataUrl`);
          if (currentUserId !== 'guest') {
            userLogger.info(
              currentUserId,
              `Début décodage (tentative ${attempt}) - ${elapsedBeforeDecode}ms écoulés`,
              'barcode-scanner',
              { attempt, elapsed: elapsedBeforeDecode, width: photo.width, height: photo.height }
            ).then(() => flushLogsNow()).catch(() => {});
          }
          
          // Réutiliser la dataUrl déjà créée pour la vérification de netteté
          // Décoder avec timeout (max 20 secondes pour inclure Cloud API + retries)
          const decodeStartTime = Date.now();
          setDecodingStatus('cloud');
          
          // Logger le début du décodage avec plus de détails
          console.log(`[BarcodeScanner] [${elapsedBeforeDecode}ms] ⚠️ TRACE: Avant decodeBarcodeFromDataUrl (tentative ${attempt}/${maxAttempts})`);
          if (currentUserId !== 'guest') {
            userLogger.info(
              currentUserId,
              `Début décodage (tentative ${attempt}/${maxAttempts}) - ${elapsedBeforeDecode}ms écoulés`,
              'barcode-scanner',
              { 
                attempt, 
                maxAttempts,
                totalElapsed: elapsedBeforeDecode,
                method: 'decode_start',
                userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined
              }
            ).then(() => {
              flushLogsNow().catch(err => console.warn('[BarcodeScanner] Erreur flush logs:', err));
            }).catch(() => {});
          }
          
          const decodePromise = decodeBarcodeFromDataUrl(dataUrl).then((barcode) => {
            const decodeDuration = Date.now() - decodeStartTime;
            const totalElapsed = Date.now() - scanStartTime;
            setDecodingStatus('');
            if (debugMode) {
              if (barcode) {
                addDebugLog(`✅ Décodage réussi en ${decodeDuration}ms: ${barcode}`);
              } else {
                addDebugLog(`❌ Décodage échoué en ${decodeDuration}ms (null)`);
              }
            }
            logger.info(`[BarcodeScanner] [${totalElapsed}ms] ✅ APRÈS decodeBarcodeFromDataUrl - Décodage terminé`, { 
              success: !!barcode, 
              barcode, 
              decodeDuration,
              attempt,
              totalElapsed
            });
            
            // Logger le résultat du décodage et forcer l'envoi
            if (currentUserId !== 'guest') {
              userLogger.debug(
                currentUserId,
                barcode ? `Décodage réussi (tentative ${attempt}): ${barcode}` : `Décodage échoué (tentative ${attempt})`,
                'barcode-scanner',
                { attempt, success: !!barcode, barcode, decodeDuration, totalElapsed }
              ).then(() => {
                flushLogsNow().catch(err => console.warn('[BarcodeScanner] Erreur flush logs:', err));
              }).catch(() => {}); // Ignorer les erreurs de logging debug
            }
            
            return barcode;
          }).catch((error: any) => {
            const decodeDuration = Date.now() - decodeStartTime;
            const totalElapsed = Date.now() - scanStartTime;
            setDecodingStatus('');
            if (debugMode) {
              addDebugLog(`❌ Erreur décodage après ${decodeDuration}ms: ${error?.message || String(error)}`);
            }
            logger.error(`[BarcodeScanner] [${totalElapsed}ms] ❌ APRÈS decodeBarcodeFromDataUrl - Erreur lors du décodage:`, { 
              error: error?.message || String(error),
              stack: error?.stack,
              decodeDuration,
              attempt,
              totalElapsed
            });
            
            // Logger l'erreur dans Firebase
            if (currentUserId !== 'guest') {
              userLogger.warn(
                currentUserId,
                `Erreur décodage (tentative ${attempt}): ${error?.message || String(error)}`,
                'barcode-scanner',
                { attempt, error: error?.message || String(error), stack: error?.stack, decodeDuration, totalElapsed }
              ).then(() => {
                flushLogsNow().catch(err => console.warn('[BarcodeScanner] Erreur flush logs:', err));
              }).catch(err => console.warn('[BarcodeScanner] Erreur logging Firebase:', err));
            }
            
            return null;
          });
          const timeoutPromise = new Promise<null>((resolve) => {
            setTimeout(() => {
              const elapsed = Date.now() - scanStartTime;
              setDecodingStatus('');
              if (debugMode) {
                addDebugLog(`⏱️ Timeout décodage (20s dépassé, ${elapsed}ms total)`);
              }
              logger.warn(`[BarcodeScanner] [${elapsed}ms] Timeout décodage (20s) - tentative ${attempt}`, {
                attempt,
                totalElapsed: elapsed
              });
              
              // Logger le timeout dans Firebase avec plus de détails
              if (currentUserId !== 'guest') {
                userLogger.warn(
                  currentUserId,
                  `Timeout décodage (20s) - tentative ${attempt}`,
                  'barcode-scanner',
                  { 
                    attempt, 
                    totalElapsed: elapsed,
                    method: 'timeout_before_decode_complete',
                    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined
                  }
                ).then(() => {
                  flushLogsNow().catch(err => console.warn('[BarcodeScanner] Erreur flush logs:', err));
                }).catch(() => {});
              }
              
              // Afficher immédiatement l'erreur et proposer saisie manuelle
              setDecodingError(`Timeout après 20 secondes (tentative ${attempt}/3). Le décodage prend trop de temps.`);
              
              resolve(null);
            }, 20000); // Timeout augmenté à 20 secondes pour laisser le temps à l'API
          });
          
          const elapsedBeforeRace = Date.now() - scanStartTime;
          console.log(`[BarcodeScanner] [${elapsedBeforeRace}ms] ⚠️ TRACE: Avant Promise.race`);
          if (currentUserId !== 'guest') {
            userLogger.info(
              currentUserId,
              `Avant Promise.race (tentative ${attempt}) - ${elapsedBeforeRace}ms écoulés`,
              'barcode-scanner',
              { attempt, elapsed: elapsedBeforeRace }
            ).then(() => flushLogsNow()).catch(() => {});
          }
          
          const barcode = await Promise.race([decodePromise, timeoutPromise]);
          
          const elapsedAfterRace = Date.now() - scanStartTime;
          console.log(`[BarcodeScanner] [${elapsedAfterRace}ms] ⚠️ TRACE: Après Promise.race - ${barcode ? 'succès' : 'échec'}`);
          if (currentUserId !== 'guest') {
            userLogger.info(
              currentUserId,
              `Après Promise.race (tentative ${attempt}) - ${barcode ? 'succès' : 'échec'} - ${elapsedAfterRace}ms écoulés`,
              'barcode-scanner',
              { attempt, success: !!barcode, barcode, elapsed: elapsedAfterRace }
            ).then(() => flushLogsNow()).catch(() => {});
          }
          
          if (barcode) {
            if (debugMode) addDebugLog(`✅ Code-barres décodé avec succès (tentative ${attempt}): ${barcode}`);
            logger.info('[BarcodeScanner] ✅ Code-barres décodé avec succès', { barcode, attempt });
            
            // Logger dans Firebase pour diagnostic
            if (currentUserId !== 'guest') {
              userLogger.info(
                currentUserId,
                `Code-barres décodé avec succès: ${barcode}`,
                'barcode-scanner',
                { barcode, attempt, method: 'cloud/quagga/zxing', blurScore }
              ).then(() => {
                // Forcer l'envoi immédiat des logs
                flushLogsNow().catch(err => console.warn('[BarcodeScanner] Erreur flush logs:', err));
              }).catch(err => console.warn('[BarcodeScanner] Erreur logging Firebase:', err));
            }
            
            setShowPhotoPreview(false);
            setCapturedPhotoUri(null);
            setScanned(true);
            onBarcodeScanned(barcode);
            return; // Succès, sortir de la boucle
          } else {
            // Décodage échoué pour cette tentative
            const decodeDuration = Date.now() - decodeStartTime;
            const totalElapsed = Date.now() - scanStartTime;
            if (debugMode) {
              addDebugLog(`❌ Décodage échoué (tentative ${attempt}/${maxAttempts}) après ${decodeDuration}ms`);
            }
            logger.warn(`[BarcodeScanner] [${totalElapsed}ms] Décodage échoué (tentative ${attempt}/${maxAttempts})`, {
              decodeDuration,
              attempt,
              maxAttempts,
              totalElapsed,
              reason: 'no_barcode_detected'
            });
            
            // Logger l'échec dans Firebase avec plus de détails
            if (currentUserId !== 'guest') {
              userLogger.debug(
                currentUserId,
                `Décodage échoué (tentative ${attempt}/${maxAttempts})`,
                'barcode-scanner',
                { 
                  attempt, 
                  maxAttempts,
                  success: false, 
                  barcode: null, 
                  decodeDuration, 
                  totalElapsed,
                  reason: 'no_barcode_detected',
                  userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined
                }
              ).then(() => {
                flushLogsNow().catch(err => console.warn('[BarcodeScanner] Erreur flush logs:', err));
              }).catch(() => {});
            }
            
            // Afficher un message d'erreur progressif
            if (attempt < maxAttempts) {
              setDecodingError(`Tentative ${attempt}/${maxAttempts} échouée. Nouvelle tentative...`);
            } else {
              setDecodingError(`Tentative ${attempt}/${maxAttempts} échouée.`);
            }
            
            lastError = `Tentative ${attempt}/${maxAttempts} échouée`;
            
            // Essayer OpenAI Vision sur CHAQUE tentative (pas seulement la dernière)
            // OpenAI Vision peut réussir même si les autres méthodes échouent
            if (photo.base64) {
              if (debugMode) addDebugLog(`🤖 Essai OpenAI Vision pour tentative ${attempt}/${maxAttempts}...`);
              logger.info(`[BarcodeScanner] [${Date.now() - scanStartTime}ms] Essai OpenAI Vision (tentative ${attempt}/${maxAttempts})...`);
              setDecodingStatus('openai');
              
              try {
                const openaiBarcode = await extractBarcodeWithOpenAI(
                  photo.base64,
                  currentUserId !== 'guest' ? currentUserId : undefined,
                  userEmailVerified
                );
                
                if (openaiBarcode) {
                  const elapsedAfterOpenAISuccess = Date.now() - scanStartTime;
                  if (debugMode) addDebugLog(`✅ Code-barres extrait avec OpenAI (tentative ${attempt}/${maxAttempts}): ${openaiBarcode}`);
                  logger.info(`[BarcodeScanner] [${elapsedAfterOpenAISuccess}ms] ✅ Code-barres extrait avec OpenAI Vision (tentative ${attempt}/${maxAttempts})`, { 
                    barcode: openaiBarcode,
                    attempt,
                    maxAttempts,
                    totalElapsed: elapsedAfterOpenAISuccess
                  });
                  // Métriques de succès
                  trackEvent('barcode_scan_success', {
                    method: 'openai_vision',
                    attempt,
                    maxAttempts,
                    duration_ms: elapsedAfterOpenAISuccess,
                    total_elapsed_ms: elapsedAfterOpenAISuccess
                  });
                  
                  // Logger dans Firebase pour diagnostic
                  if (currentUserId !== 'guest') {
                    userLogger.info(
                      currentUserId,
                      `Code-barres détecté avec OpenAI Vision (tentative ${attempt}/${maxAttempts})`,
                      'barcode-scanner',
                      { 
                        barcode: openaiBarcode,
                        method: 'openai_vision',
                        attempt,
                        maxAttempts,
                        duration: elapsedAfterOpenAISuccess,
                        totalElapsed: elapsedAfterOpenAISuccess
                      }
                    ).then(() => {
                      // Forcer l'envoi immédiat des logs
                      flushLogsNow().catch(err => console.warn('[BarcodeScanner] Erreur flush logs:', err));
                    }).catch(err => console.warn('[BarcodeScanner] Erreur logging Firebase:', err));
                  }
                  
                  setShowPhotoPreview(false);
                  setCapturedPhotoUri(null);
                  setScanned(true);
                  onBarcodeScanned(openaiBarcode);
                  return; // Succès avec OpenAI
                } else {
                  const elapsedAfterOpenAIFailure = Date.now() - scanStartTime;
                  if (debugMode) addDebugLog(`❌ OpenAI Vision n'a pas pu extraire le code-barres (tentative ${attempt}/${maxAttempts})`);
                  logger.warn(`[BarcodeScanner] [${elapsedAfterOpenAIFailure}ms] OpenAI Vision n'a pas pu extraire le code-barres (tentative ${attempt}/${maxAttempts})`, {
                    attempt,
                    maxAttempts,
                    totalElapsed: elapsedAfterOpenAIFailure
                  });
                  
                  // Logger l'échec OpenAI dans Firebase
                  if (currentUserId !== 'guest') {
                    userLogger.debug(
                      currentUserId,
                      `OpenAI Vision échoué (tentative ${attempt}/${maxAttempts})`,
                      'barcode-scanner',
                      { 
                        attempt,
                        maxAttempts,
                        method: 'openai_vision',
                        success: false,
                        totalElapsed: elapsedAfterOpenAIFailure
                      }
                    ).then(() => {
                      flushLogsNow().catch(err => console.warn('[BarcodeScanner] Erreur flush logs:', err));
                    }).catch(() => {});
                  }
                }
              } catch (openaiError: any) {
                const elapsedAfterOpenAIError = Date.now() - scanStartTime;
                if (debugMode) addDebugLog(`❌ Erreur OpenAI (tentative ${attempt}/${maxAttempts}): ${openaiError?.message || String(openaiError)}`);
                logger.error(`[BarcodeScanner] [${elapsedAfterOpenAIError}ms] Erreur OpenAI Vision (tentative ${attempt}/${maxAttempts}):`, {
                  error: openaiError?.message || String(openaiError),
                  stack: openaiError?.stack,
                  attempt,
                  maxAttempts,
                  totalElapsed: elapsedAfterOpenAIError
                });
                
                // Logger l'erreur OpenAI dans Firebase
                if (currentUserId !== 'guest') {
                  userLogger.error(
                    currentUserId,
                    `Erreur OpenAI Vision (tentative ${attempt}/${maxAttempts}): ${openaiError?.message || 'Erreur inconnue'}`,
                    'barcode-scanner',
                    { 
                      attempt,
                      maxAttempts,
                      error: openaiError?.message || String(openaiError),
                      stack: openaiError?.stack,
                      totalElapsed: elapsedAfterOpenAIError
                    }
                  ).then(() => {
                    flushLogsNow().catch(err => console.warn('[BarcodeScanner] Erreur flush logs:', err));
                  }).catch(() => {});
                }
              } finally {
                setDecodingStatus('');
              }
            }
            
            setShowPhotoPreview(false);
            setCapturedPhotoUri(null);
            if (attempt < maxAttempts) {
              // Attendre plus longtemps avant la prochaine tentative pour laisser la caméra se stabiliser
              const waitTime = 1000 + (attempt * 200); // 1s, 1.2s, 1.4s
              if (debugMode) addDebugLog(`⏳ Attente ${waitTime}ms avant tentative ${attempt + 1}...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
            }
          }
        } catch (error: any) {
          if (debugMode) addDebugLog(`Erreur tentative ${attempt}: ${error?.message || String(error)}`);
          logger.warn(`[BarcodeScanner] Erreur tentative ${attempt}:`, error?.message || String(error));
          lastError = error?.message || 'Erreur lors de la capture';
          if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      
      // Toutes les tentatives ont échoué - proposer saisie manuelle
      if (debugMode) {
        addDebugLog('❌ Toutes les tentatives ont échoué');
        addDebugLog(`📊 Résumé: ${maxAttempts} tentatives, 0 succès`);
        addDebugLog('💡 Conseil: Essayez le mode natif ou entrez le code manuellement');
      }
      logger.warn('[BarcodeScanner] ❌ Toutes les tentatives ont échoué', { 
        maxAttempts, 
        lastError,
        totalDuration: Date.now() - scanStartTime
      });
      
      // Logger l'échec complet dans Firebase
      if (currentUserId !== 'guest') {
        userLogger.warn(
          currentUserId,
          `Toutes les tentatives ont échoué (${maxAttempts} tentatives)`,
          'barcode-scanner',
          { 
            maxAttempts, 
            lastError: lastError || 'Timeout ou décodage échoué',
            totalDuration: Date.now() - scanStartTime,
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined
          }
        ).then(() => {
          flushLogsNow().catch(err => console.warn('[BarcodeScanner] Erreur flush logs:', err));
        }).catch(() => {});
      }
      
      // Forcer l'affichage de la saisie manuelle avec message clair
      // IMPORTANT: Réinitialiser showPhotoPreview pour que l'erreur soit visible
      setShowPhotoPreview(false);
      setDecodingError(`❌ Aucun code-barres détecté après ${maxAttempts} tentatives.\n\n💡 Solutions:\n• Utilisez le mode natif (bouton 📷)\n• Entrez le code manuellement\n• Vérifiez que le code-barres est net et bien éclairé`);
      setShowManualInput(true);
    } catch (error: any) {
      const totalDuration = Date.now() - scanStartTime;
      if (debugMode) addDebugLog(`Erreur fatale: ${error?.message || String(error)}`);
      logger.error('[BarcodeScanner] ❌ Erreur fatale lors de la capture/décodage', { 
        error: error?.message || String(error),
        stack: error?.stack,
        totalDuration
      });
      
      // Logger l'erreur fatale dans Firebase
      if (currentUserId !== 'guest') {
        userLogger.error(
          currentUserId,
          `Erreur fatale lors du scan: ${error?.message || 'Erreur inconnue'}`,
          'barcode-scanner',
          { error: error?.message || String(error), stack: error?.stack, totalDuration, userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined }
        ).then(() => {
          flushLogsNow().catch(err => console.warn('[BarcodeScanner] Erreur flush logs:', err));
        }).catch(err => console.warn('[BarcodeScanner] Erreur logging Firebase:', err));
      }
      
      setDecodingError('Erreur lors de la capture. Réessayez ou entrez le code manuellement.');
      // Forcer l'affichage de la saisie manuelle en cas d'erreur fatale
      setShowPhotoPreview(false);
      setShowManualInput(true);
    } finally {
      const totalDuration = Date.now() - scanStartTime;
      logger.info(`[BarcodeScanner] [${totalDuration}ms] ✅ Processus de scan terminé (durée totale: ${totalDuration}ms)`);
      
      // Logger la fin du processus dans Firebase avec plus de détails
      if (currentUserId !== 'guest') {
        userLogger.debug(
          currentUserId,
          `Processus de scan terminé (durée: ${totalDuration}ms)`,
          'barcode-scanner',
          { 
            totalDuration,
            finalState: {
              hasError: !!decodingError,
              showManualInput,
              showPhotoPreview,
              isDecoding
            }
          }
        ).then(() => {
          flushLogsNow().catch(err => console.warn('[BarcodeScanner] Erreur flush logs final:', err));
        }).catch(() => {});
      }
      
      // S'assurer que isDecoding est toujours réinitialisé
      setIsDecoding(false);
      setDecodingStatus('');
      
      // Si on a une erreur et qu'on n'a pas encore affiché la saisie manuelle, l'afficher
      if (decodingError && !showManualInput) {
        setShowPhotoPreview(false);
        setShowManualInput(true);
      }
      
      // Forcer l'envoi des logs même si le processus échoue
      if (currentUserId !== 'guest') {
        flushLogsNow().catch(err => console.warn('[BarcodeScanner] Erreur flush logs final:', err));
      }
    }
  };

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Demande d'accès à la caméra...</Text>
        <TouchableOpacity 
          style={styles.manualInputButton} 
          onPress={() => setShowManualInput(true)}
        >
          <Text style={styles.manualInputButtonText}>✏️ Entrer le code manuellement</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>Annuler</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (hasPermission === false || showManualInput) {
    return (
      <View style={styles.container}>
        {hasPermission === false && (
          <Text style={styles.text}>
            Accès à la caméra refusé.{'\n'}
            Vous pouvez entrer le code-barres manuellement.
          </Text>
        )}
        <Text style={styles.manualTitle}>Entrer le code-barres (EAN)</Text>
        <TextInput
          style={styles.manualInput}
          placeholder="Ex: 3017620422003"
          placeholderTextColor="#6b7280"
          value={manualBarcode}
          onChangeText={setManualBarcode}
          keyboardType="numeric"
          autoFocus
          returnKeyType="search"
          onSubmitEditing={handleManualSubmit}
        />
        <TouchableOpacity 
          style={[styles.submitButton, manualBarcode.trim().length === 0 && styles.submitButtonDisabled]} 
          onPress={handleManualSubmit}
          disabled={manualBarcode.trim().length === 0}
        >
          <Text style={styles.submitButtonText}>🔍 Rechercher</Text>
        </TouchableOpacity>
        {hasPermission !== false && (
          <TouchableOpacity 
            style={styles.backToScanButton} 
            onPress={() => setShowManualInput(false)}
          >
            <Text style={styles.backToScanButtonText}>📷 Retour au scan</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>Annuler</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        onBarcodeScanned={scanned || usePhotoMode ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: [
            'ean13',
            'ean8',
            'upc_a',
            'upc_e',
            'code128',
            'code39',
            'qr',
          ],
        }}
      >
        <View style={styles.overlay}>
          <View style={styles.topOverlay} />
          <View style={styles.middleRow}>
            <View style={styles.sideOverlay} />
            <View style={styles.scanArea}>
              {/* Cadre bande horizontale (meilleur pour code-barres) */}
              <View style={styles.scanGuideLine} />
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
            <View style={styles.sideOverlay} />
          </View>
          <View style={styles.bottomOverlay}>
            {usePhotoMode ? (
              // Mode photo pour iPhone Safari
              <>
                {showPhotoPreview && capturedPhotoUri && (
                  <View style={styles.previewContainer}>
                    <Text style={styles.previewTitle}>Aperçu de la photo</Text>
                    <Image source={{ uri: capturedPhotoUri }} style={styles.previewImage} />
                    {isBlurCheckActive ? (
                      <Text style={styles.previewHint}>Vérification de la netteté...</Text>
                    ) : blurScore !== null ? (
                      <>
                        <View style={styles.sharpnessContainer}>
                          <Text style={styles.sharpnessLabel}>
                            Netteté: {blurScore}/100
                          </Text>
                          <View style={styles.sharpnessBar}>
                            <View 
                              style={[
                                styles.sharpnessBarFill, 
                                { 
                                  width: `${blurScore}%`,
                                  backgroundColor: blurScore >= 50 ? '#22c55e' : blurScore >= 30 ? '#fbbf24' : '#ef4444'
                                }
                              ]} 
                            />
                          </View>
                          <Text style={[
                            styles.sharpnessStatus,
                            { color: blurScore >= 50 ? '#22c55e' : blurScore >= 30 ? '#fbbf24' : '#ef4444' }
                          ]}>
                            {blurScore >= 50 ? '✅ Net' : blurScore >= 30 ? '⚠️ Acceptable' : '❌ Flou'}
                          </Text>
                        </View>
                        <Text style={styles.previewHint}>
                          {blurScore < 30 ? 'Image floue détectée. Approchez-vous pour une meilleure détection.' : 'Analyse en cours...'}
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.previewHint}>Analyse en cours...</Text>
                    )}
                    
                    {/* Afficher l'erreur même en mode preview */}
                    {decodingError && (
                      <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>{decodingError}</Text>
                      </View>
                    )}
                    
                    {/* Afficher le statut de décodage */}
                    {isDecoding && decodingStatus && (
                      <View style={styles.statusContainer}>
                        <Text style={styles.statusText}>
                          {decodingStatus === 'cloud' ? '☁️ Analyse cloud...' : 
                           decodingStatus === 'openai' ? '🤖 Lecture avec IA...' : 
                           '⏳ Décodage...'}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
                
                {!showPhotoPreview && (
                  <>
                    <Text style={styles.instructionText}>
                      Placez le code-barres dans la bande verte, puis appuyez sur le bouton.
                    </Text>
                    
                    {decodingError && (
                      <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>❌ {decodingError}</Text>
                      </View>
                    )}
                    
                    {isDecoding && decodingStatus === 'cloud' && (
                      <View style={styles.statusContainer}>
                        <Text style={styles.statusText}>☁️ Analyse cloud en cours...</Text>
                      </View>
                    )}
                    
                    {isDecoding && decodingStatus === 'openai' && (
                      <View style={styles.statusContainer}>
                        <Text style={styles.statusText}>🤖 Lecture des chiffres avec IA...</Text>
                      </View>
                    )}
                  </>
                )}
                
                <TouchableOpacity 
                  style={[styles.captureButton, isDecoding && styles.captureButtonDisabled]} 
                  onPress={handleTakePhoto}
                  disabled={isDecoding}
                >
                  {isDecoding ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <ActivityIndicator color="#fff" size="small" />
                      <Text style={styles.captureButtonText}>
                        {decodingStatus === 'cloud' ? 'Analyse...' : 'Décodage...'}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.captureButtonText}>📸 Prendre la photo du code-barres</Text>
                  )}
                </TouchableOpacity>
                
                {/* Fallback natif iPhone Safari - plus fiable que Expo Camera */}
                {Platform.OS === 'web' && isIOSSafari() && (
                  <>
                    <TouchableOpacity 
                      style={[styles.nativeCaptureButton, isDecoding && styles.captureButtonDisabled]} 
                      onPress={handleNativePhotoCapture}
                      disabled={isDecoding}
                    >
                      <Text style={styles.nativeCaptureButtonText}>📷 Prendre photo (mode natif)</Text>
                    </TouchableOpacity>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      style={{ display: 'none' }}
                      onChange={handleNativeFileSelected}
                      // Essayer d'activer le zoom x2 si supporté (iOS 15+)
                      {...(Platform.OS === 'web' && {
                        // Sur iOS, on peut suggérer le zoom via CSS mais pas le forcer
                        // L'utilisateur peut pincer pour zoomer
                      })}
                    />
                  </>
                )}
                
                <TouchableOpacity 
                  style={styles.manualInputButton} 
                  onPress={() => setShowManualInput(true)}
                  disabled={isDecoding}
                >
                  <Text style={styles.manualInputButtonText}>✏️ Entrer manuellement</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.debugButton} 
                  onPress={() => {
                    setDebugMode(!debugMode);
                    if (!debugMode && debugLogs.length > 0) {
                      setShowDebugModal(true);
                    }
                  }}
                  disabled={isDecoding}
                >
                  <Text style={styles.debugButtonText}>
                    {debugMode ? '🔍 Mode Debug ON' : '🔍 Mode Debug OFF'}
                  </Text>
                </TouchableOpacity>
                
                {debugMode && debugLogs.length > 0 && (
                  <TouchableOpacity 
                    style={styles.viewLogsButton} 
                    onPress={() => setShowDebugModal(true)}
                  >
                    <Text style={styles.viewLogsButtonText}>📋 Voir les logs ({debugLogs.length})</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              // Mode scan live (navigateurs compatibles)
              <>
                <Text style={styles.instructionText}>
                  Placez le code-barres dans la bande. Approchez-vous (10–15 cm) et évitez les reflets.
                </Text>
                <TouchableOpacity 
                  style={styles.manualInputButton} 
                  onPress={() => setShowManualInput(true)}
                >
                  <Text style={styles.manualInputButtonText}>✏️ Entrer manuellement</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </CameraView>
      
      {/* Modal plein écran pour les logs de debug */}
      <Modal
        visible={showDebugModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowDebugModal(false)}
      >
        <View style={styles.debugModalContainer}>
          <View style={styles.debugModalHeader}>
            <Text style={styles.debugModalTitle}>📋 Logs de Debug</Text>
            <TouchableOpacity 
              style={styles.debugModalCloseButton}
              onPress={() => setShowDebugModal(false)}
            >
              <Text style={styles.debugModalCloseText}>✕ Fermer</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.debugModalContent}>
            {/* Informations système */}
            <View style={styles.debugModalSection}>
              <Text style={styles.debugModalSectionTitle}>📱 Informations Système</Text>
              {debugInfo.userAgent && (
                <Text style={styles.debugModalLogText}>User Agent: {debugInfo.userAgent}</Text>
              )}
              <Text style={styles.debugModalLogText}>
                iPhone Safari: {debugInfo.isIOSSafari ? '✅ Oui' : '❌ Non'}
              </Text>
            </View>

            {/* Informations image */}
            {(debugInfo.imageWidth || debugInfo.base64Size) && (
              <View style={styles.debugModalSection}>
                <Text style={styles.debugModalSectionTitle}>📷 Informations Image</Text>
                {debugInfo.imageWidth && debugInfo.imageHeight && (
                  <Text style={styles.debugModalLogText}>
                    Résolution: {debugInfo.imageWidth} × {debugInfo.imageHeight} px
                  </Text>
                )}
                {debugInfo.base64Size && (
                  <Text style={styles.debugModalLogText}>
                    Taille base64: {Math.round(debugInfo.base64Size / 1024)} KB ({((debugInfo.base64Size / 1024) / 1024).toFixed(2)} MB)
                  </Text>
                )}
                {debugInfo.exifOrientation !== undefined && (
                  <Text style={styles.debugModalLogText}>
                    EXIF Orientation: {debugInfo.exifOrientation} {debugInfo.exifOrientation === 1 ? '(normal)' : '(corrigée)'}
                  </Text>
                )}
                {debugInfo.canvasWidth && debugInfo.canvasHeight && (
                  <Text style={styles.debugModalLogText}>
                    Canvas après crop: {debugInfo.canvasWidth} × {debugInfo.canvasHeight} px
                  </Text>
                )}
              </View>
            )}

            {/* Résultats décodage */}
            {(debugInfo.cloudVisionResult || debugInfo.quaggaResult || debugInfo.zxingResult) && (
              <View style={styles.debugModalSection}>
                <Text style={styles.debugModalSectionTitle}>🔍 Résultats Décodage</Text>
                {debugInfo.cloudVisionResult && (
                  <Text style={styles.debugModalLogText}>
                    Cloud Vision: {debugInfo.cloudVisionResult.success ? '✅ Succès' : '❌ Échec'}
                    {debugInfo.cloudVisionResult.code && ` (Code: ${debugInfo.cloudVisionResult.code})`}
                    {debugInfo.cloudVisionResult.barcode && ` → ${debugInfo.cloudVisionResult.barcode}`}
                  </Text>
                )}
                {debugInfo.quaggaResult && (
                  <Text style={styles.debugModalLogText}>
                    QuaggaJS: {debugInfo.quaggaResult.success ? '✅ Succès' : '❌ Échec'}
                    {debugInfo.quaggaResult.barcode && ` → ${debugInfo.quaggaResult.barcode}`}
                  </Text>
                )}
                {debugInfo.zxingResult && (
                  <Text style={styles.debugModalLogText}>
                    ZXing: {debugInfo.zxingResult.success ? '✅ Succès' : '❌ Échec'}
                    {debugInfo.zxingResult.barcode && ` → ${debugInfo.zxingResult.barcode}`}
                  </Text>
                )}
              </View>
            )}

            {/* Logs détaillés */}
            {debugLogs.length > 0 && (
              <View style={styles.debugModalSection}>
                <Text style={styles.debugModalSectionTitle}>📋 Logs Détaillés</Text>
                {debugLogs.map((log, index) => (
                  <Text key={index} style={styles.debugModalLogText}>{log}</Text>
                ))}
              </View>
            )}
            
            {/* Image capturée */}
            {capturedPhotoData && (
              <View style={styles.debugModalImageContainer}>
                <Text style={styles.debugModalImageTitle}>📷 Image capturée:</Text>
                <Image 
                  source={{ uri: capturedPhotoData }} 
                  style={styles.debugModalImage}
                  resizeMode="contain"
                />
                <Text style={styles.debugModalImageInfo}>
                  Taille base64: {Math.round(capturedPhotoData.length / 1024)} KB
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  overlay: {
    flex: 1,
  },
  topOverlay: {
    flex: 2, // Augmenté de 1 à 2 pour pousser le cadre plus bas
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  middleRow: {
    flexDirection: 'row',
    height: 200, // Augmenté de 170 à 200 pour un cadre plus grand et mieux visible
    justifyContent: 'center',
    alignItems: 'center',
  },
  sideOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  scanArea: {
    width: 320,
    height: 140, // Augmenté de 110 à 140 pour un cadre plus grand
    position: 'relative',
    borderRadius: 12,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: 'rgba(34, 197, 94, 0.3)', // Bordure subtile pour mieux voir le cadre
  },
  scanGuideLine: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: '50%',
    marginTop: -1, // Centrer précisément la ligne
    height: 3, // Augmenté de 2 à 3 pour meilleure visibilité
    backgroundColor: '#22c55e', // Couleur plus vive (sans transparence)
    borderRadius: 2,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4, // Pour Android
  },
  corner: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderColor: '#22c55e',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  bottomOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 40,
    overflow: 'scroll',
  },
  text: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  instructionText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  closeButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 12,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  manualTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  manualInput: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    color: '#fff',
    borderWidth: 2,
    borderColor: '#3b82f6',
    width: '80%',
    textAlign: 'center',
    marginBottom: 20,
  },
  manualInputButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 12,
    borderWidth: 2,
    borderColor: '#60a5fa',
  },
  manualInputButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  backToScanButton: {
    backgroundColor: '#6b7280',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  backToScanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  captureButton: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
    minWidth: 280,
    alignItems: 'center',
  },
  captureButtonDisabled: {
    opacity: 0.6,
  },
  captureButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  nativeCaptureButton: {
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
    minWidth: 280,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#a78bfa',
  },
  nativeCaptureButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
    maxWidth: '90%',
  },
  errorText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },
  statusContainer: {
    backgroundColor: 'rgba(59, 130, 246, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
    maxWidth: '90%',
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '600',
  },
  previewContainer: {
    backgroundColor: 'rgba(31, 41, 55, 0.95)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    maxWidth: '90%',
  },
  previewTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  previewImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#111827',
  },
  previewHint: {
    color: '#9ca3af',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  sharpnessContainer: {
    width: '100%',
    marginTop: 12,
    marginBottom: 8,
  },
  sharpnessLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    textAlign: 'center',
  },
  sharpnessBar: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  sharpnessBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  sharpnessStatus: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  debugButton: {
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  debugButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  viewLogsButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  viewLogsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  debugLogsContainer: {
    backgroundColor: 'rgba(17, 24, 39, 0.95)',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    maxHeight: 300,
    width: '90%',
    overflow: 'scroll',
  },
  debugLogsTitle: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  debugLogText: {
    color: '#d1d5db',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 4,
  },
  debugImageContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
  debugImage: {
    width: 250,
    height: 150,
    borderRadius: 8,
    marginVertical: 8,
    backgroundColor: '#111827',
  },
  debugImageInfo: {
    color: '#9ca3af',
    fontSize: 10,
    textAlign: 'center',
  },
  debugModalContainer: {
    flex: 1,
    backgroundColor: '#111827',
  },
  debugModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1f2937',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  debugModalTitle: {
    color: '#22c55e',
    fontSize: 20,
    fontWeight: 'bold',
  },
  debugModalCloseButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  debugModalCloseText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  debugModalContent: {
    flex: 1,
    padding: 16,
  },
  debugModalSection: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  debugModalSectionTitle: {
    color: '#22c55e',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  debugModalLogText: {
    color: '#d1d5db',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 6,
    lineHeight: 20,
  },
  debugModalImageContainer: {
    marginTop: 24,
    alignItems: 'center',
    paddingBottom: 40,
  },
  debugModalImageTitle: {
    color: '#22c55e',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  debugModalImage: {
    width: '100%',
    height: 400,
    borderRadius: 12,
    marginVertical: 16,
    backgroundColor: '#1f2937',
  },
  debugModalImageInfo: {
    color: '#9ca3af',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
});
