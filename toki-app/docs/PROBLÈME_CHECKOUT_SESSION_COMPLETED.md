# Problème : checkout.session.completed Non Envoyé

## 🚨 Diagnostic

D'après les captures d'écran Stripe Dashboard :

1. ✅ **Subscription créée** : `sub_1SknCIGdme3i0KJAW35351Na` (14 h 49 min 54 s)
2. ✅ **Événements Stripe générés** : `customer.subscription.created`, `invoice.created`, `payment_intent.created`, etc.
3. ❌ **`checkout.session.completed` ABSENT** de la liste des événements
4. ❌ **Aucun événement envoyé au webhook** : "Aucune livraison au cours des 7 derniers jours"

## 🔍 Causes Possibles

### 1. L'Événement `checkout.session.completed` N'Est Pas Sélectionné

**Vérification** :
- Dans Stripe Dashboard > Webhooks > "test feed-toki"
- Cliquer sur "Afficher" à côté de "Écoute de 3 événements"
- Vérifier que `checkout.session.completed` est bien coché

**Solution** : Si non coché, cocher et sauvegarder.

### 2. Le Webhook N'Est Pas Actif

**Vérification** :
- Dans Stripe Dashboard > Webhooks > "test feed-toki"
- Vérifier que le statut est "Actif" (vert)

**Solution** : Si inactif, activer le webhook.

### 3. L'Événement N'Est Pas Généré par Stripe

**Cause possible** : Si le paiement est fait directement via Stripe Dashboard (pas via Checkout), l'événement `checkout.session.completed` n'est pas généré.

**Vérification** :
- Dans Stripe Dashboard > **Checkout Sessions**
- Vérifier s'il y a une session checkout avec le statut "complete"
- Si non, le paiement a été fait directement (sans Checkout), donc pas d'événement `checkout.session.completed`

## 🔧 Solutions

### Solution 1 : Vérifier et Sélectionner l'Événement

1. Dans Stripe Dashboard > Webhooks > "test feed-toki"
2. Cliquer sur "Modifier la destination"
3. Vérifier/Cocher les événements :
   - ✅ `checkout.session.completed` (OBLIGATOIRE)
   - ✅ `customer.subscription.created` (Alternative si checkout.session.completed ne fonctionne pas)
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
4. Sauvegarder

### Solution 2 : Utiliser `customer.subscription.created` en Alternative

Si `checkout.session.completed` ne fonctionne pas, on peut utiliser `customer.subscription.created` qui est visible dans les événements.

**Modifier le code** pour gérer aussi `customer.subscription.created` :

```typescript
case 'customer.subscription.created': {
  // Même logique que checkout.session.completed
  const subscription = event.data.object;
  const userId = subscription.metadata?.userId;
  // ... créer l'abonnement dans Firestore
}
```

### Solution 3 : Vérifier la Session Checkout

1. Dans Stripe Dashboard > **Checkout Sessions**
2. Vérifier s'il y a des sessions avec le statut "complete"
3. Si oui, vérifier pourquoi l'événement n'est pas envoyé
4. Si non, le paiement a été fait directement (sans Checkout)

## 📊 Vérification Immédiate

Dans Stripe Dashboard :

1. **Aller dans Checkout Sessions** :
   - Vérifier s'il y a des sessions checkout
   - Vérifier leur statut (complete, open, expired)

2. **Aller dans Webhooks > "test feed-toki"** :
   - Cliquer sur "Afficher" à côté de "Écoute de 3 événements"
   - **Vérifier que `checkout.session.completed` est coché**
   - Si non, cocher et sauvegarder

3. **Tester manuellement** :
   - Cliquer sur "Envoyer des événements de test"
   - Sélectionner `checkout.session.completed`
   - Envoyer
   - Vérifier les logs Firebase Functions

## 🎯 Action Immédiate

**Pouvez-vous vérifier dans Stripe Dashboard > Webhooks > "test feed-toki" > "Afficher" (à côté de "Écoute de 3 événements") si `checkout.session.completed` est bien sélectionné ?**

Si ce n'est pas le cas, c'est probablement la cause du problème !
