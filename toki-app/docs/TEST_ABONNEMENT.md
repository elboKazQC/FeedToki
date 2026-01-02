# Guide de Test : Abonnement et Accès Premium

## Phase 1 : Vérifier la configuration

### Étape 1.1 : Vérifier l'abonnement dans Firestore

**Option A : Via script (si serviceAccountKey.json disponible)**
```bash
cd toki-app
npx ts-node scripts/verify-subscription-setup.ts
```

**Option B : Via Firebase Console**
1. Ouvrir [Firebase Console - Document utilisateur](https://console.firebase.google.com/project/feed-toki/firestore/data/~2Fusers~2FcRHlBQJshyR9uDx1FpPMMruaaOW2)
2. Vérifier que le champ `subscription` existe
3. Vérifier les valeurs :
   - `tier`: `paid`
   - `status`: `active`
   - `subscriptionEndDate`: Date dans le futur

## Phase 2 : Tester l'accès premium dans l'app

### Étape 2.1 : Se connecter avec l'utilisateur de test

1. Ouvrir l'app FeedToki
2. Se connecter avec l'utilisateur correspondant à `cRHlBQJshyR9uDx1FpPMMruaaOW2`
3. Vérifier que la connexion fonctionne

### Étape 2.2 : Tester l'accès à l'écran AI Logger

1. Naviguer vers l'écran "AI Logger" (ajouter repas via IA)
2. **Vérifications attendues :**
   - ✅ Pas de paywall affiché
   - ✅ L'écran AI Logger est accessible
   - ✅ Le message "Vérification de l'abonnement..." disparaît rapidement (moins de 2 secondes)
   - ✅ Le champ de saisie de description est visible
   - ✅ Le bouton "Analyser" est visible et cliquable

**Si le paywall s'affiche :**
- Vérifier que l'abonnement existe dans Firestore
- Vérifier que `subscription.status === 'active'`
- Vérifier que `subscription.subscriptionEndDate` est dans le futur
- Vérifier les logs de la console pour voir les erreurs

### Étape 2.3 : Tester l'analyse IA

1. Dans l'écran AI Logger, saisir une description de repas :
   - Exemple : "Pâtes, poulet, brocoli, sauce blanche"
2. Cliquer sur "Analyser"
3. **Vérifications attendues :**
   - ✅ L'analyse démarre (indicateur de chargement)
   - ✅ Des items sont détectés (ex: "Pâtes", "Poulet", "Brocoli")
   - ✅ Les portions sont suggérées
   - ✅ Les points sont calculés et affichés
   - ✅ Pas d'erreur affichée

**Si l'analyse échoue :**
- Vérifier les logs de la console
- Vérifier que l'email est vérifié (requis pour l'IA)
- Vérifier que l'API OpenAI est configurée

## Phase 3 : Tester le webhook Stripe

### Étape 3.1 : Vérifier la configuration du webhook

**Vérifier que le webhook secret TEST est configuré :**
```bash
cd toki-app
firebase functions:config:get
```

**Vérifier que la fonction est déployée :**
```bash
firebase functions:list
```

La fonction `handleStripeWebhook` doit être listée.

### Étape 3.2 : Envoyer un événement de test depuis Stripe Dashboard

1. Aller sur [Stripe Dashboard > Webhooks (TEST)](https://dashboard.stripe.com/test/webhooks)
2. Cliquer sur le webhook "test feed-toki"
3. Cliquer sur "Envoyer un événement de test" (ou "Send test webhook")
4. Sélectionner l'événement `checkout.session.completed`
5. **Important :** Dans les métadonnées de l'événement, ajouter :
   - `userId`: `cRHlBQJshyR9uDx1FpPMMruaaOW2`
6. Cliquer sur "Envoyer l'événement de test"

### Étape 3.3 : Vérifier les logs Firebase Functions

```bash
cd toki-app
firebase functions:log --only handleStripeWebhook --limit 10
```

**Vérifications attendues :**
- ✅ L'événement est reçu : `[handleStripeWebhook] Nouveau webhook reçu`
- ✅ La signature est validée : Pas d'erreur "Erreur vérification signature"
- ✅ L'abonnement est créé : `[handleStripeWebhook] ✅ Subscription créée pour ...`

### Étape 3.4 : Vérifier dans Firestore

1. Ouvrir [Firebase Console - Document utilisateur](https://console.firebase.google.com/project/feed-toki/firestore/data/~2Fusers~2FcRHlBQJshyR9uDx1FpPMMruaaOW2)
2. Vérifier que le champ `subscription` a été mis à jour
3. Vérifier que les dates correspondent à l'événement Stripe

### Étape 3.5 : Tester les autres événements

**Tester `customer.subscription.updated` :**
1. Envoyer un événement de test `customer.subscription.updated`
2. Vérifier que l'abonnement est mis à jour dans Firestore

**Tester `customer.subscription.deleted` :**
1. Envoyer un événement de test `customer.subscription.deleted`
2. Vérifier que `subscription.status` devient `canceled`
3. Vérifier que `subscription.tier` devient `expired`

## Phase 4 : Tests de production

### Étape 4.1 : Vérifier la configuration production

**Vérifier les clés Stripe PRODUCTION :**
```bash
firebase functions:config:get
```

**Vérifier le webhook secret PRODUCTION :**
- Doit être différent du webhook secret TEST
- Doit commencer par `whsec_...`

### Étape 4.2 : Test end-to-end en production

1. Créer un abonnement de test en PRODUCTION via Stripe Dashboard
2. Vérifier que le webhook est appelé
3. Vérifier dans Firestore que l'abonnement est créé
4. Vérifier dans l'app que l'utilisateur a accès au premium

## Checklist de test

### Tests TEST
- [ ] Abonnement créé dans Firestore
- [ ] Accès premium fonctionne dans l'app
- [ ] Analyse IA fonctionne
- [ ] Webhook TEST reçoit les événements
- [ ] Webhook TEST met à jour Firestore correctement

### Tests PRODUCTION
- [ ] Clés Stripe PRODUCTION configurées
- [ ] Webhook secret PRODUCTION configuré
- [ ] Fonctions déployées en production
- [ ] Test end-to-end en production réussi

## Dépannage

### Le paywall s'affiche alors que l'abonnement existe

1. Vérifier que `subscription.status === 'active'`
2. Vérifier que `subscription.subscriptionEndDate` est dans le futur
3. Vérifier les logs de la console pour les erreurs
4. Vérifier que l'utilisateur est bien connecté avec le bon userId

### Le webhook ne reçoit pas les événements

1. Vérifier que l'URL du webhook est correcte : `https://us-central1-feed-toki.cloudfunctions.net/handleStripeWebhook`
2. Vérifier que le webhook secret est correct
3. Vérifier les logs Firebase Functions
4. Vérifier que la fonction est déployée

### L'analyse IA ne fonctionne pas

1. Vérifier que l'email est vérifié (requis pour l'IA)
2. Vérifier que l'API OpenAI est configurée
3. Vérifier les logs de la console
4. Vérifier les quotas OpenAI
