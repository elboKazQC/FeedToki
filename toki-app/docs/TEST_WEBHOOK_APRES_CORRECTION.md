# ✅ Test du Webhook après Correction du Secret

## 🔧 Correction Appliquée

Le secret du webhook a été mis à jour dans Firebase Functions pour correspondre à celui affiché dans Stripe Dashboard :
- **Ancien secret :** `whsec_oufgvtk4nrHCgSFwtBW945gsjT0qBjEy`
- **Nouveau secret :** `whsec_p8xFHSFtuLK1Lp2bkGlxcyz9aoXjsaqh` ✅

La fonction `handleStripeWebhook` a été redéployée avec le nouveau secret.

## 📋 Étapes de Test

### Étape 1 : Vérifier les Événements Configurés

1. Aller dans Stripe Dashboard > Webhooks > `feed-toki test`
2. Cliquer sur **"Afficher"** à côté de "Écoute de 6 événements"
3. **Vérifier que `customer.subscription.created` est dans la liste**

⚠️ **Si `customer.subscription.created` n'est pas dans la liste :**
   - Cliquer sur "..." > "Edit"
   - Ajouter `customer.subscription.created` dans "Events to send"
   - Sauvegarder

### Étape 2 : Tester le Webhook depuis Stripe Dashboard

1. Dans Stripe Dashboard > Webhooks > `feed-toki test`
2. Cliquer sur **"Send test webhook"** (ou "Envoyer un webhook de test")
3. Sélectionner l'événement : **`customer.subscription.created`**
4. Cliquer sur **"Send test webhook"**
5. Vérifier les logs Firebase Functions :
   ```bash
   firebase functions:log --only handleStripeWebhook
   ```

**Résultat attendu :**
```
[handleStripeWebhook] 🎯 NOUVEAU WEBHOOK REÇU
[handleStripeWebhook] ✅ Signature vérifiée
[handleStripeWebhook] Type d'événement: customer.subscription.created
[handleStripeWebhook] ✅✅✅ Subscription créée/mise à jour pour ...
```

**Si vous voyez une erreur "Invalid signature" :**
- Vérifier que le secret dans Firebase Functions correspond exactement à celui dans Stripe Dashboard
- Redéployer la fonction : `firebase deploy --only functions:handleStripeWebhook`

### Étape 3 : Tester avec un Paiement Réel

1. **Créer une nouvelle session Checkout depuis l'app :**
   - Aller dans l'écran d'abonnement
   - Cliquer sur "S'abonner"
   - Compléter le paiement avec une carte de test :
     - Numéro : `4242 4242 4242 4242`
     - Date : N'importe quelle date future (ex: 12/25)
     - CVC : N'importe quel 3 chiffres (ex: 123)
     - Code postal : N'importe quel code postal

2. **Vérifier dans Stripe Dashboard :**
   - Aller dans Stripe Dashboard > Webhooks > `feed-toki test`
   - Vérifier que "Events sent" > 0
   - Cliquer sur "Events" pour voir les événements envoyés
   - Vérifier qu'un événement `customer.subscription.created` a été envoyé

3. **Vérifier les logs Firebase Functions :**
   ```bash
   firebase functions:log --only handleStripeWebhook
   ```
   
   Vous devriez voir :
   ```
   [handleStripeWebhook] 🎯 NOUVEAU WEBHOOK REÇU
   [handleStripeWebhook] ✅ Signature vérifiée
   [handleStripeWebhook] Type d'événement: customer.subscription.created
   [handleStripeWebhook] Subscription ID: sub_...
   [handleStripeWebhook] ✅✅✅ Subscription créée/mise à jour pour ...
   ```

4. **Vérifier dans Firestore :**
   - Aller dans Firebase Console > Firestore
   - Ouvrir le document utilisateur : `users/{votreUserId}`
   - Vérifier que le champ `subscription` existe et contient :
     ```json
     {
       "subscription": {
         "tier": "paid",
         "status": "active",
         "subscriptionStartDate": "...",
         "subscriptionEndDate": "...",
         "stripeCustomerId": "cus_...",
         "stripeSubscriptionId": "sub_...",
         "createdAt": "..."
       }
     }
     ```

5. **Vérifier dans l'app :**
   - Recharger l'écran d'abonnement
   - Le statut devrait maintenant afficher "Abonnement actif" au lieu de "Abonnement expiré"

## 🔍 Diagnostic en Cas de Problème

### Problème : Le webhook n'est toujours pas appelé

**Vérifications :**
1. ✅ URL du webhook correcte : `https://us-central1-feed-toki.cloudfunctions.net/handleStripeWebhook`
2. ✅ Webhook actif (statut "Enabled")
3. ✅ `customer.subscription.created` dans la liste des événements
4. ✅ Secret correspond entre Stripe et Firebase Functions
5. ✅ Fonction déployée

**Si tout est correct mais que le webhook n'est toujours pas appelé :**
- Vérifier que vous êtes en mode TEST dans Stripe Dashboard
- Vérifier que la clé Stripe utilisée dans `createCheckoutSession` est en mode TEST
- Essayer de supprimer et recréer le webhook dans Stripe Dashboard

### Problème : Erreur "Invalid signature"

**Solution :**
1. Re-copier le secret depuis Stripe Dashboard
2. Mettre à jour dans Firebase Functions :
   ```bash
   firebase functions:config:set stripe.webhook_secret="whsec_..."
   ```
3. Redéployer :
   ```bash
   firebase deploy --only functions:handleStripeWebhook
   ```

### Problème : Le webhook est appelé mais la subscription n'est pas créée dans Firestore

**Vérifications :**
1. Vérifier les logs Firebase Functions pour voir les erreurs
2. Vérifier que le `userId` est présent dans les metadata de la subscription
3. Vérifier que le document utilisateur existe dans Firestore (sinon il sera créé automatiquement)

## 📊 Checklist de Vérification

- [ ] Secret du webhook mis à jour dans Firebase Functions
- [ ] Fonction `handleStripeWebhook` redéployée
- [ ] `customer.subscription.created` dans la liste des événements Stripe
- [ ] Test webhook envoyé depuis Stripe Dashboard
- [ ] Logs Firebase Functions montrent la réception du webhook
- [ ] Pas d'erreur "Invalid signature"
- [ ] Paiement test effectué avec succès
- [ ] Événement `customer.subscription.created` visible dans Stripe Dashboard
- [ ] Document Firestore utilisateur mis à jour avec `subscription`
- [ ] App affiche "Abonnement actif"

---

**Dernière mise à jour :** Janvier 2025
