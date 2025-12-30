// Composant de scan de code-barres
// Utilise expo-camera pour scanner les codes-barres de produits

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, TextInput } from 'react-native';
import { CameraView, Camera, BarcodeScanningResult } from 'expo-camera';

type BarcodeScannerProps = {
  onBarcodeScanned: (barcode: string) => void;
  onClose: () => void;
};

export function BarcodeScanner({ onBarcodeScanned, onClose }: BarcodeScannerProps) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
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
        style={styles.camera}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
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
              <View style={styles.corner} style={[styles.corner, styles.topLeft]} />
              <View style={styles.corner} style={[styles.corner, styles.topRight]} />
              <View style={styles.corner} style={[styles.corner, styles.bottomLeft]} />
              <View style={styles.corner} style={[styles.corner, styles.bottomRight]} />
            </View>
            <View style={styles.sideOverlay} />
          </View>
          <View style={styles.bottomOverlay}>
            <Text style={styles.instructionText}>
              Placez le code-barres dans le cadre
            </Text>
            <TouchableOpacity 
              style={styles.manualInputButton} 
              onPress={() => setShowManualInput(true)}
            >
              <Text style={styles.manualInputButtonText}>✏️ Entrer manuellement</Text>
            </TouchableOpacity>
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
    height: 250,
  },
  sideOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  scanArea: {
    width: 300,
    height: 250,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
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
});
