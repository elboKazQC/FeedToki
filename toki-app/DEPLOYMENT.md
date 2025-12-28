# Guide de Déploiement - Toki

## Déploiement PWA (Recommandé pour Single-User)

### Prérequis

1. Node.js installé
2. Compte Firebase (gratuit)
3. Compte Vercel ou Netlify (gratuit)

### Étape 1: Activer Firebase

1. Créer un projet sur [console.firebase.google.com](https://console.firebase.google.com)
2. Activer **Authentication** (Email/Password)
3. Créer une base **Firestore** en mode test
4. Dans Project Settings > General, ajouter une app Web
5. Copier l'objet `firebaseConfig`
6. Dans `lib/firebase-config.ts`:
   - Coller la config
   - Mettre `FIREBASE_ENABLED = true`

### Étape 2: Règles de Sécurité Firestore

Dans Firestore > Rules, utiliser:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Les utilisateurs peuvent lire/écrire leur propre profil
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      // Sous-collections
      match /meals/{mealId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
      match /points/{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
      match /targets/{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
      match /weights/{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
    
    // Logs utilisateurs - pour debugging
    match /user_logs/{logId} {
      // Les utilisateurs peuvent créer leurs propres logs
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
      
      // Les utilisateurs peuvent lire leurs propres logs
      allow read: if request.auth != null && request.auth.uid == resource.data.userId;
      
      // TODO: Ajouter un champ "admin" dans le profil utilisateur pour permettre la lecture de tous les logs
      // allow read: if request.auth != null && 
      //   get(/databases/$(database)/documents/users/$(request.auth.uid)).data.admin == true;
    }
  }
}
```

### Étape 3: Build Web

```bash
cd toki-app
npm install
npx expo export:web
```

Le build sera dans le dossier `web-build/`.

### Étape 4: Déployer sur Firebase Hosting (Recommandé)

1. Installer Firebase CLI (si pas déjà fait):
   ```bash
   npm install -g firebase-tools
   ```

2. Se connecter à Firebase:
   ```bash
   firebase login
   ```

3. Initialiser Firebase Hosting dans le projet:
   ```bash
   cd toki-app
   firebase init hosting
   ```
   
   Lors des questions:
   - **"What do you want to use as your public directory?"** → `web-build` (Expo génère les fichiers dans ce dossier)
   - **"Configure as a single-page app?"** → `Yes`
   - **"Set up automatic builds and deploys with GitHub?"** → `No` (optionnel)

4. Build l'application web:
   ```bash
   npx expo export:web
   ```
   
   Cela génère les fichiers statiques dans `web-build/`

5. Déployer sur Firebase Hosting:
   ```bash
   firebase deploy --only hosting
   ```

6. L'app sera accessible à:
   - `https://feed-toki.web.app`
   - `https://feed-toki.firebaseapp.com`

### Alternative: Déployer sur Vercel

Si tu préfères Vercel (plus simple, pas besoin de CLI):

1. Installer Vercel CLI: `npm i -g vercel`
2. Dans le dossier `toki-app`:
   ```bash
   npx expo export:web
   vercel
   ```
3. Suivre les instructions
4. L'app sera accessible via une URL Vercel

### Étape 5: Installer comme PWA

1. Ouvrir l'URL sur mobile
2. Sur iOS Safari: Partager > Sur l'écran d'accueil
3. Sur Android Chrome: Menu > Installer l'application

---

## Coûts Estimés

- **Firebase Spark (gratuit):** Jusqu'à 50k reads/jour, 20k writes/jour
- **Vercel/Netlify:** Gratuit pour usage personnel
- **Total:** **$0/mois** pour usage single-user

Si dépassement Firebase:
- Blaze Plan: Pay-as-you-go
- ~$0.50-2/mois pour usage modéré

---

## Alternative: Expo EAS Build (TestFlight)

Si tu préfères une app native:

```bash
# Installer EAS CLI
npm install -g eas-cli

# Login
eas login

# Configurer
eas build:configure

# Build iOS
eas build --platform ios

# Soumettre à TestFlight
eas submit --platform ios
```

**Coût:** Gratuit pour builds de développement

---

## Monitoring

### Firebase Analytics (Gratuit)

1. Activer dans Firebase Console
2. Analytics s'active automatiquement
3. Voir les stats dans Firebase Console > Analytics

### Erreurs

Les erreurs sont loggées dans:
- Console (en développement)
- Firebase Crashlytics (si activé, payant après quota gratuit)

---

## Maintenance

### Mises à jour

1. Faire les modifications
2. Rebuild: `npx expo export:web`
3. Redéployer: `vercel --prod`

### Backup

Firestore fait des backups automatiques. Pour backup manuel:
1. Firebase Console > Firestore > Export
2. Télécharger le backup JSON

---

## Troubleshooting

### L'app ne se charge pas

- Vérifier que Firebase est bien configuré
- Vérifier les règles Firestore
- Vérifier la console pour erreurs

### Données non synchronisées

- Vérifier que `FIREBASE_ENABLED = true`
- Vérifier la connexion internet
- Vérifier les logs dans la console

### PWA ne s'installe pas

- Vérifier que `app.json` contient la config web
- Vérifier que le service worker est généré
- Essayer en mode HTTPS (requis pour PWA)

---

**Dernière mise à jour:** Janvier 2025

