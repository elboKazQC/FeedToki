# Problème : Webhook Stripe non appelé

## Problème identifié

Après un paiement réussi via Stripe Checkout, le webhook `handleStripeWebhook` n'a pas été appelé, donc l'abonnement n'a pas été créé dans Firestore.

## Causes possibles

1. **Webhook non configuré dans Stripe Dashboard**
   - Le webhook doit être configuré dans Stripe Dashboard > Developers > Webhooks
   - URL: `https://us-central1-feed-toki.cloudfunctions.net/handleStripeWebhook`
   - Événements requis: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

2. **Webhook secret incorrect**
   - Le secret du webhook doit être configuré dans Firebase Functions
   - Vérifier avec: `firebase functions:config:get`
   - Configurer avec: `firebase functions:config:set stripe.webhook_secret="whsec_..."`

3. **Webhook appelé mais échoué**
   - Vérifier les logs Firebase Functions: `firebase functions:log`
   - Chercher les erreurs dans `handleStripeWebhook`

4. **Paiement non complété**
   - Vérifier dans Stripe Dashboard si le paiement est bien "succeeded"
   - Vérifier si la session checkout est "complete"

## Solution immédiate : Créer l'abonnement manuellement

### Option 1 : Utiliser la fonction Firebase `createSubscriptionManually`

1. Aller dans Firebase Console > Functions
2. Trouver la fonction `createSubscriptionManually`
3. L'appeler avec les paramètres:
   ```json
   {
     "userId": "cRHlBQJshyR9uDx1FpPMMruaaOW2",
     "subscriptionId": "sub_1SknCIGdme3i0KJAW3s35lNa"
   }
   ```

### Option 2 : Utiliser le script (nécessite serviceAccountKey.json)

```bash
cd toki-app
# Installer firebase-admin dans le répertoire principal si nécessaire
npm install firebase-admin --save-dev
npx ts-node scripts/create-subscription-manually.ts
```

### Option 3 : Créer directement dans Firestore Console

1. Aller dans Firebase Console > Firestore
2. Naviguer vers `users/cRHlBQJshyR9uDx1FpPMMruaaOW2`
3. Ajouter/modifier le champ `subscription`:
   ```json
   {
     "tier": "paid",
     "status": "active",
     "subscriptionStartDate": "2026-01-01T00:00:00.000Z",
     "subscriptionEndDate": "2026-02-01T00:00:00.000Z",
     "stripeCustomerId": "cus_TiDXZZf5MqNgtk",
     "stripeSubscriptionId": "sub_1SknCIGdme3i0KJAW3s35lNa",
     "createdAt": "2026-01-01T00:00:00.000Z"
   }
   ```

## Vérification du webhook dans Stripe

1. Aller dans Stripe Dashboard > Developers > Webhooks
2. Vérifier que le webhook existe avec l'URL correcte
3. Vérifier les événements sélectionnés
4. Vérifier les logs du webhook pour voir s'il a été appelé
5. Si le webhook n'existe pas, le créer:
   - URL: `https://us-central1-feed-toki.cloudfunctions.net/handleStripeWebhook`
   - Événements: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Copier le "Signing secret" (commence par `whsec_`)
   - Configurer dans Firebase: `firebase functions:config:set stripe.webhook_secret="whsec_..."`

## Prévention

Pour éviter ce problème à l'avenir:

1. **Tester le webhook après chaque déploiement**
   - Utiliser Stripe CLI pour tester localement: `stripe listen --forward-to localhost:5001/feed-toki/us-central1/handleStripeWebhook`
   - Utiliser Stripe Dashboard pour envoyer un événement de test

2. **Ajouter des logs détaillés**
   - Les logs dans `handleStripeWebhook` sont déjà détaillés
   - Vérifier régulièrement les logs Firebase Functions

3. **Créer un fallback**
   - Ajouter un bouton "Créer abonnement manuellement" pour les admins
   - Utiliser la fonction `createSubscriptionManually` existante

## Informations de test

- **User ID**: `cRHlBQJshyR9uDx1FpPMMruaaOW2`
- **Customer ID**: `cus_TiDXZZf5MqNgtk`
- **Subscription ID**: `sub_1SknCIGdme3i0KJAW3s35lNa`
- **Webhook URL (TEST)**: `https://us-central1-feed-toki.cloudfunctions.net/handleStripeWebhook`
- **Webhook Secret (TEST)**: `whsec_oufgvtk4nrHCgSFwtBW945gsjT0qBjEy`
