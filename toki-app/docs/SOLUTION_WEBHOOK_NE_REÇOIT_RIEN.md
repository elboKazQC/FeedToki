# Solution : Webhook Ne Reçoit Aucun Événement

## 🚨 Problème Identifié

D'après les captures d'écran Stripe Dashboard :

1. ✅ **Événements générés** : `customer.subscription.created`, `invoice.created`, etc. sont visibles dans Stripe
2. ❌ **Aucun événement envoyé au webhook** : "Aucune livraison au cours des 7 derniers jours"
3. ❌ **`checkout.session.completed` absent** de la liste des événements

## 🔍 Cause Probable

Le webhook est configuré mais **les événements ne sont pas sélectionnés** ou **le webhook n'est pas actif**.

## ✅ Solution Immédiate

### Étape 1 : Vérifier les Événements Sélectionnés

Dans Stripe Dashboard > Webhooks > "test feed-toki" :

1. **Cliquer sur "Afficher"** à côté de "Écoute de 3 événements"
2. **Vérifier que ces événements sont sélectionnés** :
   - ✅ `checkout.session.completed` (si disponible)
   - ✅ `customer.subscription.created` (ALTERNATIVE - visible dans les événements)
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`

### Étape 2 : Si les Événements Ne Sont Pas Sélectionnés

1. **Cliquer sur "Modifier la destination"** (bouton en haut à droite)
2. **Cocher les événements** :
   - ✅ `checkout.session.completed`
   - ✅ `customer.subscription.created` (CRITIQUE - cet événement est visible dans vos logs)
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
3. **Sauvegarder**

### Étape 3 : Déployer les Modifications

J'ai ajouté la gestion de `customer.subscription.created` dans le code. Il faut déployer :

```bash
cd toki-app/functions
npm run build
firebase deploy --only functions:handleStripeWebhook
```

### Étape 4 : Tester

1. **Tester manuellement le webhook** :
   - Dans Stripe Dashboard > Webhooks > "test feed-toki"
   - Cliquer sur "Envoyer des événements de test"
   - Sélectionner `customer.subscription.created`
   - Envoyer
   - Vérifier les logs Firebase Functions

2. **Ou créer une nouvelle subscription** :
   - Utiliser l'app pour créer une nouvelle subscription
   - Vérifier que le webhook est appelé

## 📊 Modifications Apportées

### 1. Ajout de `subscription_data.metadata` dans `createCheckoutSession`

Pour que l'événement `customer.subscription.created` ait le `userId` :

```typescript
subscription_data: {
  metadata: {
    userId: userId,
  },
}
```

### 2. Gestion de `customer.subscription.created` dans `handleStripeWebhook`

Le webhook gère maintenant aussi `customer.subscription.created` comme alternative à `checkout.session.completed`.

## 🎯 Action Immédiate

**Pouvez-vous vérifier dans Stripe Dashboard > Webhooks > "test feed-toki" > "Afficher" si `customer.subscription.created` est sélectionné ?**

Si ce n'est pas le cas, c'est la cause du problème ! Il faut le cocher et sauvegarder.
