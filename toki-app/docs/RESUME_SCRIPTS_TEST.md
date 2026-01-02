# Résumé des Scripts de Test pour les Abonnements

## ✅ Ce qui a été fait

### 1. Logs détaillés ajoutés dans `handleStripeWebhook`

La fonction Firebase `handleStripeWebhook` a été mise à jour avec des logs très détaillés :
- Logs de chaque étape du traitement
- Vérification de l'écriture dans Firestore
- Vérification après écriture pour confirmer le succès
- Logs d'erreur détaillés

**Fichier modifié** : `toki-app/functions/src/index.ts`
**Déployé** : ✅ Oui (version avec logs)

### 2. Script de test simplifié créé

**Fichier** : `toki-app/scripts/test-subscription-simple.ts`

Ce script permet de :
- ✅ Lire l'état actuel d'un utilisateur dans Firestore
- ✅ Créer un abonnement directement dans Firestore en bypassant tout le système
- ✅ Vérifier que l'abonnement a bien été créé

**Usage** :
```bash
cd toki-app
npx ts-node scripts/test-subscription-simple.ts <userId> <subscriptionId>
```

**Exemple** :
```bash
npx ts-node scripts/test-subscription-simple.ts cRHlBQJshyR9uDx1FpPMMruaaOW2 sub_1SknCIGdme3i0KJAW3s35lNa
```

### 3. Script de test complet créé

**Fichier** : `toki-app/scripts/test-subscription-complete.ts`

Ce script fait tout ce que le script simple fait, plus :
- Test de création de session Checkout
- Simulation de webhook
- Tests plus approfondis

## 📋 Prérequis pour utiliser les scripts

1. **Service Account Key** :
   - Aller dans Firebase Console > Project Settings > Service Accounts
   - Cliquer sur "Generate new private key"
   - Placer le fichier dans `toki-app/serviceAccountKey.json` ou `toki-app/functions/serviceAccountKey.json`

2. **Clé Stripe** (optionnelle, pour récupérer les vraies dates) :
   - Définir `STRIPE_SECRET_KEY` dans les variables d'environnement
   - Ou dans `.env.production`

## 🔍 Comment diagnostiquer le problème

### Étape 1: Vérifier les logs Firebase Functions

```bash
firebase functions:log --only handleStripeWebhook --limit 50
```

Chercher les logs `[handleStripeWebhook]` qui montrent :
- Si le webhook a été appelé
- Les données reçues
- Si l'écriture a réussi
- La vérification après écriture

### Étape 2: Tester la création manuelle

```bash
cd toki-app
npx ts-node scripts/test-subscription-simple.ts <userId> <subscriptionId>
```

Ce script va :
1. Lire l'état actuel
2. Créer l'abonnement dans Firestore
3. Vérifier que ça a fonctionné

### Étape 3: Vérifier dans Firebase Console

Aller dans Firebase Console > Firestore > Collection `users` > Document `{userId}`

Vérifier si le champ `subscription` existe et contient les bonnes données.

## 🐛 Problèmes possibles et solutions

### Problème 1: Le webhook n'est pas appelé

**Vérifier** :
- Stripe Dashboard > Developers > Webhooks
- Vérifier que le webhook est configuré
- Vérifier les événements envoyés

**Solution** : Utiliser le script pour créer l'abonnement manuellement

### Problème 2: Le webhook est appelé mais l'abonnement n'apparaît pas

**Vérifier les logs Firebase Functions** :
- Chercher `[handleStripeWebhook]`
- Vérifier si l'écriture a réussi
- Vérifier la vérification après écriture

**Solution** : Les logs détaillés vont montrer exactement où ça bloque

### Problème 3: L'abonnement est créé mais pas actif

**Vérifier** :
- Le status dans Firestore
- La date d'expiration
- Le tier

**Solution** : Le script de test affiche tous ces détails

## 📝 Notes importantes

- Les logs sont maintenant **très détaillés** pour faciliter le diagnostic
- Le script utilise `set()` avec `merge: true` pour garantir la création ou mise à jour
- Le script vérifie toujours après écriture pour confirmer le succès
- Tous les accès à `window` sont protégés dans le frontend

## 🚀 Prochaines étapes

1. Exécuter le script de test pour créer l'abonnement manuellement
2. Vérifier les logs Firebase Functions pour voir ce qui se passe
3. Identifier le problème exact avec les logs détaillés
4. Corriger le problème identifié
