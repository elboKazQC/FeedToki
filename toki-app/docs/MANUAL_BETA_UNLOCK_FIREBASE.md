# Débloquer manuellement un compte Beta via Firebase Console

## Instructions rapides

Pour débloquer un compte beta tester manuellement dans Firebase Console :

### Étape 1: Ouvrir Firestore
1. Allez dans [Firebase Console](https://console.firebase.google.com)
2. Sélectionnez votre projet
3. Allez dans **Firestore Database**

### Étape 2: Trouver l'utilisateur
1. Dans la collection `users`, trouvez le document avec l'ID = userId du beta tester
2. Ouvrez ce document

### Étape 3: Ajouter/Modifier la subscription
Dans le document utilisateur, ajoutez ou modifiez le champ `subscription` :

**Type de champ :** `map` (objet)

**Structure :**
```json
{
  "tier": "beta",
  "status": "active",
  "createdAt": "2026-01-02T00:00:00.000Z"
}
```

**Champs requis :**
- `tier`: `string` = `"beta"`
- `status`: `string` = `"active"`
- `createdAt`: `string` = Date ISO (ex: `"2026-01-02T00:00:00.000Z"`)

### Étape 4: Sauvegarder
1. Cliquez sur **Update** (ou le bouton de sauvegarde)
2. Le compte est maintenant débloqué !

## Exemple visuel

Dans Firebase Console, le document devrait ressembler à :

```
users/
  └── {userId}/
      ├── email: "user@example.com"
      ├── displayName: "Nom Utilisateur"
      ├── subscription (map):
      │   ├── tier: "beta"
      │   ├── status: "active"
      │   └── createdAt: "2026-01-02T00:00:00.000Z"
      └── ... (autres champs)
```

## Vérification

Pour vérifier que ça fonctionne :
1. L'utilisateur doit se reconnecter dans l'app
2. Il devrait maintenant pouvoir accéder aux features premium (AI Logger, etc.)
3. Le paywall ne devrait plus s'afficher

## Notes importantes

- **Pas besoin de `userRank`** : On ne vérifie plus le userRank pour l'accès beta
- **La subscription est suffisante** : Si `subscription.tier === 'beta'` et `subscription.status === 'active'`, l'utilisateur a accès
- **Date createdAt** : Utilisez la date/heure actuelle en format ISO (ex: `new Date().toISOString()`)

## Alternative : Via Firebase CLI (pour les développeurs)

Si vous préférez utiliser la ligne de commande :

```bash
# Installer Firebase CLI si pas déjà installé
npm install -g firebase-tools

# Se connecter
firebase login

# Mettre à jour la subscription
firebase firestore:set users/{userId} subscription.tier beta
firebase firestore:set users/{userId} subscription.status active
firebase firestore:set users/{userId} subscription.createdAt "2026-01-02T00:00:00.000Z"
```
