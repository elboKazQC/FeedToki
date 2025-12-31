# Architecture du Scanner de Codes-Barres

## Vue d'ensemble

Le scanner de codes-barres utilise une approche multi-méthodes avec sélection automatique selon l'appareil/navigateur.

## Méthodes de décodage

### 1. Google Cloud Vision API
- **Disponibilité**: Tous les appareils (via Firebase Functions)
- **Performance**: Excellente (>95% taux de détection)
- **Coût**: Payant (mais très fiable)
- **Utilisation**: Méthode principale sur tous les appareils

### 2. QuaggaJS
- **Disponibilité**: Navigateurs non-iOS uniquement
- **Performance**: Bonne pour codes-barres nets
- **Coût**: Gratuit (bibliothèque open source)
- **Utilisation**: Fallback sur navigateurs non-iOS
- **Limitation**: Trop lourd sur iOS Safari (causait des timeouts)

### 3. ZXing (Zebra Crossing)
- **Disponibilité**: Navigateurs non-iOS uniquement
- **Performance**: Bonne pour codes-barres nets
- **Coût**: Gratuit (bibliothèque open source)
- **Utilisation**: Dernier recours sur navigateurs non-iOS
- **Limitation**: Trop lourd sur iOS Safari (causait des timeouts)

### 4. OpenAI Vision
- **Disponibilité**: Tous les appareils (si userId et emailVerified)
- **Performance**: Excellente même pour images floues
- **Coût**: Payant (mais très puissant)
- **Utilisation**: Dernier recours si toutes les autres méthodes échouent

## Stratégie par appareil

### iPhone Safari (iOS)
```
Cloud Vision API → OpenAI Vision (si échec)
```
- **QuaggaJS et ZXing désactivés** (trop lourds, causent des timeouts)
- **3 stratégies de crop** (au lieu de 6) pour plus de rapidité
- **Pas de rotations** (gain de temps)

### Autres navigateurs
```
Cloud Vision API → QuaggaJS → ZXing → OpenAI Vision (si échec)
```
- **Toutes les méthodes activées** pour meilleure détection
- **6 stratégies de crop** + rotations
- **Upscaling x2** pour QuaggaJS/ZXing

## Fichiers clés

### `lib/barcode-decode-web.ts`
- Fonction principale: `decodeBarcodeFromDataUrl()`
- Gère la détection iOS et sélection automatique des méthodes
- Preprocessing d'image (EXIF, crop, rotation, upscaling)

### `lib/barcode-decoder-wrapper.ts` (Phase 3)
- Wrapper unifié pour toutes les méthodes
- Interface commune avec sélection automatique
- Utile pour tests et futures améliorations

### `components/barcode-scanner.tsx`
- Composant React pour l'interface utilisateur
- Gère la capture photo, le feedback utilisateur, les logs
- Appelle `decodeBarcodeFromDataUrl()` et `extractBarcodeWithOpenAI()`

## Optimisations iOS (Phase 2)

### Problèmes identifiés
- QuaggaJS et ZXing causaient des timeouts de 20s sur iOS Safari
- Trop de tentatives (6 crops × 3 méthodes × rotations) = trop lent
- WebWorkers instables sur iOS Safari

### Solutions implémentées
1. **Détection iOS**: Utilisation de `isIOSSafari()` pour détecter iOS Safari
2. **Désactivation QuaggaJS/ZXing sur iOS**: Utilisation uniquement de Cloud Vision API
3. **Réduction des stratégies**: 3 crops au lieu de 6 sur iOS
4. **Pas de rotations sur iOS**: Gain de temps significatif
5. **OpenAI Vision en fallback**: Si Cloud Vision échoue, le composant parent essaie OpenAI Vision

## Utilisation du wrapper unifié (Phase 3)

### Exemple basique
```typescript
import { decodeBarcodeUnified } from '../lib/barcode-decoder-wrapper';

const result = await decodeBarcodeUnified(dataUrl, {
  userId: currentUserId,
  emailVerified: true,
  timeout: 20000
});

if (result.barcode) {
  console.log(`Code-barres détecté: ${result.barcode}`);
  console.log(`Méthode utilisée: ${result.method}`);
  console.log(`Durée: ${result.duration}ms`);
  console.log(`Tentatives: ${result.attempts}`);
}
```

### Configuration avancée
```typescript
// Forcer une méthode spécifique (pour tests)
const result = await decodeBarcodeUnified(dataUrl, {
  forceMethod: 'cloud_vision',
  userId: currentUserId,
  emailVerified: true
});

// Désactiver certaines méthodes
const result = await decodeBarcodeUnified(dataUrl, {
  disabledMethods: ['quaggajs', 'zxing'], // Utiliser uniquement Cloud Vision
  userId: currentUserId,
  emailVerified: true
});
```

## Métriques et analytics

Tous les événements de scan sont trackés via Firebase Analytics:
- `barcode_scan_success`: Succès avec méthode utilisée, durée, tentatives
- `barcode_scan_failure`: Échec avec méthodes essayées, durée

## Logs Firebase

Tous les événements critiques sont loggés dans Firestore (`user_logs`):
- Début/fin de décodage
- Timeouts
- Erreurs
- Succès avec détails (méthode, durée, tentatives)

## Améliorations futures

1. **Cache des résultats**: Mémoriser les codes-barres scannés récemment
2. **Préprocessing amélioré**: Détection automatique de la meilleure stratégie
3. **Support de plus de formats**: Code 128, Code 39, etc.
4. **Mode batch**: Scanner plusieurs codes-barres en une seule image
