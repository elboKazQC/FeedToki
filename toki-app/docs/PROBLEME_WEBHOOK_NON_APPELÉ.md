# Problème : Webhook Stripe Non Appelé

## 🚨 Diagnostic

Après le test de paiement, les logs montrent :
- ✅ `createCheckoutSession` a été appelé et a créé une session Stripe
- ❌ **AUCUN** appel à `handleStripeWebhook` dans les logs Firebase Functions

**Conclusion** : Le webhook Stripe n'a jamais été appelé par Stripe.

## 🔍 Causes Possibles

### 1. Webhook Non Configuré dans Stripe Dashboard

Le webhook n'existe peut-être pas dans Stripe Dashboard.

**Solution** : Vérifier dans Stripe Dashboard > Developers > Webhooks

### 2. URL du Webhook Incorrecte

L'URL du webhook dans Stripe Dashboard doit être exactement :
```
https://us-central1-feed-toki.cloudfunctions.net/handleStripeWebhook
```

**Solution** : Vérifier que l'URL est correcte dans Stripe Dashboard

### 3. Événements Non Sélectionnés

Les événements suivants doivent être sélectionnés :
- `checkout.session.completed` (CRITIQUE)
- `customer.subscription.updated`
- `customer.subscription.deleted`

**Solution** : Vérifier les événements sélectionnés dans Stripe Dashboard

### 4. Mode TEST vs PRODUCTION

Le webhook doit être configuré pour le mode TEST si vous utilisez des cartes de test.

**Solution** : Vérifier que vous êtes en mode TEST dans Stripe Dashboard (bascule en haut à droite)

## ✅ Solution : Configurer le Webhook

### Étape 1 : Aller dans Stripe Dashboard

1. Aller sur https://dashboard.stripe.com/test/webhooks (mode TEST)
2. Cliquer sur **"Add endpoint"** ou **"Add webhook"**

### Étape 2 : Configurer l'URL

1. **Endpoint URL** : 
   ```
   https://us-central1-feed-toki.cloudfunctions.net/handleStripeWebhook
   ```
2. Vérifier que l'URL est exactement celle-ci (pas de slash à la fin)

### Étape 3 : Sélectionner les Événements

Sélectionner au minimum :
- ✅ `checkout.session.completed` (OBLIGATOIRE)
- ✅ `customer.subscription.updated`
- ✅ `customer.subscription.deleted`

### Étape 4 : Récupérer le Webhook Secret

1. Après avoir créé le webhook, cliquer dessus
2. Dans la section **"Signing secret"**, cliquer sur **"Reveal"** ou **"Click to reveal"**
3. **Copier le secret** (commence par `whsec_...`)

### Étape 5 : Configurer le Secret dans Firebase

**Option A : Via Firebase CLI**
```bash
cd toki-app/functions
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
# Coller le secret quand demandé
```

**Option B : Via Firebase Console**
1. Aller dans Firebase Console > Functions > Configuration
2. Onglet **"Secrets"**
3. Cliquer sur **"Add secret"**
4. Nom : `STRIPE_WEBHOOK_SECRET`
5. Valeur : Coller le secret (commence par `whsec_...`)
6. Cliquer sur **"Save"**

### Étape 6 : Redéployer les Fonctions

```bash
cd toki-app
firebase deploy --only functions
```

### Étape 7 : Tester à Nouveau

1. Faire un nouveau paiement avec la carte de test
2. Vérifier les logs Firebase Functions :
   ```bash
   firebase functions:log | grep -i "handleStripeWebhook"
   ```
3. Vous devriez voir :
   - `[handleStripeWebhook] 🎯 NOUVEAU WEBHOOK REÇU`
   - `[handleStripeWebhook] 📦 Événement: checkout.session.completed`
   - `[handleStripeWebhook] ✅ Subscription créée/mise à jour pour ...`

## 🔧 Vérification dans Stripe Dashboard

Après avoir configuré le webhook, dans Stripe Dashboard > Developers > Webhooks > [Votre webhook] > **Events** :

Vous devriez voir les événements envoyés avec leur statut :
- ✅ **Succeeded** : Le webhook a été appelé avec succès
- ❌ **Failed** : Le webhook a échoué (voir les détails)

## 📝 Notes Importantes

- Le webhook doit être configuré **séparément pour TEST et PRODUCTION**
- L'URL doit être **exactement** celle indiquée (pas de slash final)
- Le webhook secret TEST est différent du webhook secret PRODUCTION
- Les logs détaillés dans `handleStripeWebhook` montreront exactement ce qui se passe

## 🐛 Si le Webhook Échoue

Si le webhook est appelé mais échoue, vérifier les logs Firebase Functions pour voir l'erreur exacte. Les logs détaillés montreront :
- Si la signature est valide
- Si les données sont correctes
- Si l'écriture dans Firestore a réussi
