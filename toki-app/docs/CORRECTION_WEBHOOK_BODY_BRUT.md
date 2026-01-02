# ✅ Correction : Webhook Stripe - Body Brut

## 🎯 Problème Identifié

Les événements Stripe étaient envoyés (8 événements le 1er janvier 2026), mais **tous échouaient** avec l'erreur :

```
Webhook payload must be provided as a string or a Buffer instance representing the _raw_ request body.
Payload was provided as a parsed JavaScript object instead.
```

## 🔍 Cause du Problème

Firebase Functions parse automatiquement le body de la requête en JSON, mais **Stripe a besoin du body brut (raw)** pour vérifier la signature du webhook. Sans le body brut, Stripe ne peut pas vérifier que l'événement provient bien de Stripe.

## ✅ Solution Appliquée

1. **Installation d'Express** :
   ```bash
   cd toki-app/functions
   npm install express
   npm install --save-dev @types/express
   ```

2. **Modification de la fonction** pour utiliser Express avec `express.raw()` :
   - Utilisation de `express.raw({ type: 'application/json' })` pour recevoir le body brut
   - Le body est maintenant un `Buffer` au lieu d'un objet JSON parsé
   - Stripe peut maintenant vérifier la signature correctement

3. **Code modifié** :
   ```typescript
   import express from 'express';
   import { Request, Response } from 'express';

   const app = express();

   // IMPORTANT: Utiliser express.raw() pour recevoir le body brut
   app.use('/handleStripeWebhook', express.raw({ type: 'application/json' }));

   app.post('/handleStripeWebhook', async (req: Request, res: Response) => {
     // req.body est maintenant un Buffer (body brut)
     event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
     // ...
   });

   export const handleStripeWebhook = functions.https.onRequest(app);
   ```

## 📋 Test de la Correction

### Étape 1 : Vérifier que la fonction est déployée

```bash
firebase functions:list
```

La fonction `handleStripeWebhook` doit être listée.

### Étape 2 : Tester le webhook depuis Stripe Dashboard

1. Aller dans Stripe Dashboard > Webhooks > `feed-toki test`
2. Cliquer sur **"Send test webhook"**
3. Sélectionner `customer.subscription.created`
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

**Plus d'erreur "Webhook payload must be provided as a string or a Buffer"** ✅

### Étape 3 : Tester avec un Paiement Réel

1. Créer une nouvelle session Checkout depuis l'app
2. Compléter le paiement avec une carte de test
3. Vérifier dans Stripe Dashboard que les événements sont maintenant **réussis** (pas échoués)
4. Vérifier que la subscription est créée dans Firestore
5. Vérifier que l'app affiche "Abonnement actif"

## 🔍 Vérification dans Stripe Dashboard

Après la correction, dans Stripe Dashboard > Webhooks > `feed-toki test` :

- **Événements envoyés** : Devrait montrer des événements **réussis** (pas seulement échoués)
- **Temps de réponse** : Devrait être normal (< 2 secondes)
- **État** : Les événements devraient avoir le statut "Réussi" au lieu de "Échoué"

## 📊 Logs à Surveiller

**Logs Firebase Functions :**
```bash
firebase functions:log --only handleStripeWebhook
```

**Logs attendus après correction :**
```
[handleStripeWebhook] Body is Buffer: true
[handleStripeWebhook] ✅ Signature vérifiée
[handleStripeWebhook] Type d'événement: customer.subscription.created
[handleStripeWebhook] ✅✅✅ Subscription créée/mise à jour pour ...
```

**Plus d'erreur :**
```
❌ Erreur vérification signature: Webhook payload must be provided as a string or a Buffer
```

## ✅ Checklist de Vérification

- [ ] Express installé dans `functions/package.json`
- [ ] `@types/express` installé dans `functions/package.json`
- [ ] Fonction modifiée pour utiliser `express.raw()`
- [ ] Fonction compilée sans erreurs TypeScript
- [ ] Fonction déployée avec succès
- [ ] Test webhook envoyé depuis Stripe Dashboard
- [ ] Logs Firebase Functions montrent "Signature vérifiée"
- [ ] Pas d'erreur "Webhook payload must be provided as a string or a Buffer"
- [ ] Événements réussis dans Stripe Dashboard
- [ ] Subscription créée dans Firestore après paiement
- [ ] App affiche "Abonnement actif"

---

**Dernière mise à jour :** Janvier 2025
