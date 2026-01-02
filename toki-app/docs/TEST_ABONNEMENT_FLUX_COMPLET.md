# Guide de Test - Flux Complet d'Abonnement

Ce guide explique comment tester le flux complet d'abonnement dans l'application.

## 🎯 Objectif

Tester le flux complet :
1. Connexion à l'application
2. Clic sur "S'abonner"
3. Redirection vers Stripe Checkout
4. Paiement avec une carte de test
5. Retour à l'application
6. Vérification que l'abonnement est créé dans Firestore

## 💳 Cartes de Test Stripe

### Carte de Test Succès (Recommandée)
```
Numéro: 4242 4242 4242 4242
Date d'expiration: N'importe quelle date future (ex: 12/25)
CVC: N'importe quel 3 chiffres (ex: 123)
Code postal: N'importe quel code postal (ex: 12345)
```

### Autres Cartes de Test
- **Carte 3D Secure**: `4000 0025 0000 3155`
- **Carte refusée**: `4000 0000 0000 0002`
- **Carte insuffisance de fonds**: `4000 0000 0000 9995`

## 📋 Étapes de Test

### 1. Préparer l'environnement

Vérifier que vous êtes en mode TEST :
- Les fonctions Firebase utilisent la clé Stripe TEST
- Le webhook Stripe est configuré pour TEST
- L'URL de retour est correcte

### 2. Se connecter à l'application

1. Aller sur l'application web
2. Se connecter avec votre compte
3. Aller sur la page `/subscription`

### 3. Tester l'abonnement

1. Cliquer sur "S'abonner maintenant ($10/mois)"
2. Vous devriez être redirigé vers Stripe Checkout
3. Remplir le formulaire avec la carte de test :
   - Numéro: `4242 4242 4242 4242`
   - Date: `12/25` (ou toute date future)
   - CVC: `123`
   - Code postal: `12345`
4. Cliquer sur "Payer"
5. Vous devriez être redirigé vers `/subscription?success=true`

### 4. Vérifier le résultat

#### Dans l'application :
- Le statut devrait changer de "Abonnement expiré" à "Abonné jusqu'au [date]"
- Si ça ne change pas immédiatement, attendre 30 secondes (le script recharge plusieurs fois)

#### Dans Firebase Console :
1. Aller dans Firestore
2. Collection: `users`
3. Document: votre `userId`
4. Vérifier que le champ `subscription` existe avec :
   - `tier`: `paid`
   - `status`: `active`
   - `subscriptionStartDate`: date de début
   - `subscriptionEndDate`: date de fin (1 mois plus tard)
   - `stripeCustomerId`: ID du customer Stripe
   - `stripeSubscriptionId`: ID de la subscription Stripe

#### Dans les logs Firebase Functions :
```bash
firebase functions:log --only handleStripeWebhook --limit 50
```

Chercher les logs `[handleStripeWebhook]` qui montrent :
- ✅ Si le webhook a été appelé
- ✅ Les données reçues
- ✅ Si l'écriture dans Firestore a réussi
- ✅ La vérification après écriture

## 🐛 Diagnostic des Problèmes

### Problème 1: Le webhook n'est pas appelé

**Symptômes** :
- L'abonnement n'apparaît pas dans Firestore
- Pas de logs dans Firebase Functions

**Solutions** :
1. Vérifier dans Stripe Dashboard > Developers > Webhooks
2. Vérifier que l'endpoint est correct : `https://us-central1-feed-toki.cloudfunctions.net/handleStripeWebhook`
3. Vérifier que les événements sont sélectionnés : `checkout.session.completed`
4. Vérifier le webhook secret dans Firebase Functions

### Problème 2: Le webhook est appelé mais l'abonnement n'apparaît pas

**Symptômes** :
- Des logs dans Firebase Functions mais pas d'abonnement dans Firestore

**Solutions** :
1. Vérifier les logs détaillés `[handleStripeWebhook]`
2. Chercher les erreurs d'écriture
3. Vérifier que le `userId` est présent dans les metadata de la session Stripe

### Problème 3: L'abonnement apparaît mais le statut reste "expiré"

**Symptômes** :
- L'abonnement existe dans Firestore
- Mais l'application affiche toujours "Abonnement expiré"

**Solutions** :
1. Vérifier que `subscription.status === 'active'`
2. Vérifier que `subscription.tier === 'paid'`
3. Vérifier que `subscriptionEndDate` est dans le futur
4. Vérifier que l'application recharge bien les données depuis Firestore

## 📊 Logs à Surveiller

### Dans la Console du Navigateur :
- `[Subscription Screen] ✅ Retour de Stripe avec succès`
- `[Subscription Screen] Chargement abonnement pour userId: ...`
- `[Subscription Screen] Abonnement chargé: ...`

### Dans Firebase Functions :
- `[handleStripeWebhook] 🎯 NOUVEAU WEBHOOK REÇU`
- `[handleStripeWebhook] 📦 Événement: checkout.session.completed`
- `[handleStripeWebhook] ✅ Subscription créée/mise à jour pour ...`
- `[handleStripeWebhook] ✅✅✅ SUBSCRIPTION TROUVÉE DANS LE DOCUMENT! ✅✅✅`

## ✅ Checklist de Vérification

Après le test, vérifier :

- [ ] Le webhook a été appelé (logs Firebase Functions)
- [ ] L'abonnement existe dans Firestore
- [ ] Le statut est `active` et le tier est `paid`
- [ ] La date d'expiration est dans le futur
- [ ] L'application affiche "Abonné jusqu'au [date]"
- [ ] Les logs montrent que tout s'est bien passé

## 🔧 Si ça ne fonctionne pas

1. **Vérifier les logs Firebase Functions** :
   ```bash
   firebase functions:log --only handleStripeWebhook --limit 100
   ```

2. **Vérifier dans Stripe Dashboard** :
   - Aller dans Stripe Dashboard > Subscriptions
   - Vérifier que la subscription existe
   - Vérifier les webhooks envoyés (Stripe Dashboard > Developers > Webhooks > [votre webhook] > Events)

3. **Créer manuellement si nécessaire** :
   - Utiliser le script `create-subscription-final.ts` pour créer l'abonnement manuellement
   - Ou créer directement dans Firebase Console

## 📝 Notes

- Les logs sont maintenant **très détaillés** pour faciliter le diagnostic
- Le script de rechargement dans l'application attend jusqu'à 15 secondes pour que le webhook se déclenche
- Si le webhook prend plus de temps, l'abonnement sera visible au prochain rechargement de la page
