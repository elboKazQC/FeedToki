# Passer en Mode TEST Stripe

## 🎯 Objectif

Basculer du mode PRODUCTION au mode TEST pour tester les paiements sans débiter de vrais fonds.

## ⚠️ Important

En mode TEST:
- ✅ Les paiements sont simulés (pas de vrais débits)
- ✅ Utilisez des cartes de test (ex: `4242 4242 4242 4242`)
- ✅ Les données TEST sont séparées des données PRODUCTION
- ⚠️ Il faut créer le produit et configurer le webhook en mode TEST

---

## 📋 Étapes pour Basculer en Mode TEST

### 1. Configurer les Clés TEST ✅

Les clés TEST sont déjà configurées via le script `setup-stripe-secrets.bat`.

**Vérifier:**
```bash
firebase functions:config:get
```

Vous devriez voir:
- `stripe.secret_key` = `sk_test_...`
- `stripe.publishable_key` = `pk_test_...`

### 2. Créer le Produit en Mode TEST dans Stripe

1. Aller sur https://dashboard.stripe.com/test/products
   - **Important:** S'assurer d'être en mode **TEST** (bouton "Test mode" en haut à droite)
2. Cliquer "Add product"
3. Remplir les informations:
   - **Nom:** FeedToki Premium
   - **Description:** (optionnel)
4. Dans "Pricing":
   - **Prix:** $10.00 CAD
   - **Billing period:** Monthly (recurring)
5. Cliquer "Save product"
6. **Copier le Price ID** (commence par `price_...`, pas `prod_...`)
   - Exemple: `price_1ABC123test...`

### 3. Mettre à Jour le Price ID dans le Code

Dans `functions/src/index.ts` ligne 221, remplacer:

```typescript
const PRICE_ID = 'price_1SkU52Gdme3i0KJAgTp4COAz'; // PRODUCTION
```

par le Price ID TEST:

```typescript
const PRICE_ID = 'price_XXXXX'; // TEST - À remplacer avec votre Price ID TEST
```

### 4. Configurer le Webhook en Mode TEST

1. Aller sur https://dashboard.stripe.com/test/webhooks
   - **Important:** S'assurer d'être en mode **TEST**
2. Cliquer "Add endpoint"
3. URL: `https://us-central1-feed-toki.cloudfunctions.net/handleStripeWebhook`
4. Description: (optionnel) "FeedToki TEST"
5. Sélectionner les événements:
   - ✅ `checkout.session.completed`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
6. Cliquer "Add endpoint"
7. **Copier le Webhook Signing Secret** (commence par `whsec_...`)
   - Exemple: `whsec_1ABC123test...`

### 5. Configurer le Webhook Secret TEST

```bash
cd toki-app
firebase functions:config:set stripe.webhook_secret="whsec_..." # Votre secret TEST
```

### 6. Redéployer les Functions

```bash
cd toki-app/functions
npm run build
cd ..
firebase deploy --only functions
```

### 7. Tester avec une Carte de Test

1. Ouvrir votre application
2. Aller sur `/subscription`
3. Cliquer "S'abonner maintenant"
4. Utiliser la carte de test:
   - **Numéro:** `4242 4242 4242 4242`
   - **Date:** N'importe quelle date future (ex: `12/34`)
   - **CVC:** N'importe quel 3 chiffres (ex: `123`)
   - **Code postal:** N'importe quel code (ex: `H1A 1A1`)
5. Compléter le paiement
6. Vérifier:
   - ✅ Dans Stripe Dashboard > Subscriptions (mode TEST): L'abonnement est créé
   - ✅ Dans Firestore: La subscription est créée
   - ✅ Dans l'app: Accès à `/ai-logger` fonctionne

---

## 🔄 Retourner en Mode PRODUCTION

Quand vous êtes prêt pour la production:

1. Reconfigurer les clés PRODUCTION:
   ```bash
   scripts\setup-stripe-secrets-production.bat
   ```

2. Remettre le Price ID PRODUCTION dans `functions/src/index.ts`:
   ```typescript
   const PRICE_ID = 'price_1SkU52Gdme3i0KJAgTp4COAz'; // PRODUCTION
   ```

3. Configurer le webhook PRODUCTION (déjà fait):
   - URL: `https://us-central1-feed-toki.cloudfunctions.net/handleStripeWebhook`
   - Secret: `whsec_qf4mVsFuJD9p07K8t6eYw1nayAbMuOej`

4. Redéployer:
   ```bash
   firebase deploy --only functions
   ```

---

## 📝 Checklist Mode TEST

- [ ] Clés TEST configurées dans Firebase Functions
- [ ] Produit créé en mode TEST dans Stripe Dashboard
- [ ] Price ID TEST copié et mis à jour dans `functions/src/index.ts`
- [ ] Webhook configuré en mode TEST dans Stripe Dashboard
- [ ] Webhook secret TEST configuré dans Firebase Functions
- [ ] Functions redéployées
- [ ] Test avec carte `4242 4242 4242 4242` réussi
- [ ] Subscription créée dans Firestore
- [ ] Accès à `/ai-logger` fonctionne

---

## 🆘 Aide

Si vous avez besoin d'aide:
- Voir `docs/STRIPE_TEST_CARDS.md` pour les cartes de test
- Voir `docs/TESTER_PAIEMENT.md` pour le guide complet de test
- Vérifier les logs: `firebase functions:log`
