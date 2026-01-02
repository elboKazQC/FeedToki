# Comment Ajouter le Champ Subscription dans Firebase Console

## 🚨 Problème

Votre document utilisateur dans Firestore **n'a pas le champ `subscription`**, c'est pourquoi l'application affiche "Abonnement expiré".

## ✅ Solution : Ajouter le Champ Manuellement

### Option 1 : Si vous êtes Beta Tester (Day 1 - dans les 10 premiers)

Si vous êtes dans les 10 premiers utilisateurs, vous devriez avoir un abonnement beta gratuit à vie :

1. Dans Firebase Console, aller sur votre document utilisateur
2. Cliquer sur **"+ Ajouter un champ"**
3. **Nom du champ** : `subscription`
4. **Type** : `map` (carte)
5. Cliquer sur **"Ajouter"**
6. Dans le champ `subscription`, ajouter les sous-champs suivants :
   - **tier** (string) : `beta`
   - **status** (string) : `active`
   - **createdAt** (string) : `2025-12-28T18:45:21.585Z` (ou la date de création de votre compte)

**Structure complète** :
```json
{
  "subscription": {
    "tier": "beta",
    "status": "active",
    "createdAt": "2025-12-28T18:45:21.585Z"
  }
}
```

### Option 2 : Si vous avez un Abonnement Payant

Si vous avez payé et que le webhook n'a pas fonctionné :

1. Dans Firebase Console, aller sur votre document utilisateur
2. Cliquer sur **"+ Ajouter un champ"**
3. **Nom du champ** : `subscription`
4. **Type** : `map` (carte)
5. Cliquer sur **"Ajouter"**
6. Dans le champ `subscription`, ajouter les sous-champs suivants :
   - **tier** (string) : `paid`
   - **status** (string) : `active`
   - **subscriptionStartDate** (string) : Date de début (ex: `2026-01-01T15:50:00.000Z`)
   - **subscriptionEndDate** (string) : Date de fin (1 mois plus tard, ex: `2026-02-01T15:50:00.000Z`)
   - **stripeCustomerId** (string) : ID du customer Stripe (ex: `cus_TiDXZZf5MqNgtk`)
   - **stripeSubscriptionId** (string) : ID de la subscription Stripe (ex: `sub_1SknCIGdme3i0KJAW3s35lNa`)
   - **createdAt** (string) : Date de création (ex: `2026-01-01T15:50:00.000Z`)

**Structure complète** :
```json
{
  "subscription": {
    "tier": "paid",
    "status": "active",
    "subscriptionStartDate": "2026-01-01T15:50:00.000Z",
    "subscriptionEndDate": "2026-02-01T15:50:00.000Z",
    "stripeCustomerId": "cus_TiDXZZf5MqNgtk",
    "stripeSubscriptionId": "sub_1SknCIGdme3i0KJAW3s35lNa",
    "createdAt": "2026-01-01T15:50:00.000Z"
  }
}
```

## 🔍 Vérifier si vous êtes Beta Tester

Pour vérifier si vous êtes dans les 10 premiers utilisateurs :

1. Dans Firebase Console, vérifier votre `createdAt` : `2025-12-28T18:45:21.585Z`
2. Compter combien d'utilisateurs ont un `createdAt` antérieur au vôtre
3. Si vous êtes dans les 10 premiers, vous êtes beta tester

**Note** : Le champ `userRank` devrait aussi être ajouté pour les beta testers, mais ce n'est pas critique pour le moment.

## 📝 Champs Manquants Identifiés

D'après votre document actuel, il manque :
- ❌ `subscription` (CRITIQUE - pour afficher le statut d'abonnement)
- ⚠️ `userRank` (Optionnel - pour identifier les beta testers)

## ✅ Après Ajout

Une fois le champ `subscription` ajouté :
1. Recharger la page `/subscription` dans l'application
2. Le statut devrait changer de "Abonnement expiré" à :
   - "Beta Tester - Gratuit à vie ✅" (si tier = beta)
   - "Abonné jusqu'au [date]" (si tier = paid et status = active)
