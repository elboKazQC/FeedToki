# Guide : Configurer Stripe en PRODUCTION

## Prérequis

- ✅ Clés Stripe PRODUCTION disponibles
- ✅ Webhook créé dans Stripe Dashboard PRODUCTION
- ✅ Webhook secret PRODUCTION copié

## Étape 1 : Vérifier les clés Stripe PRODUCTION

### 1.1 : Vérifier la configuration actuelle

```bash
cd toki-app
firebase functions:config:get
```

**OU utiliser le script de vérification :**
```bash
# Windows
scripts\verify-production-config.bat

# Linux/Mac
./scripts/verify-production-config.sh
```

### 1.2 : Configurer les clés Stripe PRODUCTION

**Si les clés ne sont pas configurées, utiliser :**

**Windows:**
```bash
scripts\setup-stripe-secrets-production.bat
```

**Linux/Mac:**
```bash
./scripts/setup-stripe-secrets-production.sh
```

**OU manuellement :**
```bash
firebase functions:config:set stripe.secret_key="sk_live_..."
firebase functions:config:set stripe.publishable_key="pk_live_..."
```

## Étape 2 : Configurer le webhook PRODUCTION

### 2.1 : Créer le webhook dans Stripe Dashboard PRODUCTION

1. Aller sur [Stripe Dashboard > Webhooks (PRODUCTION)](https://dashboard.stripe.com/webhooks)
2. Cliquer sur **"Ajouter un endpoint"** (ou **"Add endpoint"**)
3. **URL du endpoint** : `https://us-central1-feed-toki.cloudfunctions.net/handleStripeWebhook`
4. **Description** : "FeedToki Production Webhook"
5. Sélectionner les événements :
   - ✅ `checkout.session.completed`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
6. Cliquer sur **"Ajouter un endpoint"**

### 2.2 : Copier le webhook secret PRODUCTION

1. Dans la page du webhook créé, trouver la section **"Clé secrète de signature"**
2. Cliquer sur **"Révéler"** ou **"Afficher"**
3. Copier le webhook secret (commence par `whsec_...`)
4. **⚠️ IMPORTANT :** Ne pas partager cette clé publiquement

### 2.3 : Configurer le webhook secret dans Firebase Functions

**Windows:**
```bash
cd toki-app
firebase functions:config:set stripe.webhook_secret="whsec_..."
```

**Linux/Mac:**
```bash
cd toki-app
firebase functions:config:set stripe.webhook_secret="whsec_..."
```

**OU créer un script :**
```bash
# Créer setup-webhook-secret-production.bat ou .sh avec le secret
```

## Étape 3 : Vérifier le Price ID PRODUCTION

### 3.1 : Vérifier dans le code

Le Price ID PRODUCTION est déjà configuré dans `functions/src/index.ts` :
- **Price ID PRODUCTION** : `price_1SkU52Gdme3i0KJAgTp4COAz`

### 3.2 : Vérifier dans Stripe Dashboard

1. Aller sur [Stripe Dashboard > Produits (PRODUCTION)](https://dashboard.stripe.com/products)
2. Trouver le produit "FeedToki Premium"
3. Vérifier que le Price ID `price_1SkU52Gdme3i0KJAgTp4COAz` existe
4. Si nécessaire, créer un nouveau prix et mettre à jour le code

## Étape 4 : Déployer les fonctions

```bash
cd toki-app/functions
npm install stripe
npm run build
cd ..
firebase deploy --only functions:handleStripeWebhook,functions:createCheckoutSession
```

## Étape 5 : Vérifier la configuration

### 5.1 : Vérifier la configuration

```bash
# Windows
scripts\verify-production-config.bat

# Linux/Mac
./scripts/verify-production-config.sh
```

### 5.2 : Vérifier que les fonctions sont déployées

```bash
firebase functions:list
```

Les fonctions suivantes doivent être listées :
- ✅ `handleStripeWebhook`
- ✅ `createCheckoutSession`

## Étape 6 : Test en production

### 6.1 : Tester le webhook PRODUCTION

1. Aller sur [Stripe Dashboard > Webhooks (PRODUCTION)](https://dashboard.stripe.com/webhooks)
2. Cliquer sur le webhook créé
3. Cliquer sur **"Envoyer un événement de test"**
4. Sélectionner `checkout.session.completed`
5. **Important :** Dans les métadonnées, ajouter `userId` avec un userId de test
6. Cliquer sur **"Envoyer l'événement de test"**

### 6.2 : Vérifier les logs

```bash
cd toki-app
firebase functions:log --only handleStripeWebhook --limit 10
```

**OU utiliser le script :**
```bash
# Windows
scripts\check-webhook-logs.bat

# Linux/Mac
./scripts/check-webhook-logs.sh
```

### 6.3 : Vérifier dans Firestore

1. Ouvrir Firebase Console
2. Vérifier que l'abonnement a été créé pour l'utilisateur de test

## Checklist production

- [ ] Clés Stripe PRODUCTION configurées
- [ ] Webhook PRODUCTION créé dans Stripe Dashboard
- [ ] Webhook secret PRODUCTION configuré dans Firebase Functions
- [ ] Price ID PRODUCTION vérifié dans Stripe Dashboard
- [ ] Price ID PRODUCTION vérifié dans le code
- [ ] Fonctions déployées en production
- [ ] Webhook PRODUCTION testé avec succès
- [ ] Test end-to-end en production réussi

## Notes importantes

- ⚠️ **Ne jamais utiliser les clés TEST en production**
- ⚠️ **Le webhook secret PRODUCTION est différent du webhook secret TEST**
- ⚠️ **Vérifier que le Price ID PRODUCTION existe dans Stripe Dashboard**
- ⚠️ **Toujours tester en production avec des montants réels (mais petits) avant de lancer**

## Dépannage

### Le webhook ne reçoit pas les événements

1. Vérifier que l'URL est correcte : `https://us-central1-feed-toki.cloudfunctions.net/handleStripeWebhook`
2. Vérifier que le webhook secret est correct
3. Vérifier que la fonction est déployée
4. Vérifier les logs Firebase Functions

### Les clés ne sont pas configurées

1. Vérifier que vous êtes connecté à Firebase : `firebase login`
2. Vérifier que vous avez les permissions : `firebase projects:list`
3. Réessayer la configuration

### Le Price ID n'existe pas

1. Créer un nouveau prix dans Stripe Dashboard PRODUCTION
2. Mettre à jour `functions/src/index.ts` avec le nouveau Price ID
3. Redéployer les fonctions
