# Comment Trouver l'URL du Webhook Stripe

## Méthode 1: Via Firebase Console (Recommandé)

1. Aller dans Firebase Console: https://console.firebase.google.com
2. Sélectionner votre projet "feed-toki"
3. Aller dans **Functions** (dans le menu de gauche)
4. Cliquer sur une function (ex: `decodeBarcodeCloud`)
5. Dans les détails de la function, vous verrez l'URL complète, par exemple:
   - `https://us-central1-feed-toki.cloudfunctions.net/decodeBarcodeCloud`
6. Pour le webhook, l'URL sera:
   - `https://us-central1-feed-toki.cloudfunctions.net/handleStripeWebhook`
   - (Remplacez `us-central1` par votre région si différente)

## Méthode 2: Via Firebase CLI

```bash
cd toki-app
firebase functions:list
```

Cela affichera toutes vos functions avec leurs URLs complètes.

## Méthode 3: Après Déploiement

Après avoir déployé les functions, l'URL sera visible dans:
- Firebase Console > Functions > handleStripeWebhook
- Ou dans les logs de déploiement

## Régions Communes

Les régions les plus courantes sont:
- `us-central1` (Iowa, USA) - Défaut
- `us-east1` (Caroline du Sud, USA)
- `europe-west1` (Belgique)
- `asia-east1` (Taiwan)

Si vous ne savez pas quelle région, `us-central1` est la plus probable.

## URL Complète Probable

Basé sur votre projet "feed-toki", l'URL est probablement:
```
https://us-central1-feed-toki.cloudfunctions.net/handleStripeWebhook
```

**Mais vérifiez d'abord avec les méthodes ci-dessus pour être sûr!**
