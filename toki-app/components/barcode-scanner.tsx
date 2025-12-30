// Composant de scan de code-barres
// Utilise expo-camera pour scanner les codes-barres de produits
// Fallback photo + ZXing pour iPhone Safari web (scan live non supporté)

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, TextInput, ActivityIndicator, Image, ScrollView } from 'react-native';
import { CameraView, Camera, BarcodeScanningResult } from 'expo-camera';
import { decodeBarcodeFromDataUrl, isIOSSafari } from '../lib/barcode-decode-web';
import { extractBarcodeWithOpenAI } from '../lib/openai-parser';
import { useAuth } from '../lib/auth-context';
import { logger } from '../lib/logger';

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
  
  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(`[DEBUG] ${message}`);
  };
  
  // Récupérer les infos utilisateur pour OpenAI
  const currentUserId = authProfile?.userId || (authUser as any)?.uid || (authUser as any)?.id || 'guest';
  const userEmailVerified = (authUser as any)?.emailVerified || false;

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
      
      // Détecter si on doit utiliser le mode photo (iPhone Safari web)
      if (Platform.OS === 'web' && isIOSSafari()) {
        logger.info('[BarcodeScanner] iPhone Safari détecté → mode photo activé');
        setUsePhotoMode(true);
      }
    })();
  }, []);

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

  // Mode photo: capturer une image et la décoder avec plusieurs tentatives
  const handleTakePhoto = async () => {
    if (!cameraRef.current || isDecoding) return;
    
    try {
      setIsDecoding(true);
      setDecodingError(null);
      if (debugMode) {
        setDebugLogs([]);
        addDebugLog('Démarrage capture avec tentatives multiples...');
      }
      
      logger.info('[BarcodeScanner] Démarrage capture avec tentatives multiples...');
      
      // Essayer jusqu'à 3 fois si échec
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
          if (debugMode) addDebugLog('Capture de la photo (qualité maximale)...');
          logger.info('[BarcodeScanner] Capture de la photo (qualité maximale)...');
          const photo = await cameraRef.current.takePictureAsync({
            base64: true,
            quality: 1.0, // Qualité maximale pour meilleure détection
            skipProcessing: false, // Laisser le traitement natif (améliore la netteté)
            exif: false, // Pas besoin d'EXIF pour le décodage
          });
          
          if (!photo || !photo.base64) {
            throw new Error('Photo non capturée ou base64 manquant');
          }
          
          // Mode debug: sauvegarder la photo capturée
          if (debugMode) {
            setCapturedPhotoData(`data:image/jpeg;base64,${photo.base64}`);
            addDebugLog(`Photo capturée: ${photo.width}x${photo.height}, base64 length: ${photo.base64.length}`);
          }
          
          // Afficher l'aperçu de la photo
          setCapturedPhotoUri(photo.uri);
          setShowPhotoPreview(true);
          
          // Attendre que l'utilisateur confirme ou recapture
          // Pour l'instant, on continue automatiquement (peut être amélioré avec un bouton de confirmation)
          await new Promise(resolve => setTimeout(resolve, 500)); // Petit délai pour voir l'aperçu
          
          if (debugMode) addDebugLog('Photo capturée, décodage en cours (Cloud API → QuaggaJS → ZXing)...');
          logger.info('[BarcodeScanner] Photo capturée, décodage en cours (Cloud API → QuaggaJS → ZXing)...');
          
          // Construire la data URL
          const dataUrl = `data:image/jpeg;base64,${photo.base64}`;
          
          // Décoder avec timeout (max 15 secondes pour inclure Cloud API)
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
            logger.info('[BarcodeScanner] ✅ Code-barres décodé avec succès', { barcode, attempt });
            setShowPhotoPreview(false);
            setCapturedPhotoUri(null);
            setScanned(true);
            onBarcodeScanned(barcode);
            return; // Succès, sortir de la boucle
          } else {
            if (debugMode) addDebugLog(`Tentative ${attempt} échouée: aucun code-barres détecté`);
            logger.warn(`[BarcodeScanner] Tentative ${attempt} échouée: aucun code-barres détecté`);
            lastError = `Tentative ${attempt}/${maxAttempts} échouée`;
            
            // Si c'est la dernière tentative, essayer OpenAI Vision comme fallback ultime
            if (attempt === maxAttempts && photo.base64) {
              if (debugMode) addDebugLog('Tentative finale avec OpenAI Vision...');
              logger.info('[BarcodeScanner] Tentative finale avec OpenAI Vision...');
              setDecodingStatus('openai');
              
              try {
                const openaiBarcode = await extractBarcodeWithOpenAI(
                  photo.base64,
                  currentUserId !== 'guest' ? currentUserId : undefined,
                  userEmailVerified
                );
                
                if (openaiBarcode) {
                  if (debugMode) addDebugLog(`✅ Code-barres extrait avec OpenAI: ${openaiBarcode}`);
                  logger.info('[BarcodeScanner] ✅ Code-barres extrait avec OpenAI Vision', { barcode: openaiBarcode });
                  setShowPhotoPreview(false);
                  setCapturedPhotoUri(null);
                  setScanned(true);
                  onBarcodeScanned(openaiBarcode);
                  return; // Succès avec OpenAI
                } else {
                  if (debugMode) addDebugLog('OpenAI Vision n\'a pas pu extraire le code-barres');
                  logger.warn('[BarcodeScanner] OpenAI Vision n\'a pas pu extraire le code-barres');
                }
              } catch (openaiError: any) {
                if (debugMode) addDebugLog(`Erreur OpenAI: ${openaiError?.message || String(openaiError)}`);
                logger.error('[BarcodeScanner] Erreur OpenAI Vision:', openaiError);
              }
            }
            
            setShowPhotoPreview(false);
            setCapturedPhotoUri(null);
            if (attempt < maxAttempts) {
              // Attendre un peu avant la prochaine tentative
              await new Promise(resolve => setTimeout(resolve, 1000));
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
      
      // Toutes les tentatives ont échoué
      if (debugMode) addDebugLog('❌ Toutes les tentatives ont échoué');
      logger.warn('[BarcodeScanner] ❌ Toutes les tentatives ont échoué');
      
      // Message d'erreur amélioré avec conseils spécifiques
      const errorDetails = [];
      errorDetails.push(`❌ Aucun code-barres détecté après ${maxAttempts} tentatives`);
      errorDetails.push('');
      errorDetails.push('💡 Conseils pour améliorer la détection:');
      errorDetails.push('• Centrez bien le code sur la ligne verte');
      errorDetails.push('• Approchez-vous (10-15 cm du produit)');
      errorDetails.push('• Assurez-vous d\'avoir un bon éclairage');
      errorDetails.push('• Évitez les reflets sur l\'emballage');
      errorDetails.push('• Tenez le téléphone stable pendant la capture');
      errorDetails.push('• Le code doit être net et bien visible');
      errorDetails.push('');
      errorDetails.push('💭 Si le problème persiste, entrez le code manuellement ci-dessous.');
      
      setDecodingError(errorDetails.join('\n'));
    } catch (error: any) {
      if (debugMode) addDebugLog(`Erreur fatale: ${error?.message || String(error)}`);
      logger.error('[BarcodeScanner] Erreur fatale lors de la capture/décodage', { 
        error: error?.message || String(error) 
      });
      setDecodingError('Erreur lors de la capture. Réessayez ou entrez le code manuellement.');
    } finally {
      setIsDecoding(false);
      setDecodingStatus('');
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
                    <Text style={styles.previewHint}>Analyse en cours...</Text>
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
                
                <TouchableOpacity 
                  style={styles.manualInputButton} 
                  onPress={() => setShowManualInput(true)}
                  disabled={isDecoding}
                >
                  <Text style={styles.manualInputButtonText}>✏️ Entrer manuellement</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.debugButton} 
                  onPress={() => setDebugMode(!debugMode)}
                  disabled={isDecoding}
                >
                  <Text style={styles.debugButtonText}>
                    {debugMode ? '🔍 Mode Debug ON' : '🔍 Mode Debug OFF'}
                  </Text>
                </TouchableOpacity>
                
                {debugMode && debugLogs.length > 0 && (
                  <ScrollView style={styles.debugLogsContainer}>
                    <Text style={styles.debugLogsTitle}>📋 Logs de Debug:</Text>
                    {debugLogs.map((log, index) => (
                      <Text key={index} style={styles.debugLogText}>{log}</Text>
                    ))}
                    {capturedPhotoData && (
                      <View style={styles.debugImageContainer}>
                        <Text style={styles.debugLogsTitle}>📷 Image capturée:</Text>
                        <Image 
                          source={{ uri: capturedPhotoData }} 
                          style={styles.debugImage}
                          resizeMode="contain"
                        />
                        <Text style={styles.debugImageInfo}>
                          Taille base64: {capturedPhotoData.length} caractères
                        </Text>
                      </View>
                    )}
                  </ScrollView>
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 40,
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
  debugLogsContainer: {
    backgroundColor: 'rgba(17, 24, 39, 0.95)',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    maxHeight: 200,
    width: '90%',
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
});
