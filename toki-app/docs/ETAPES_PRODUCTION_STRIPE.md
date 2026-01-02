# Étapes pour Finaliser le Passage en Production Stripe

## ✅ Ce qui est déjà fait

- ✅ Secret Key PRODUCTION configurée dans Firebase Functions
- ✅ Price ID PRODUCTION présent dans le code (`price_1SkU52Gdme3i0KJAgTp4COAz`)
- ✅ Code gère l'événement `customer.subscription.created`
- ✅ Stripe package installé dans les fonctions

## ⚠️ Actions manuelles requises (dans Stripe Dashboard)

### Étape 1 : Ajouter l'événement `customer.subscription.created` au webhook

1. Aller sur [Stripe Dashboard > Webhooks (Live mode)](https://dashboard.stripe.com/webhooks)
2. **IMPORTANT :** S'assurer d'être en mode **"Live mode"** (pas "Test mode") - vérifier le toggle en haut à droite
3. Cliquer sur le webhook existant "feed-toki"
4. Cliquer sur **"Modifier"** ou **"Edit"**
5. Dans la section **"Événements à envoyer"** ou **"Events to send"**, ajouter :
   - ✅ `customer.subscription.created` ⚠️ **ACTUELLEMENT MANQUANT - À AJOUTER**
6. Vérifier que tous ces événements sont sélectionnés :
   - ✅ `checkout.session.completed`
   - ✅ `customer.subscription.created` ⚠️ **À AJOUTER**
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
7. Cliquer sur **"Enregistrer"** ou **"Save"**

### Étape 2 : Récupérer le webhook secret PRODUCTION

1. Après avoir modifié le webhook (Étape 1), rester sur la page du webhook
2. Dans la section **"Signing secret"** ou **"Clé secrète de signature"**, cliquer sur **"Révéler"** ou **"Reveal"**
3. Copier le secret qui commence par `whsec_...`
4. ⚠️ **IMPORTANT :** Ne pas partager cette clé publiquement

## 🔧 Configuration automatique (après avoir récupéré le webhook secret)

Une fois que vous avez le webhook secret PRODUCTION (`whsec_...`), exécutez :

```bash
cd toki-app
./scripts/configure-stripe-production.sh whsec_VOTRE_SECRET_ICI
```

**OU** manuellement :

```bash
cd toki-app
firebase functions:config:set stripe.webhook_secret="whsec_VOTRE_SECRET_ICI"
```

## 🚀 Déploiement des fonctions

Une fois le webhook secret configuré :

```bash
cd toki-app/functions
npm install
npm run build
cd ..
firebase deploy --only functions:handleStripeWebhook,functions:createCheckoutSession
```

## ✅ Vérification

### Vérifier la configuration

```bash
cd toki-app
firebase functions:config:get | grep -A 3 stripe
```

**Vérifications attendues :**
- ✅ `secret_key`: `sk_live_...` (PRODUCTION)
- ✅ `webhook_secret`: `whsec_...` (PRODUCTION, pas TEST)

### Vérifier dans Stripe Dashboard

1. Aller sur [Stripe Dashboard > Webhooks (Live mode)](https://dashboard.stripe.com/webhooks)
2. Vérifier que le webhook inclut bien `customer.subscription.created`
3. Vérifier que le webhook est actif

### Tester le webhook

1. Aller sur [Stripe Dashboard > Webhooks (Live mode)](https://dashboard.stripe.com/webhooks)
2. Cliquer sur le webhook "feed-toki"
3. Cliquer sur **"Send test webhook"** ou **"Envoyer un événement de test"**
4. Sélectionner `customer.subscription.created`
5. Dans les métadonnées, ajouter :
   - `userId`: Un userId de test (ex: `cRHlBQJshyR9uDx1FpPMMruaaOW2`)
6. Cliquer sur **"Send test webhook"**

**Vérifier les logs :**

```bash
cd toki-app
firebase functions:log --only handleStripeWebhook
```

**Vérifications attendues dans les logs :**
- ✅ `[handleStripeWebhook] 🎯 NOUVEAU WEBHOOK REÇU`
- ✅ `[handleStripeWebhook] 📦 Événement: customer.subscription.created`
- ✅ `[handleStripeWebhook] ✅✅✅ Subscription créée/mise à jour pour ...`

**Vérifier dans Firestore :**
1. Ouvrir [Firebase Console > Firestore](https://console.firebase.google.com/project/feed-toki/firestore)
2. Naviguer vers `users/[userId]`
3. Vérifier que le champ `subscription` a été créé avec :
   - `tier`: `paid`
   - `status`: `active`
   - `stripeCustomerId`: Présent
   - `stripeSubscriptionId`: Présent

## 📋 Checklist finale

- [ ] Événement `customer.subscription.created` ajouté au webhook dans Stripe Dashboard
- [ ] Webhook secret PRODUCTION récupéré (`whsec_...`)
- [ ] Webhook secret PRODUCTION configuré dans Firebase Functions
- [ ] Fonctions Firebase déployées
- [ ] Webhook PRODUCTION testé avec succès (événement de test)
- [ ] Abonnement créé dans Firestore après test webhook

## 🎯 Une fois tout complété

Les utilisateurs pourront :
- S'abonner avec de vrais paiements ($10 CAD/mois)
- Recevoir des abonnements actifs dans Firestore automatiquement
- Accéder aux fonctionnalités premium (50 analyses IA par jour)

## ⚠️ Notes importantes

- ⚠️ **Ne jamais utiliser les clés TEST en production**
- ⚠️ **Le webhook secret PRODUCTION est différent du webhook secret TEST**
- ⚠️ **Vérifier que vous êtes en mode "Live" dans Stripe Dashboard, pas "Test mode"**
- ⚠️ **Les paiements en production sont réels - tester avec précaution**
- ⚠️ **Garder les clés PRODUCTION secrètes - ne jamais les commiter dans Git**
