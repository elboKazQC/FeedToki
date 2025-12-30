# Configuration Firebase Functions pour Scan Code-Barres

## Prérequis

1. **Plan Firebase Blaze (pay-as-you-go)**
   - Firebase Functions nécessite le plan Blaze (gratuit jusqu'à un certain quota)
   - Va sur [Firebase Console](https://console.firebase.google.com/project/feed-toki/usage/details)
   - Clique sur "Upgrade to Blaze plan"
   - Le plan Blaze a un quota gratuit généreux pour les fonctions

2. **Activer Google Cloud Vision API**
   - Suis les instructions dans `docs/GOOGLE_VISION_API_SETUP.md`
   - Active l'API dans Google Cloud Console

## Déploiement des Functions

Une fois le plan Blaze activé et Vision API activée:

```bash
cd toki-app
firebase deploy --only functions
```

## Vérification

Après déploiement, teste la fonction:

```bash
# Via Firebase Console > Functions > decodeBarcodeCloud > Test
# Ou via l'app web - le scan devrait utiliser l'API cloud
```

## Coûts

- **Firebase Functions**: Gratuit jusqu'à 2M invocations/mois, puis $0.40 par million
- **Google Vision API**: 1000 requêtes/mois gratuites, puis ~$1.50 pour 1000 requêtes
- **Total estimé**: Gratuit pour < 1000 scans/mois, puis ~$2/mois pour 1000 scans supplémentaires

## Fallback

Si l'API cloud n'est pas disponible (plan Blaze non activé, Vision API non activée, erreur réseau), l'app basculera automatiquement vers QuaggaJS puis ZXing (décodage local).
