# Vérification Configuration Webhook Stripe

## 🚨 Problème Identifié

Le webhook Stripe **n'a jamais été appelé** après le paiement. Les logs Firebase Functions montrent :
- ✅ `createCheckoutSession` a été appelé et a créé une session
- ❌ **AUCUN** appel à `handleStripeWebhook`

## 🔍 Vérifications à Faire

### 1. Vérifier dans Stripe Dashboard

1. Aller dans **Stripe Dashboard** > **Developers** > **Webhooks**
2. Vérifier qu'un webhook existe avec l'URL :
   ```
   https://us-central1-feed-toki.cloudfunctions.net/handleStripeWebhook
   ```
3. Vérifier que les événements suivants sont sélectionnés :
   - ✅ `checkout.session.completed`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`

### 2. Vérifier les Webhooks Envoyés

Dans Stripe Dashboard > **Developers** > **Webhooks** > [Votre webhook] > **Events** :
- Vérifier s'il y a des événements récents
- Si oui, vérifier s'ils ont réussi ou échoué
- Si échoué, voir les détails de l'erreur

### 3. Vérifier le Webhook Secret

Le webhook secret doit être configuré dans Firebase Functions :
```bash
cd toki-app/functions
firebase functions:config:get
```

Ou via Firebase Console > Functions > Configuration > Secrets

Le secret doit être : `STRIPE_WEBHOOK_SECRET` avec la valeur commençant par `whsec_...`

### 4. Tester le Webhook Manuellement

Si le webhook n'est pas configuré, voici comment le configurer :

1. **Dans Stripe Dashboard** :
   - Aller dans **Developers** > **Webhooks**
   - Cliquer sur **"Add endpoint"**
   - URL : `https://us-central1-feed-toki.cloudfunctions.net/handleStripeWebhook`
   - Sélectionner les événements :
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
   - Cliquer sur **"Add endpoint"**
   - **Copier le "Signing secret"** (commence par `whsec_...`)

2. **Configurer le secret dans Firebase** :
   ```bash
   cd toki-app/functions
   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
   # Coller le secret quand demandé
   ```

   OU via Firebase Console :
   - Aller dans **Functions** > **Configuration** > **Secrets**
   - Ajouter `STRIPE_WEBHOOK_SECRET` avec la valeur du secret

3. **Redéployer les fonctions** :
   ```bash
   cd toki-app
   firebase deploy --only functions
   ```

### 5. Vérifier les Logs après Configuration

Après avoir configuré le webhook, tester à nouveau un paiement et vérifier les logs :

```bash
cd toki-app
firebase functions:log | grep -i "handleStripeWebhook\|webhook"
```

Vous devriez voir :
- `[handleStripeWebhook] 🎯 NOUVEAU WEBHOOK REÇU`
- `[handleStripeWebhook] 📦 Événement: checkout.session.completed`
- `[handleStripeWebhook] ✅ Subscription créée/mise à jour pour ...`

## 🔧 Solution Temporaire

En attendant que le webhook soit configuré, vous pouvez créer l'abonnement manuellement dans Firebase Console (voir `docs/TEST_ABONNEMENT_COMPLET.md`).

## 📝 Notes

- Le webhook doit être configuré **séparément pour TEST et PRODUCTION**
- L'URL du webhook doit être exactement : `https://us-central1-feed-toki.cloudfunctions.net/handleStripeWebhook`
- Le webhook secret TEST est différent du webhook secret PRODUCTION
