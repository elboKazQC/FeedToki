# Tester l'Abonnement comme Nouvel Utilisateur

## 🎯 Objectif

Tester le flux complet d'abonnement comme si vous étiez un nouvel utilisateur (pas beta tester).

## ✅ Option 1 : Créer un Compte de Test (Recommandé)

C'est la meilleure façon de tester car vous gardez votre compte beta intact.

### Étapes

1. **Créer un nouveau compte** :
   - Aller sur `/auth`
   - Cliquer sur "Créer un compte"
   - Utiliser un email différent (ex: `test@example.com`)
   - Créer le compte

2. **Compléter l'onboarding** :
   - Sélectionner un objectif de poids
   - Entrer votre poids
   - Compléter l'onboarding

3. **Tester l'abonnement** :
   - Aller sur `/subscription`
   - Cliquer sur "S'abonner maintenant ($10/mois)"
   - Utiliser la carte de test : `4242 4242 4242 4242`
   - Compléter le paiement

4. **Vérifier** :
   - Le webhook devrait être appelé
   - L'abonnement devrait apparaître dans Firestore
   - Le statut devrait changer à "Abonné jusqu'au [date]"

## ✅ Option 2 : Modifier Temporairement Votre Compte

Si vous voulez tester avec votre compte actuel :

### Étapes

1. **Dans Firebase Console** :
   - Aller sur votre document utilisateur
   - Modifier le champ `subscription` :
     - Supprimer le champ `subscription` (ou le mettre à `null`)
     - OU changer `tier` de `beta` à `expired`
     - OU supprimer complètement le champ

2. **Dans l'application** :
   - Recharger la page `/subscription`
   - Le statut devrait être "Abonnement expiré"
   - Cliquer sur "S'abonner maintenant ($10/mois)"

3. **Tester le paiement** :
   - Utiliser la carte de test : `4242 4242 4242 4242`
   - Compléter le paiement

4. **Vérifier** :
   - Le webhook devrait être appelé
   - L'abonnement devrait apparaître dans Firestore avec `tier: "paid"`

5. **Remettre votre statut beta** (après le test) :
   - Dans Firebase Console, remettre :
     - `tier`: `beta`
     - `status`: `active`

## 💳 Carte de Test Stripe

```
Numéro: 4242 4242 4242 4242
Date d'expiration: 12/25 (ou toute date future)
CVC: 123 (ou n'importe quel 3 chiffres)
Code postal: 12345 (ou n'importe quel code postal)
```

## 🔍 Vérifications Après le Test

### 1. Dans l'Application
- Le statut devrait changer de "Abonnement expiré" à "Abonné jusqu'au [date]"
- Si ça ne change pas immédiatement, attendre 30 secondes (rechargements automatiques)

### 2. Dans Firebase Console
- Aller sur le document utilisateur
- Vérifier que le champ `subscription` existe avec :
  - `tier`: `paid`
  - `status`: `active`
  - `subscriptionStartDate`: date de début
  - `subscriptionEndDate`: date de fin (1 mois plus tard)
  - `stripeCustomerId`: ID du customer Stripe
  - `stripeSubscriptionId`: ID de la subscription Stripe

### 3. Dans les Logs Firebase Functions
```bash
cd toki-app
firebase functions:log | grep -i "handleStripeWebhook"
```

Vous devriez voir :
- `[handleStripeWebhook] 🎯 NOUVEAU WEBHOOK REÇU`
- `[handleStripeWebhook] 📦 Événement: checkout.session.completed`
- `[handleStripeWebhook] ✅ Subscription créée/mise à jour pour ...`

### 4. Dans Stripe Dashboard
- Aller dans **Subscriptions** (mode TEST)
- Vérifier que la subscription existe
- Aller dans **Developers** > **Webhooks** > [Votre webhook] > **Events**
- Vérifier qu'un événement `checkout.session.completed` a été envoyé

## 🐛 Si le Webhook N'est Pas Appelé

Si après le paiement, le webhook n'est toujours pas appelé :

1. **Vérifier dans Stripe Dashboard** :
   - Aller dans **Developers** > **Webhooks**
   - Vérifier qu'un webhook existe avec l'URL :
     ```
     https://us-central1-feed-toki.cloudfunctions.net/handleStripeWebhook
     ```
   - Vérifier que les événements sont sélectionnés :
     - ✅ `checkout.session.completed`
     - ✅ `customer.subscription.updated`
     - ✅ `customer.subscription.deleted`

2. **Vérifier le webhook secret** :
   - Le secret doit être configuré dans Firebase Functions
   - Vérifier avec : `firebase functions:config:get`

3. **Voir les détails dans `docs/PROBLEME_WEBHOOK_NON_APPELÉ.md`**

## 📝 Notes

- Le webhook doit être configuré **séparément pour TEST et PRODUCTION**
- Les logs détaillés dans `handleStripeWebhook` montreront exactement ce qui se passe
- Si le webhook échoue, vous pouvez créer l'abonnement manuellement (voir `docs/TEST_ABONNEMENT_COMPLET.md`)
