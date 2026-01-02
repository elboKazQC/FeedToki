# Instructions : Ajouter le Champ Subscription dans Firebase Console

## 🎯 Votre Situation

Vous êtes **Day 1** (utilisateur depuis le début), donc vous devriez être **Beta Tester** (gratuit à vie).

## ✅ Solution : Ajouter le Champ `subscription`

### Étapes dans Firebase Console

1. **Aller sur votre document utilisateur** :
   - Collection : `users`
   - Document : `cRHlBQJshyR9uDx1FpPMMruaaOW2`

2. **Ajouter le champ `subscription`** :
   - Cliquer sur **"+ Ajouter un champ"**
   - **Nom du champ** : `subscription`
   - **Type** : `map` (carte)
   - Cliquer sur **"Ajouter"**

3. **Ajouter les sous-champs dans `subscription`** :
   
   Cliquer sur le champ `subscription` pour l'ouvrir, puis ajouter :
   
   - **tier** (string) : `beta`
   - **status** (string) : `active`
   - **createdAt** (string) : `2025-12-28T18:45:21.585Z` (votre date de création)

### Structure Complète à Ajouter

```json
{
  "subscription": {
    "tier": "beta",
    "status": "active",
    "createdAt": "2025-12-28T18:45:21.585Z"
  }
}
```

## 🔍 Vérification

Après avoir ajouté le champ :

1. **Recharger la page `/subscription`** dans l'application
2. Le statut devrait changer de **"Abonnement expiré"** à **"Beta Tester - Gratuit à vie ✅"**

## 📝 Optionnel : Ajouter `userRank`

Si vous voulez aussi ajouter votre rang (pour confirmer que vous êtes beta) :

1. Cliquer sur **"+ Ajouter un champ"**
2. **Nom du champ** : `userRank`
3. **Type** : `number`
4. **Valeur** : `1` (si vous êtes le premier) ou le rang approprié

**Note** : Ce champ n'est pas critique, mais il permet de confirmer que vous êtes dans les 10 premiers.

## ✅ Après Ajout

Une fois le champ `subscription` ajouté avec `tier: "beta"` et `status: "active"` :
- L'application affichera **"Beta Tester - Gratuit à vie ✅"**
- Vous aurez accès à toutes les fonctionnalités premium gratuitement
- Plus besoin de payer pour utiliser l'IA
