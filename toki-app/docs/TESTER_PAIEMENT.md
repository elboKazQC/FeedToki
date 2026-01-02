# Guide de Test du Système de Paiement Stripe

## 🎯 Options de Test

Il y a **2 modes de test** disponibles :

### Option 1: Mode TEST (Recommandé pour commencer) ✅

Les paiements sont **simulés** - aucun vrai argent n'est débité.

**Avantages:**
- ✅ Aucun risque financier
- ✅ Tests illimités
- ✅ Cartes de test disponibles
- ✅ Webhook en mode test

### Option 2: Mode PRODUCTION (Vraie monnaie) ⚠️

Les paiements sont **RÉELS** - l'argent sera vraiment débité.

**Avantages:**
- ✅ Test du vrai flow de production
- ✅ Vérification complète du système

**Inconvénients:**
- ⚠️ Vrais paiements (même si vous pouvez tester avec $0.50)

---

## 🧪 Mode TEST - Guide Complet

### 1. S'assurer d'être en Mode TEST

Vérifier que les clés TEST sont configurées:

```bash
cd toki-app
scripts\setup-stripe-secrets.bat
```

### 2. Créer le Produit en Mode TEST dans Stripe

1. Aller sur https://dashboard.stripe.com/test/products
2. S'assurer d'être en mode **TEST** (bouton en haut à droite)
3. Créer le produit "FeedToki Premium" à $10.00 CAD/mois
4. Copier le **Price ID TEST** (commence par `price_...`)
5. Mettre à jour `functions/src/index.ts` avec le Price ID TEST

### 3. Configurer le Webhook en Mode TEST

1. Aller sur https://dashboard.stripe.com/test/webhooks
2. Cliquer "Add endpoint"
3. URL: `https://us-central1-feed-toki.cloudfunctions.net/handleStripeWebhook`
4. Sélectionner les événements:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Copier le **Webhook Signing Secret TEST** (commence par `whsec_...`)
6. Configurer: `firebase functions:config:set stripe.webhook_secret="whsec_..."`

### 4. Déployer les Functions

```bash
cd toki-app/functions
npm install stripe
npm run build
cd ..
firebase deploy --only functions
```

### 5. Tester avec une Carte de Test

#### Carte qui réussit toujours:
- **Numéro:** `4242 4242 4242 4242`
- **Date:** N'importe quelle date future (ex: `12/34`)
- **CVC:** N'importe quel 3 chiffres (ex: `123`)
- **Code postal:** N'importe quel code (ex: `H1A 1A1`)

#### Autres cartes de test:
- **Carte refusée:** `4000 0000 0000 0002`
- **Carte 3D Secure:** `4000 0025 0000 3155`

### 6. Flow de Test Complet

1. **Créer un compte test** dans votre app
2. **Aller sur `/subscription`**
3. **Cliquer "S'abonner maintenant"**
4. **Utiliser la carte de test** `4242 4242 4242 4242`
5. **Compléter le paiement**
6. **Vérifier:**
   - ✅ Dans Stripe Dashboard > Subscriptions (mode TEST): L'abonnement est créé
   - ✅ Dans Firestore: La subscription de l'utilisateur est créée avec `tier: PREMIUM` et `status: ACTIVE`
   - ✅ Dans l'app: L'utilisateur peut accéder à `/ai-logger` sans paywall

### 7. Vérifier les Webhooks

1. Aller dans Stripe Dashboard > Developers > Webhooks
2. Cliquer sur votre endpoint
3. Voir les événements dans "Events"
4. Vérifier que les événements sont reçus et traités correctement

---

## 🚀 Mode PRODUCTION - Test Final

**⚠️ ATTENTION: Les paiements seront RÉELS!**

### Pré-requis

1. ✅ Clés PRODUCTION configurées
2. ✅ Produit créé en mode LIVE
3. ✅ Webhook configuré en mode LIVE
4. ✅ Functions déployées

### Test Recommandé

Utiliser un **montant minimal** pour tester (ex: créer un produit à $0.50 CAD/mois temporairement):

1. Créer un produit de test à $0.50/mois en mode LIVE
2. Mettre à jour le Price ID temporairement
3. Tester avec votre vraie carte
4. Vérifier que tout fonctionne
5. Remettre le produit à $10/mois

**OU** tester directement avec $10 si vous êtes confiant (vous pouvez annuler immédiatement après le test).

### Flow de Test Production

1. Créer un compte dans votre app
2. Aller sur `/subscription`
3. Cliquer "S'abonner maintenant"
4. Utiliser votre **vraie carte de crédit**
5. Compléter le paiement
6. Vérifier:
   - ✅ Dans Stripe Dashboard > Subscriptions (mode LIVE): L'abonnement est créé
   - ✅ Dans Firestore: La subscription est créée
   - ✅ Dans l'app: L'utilisateur peut accéder à `/ai-logger`
   - ✅ Dans Stripe Dashboard: Le paiement est visible

---

## 🔍 Vérifications Importantes

### Dans Stripe Dashboard

- ✅ L'abonnement est créé
- ✅ Le statut est "Active"
- ✅ Le paiement est traité
- ✅ Les événements webhook sont reçus

### Dans Firestore

Collection: `users/{userId}/subscriptions/current`

```json
{
  "userId": "...",
  "tier": "PREMIUM",
  "status": "ACTIVE",
  "startDate": "2025-01-XX...",
  "stripeCustomerId": "cus_...",
  "stripeSubscriptionId": "sub_...",
  "createdAt": "2025-01-XX...",
  "updatedAt": "2025-01-XX..."
}
```

### Dans l'Application

- ✅ `/subscription` affiche "Premium Actif ✅"
- ✅ `/ai-logger` est accessible sans paywall
- ✅ Le paywall ne s'affiche plus

---

## 🐛 Troubleshooting

### Le webhook ne reçoit pas d'événements

1. Vérifier que la function est déployée
2. Vérifier que l'URL du webhook est correcte
3. Vérifier que le webhook secret est configuré correctement
4. Vérifier les logs Firebase Functions

### La subscription n'est pas créée dans Firestore

1. Vérifier les logs Firebase Functions
2. Vérifier les logs Stripe Webhooks
3. Vérifier que les règles Firestore permettent l'écriture

### Le paywall s'affiche encore après paiement

1. Vérifier que la subscription est bien créée dans Firestore
2. Vérifier que `hasActiveSubscription()` fonctionne correctement
3. Rafraîchir l'app ou se déconnecter/reconnecter

---

## ✅ Checklist de Test

### Mode TEST
- [ ] Clés TEST configurées
- [ ] Produit créé en mode TEST
- [ ] Webhook configuré en mode TEST
- [ ] Functions déployées
- [ ] Test avec carte `4242 4242 4242 4242`
- [ ] Subscription créée dans Firestore
- [ ] Accès à `/ai-logger` fonctionne

### Mode PRODUCTION
- [ ] Clés PRODUCTION configurées
- [ ] Produit créé en mode LIVE
- [ ] Webhook configuré en mode LIVE
- [ ] Functions déployées
- [ ] Test avec vraie carte
- [ ] Subscription créée dans Firestore
- [ ] Paiement visible dans Stripe Dashboard
- [ ] Accès à `/ai-logger` fonctionne
