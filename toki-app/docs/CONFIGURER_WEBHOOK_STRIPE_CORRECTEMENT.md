# 🔧 Guide : Configurer le Webhook Stripe Correctement

## 🎯 Problème Actuel

Le webhook Stripe `test feed-toki` est actif mais a envoyé **0 événements**, ce qui signifie que Stripe n'appelle jamais notre fonction Firebase `handleStripeWebhook`.

## ✅ Solution : Configuration Complète du Webhook

### Étape 1 : Vérifier l'URL du Webhook

L'URL du webhook doit être exactement :

**Mode TEST :**
```
https://us-central1-feed-toki.cloudfunctions.net/handleStripeWebhook
```

**Mode PRODUCTION :**
```
https://us-central1-feed-toki.cloudfunctions.net/handleStripeWebhook
```

⚠️ **IMPORTANT :** L'URL doit être accessible publiquement (pas de localhost, pas de tunnel).

### Étape 2 : Configurer le Webhook dans Stripe Dashboard

1. **Aller dans Stripe Dashboard :**
   - Mode TEST : https://dashboard.stripe.com/test/webhooks
   - Mode PRODUCTION : https://dashboard.stripe.com/webhooks

2. **Créer un nouveau webhook OU modifier l'existant :**
   - Cliquer sur "Add endpoint" (nouveau) ou "..." > "Edit" (existant)

3. **Configurer l'URL :**
   - Coller l'URL : `https://us-central1-feed-toki.cloudfunctions.net/handleStripeWebhook`

4. **Sélectionner les événements à écouter :**
   
   ⚠️ **CRITIQUE :** Sélectionner au minimum ces événements :
   
   - ✅ `checkout.session.completed` (quand le paiement est complété)
   - ✅ `customer.subscription.created` (quand une subscription est créée)
   - ✅ `customer.subscription.updated` (quand une subscription est mise à jour)
   - ✅ `customer.subscription.deleted` (quand une subscription est annulée)
   - ✅ `invoice.payment_succeeded` (quand un paiement récurrent réussit)
   - ✅ `invoice.payment_failed` (quand un paiement échoue)

5. **Sauvegarder le webhook**

6. **Copier le "Signing secret" :**
   - Cliquer sur le webhook créé
   - Dans la section "Signing secret", cliquer sur "Reveal" ou "Click to reveal"
   - Copier le secret (commence par `whsec_...`)

### Étape 3 : Configurer le Secret dans Firebase Functions

**Mode TEST :**
```bash
cd toki-app
firebase functions:config:set stripe.webhook_secret="whsec_..."
```

**OU via Firebase Console :**
1. Aller dans Firebase Console > Functions > Configuration
2. Ajouter une variable d'environnement :
   - **Nom :** `STRIPE_WEBHOOK_SECRET`
   - **Valeur :** `whsec_...` (le secret copié depuis Stripe)

### Étape 4 : Redéployer les Functions

```bash
cd toki-app
firebase deploy --only functions:handleStripeWebhook
```

### Étape 5 : Tester le Webhook

#### Option A : Test depuis Stripe Dashboard (Recommandé)

1. Aller dans Stripe Dashboard > Webhooks
2. Cliquer sur votre webhook
3. Cliquer sur "Send test webhook"
4. Sélectionner un événement (ex: `customer.subscription.created`)
5. Cliquer sur "Send test webhook"
6. Vérifier les logs Firebase Functions :
   ```bash
   firebase functions:log --only handleStripeWebhook
   ```

#### Option B : Test avec un Paiement Réel

1. Créer une session Checkout depuis l'app
2. Compléter le paiement avec une carte de test
3. Vérifier les logs Firebase Functions :
   ```bash
   firebase functions:log --only handleStripeWebhook
   ```

### Étape 6 : Vérifier que le Webhook Fonctionne

**Dans Stripe Dashboard :**
- Aller dans Webhooks > Votre webhook
- Vérifier que "Events sent" > 0
- Cliquer sur "Events" pour voir les événements envoyés

**Dans Firebase Functions Logs :**
```bash
firebase functions:log --only handleStripeWebhook
```

Vous devriez voir des logs comme :
```
[handleStripeWebhook] 🎯 NOUVEAU WEBHOOK REÇU
[handleStripeWebhook] Type d'événement: customer.subscription.created
[handleStripeWebhook] ✅✅✅ Subscription créée/mise à jour pour ...
```

## 🔍 Diagnostic : Pourquoi le Webhook n'est pas Appelé ?

### Problème 1 : URL Incorrecte

**Symptômes :**
- Webhook actif mais 0 événements
- Erreurs 404 dans Stripe Dashboard

**Solution :**
- Vérifier que l'URL est exactement : `https://us-central1-feed-toki.cloudfunctions.net/handleStripeWebhook`
- Vérifier que la fonction est déployée : `firebase functions:list`

### Problème 2 : Événements Non Sélectionnés

**Symptômes :**
- Webhook actif mais 0 événements
- Les événements ne sont pas dans la liste "Events to send"

**Solution :**
- Ajouter les événements manquants dans Stripe Dashboard
- Redéployer la fonction si nécessaire

### Problème 3 : Webhook Secret Incorrect

**Symptômes :**
- Webhook appelé mais erreur "Webhook Error: Invalid signature"
- Logs Firebase montrent "Erreur vérification signature"

**Solution :**
- Vérifier que le secret dans Firebase Functions correspond au secret dans Stripe Dashboard
- Re-copier le secret depuis Stripe Dashboard
- Redéployer la fonction

### Problème 4 : Mode TEST vs PRODUCTION

**Symptômes :**
- Webhook configuré en mode TEST mais paiement en mode PRODUCTION (ou vice versa)

**Solution :**
- S'assurer que le webhook est configuré dans le bon mode (TEST ou PRODUCTION)
- S'assurer que `STRIPE_SECRET_KEY` dans Firebase Functions correspond au bon mode

## 📋 Checklist de Vérification

- [ ] Webhook créé dans Stripe Dashboard
- [ ] URL correcte : `https://us-central1-feed-toki.cloudfunctions.net/handleStripeWebhook`
- [ ] Événements sélectionnés : `checkout.session.completed`, `customer.subscription.created`, etc.
- [ ] Webhook secret copié depuis Stripe Dashboard
- [ ] Webhook secret configuré dans Firebase Functions (`STRIPE_WEBHOOK_SECRET`)
- [ ] Fonction `handleStripeWebhook` déployée
- [ ] Test webhook envoyé depuis Stripe Dashboard
- [ ] Logs Firebase Functions montrent la réception du webhook
- [ ] Document Firestore utilisateur mis à jour avec `subscription`

## 🚨 Actions Immédiates

1. **Vérifier la configuration actuelle du webhook dans Stripe Dashboard**
2. **S'assurer que `customer.subscription.created` est dans la liste des événements**
3. **Envoyer un test webhook depuis Stripe Dashboard**
4. **Vérifier les logs Firebase Functions**

---

**Dernière mise à jour :** Janvier 2025
