# 🔍 Diagnostic : Webhook Stripe avec 0 Événements

## 🎯 Problème Identifié

Le webhook Stripe `test feed-toki` est **actif** mais a envoyé **0 événements**, ce qui signifie que Stripe n'appelle jamais notre fonction Firebase `handleStripeWebhook`.

## ✅ Vérifications à Faire

### 1. Vérifier l'URL du Webhook dans Stripe Dashboard

1. Aller dans Stripe Dashboard > Webhooks (mode TEST)
2. Cliquer sur le webhook `test feed-toki`
3. Vérifier que l'URL est exactement :
   ```
   https://us-central1-feed-toki.cloudfunctions.net/handleStripeWebhook
   ```

⚠️ **Points à vérifier :**
- Pas de `/` à la fin
- Pas de `localhost` ou `127.0.0.1`
- Pas de tunnel local (ngrok, etc.)
- URL accessible publiquement

### 2. Vérifier les Événements Sélectionnés

Dans Stripe Dashboard > Webhooks > Votre webhook > "Events to send" :

**Événements MINIMUM requis :**
- ✅ `checkout.session.completed`
- ✅ `customer.subscription.created`
- ✅ `customer.subscription.updated`
- ✅ `customer.subscription.deleted`

⚠️ **Si `checkout.session.completed` n'est pas dans la liste, c'est normal** - Stripe ne l'envoie pas toujours. C'est pourquoi nous avons ajouté la gestion de `customer.subscription.created`.

### 3. Vérifier que le Webhook est Actif

Dans Stripe Dashboard > Webhooks > Votre webhook :
- Statut doit être **"Enabled"** (pas "Disabled")
- "Events sent" devrait être > 0 après un paiement

### 4. Tester le Webhook depuis Stripe Dashboard

1. Aller dans Stripe Dashboard > Webhooks > Votre webhook
2. Cliquer sur **"Send test webhook"**
3. Sélectionner un événement (ex: `customer.subscription.created`)
4. Cliquer sur **"Send test webhook"**
5. Vérifier les logs Firebase Functions :
   ```bash
   firebase functions:log --only handleStripeWebhook
   ```

**Résultat attendu :**
- Logs montrent `[handleStripeWebhook] 🎯 NOUVEAU WEBHOOK REÇU`
- Logs montrent `[handleStripeWebhook] Type d'événement: customer.subscription.created`
- Pas d'erreur "No stripe-signature header value"

### 5. Vérifier le Webhook Secret

1. Dans Stripe Dashboard > Webhooks > Votre webhook
2. Section "Signing secret" > Cliquer sur "Reveal"
3. Copier le secret (commence par `whsec_...`)
4. Vérifier dans Firebase Functions :
   ```bash
   firebase functions:config:get
   ```
   OU dans Firebase Console > Functions > Configuration

Le secret doit correspondre exactement.

### 6. Vérifier que la Fonction est Déployée

```bash
firebase functions:list
```

La fonction `handleStripeWebhook` doit être listée et accessible.

## 🚨 Actions Correctives

### Si l'URL est Incorrecte

1. **Supprimer l'ancien webhook** dans Stripe Dashboard
2. **Créer un nouveau webhook** avec la bonne URL
3. **Copier le nouveau secret** et le configurer dans Firebase Functions
4. **Redéployer la fonction** :
   ```bash
   firebase deploy --only functions:handleStripeWebhook
   ```

### Si les Événements ne sont pas Sélectionnés

1. Aller dans Stripe Dashboard > Webhooks > Votre webhook
2. Cliquer sur "..." > "Edit"
3. Dans "Events to send", sélectionner :
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Sauvegarder

### Si le Webhook Secret est Incorrect

1. **Re-copier le secret** depuis Stripe Dashboard
2. **Configurer dans Firebase Functions** :
   ```bash
   firebase functions:config:set stripe.webhook_secret="whsec_..."
   ```
3. **Redéployer la fonction** :
   ```bash
   firebase deploy --only functions:handleStripeWebhook
   ```

## 📋 Checklist de Diagnostic

- [ ] URL du webhook correcte dans Stripe Dashboard
- [ ] Webhook actif (statut "Enabled")
- [ ] Événements sélectionnés : `customer.subscription.created`, etc.
- [ ] Webhook secret configuré dans Firebase Functions
- [ ] Fonction `handleStripeWebhook` déployée
- [ ] Test webhook envoyé depuis Stripe Dashboard
- [ ] Logs Firebase Functions montrent la réception du webhook
- [ ] Pas d'erreur "No stripe-signature header value"

## 🔬 Test Manuel

### Option 1 : Test depuis Stripe Dashboard (Recommandé)

1. Stripe Dashboard > Webhooks > Votre webhook
2. "Send test webhook" > Sélectionner `customer.subscription.created`
3. "Send test webhook"
4. Vérifier les logs Firebase Functions

### Option 2 : Test avec un Paiement Réel

1. Créer une session Checkout depuis l'app
2. Compléter le paiement avec une carte de test :
   - Numéro : `4242 4242 4242 4242`
   - Date : N'importe quelle date future
   - CVC : N'importe quel 3 chiffres
3. Vérifier les logs Firebase Functions :
   ```bash
   firebase functions:log --only handleStripeWebhook
   ```

## 📊 Logs à Surveiller

**Logs Firebase Functions :**
```bash
firebase functions:log --only handleStripeWebhook
```

**Logs attendus après un webhook valide :**
```
[handleStripeWebhook] 🎯 NOUVEAU WEBHOOK REÇU
[handleStripeWebhook] ✅ Signature vérifiée
[handleStripeWebhook] Type d'événement: customer.subscription.created
[handleStripeWebhook] ✅✅✅ Subscription créée/mise à jour pour ...
```

**Logs d'erreur à éviter :**
```
[handleStripeWebhook] ❌ Erreur vérification signature: No stripe-signature header value was provided.
```
(Cela signifie que la requête ne vient pas de Stripe)

---

**Dernière mise à jour :** Janvier 2025
