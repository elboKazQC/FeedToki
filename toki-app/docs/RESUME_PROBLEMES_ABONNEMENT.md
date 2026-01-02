# Résumé des Problèmes d'Abonnement

## 🚨 Problèmes Identifiés

### 1. Erreur React #418 (Hydratation)
**Symptôme** : `Uncaught Error: Minified React error #418` dans la console

**Cause** : Problème d'hydratation SSR/client sur web

**Solution** : ✅ Corrigé - Le composant wrapper ne doit pas utiliser de hooks avant le return conditionnel

### 2. Webhook Stripe Non Appelé ⚠️ **PROBLÈME PRINCIPAL**
**Symptôme** : 
- Le paiement réussit
- L'utilisateur est redirigé vers `/subscription?success=true`
- Mais l'abonnement n'apparaît jamais dans Firestore
- Les logs Firebase Functions ne montrent **AUCUN** appel à `handleStripeWebhook`

**Cause** : Le webhook Stripe n'est probablement pas configuré dans Stripe Dashboard

**Solution** : Voir `docs/PROBLEME_WEBHOOK_NON_APPELÉ.md`

## ✅ Ce qui Fonctionne

1. ✅ Création de session Checkout Stripe (`createCheckoutSession`)
2. ✅ Redirection vers Stripe Checkout
3. ✅ Paiement avec carte de test
4. ✅ Retour à l'application avec `?success=true`
5. ✅ Logs détaillés dans `handleStripeWebhook` (prêts à recevoir les webhooks)
6. ✅ Scripts de test pour créer manuellement l'abonnement

## ❌ Ce qui Ne Fonctionne Pas

1. ❌ Le webhook Stripe n'est jamais appelé
2. ❌ L'abonnement n'est pas créé dans Firestore automatiquement
3. ⚠️ Erreur React #418 (en cours de correction)

## 🔧 Actions Requises

### Action 1 : Configurer le Webhook Stripe (CRITIQUE)

1. Aller dans **Stripe Dashboard** > **Developers** > **Webhooks** (mode TEST)
2. Vérifier si un webhook existe avec l'URL :
   ```
   https://us-central1-feed-toki.cloudfunctions.net/handleStripeWebhook
   ```
3. Si le webhook n'existe pas :
   - Cliquer sur **"Add endpoint"**
   - URL : `https://us-central1-feed-toki.cloudfunctions.net/handleStripeWebhook`
   - Sélectionner les événements :
     - ✅ `checkout.session.completed` (OBLIGATOIRE)
     - ✅ `customer.subscription.updated`
     - ✅ `customer.subscription.deleted`
   - Cliquer sur **"Add endpoint"**
   - Copier le **Signing secret** (commence par `whsec_...`)
   - Configurer dans Firebase (voir ci-dessous)

4. Si le webhook existe mais n'est pas appelé :
   - Vérifier l'URL (doit être exactement celle indiquée)
   - Vérifier que les événements sont sélectionnés
   - Vérifier dans **Events** si des événements ont été envoyés

### Action 2 : Vérifier le Webhook Secret

Le webhook secret est déjà configuré : `whsec_oufgvtk4nrHCgSFwtBW945gsjT0qBjEy`

Si vous créez un nouveau webhook, mettre à jour le secret :
```bash
cd toki-app/functions
firebase functions:config:set stripe.webhook_secret="whsec_NOUVEAU_SECRET"
firebase deploy --only functions
```

### Action 3 : Tester à Nouveau

Après avoir configuré le webhook :
1. Faire un nouveau paiement avec la carte de test
2. Vérifier les logs Firebase Functions :
   ```bash
   firebase functions:log | grep -i "handleStripeWebhook"
   ```
3. Vérifier dans Stripe Dashboard > Webhooks > Events si l'événement a été envoyé

## 📊 Logs à Surveiller

### Dans Firebase Functions :
```bash
firebase functions:log | grep -i "handleStripeWebhook"
```

Vous devriez voir :
- `[handleStripeWebhook] 🎯 NOUVEAU WEBHOOK REÇU`
- `[handleStripeWebhook] 📦 Événement: checkout.session.completed`
- `[handleStripeWebhook] ✅ Subscription créée/mise à jour pour ...`

### Dans Stripe Dashboard :
- Aller dans **Developers** > **Webhooks** > [Votre webhook] > **Events**
- Vérifier si des événements `checkout.session.completed` ont été envoyés
- Vérifier leur statut (Succeeded ou Failed)

## 🔄 Solution Temporaire

En attendant que le webhook soit configuré, vous pouvez créer l'abonnement manuellement :

1. **Via Firebase Console** :
   - Aller dans Firestore > Collection `users` > Document `{userId}`
   - Ajouter le champ `subscription` (type: map) avec les données

2. **Via Script** :
   ```bash
   cd toki-app
   npx ts-node scripts/create-subscription-final.ts <userId> <subscriptionId>
   ```

## 📝 Notes

- Le webhook doit être configuré **séparément pour TEST et PRODUCTION**
- L'URL du webhook doit être **exactement** celle indiquée
- Les logs détaillés dans `handleStripeWebhook` montreront exactement ce qui se passe une fois le webhook configuré
