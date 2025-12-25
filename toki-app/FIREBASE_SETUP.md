# Guide de Configuration Firebase pour Toki

## 1. Créer un Projet Firebase

1. Va sur [console.firebase.google.com](https://console.firebase.google.com)
2. Clique sur "Ajouter un projet"
3. Nomme ton projet "Toki" (ou un autre nom)
4. Active Google Analytics (optionnel)
5. Clique sur "Créer le projet"

## 2. Configurer Authentication

1. Dans le menu de gauche, clique sur "Authentication"
2. Clique sur "Commencer"
3. Active le fournisseur "E-mail/Mot de passe"
4. Sauvegarde

## 3. Configurer Firestore Database

1. Dans le menu de gauche, clique sur "Firestore Database"
2. Clique sur "Créer une base de données"
3. Sélectionne "Commencer en mode test" (pour le développement)
4. Choisis une région (us-central1 recommandé)
5. Clique sur "Activer"

### Règles de sécurité (pour commencer):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Les utilisateurs peuvent lire/écrire leur propre profil
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Les utilisateurs peuvent lire/écrire leurs propres repas
    match /users/{userId}/meals/{mealId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## 4. Obtenir les Clés de Configuration

1. Dans la page d'accueil du projet, clique sur l'icône Web `</>`
2. Nomme ton app "Toki Web"
3. Copie l'objet `firebaseConfig`
4. Colle les valeurs dans `lib/firebase-config.ts`

Exemple:
```typescript
const firebaseConfig = {
  apiKey: "AIza...", // Ta vraie clé
  authDomain: "toki-xxxxx.firebaseapp.com",
  projectId: "toki-xxxxx",
  storageBucket: "toki-xxxxx.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef..."
};
```

## 5. Structure Firestore

### Collection `users`
Stocke les profils utilisateurs:
```
/users/{userId}
  - userId: string
  - displayName: string
  - email: string
  - weeklyCalorieTarget: number
  - dailyPointsBudget: number
  - onboardingCompleted: boolean
  - createdAt: timestamp
```

### Sous-collection `meals`
Stocke les repas de chaque utilisateur:
```
/users/{userId}/meals/{mealId}
  - id: string
  - label: string
  - category: string
  - items: array
  - createdAt: timestamp
```

## 6. Tester l'Authentification

Une fois configuré:
1. Lance l'app: `npm start`
2. Va sur l'écran de connexion
3. Crée un compte avec un email/mot de passe
4. Vérifie dans la console Firebase que l'utilisateur apparaît dans Authentication
5. Vérifie que le profil est créé dans Firestore

## 7. Multi-Comptes Famille (Phase 2 suite)

Pour permettre plusieurs membres de la famille:
- Chaque membre a son propre compte Firebase
- Les parents peuvent créer des comptes enfants
- Utiliser Firestore pour lier les comptes familiaux
