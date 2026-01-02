# Diagnostic : Webhook Stripe Non Appelé

## 🚨 Problème Confirmé

**Le webhook Stripe n'a JAMAIS été appelé** après le paiement. Les logs Firebase Functions ne montrent **AUCUN** appel à `handleStripeWebhook`.

## ✅ Ce qui Fonctionne

1. ✅ Le paiement Stripe réussit
2. ✅ L'utilisateur est redirigé vers `/subscription?success=true`
3. ✅ L'application affiche "Abonnement en cours d'activation..."
4. ✅ Le code du webhook est prêt avec des logs détaillés

## ❌ Ce qui Ne Fonctionne Pas

1. ❌ Le webhook Stripe n'est **jamais appelé**
2. ❌ L'abonnement n'est **jamais créé** dans Firestore
3. ❌ Le statut reste `null` et le tier reste `expired`

## 🔍 Diagnostic : Vérifier dans Stripe Dashboard

### Étape 1 : Vérifier si le Webhook Existe

1. Aller sur **Stripe Dashboard** > **Developers** > **Webhooks** (mode TEST)
2. Vérifier s'il y a un webhook avec l'URL :
   ```
   https://us-central1-feed-toki.cloudfunctions.net/handleStripeWebhook
   ```

### Étape 2 : Si le Webhook N'Existe Pas

**C'est probablement le problème !** Le webhook n'est pas configuré.

**Solution** :
1. Cliquer sur **"Add endpoint"** ou **"Add webhook"**
2. **Endpoint URL** : 
   ```
   https://us-central1-feed-toki.cloudfunctions.net/handleStripeWebhook
   ```
3. **Sélectionner les événements** :
   - ✅ `checkout.session.completed` (OBLIGATOIRE)
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
4. Cliquer sur **"Add endpoint"**
5. **Copier le Signing secret** (commence par `whsec_...`)
6. Vérifier que c'est le même que celui configuré dans Firebase Functions

### Étape 3 : Si le Webhook Existe

Vérifier dans **Stripe Dashboard** > **Developers** > **Webhooks** > [Votre webhook] > **Events** :

1. **Y a-t-il des événements récents ?**
   - Si **NON** : Le webhook n'est pas appelé (problème de configuration)
   - Si **OUI** : Vérifier le statut (Succeeded ou Failed)

2. **Si des événements ont été envoyés mais ont échoué** :
   - Cliquer sur l'événement pour voir les détails
   - Vérifier l'erreur (probablement signature invalide ou URL incorrecte)

### Étape 4 : Vérifier l'URL du Webhook

L'URL doit être **exactement** :
```
https://us-central1-feed-toki.cloudfunctions.net/handleStripeWebhook
```

**Vérifications** :
- ✅ Pas de slash à la fin
- ✅ `https://` (pas `http://`)
- ✅ `us-central1` (pas une autre région)
- ✅ `feed-toki` (nom du projet Firebase)
- ✅ `handleStripeWebhook` (nom exact de la fonction)

### Étape 5 : Vérifier les Événements Sélectionnés

Les événements suivants doivent être sélectionnés :
- ✅ `checkout.session.completed` (CRITIQUE - c'est celui qui déclenche la création d'abonnement)
- ✅ `customer.subscription.updated`
- ✅ `customer.subscription.deleted`

### Étape 6 : Vérifier le Webhook Secret

1. Dans Stripe Dashboard, copier le **Signing secret** (commence par `whsec_...`)
2. Vérifier dans Firebase Functions :
   ```bash
   cd toki-app/functions
   firebase functions:config:get
   ```
3. Vérifier que `stripe.webhook_secret` correspond au secret dans Stripe Dashboard

## 🔧 Solution : Configurer le Webhook

### Si le Webhook N'Existe Pas

1. **Dans Stripe Dashboard** (mode TEST) :
   - Aller dans **Developers** > **Webhooks**
   - Cliquer sur **"Add endpoint"**
   - URL : `https://us-central1-feed-toki.cloudfunctions.net/handleStripeWebhook`
   - Événements : `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Cliquer sur **"Add endpoint"**
   - **Copier le Signing secret**

2. **Configurer le secret dans Firebase** (si différent) :
   ```bash
   cd toki-app/functions
   firebase functions:config:set stripe.webhook_secret="whsec_NOUVEAU_SECRET"
   firebase deploy --only functions
   ```

### Si le Webhook Existe Mais N'Est Pas Appelé

1. **Vérifier l'URL** : Doit être exactement celle indiquée ci-dessus
2. **Vérifier les événements** : `checkout.session.completed` doit être sélectionné
3. **Tester manuellement** : Dans Stripe Dashboard, cliquer sur **"Send test webhook"** pour tester

## 📊 Vérification Après Configuration

Après avoir configuré le webhook :

1. **Faire un nouveau paiement** avec la carte de test
2. **Vérifier dans Stripe Dashboard** > **Webhooks** > **Events** :
   - Un événement `checkout.session.completed` devrait apparaître
   - Le statut devrait être **"Succeeded"** (vert)
3. **Vérifier les logs Firebase Functions** :
   ```bash
   firebase functions:log | grep -i "handleStripeWebhook"
   ```
   Vous devriez voir :
   - `[handleStripeWebhook] 🎯 NOUVEAU WEBHOOK REÇU`
   - `[handleStripeWebhook] 📦 Événement: checkout.session.completed`
   - `[handleStripeWebhook] ✅ Subscription créée/mise à jour pour ...`
4. **Vérifier dans Firebase Console** :
   - Le champ `subscription` devrait être mis à jour avec `tier: "paid"` et `status: "active"`

## 🐛 Si le Webhook Échoue Après Configuration

Si le webhook est appelé mais échoue, vérifier les logs Firebase Functions pour voir l'erreur exacte. Les logs détaillés montreront :
- Si la signature est valide
- Si le `userId` est présent dans les metadata
- Si l'écriture dans Firestore a réussi

## 📝 Notes Importantes

- Le webhook doit être configuré **séparément pour TEST et PRODUCTION**
- L'URL doit être **exactement** celle indiquée (pas de slash final)
- Le webhook secret TEST est différent du webhook secret PRODUCTION
- Les logs détaillés dans `handleStripeWebhook` montreront exactement ce qui se passe une fois le webhook configuré
