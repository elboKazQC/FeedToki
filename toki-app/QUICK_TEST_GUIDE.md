# Guide de Test Rapide - Mode TEST Stripe

## ✅ Prérequis Vérifiés

- [x] Clés TEST configurées
- [x] Price ID TEST configuré: `price_1SkUYTGdme3i0KJAuhnlrPXJ`
- [x] Produit TEST créé dans Stripe
- [x] Webhook TEST configuré dans Stripe Dashboard
- [x] Functions déployées

## 🧪 Test Rapide

### 1. Tester le Checkout

1. **Ouvrir votre application** (en développement ou production)
2. **Aller sur** `/subscription`
3. **Cliquer** "S'abonner maintenant"
4. **Utiliser la carte de test:**
   - Numéro: `4242 4242 4242 4242`
   - Date: `12/34` (n'importe quelle date future)
   - CVC: `123` (n'importe quel 3 chiffres)
   - Code postal: `H1A 1A1` (n'importe quel code)
5. **Compléter le paiement**

### 2. Vérifier le Résultat

#### Dans Stripe Dashboard (mode TEST):
1. Aller sur https://dashboard.stripe.com/test/subscriptions
2. Vous devriez voir l'abonnement créé
3. Statut: "Active"

#### Dans Firestore:
Collection: `users/{userId}/subscriptions/current`

Vérifier que le document existe avec:
```json
{
  "tier": "PREMIUM",
  "status": "ACTIVE",
  "stripeCustomerId": "cus_...",
  "stripeSubscriptionId": "sub_...",
  ...
}
```

#### Dans l'Application:
1. Aller sur `/subscription`
2. Devrait afficher "Premium Actif ✅"
3. Aller sur `/ai-logger`
4. **Le paywall ne devrait PAS s'afficher** - vous devriez pouvoir utiliser l'IA

### 3. Vérifier les Webhooks

1. Aller sur https://dashboard.stripe.com/test/webhooks
2. Cliquer sur votre endpoint
3. Dans "Events", vous devriez voir:
   - `checkout.session.completed`
   - Possiblement `customer.subscription.updated`

Si les événements ont une croix rouge, vérifier les logs Firebase Functions.

## 🐛 Si ça ne fonctionne pas

### Le paiement échoue
- Vérifier que vous utilisez bien la carte de test `4242 4242 4242 4242`
- Vérifier que vous êtes bien en mode TEST dans Stripe Dashboard

### La subscription n'est pas créée dans Firestore
- Vérifier les logs Firebase Functions: `firebase functions:log`
- Vérifier que le webhook secret TEST est configuré
- Vérifier que les règles Firestore permettent l'écriture

### Le paywall s'affiche encore
- Vérifier que la subscription est bien créée dans Firestore
- Rafraîchir l'app ou se déconnecter/reconnecter
- Vérifier que `hasActiveSubscription()` fonctionne

## 📝 Note sur le Webhook Secret TEST

Si le webhook secret TEST n'est pas encore configuré:
1. Aller sur https://dashboard.stripe.com/test/webhooks
2. Cliquer sur votre endpoint
3. Copier le "Signing secret" (commence par `whsec_...`)
4. Configurer:
   ```bash
   firebase functions:config:set stripe.webhook_secret="whsec_..."
   ```
5. Redéployer:
   ```bash
   firebase deploy --only functions
   ```

**Note:** Le checkout fonctionnera même sans le webhook secret, mais la subscription ne sera pas créée automatiquement dans Firestore. Il faut le webhook secret pour la synchronisation automatique.
