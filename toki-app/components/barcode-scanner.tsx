// Composant de scan de code-barres
// Utilise expo-camera pour scanner les codes-barres de produits
// Fallback photo + ZXing pour iPhone Safari web (scan live non supporté)

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, TextInput, ActivityIndicator } from 'react-native';
import { CameraView, Camera, BarcodeScanningResult } from 'expo-camera';
import { decodeBarcodeFromDataUrl, isIOSSafari } from '../lib/barcode-decode-web';
import { logger } from '../lib/logger';

type BarcodeScannerProps = {
  onBarcodeScanned: (barcode: string) => void;
  onClose: () => void;
};

export function BarcodeScanner({ onBarcodeScanned, onClose }: BarcodeScannerProps) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  
  // États pour le mode photo (fallback iPhone Safari)
  const [isDecoding, setIsDecoding] = useState(false);
  const [decodingError, setDecodingError] = useState<string | null>(null);
  const [usePhotoMode, setUsePhotoMode] = useState(false);
  const [decodingStatus, setDecodingStatus] = useState<string>(''); // Status: 'cloud', 'local', ''
  const cameraRef = useRef<CameraView>(null);

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

  // Mode photo: capturer une image et la décoder avec ZXing
  const handleTakePhoto = async () => {
    if (!cameraRef.current || isDecoding) return;
    
    try {
      setIsDecoding(true);
      setDecodingError(null);
      
      logger.info('[BarcodeScanner] Capture de la photo...');
      
      // Amélioration qualité: quality 0.9 et skipProcessing false pour meilleure détection
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.9, // Augmenté de 0.7 à 0.9 pour meilleure qualité
        skipProcessing: false, // Laisser le traitement natif (améliore la netteté)
      });
      
      if (!photo || !photo.base64) {
        throw new Error('Photo non capturée ou base64 manquant');
      }
      
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
        logger.info('[BarcodeScanner] Code-barres décodé avec succès', { barcode });
        setScanned(true);
        onBarcodeScanned(barcode);
      } else {
        logger.warn('[BarcodeScanner] Aucun code-barres détecté après toutes les tentatives (Cloud API + QuaggaJS + ZXing)');
        setDecodingError('Aucun code-barres détecté. Conseils:\n• Centrez bien le code sur la ligne verte\n• Approchez-vous (10-15 cm)\n• Améliorez l\'éclairage et évitez les reflets\n• Ou entrez le code manuellement ci-dessous');
      }
    } catch (error: any) {
      logger.error('[BarcodeScanner] Erreur lors de la capture/décodage', { 
        error: error?.message || String(error) 
      });
      setDecodingError('Erreur lors de la capture. Réessayez ou entrez le code manuellement.');
    } finally {
      setIsDecoding(false);
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
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  middleRow: {
    flexDirection: 'row',
    height: 170,
  },
  sideOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  scanArea: {
    width: 320,
    height: 110,
    position: 'relative',
    borderRadius: 12,
  },
  scanGuideLine: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: '50%',
    height: 2,
    backgroundColor: 'rgba(34, 197, 94, 0.8)',
    borderRadius: 2,
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
});
