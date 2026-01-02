# Guide de Test Complet des Abonnements

Ce guide explique comment utiliser le script de test pour diagnostiquer les problèmes d'abonnement.

## 📋 Prérequis

1. **Service Account Key** : Télécharger `serviceAccountKey.json` depuis Firebase Console
   - Firebase Console > Project Settings > Service Accounts
   - Cliquer sur "Generate new private key"
   - Placer le fichier dans `toki-app/serviceAccountKey.json` ou `toki-app/functions/serviceAccountKey.json`

2. **Variables d'environnement** : Créer `.env.production` dans `toki-app/` avec :
   ```
   STRIPE_SECRET_KEY=sk_test_...
   EXPO_PUBLIC_FIREBASE_API_KEY=...
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   EXPO_PUBLIC_FIREBASE_APP_ID=...
   ```

## 🧪 Utilisation du Script

### Test 1: Vérifier l'abonnement actuel

```bash
cd toki-app
npx ts-node scripts/test-subscription-complete.ts cRHlBQJshyR9uDx1FpPMMruaaOW2
```

Cela va :
- Lire le document utilisateur dans Firestore
- Afficher toutes les données
- Vérifier si une subscription existe
- Vérifier si elle est active

### Test 2: Créer manuellement un abonnement

```bash
cd toki-app
npx ts-node scripts/test-subscription-complete.ts cRHlBQJshyR9uDx1FpPMMruaaOW2 sub_1SknCIGdme3i0KJAW3s35lNa
```

Cela va :
- Récupérer la subscription depuis Stripe
- Créer l'abonnement dans Firestore
- Vérifier que l'écriture a réussi

### Test 3: Simuler un webhook

Le script simule aussi un webhook Stripe pour tester la logique complète.

## 📊 Logs Détaillés

Le script affiche des logs colorés pour chaque étape :
- 🔍 En bleu : Actions en cours
- ✅ En vert : Succès
- ❌ En rouge : Erreurs
- ⚠️ En jaune : Avertissements

## 🔍 Vérification des Logs Firebase

Après avoir testé, vérifier les logs Firebase Functions :

```bash
firebase functions:log --only handleStripeWebhook --limit 50
```

Les logs incluent maintenant :
- Tous les détails du webhook reçu
- Les données de la session Stripe
- Les données de la subscription Stripe
- Les données écrites dans Firestore
- La vérification après écriture

## 🐛 Diagnostic

Si l'abonnement n'apparaît pas dans Firestore :

1. **Vérifier les logs Firebase Functions** :
   - Chercher `[handleStripeWebhook]` dans les logs
   - Vérifier si le webhook a été appelé
   - Vérifier si l'écriture a réussi

2. **Vérifier le document utilisateur** :
   - Aller dans Firebase Console > Firestore
   - Chercher le document `users/{userId}`
   - Vérifier si le champ `subscription` existe

3. **Vérifier Stripe** :
   - Aller dans Stripe Dashboard > Subscriptions
   - Vérifier que la subscription existe
   - Vérifier les webhooks envoyés (Stripe Dashboard > Developers > Webhooks)

## 🔧 Correction Manuelle

Si le webhook n'a pas fonctionné, utiliser le script pour créer l'abonnement manuellement :

```bash
npx ts-node scripts/test-subscription-complete.ts <userId> <subscriptionId>
```

Le script va :
1. Récupérer la subscription depuis Stripe
2. Créer l'abonnement dans Firestore avec les bonnes dates
3. Vérifier que tout est correct

## 📝 Notes

- Le script utilise `set()` avec `merge: true` pour garantir la création ou mise à jour
- Les logs sont très détaillés pour faciliter le diagnostic
- Le script vérifie toujours après écriture pour confirmer le succès
