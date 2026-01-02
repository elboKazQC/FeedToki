# Vérifier les Événements Sélectionnés dans le Webhook

## 🔍 Problème

Le webhook est configuré mais **aucun événement n'est envoyé** (Total 0 dans Stripe Dashboard).

## ✅ Vérification Immédiate

Dans Stripe Dashboard, sur la page du webhook "test feed-toki" :

1. **Cliquer sur "Afficher"** à côté de "Écoute de 3 événements"
2. **Vérifier que les événements suivants sont sélectionnés** :
   - ✅ `checkout.session.completed` (CRITIQUE - celui qui déclenche la création d'abonnement)
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`

## 🧪 Tester le Webhook Manuellement

Dans Stripe Dashboard, sur la page du webhook :

1. **Cliquer sur "Envoyer des événements de test"** (bouton en haut à droite)
2. **Sélectionner l'événement** : `checkout.session.completed`
3. **Cliquer sur "Envoyer l'événement de test"**
4. **Vérifier les logs Firebase Functions** :
   ```bash
   firebase functions:log | grep -i "handleStripeWebhook"
   ```
   Vous devriez voir les logs détaillés que nous avons ajoutés.

## 🔧 Si les Événements Ne Sont Pas Sélectionnés

1. **Cliquer sur "Modifier la destination"** (bouton en haut à droite)
2. **Vérifier/Cocher les événements** :
   - ✅ `checkout.session.completed`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
3. **Sauvegarder**

## 📊 Vérifier Pourquoi Aucun Événement N'Est Envoyé

Même si le webhook est configuré, Stripe peut ne pas envoyer d'événements si :

1. **Le paiement n'a pas vraiment réussi** :
   - Vérifier dans Stripe Dashboard > **Payments** si le paiement apparaît
   - Vérifier le statut du paiement

2. **La session checkout n'a pas créé de subscription** :
   - Vérifier dans Stripe Dashboard > **Subscriptions** si une subscription a été créée
   - Si non, le problème est dans `createCheckoutSession`

3. **Le webhook n'est pas actif** :
   - Vérifier que le statut est "Actif" (vert) dans Stripe Dashboard

## 🐛 Solution : Tester avec un Événement de Test

Pour vérifier que le webhook fonctionne :

1. Dans Stripe Dashboard > Webhooks > "test feed-toki"
2. Cliquer sur **"Envoyer des événements de test"**
3. Sélectionner **`checkout.session.completed`**
4. Cliquer sur **"Envoyer l'événement de test"**
5. Vérifier les logs Firebase Functions pour voir si le webhook est appelé

Si le test fonctionne mais pas les vrais événements, le problème est dans la création de la session checkout ou dans le paiement lui-même.
