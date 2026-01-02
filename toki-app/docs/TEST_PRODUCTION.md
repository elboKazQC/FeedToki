# Guide : Tests en Production

## Prérequis

- ✅ Clés Stripe PRODUCTION configurées
- ✅ Webhook PRODUCTION configuré
- ✅ Fonctions déployées en production
- ✅ Price ID PRODUCTION vérifié

## Test 1 : Vérifier la configuration

### Étape 1.1 : Vérifier la configuration

```bash
cd toki-app

# Windows
scripts\verify-production-config.bat

# Linux/Mac
./scripts/verify-production-config.sh
```

**Vérifications attendues :**
- ✅ STRIPE_SECRET_KEY: PRODUCTION (sk_live_...)
- ✅ STRIPE_WEBHOOK_SECRET: Configuré (whsec_...)
- ✅ Price ID PRODUCTION trouvé dans le code

### Étape 1.2 : Vérifier que les fonctions sont déployées

```bash
firebase functions:list
```

**Vérifications attendues :**
- ✅ `handleStripeWebhook` listée
- ✅ `createCheckoutSession` listée

## Test 2 : Tester le webhook PRODUCTION

### Étape 2.1 : Envoyer un événement de test

1. Aller sur [Stripe Dashboard > Webhooks (PRODUCTION)](https://dashboard.stripe.com/webhooks)
2. Cliquer sur le webhook PRODUCTION
3. Cliquer sur **"Envoyer un événement de test"** (ou **"Send test webhook"**)
4. Sélectionner l'événement `checkout.session.completed`
5. **Important :** Dans les métadonnées, ajouter :
   - `userId`: Un userId de test (ex: `cRHlBQJshyR9uDx1FpPMMruaaOW2`)
6. Cliquer sur **"Envoyer l'événement de test"**

### Étape 2.2 : Vérifier les logs

```bash
cd toki-app

# Windows
scripts\check-webhook-logs.bat

# Linux/Mac
./scripts/check-webhook-logs.sh
```

**OU manuellement :**
```bash
firebase functions:log --only handleStripeWebhook --limit 10
```

**Vérifications attendues :**
- ✅ `[handleStripeWebhook] Nouveau webhook reçu`
- ✅ Pas d'erreur "Erreur vérification signature"
- ✅ `[handleStripeWebhook] ✅ Subscription créée pour ...`

### Étape 2.3 : Vérifier dans Firestore

1. Ouvrir [Firebase Console](https://console.firebase.google.com/project/feed-toki/firestore)
2. Naviguer vers `users/[userId]`
3. Vérifier que le champ `subscription` a été créé/mis à jour

## Test 3 : Test end-to-end complet

### Étape 3.1 : Créer un abonnement de test en production

**⚠️ ATTENTION :** Ce test utilise de l'argent réel. Utilisez un montant minimal.

1. Aller sur [Stripe Dashboard > Customers (PRODUCTION)](https://dashboard.stripe.com/customers)
2. Créer un nouveau customer ou utiliser un customer existant
3. Créer une subscription pour ce customer avec le Price ID PRODUCTION
4. Utiliser une carte de test Stripe (voir [Stripe Test Cards](https://stripe.com/docs/testing))

### Étape 3.2 : Vérifier que le webhook est appelé

1. Attendre quelques secondes
2. Vérifier les logs Firebase Functions :
   ```bash
   firebase functions:log --only handleStripeWebhook --limit 5
   ```
3. Vérifier que l'événement `checkout.session.completed` a été reçu

### Étape 3.3 : Vérifier dans Firestore

1. Ouvrir Firebase Console
2. Trouver l'utilisateur correspondant au customer Stripe
3. Vérifier que l'abonnement a été créé avec :
   - `tier`: `paid`
   - `status`: `active`
   - `stripeCustomerId`: Correspond au customer Stripe
   - `stripeSubscriptionId`: Correspond à la subscription Stripe

### Étape 3.4 : Tester dans l'app

1. Se connecter avec l'utilisateur qui a l'abonnement
2. Naviguer vers l'écran "AI Logger"
3. **Vérifications attendues :**
   - ✅ Pas de paywall affiché
   - ✅ L'écran AI Logger est accessible
   - ✅ L'analyse IA fonctionne

## Test 4 : Tester les autres événements

### Étape 4.1 : Tester `customer.subscription.updated`

1. Dans Stripe Dashboard, modifier la subscription (ex: changer le plan)
2. Vérifier les logs Firebase Functions
3. Vérifier dans Firestore que l'abonnement a été mis à jour

### Étape 4.2 : Tester `customer.subscription.deleted`

1. Dans Stripe Dashboard, annuler la subscription
2. Vérifier les logs Firebase Functions
3. Vérifier dans Firestore que :
   - `subscription.status` = `canceled`
   - `subscription.tier` = `expired`

## Checklist de test production

- [ ] Configuration vérifiée (clés PRODUCTION)
- [ ] Fonctions déployées
- [ ] Webhook PRODUCTION testé avec succès
- [ ] Abonnement créé en production
- [ ] Webhook appelé et abonnement créé dans Firestore
- [ ] Accès premium fonctionne dans l'app
- [ ] Événement `customer.subscription.updated` testé
- [ ] Événement `customer.subscription.deleted` testé

## Dépannage

### Le webhook ne reçoit pas les événements

1. Vérifier que l'URL est correcte
2. Vérifier que le webhook secret est correct
3. Vérifier que la fonction est déployée
4. Vérifier les logs Firebase Functions
5. Vérifier dans Stripe Dashboard que le webhook est actif

### L'abonnement n'est pas créé dans Firestore

1. Vérifier les logs Firebase Functions pour les erreurs
2. Vérifier que `userId` est présent dans les métadonnées de l'événement
3. Vérifier que l'utilisateur existe dans Firestore
4. Vérifier les permissions Firestore

### L'accès premium ne fonctionne pas dans l'app

1. Vérifier que l'abonnement existe dans Firestore
2. Vérifier que `subscription.status === 'active'`
3. Vérifier que `subscription.subscriptionEndDate` est dans le futur
4. Vérifier les logs de la console pour les erreurs

## Notes importantes

- ⚠️ **Les tests en production utilisent de l'argent réel**
- ⚠️ **Utilisez des montants minimaux pour les tests**
- ⚠️ **Annulez les abonnements de test après les tests**
- ⚠️ **Ne partagez jamais les clés PRODUCTION publiquement**
