# Solution - Erreur Firestore : champ `country` undefined

**Date de résolution :** 2 janvier 2026  
**Version de déploiement :** 1.0.75  
**Problème :** Erreur lors de la création d'un nouveau compte utilisateur sur iPhone/Safari

## 🔍 Description du Problème

Lors de la création d'un nouveau compte utilisateur, une erreur Firestore se produisait :

```
Function setDoc() called with invalid data. 
Unsupported field value: undefined 
(found in field country in document users/[userId])
```

Cette erreur empêchait la création du compte utilisateur et affichait un message d'erreur d'authentification.

### Cause Racine

Dans `lib/firebase-auth.ts`, lors de la création du profil utilisateur initial :

1. La fonction `detectCountry()` est appelée pour détecter le pays de l'utilisateur via IP
2. Si la détection échoue (erreur réseau, service indisponible, etc.), `country` reste `undefined`
3. Le champ `country` était toujours ajouté au profil, même s'il était `undefined`
4. **Firestore n'accepte pas les valeurs `undefined`** dans les documents, ce qui causait l'erreur

## ✅ Solution Appliquée

### Correction dans `lib/firebase-auth.ts`

**Avant :**
```typescript
const defaultProfile: UserProfile = {
  userId: userCredential.user.uid,
  displayName,
  email: userCredential.user.email || email,
  weeklyCalorieTarget: defaultWeeklyTarget,
  dailyPointsBudget: defaultDailyPoints,
  maxPointsCap: Math.min(defaultDailyPoints * 4, 12),
  createdAt: new Date().toISOString(),
  onboardingCompleted: false,
  country, // ❌ Peut être undefined
};
```

**Après :**
```typescript
// Construire le profil par défaut
// IMPORTANT: Ne pas inclure country si undefined (Firestore n'accepte pas undefined)
const defaultProfile: any = {
  userId: userCredential.user.uid,
  displayName,
  email: userCredential.user.email || email,
  weeklyCalorieTarget: defaultWeeklyTarget,
  dailyPointsBudget: defaultDailyPoints,
  maxPointsCap: Math.min(defaultDailyPoints * 4, 12),
  createdAt: new Date().toISOString(),
  onboardingCompleted: false,
};

// Ajouter country seulement si défini (Firestore n'accepte pas undefined)
if (country) {
  defaultProfile.country = country;
}
```

## 📋 Fichiers Modifiés

1. **`toki-app/lib/firebase-auth.ts`**
   - Modification de la fonction `signUp()` pour ne pas inclure `country` si `undefined`

## 🎯 Principe Clé

**Firestore ne supporte pas les valeurs `undefined`**

Lors de la création ou mise à jour de documents Firestore :
- ❌ Ne jamais inclure un champ avec une valeur `undefined`
- ✅ Soit ne pas inclure le champ du tout s'il est `undefined`
- ✅ Soit utiliser une valeur par défaut appropriée
- ✅ Toujours filtrer les valeurs `undefined` avant `setDoc()` ou `updateDoc()`

**Pattern recommandé :**
```typescript
// ✅ CORRECT - Filtrer les valeurs undefined
const cleanData: any = {};
for (const [key, value] of Object.entries(data)) {
  if (value !== undefined) {
    cleanData[key] = value;
  }
}
await setDoc(doc(db, 'collection', 'id'), cleanData);

// ✅ CORRECT - Ajout conditionnel
const profile: any = { /* champs obligatoires */ };
if (optionalField) {
  profile.optionalField = optionalField;
}
await setDoc(doc(db, 'collection', 'id'), profile);
```

## ✅ Vérification

Après déploiement de la version 1.0.75 :
- La création de compte devrait fonctionner même si la détection du pays échoue
- Le champ `country` sera présent uniquement s'il a été détecté avec succès
- Aucune erreur Firestore ne devrait se produire lors de la création de compte

## 🔗 Références

- [Firestore Data Types - Documentation officielle](https://firebase.google.com/docs/firestore/manage-data/data-types)
- Note : Firestore accepte `null` mais pas `undefined`

## 📝 Notes Importantes

- La fonction `updateUserProfile()` filtre déjà correctement les valeurs `undefined` (lignes 308-314)
- Le code d'onboarding filtre également les valeurs `undefined` avant la sauvegarde
- Cette correction garantit que tous les nouveaux comptes peuvent être créés même si la géolocalisation échoue
