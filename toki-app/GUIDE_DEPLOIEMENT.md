# 📘 Guide Complet : Déploiement et Versions

## 🎯 Vue d'ensemble

Ton application FeedToki fonctionne avec **deux environnements** :

1. **Développement local** (sur ton ordinateur)
2. **Production** (sur Firebase Hosting, accessible sur `https://feed-toki.web.app`)

## 🔄 Comment ça fonctionne

### Code Local vs Code en Production

```
┌─────────────────────────────────────────────────┐
│  TON ORDINATEUR (Code Source)                   │
│  ├── app/(tabs)/index.tsx  ← Tu modifies ici   │
│  ├── lib/...                                    │
│  └── ...                                        │
└─────────────────────────────────────────────────┘
                    │
                    │ Tu exécutes: build + deploy
                    ▼
┌─────────────────────────────────────────────────┐
│  FIREBASE HOSTING (Production)                  │
│  ├── web-build/  ← Fichiers compilés           │
│  └── https://feed-toki.web.app  ← Version live │
└─────────────────────────────────────────────────┘
```

### ⚠️ IMPORTANT : Les modifications locales ne sont PAS automatiques

Quand je modifie ton code ou que tu modifies le code :
- ✅ Les changements sont sauvegardés dans tes fichiers locaux
- ❌ Les changements ne sont **PAS** automatiquement sur le site web
- ✅ Il faut **build** puis **déployer** pour que les changements soient visibles

## 📋 Processus de Déploiement (Ce que je fais)

Quand je dis "j'ai déployé en production", voici ce que j'exécute :

### Étape 1 : Build (Compilation)
```bash
cd toki-app
npx expo export --platform web
```
**Résultat :** Génère les fichiers dans `dist/`

### Étape 2 : Copie vers web-build
```bash
cp -r dist/* web-build/
```
**Pourquoi :** Firebase Hosting lit les fichiers depuis `web-build/` (configuré dans `firebase.json`)

### Étape 3 : Déploiement sur Firebase
```bash
firebase deploy --only hosting
```
**Résultat :** Les fichiers sont uploadés sur Firebase Hosting et deviennent accessibles sur `https://feed-toki.web.app`

## 🔍 Comment Vérifier si un Déploiement a Réussi

### Méthode 1 : Vérifier les logs
Quand je déploie, tu peux voir dans les logs :
```
+  hosting[feed-toki]: release complete
+  Deploy complete!
```

### Méthode 2 : Vérifier sur le site
1. Va sur `https://feed-toki.web.app`
2. Rafraîchis la page (F5 ou Ctrl+R)
3. Si tu vois les changements → Le déploiement a réussi ✅
4. Si tu ne vois pas les changements → Vérifie que tu as bien rafraîchi la page (le cache peut cacher l'ancienne version)

### Méthode 3 : Vérifier la console Firebase
- Va sur [Firebase Console](https://console.firebase.google.com/project/feed-toki/hosting)
- Tu verras l'historique des déploiements avec dates/heures

## 🛠️ Workflow Recommandé pour Toi

### Pour une mise à jour simple (après que j'ai modifié le code)

**Option A : Script automatique (Recommandé)**
```bash
cd toki-app
./scripts/build-production.sh
```

**Option B : Commandes manuelles**
```bash
cd toki-app
npx expo export --platform web
cp -r dist/* web-build/
firebase deploy --only hosting
```

### Pour tester localement AVANT de déployer

```bash
cd toki-app
npm start
# Ouvre http://localhost:8081 dans ton navigateur
```

⚠️ **Note :** Le mode développement local utilise parfois du code différent (hot reload, etc.). Pour tester la vraie version production, il faut faire un build complet.

## 📦 Différence entre Développement et Production

| Aspect | Développement Local | Production (Firebase) |
|--------|---------------------|-----------------------|
| **Code** | Fichiers TypeScript/React bruts | Fichiers JavaScript compilés |
| **Accès** | `localhost:8081` (ton ordinateur uniquement) | `https://feed-toki.web.app` (accessible partout) |
| **Modifications** | Instantanées (hot reload) | Nécessite build + deploy |
| **Debug** | Console détaillée, erreurs claires | Optimisé, moins de logs |
| **Variables d'environnement** | `.env` local | `.env.production` (dans le build) |

## 🎯 Bonnes Pratiques

### ✅ À FAIRE

1. **Tester localement avant de déployer**
   - Lance `npm start` pour voir les changements en direct
   - Teste les fonctionnalités importantes

2. **Déployer après chaque fonctionnalité majeure**
   - Ne laisse pas trop de changements locaux non déployés
   - Ça évite les surprises et les conflits

3. **Vérifier après déploiement**
   - Rafraîchis la page web
   - Teste rapidement les fonctionnalités modifiées

4. **Garder un historique**
   - Utilise Git pour sauvegarder ton code
   - Commit régulièrement : `git add . && git commit -m "Description des changements"`

### ❌ À ÉVITER

1. **Modifier directement dans `web-build/`**
   - Ce dossier est généré automatiquement
   - Les modifications seront écrasées au prochain build

2. **Déployer sans tester**
   - Teste au moins localement avant

3. **Oublier de rafraîchir le cache**
   - Si tu ne vois pas les changements, fais Ctrl+Shift+R (hard refresh) pour vider le cache

## 🔐 Variables d'Environnement

Les clés secrètes (OpenAI API, etc.) sont gérées différemment :

- **Développement :** `.env` (si tu en as un)
- **Production :** `.env.production` (utilisé lors du build)

⚠️ **Important :** `.env.production` est dans `.gitignore` pour ne pas être commit dans Git (sécurité).

## 🚨 Si les Changements ne Sont Pas Visibles

1. **Vérifie que le déploiement a réussi**
   - Regarde les logs de la commande `firebase deploy`
   - Vérifie la console Firebase

2. **Vide le cache du navigateur**
   - Chrome/Edge : Ctrl+Shift+R (hard refresh)
   - Firefox : Ctrl+F5
   - Ou : F12 → Onglet Network → Coche "Disable cache" → Rafraîchis

3. **Vérifie que tu es sur la bonne URL**
   - `https://feed-toki.web.app` (pas `http://`)

4. **Attends quelques secondes**
   - Firebase peut prendre 10-30 secondes pour propager les changements

5. **Vérifie le code local**
   - Assure-toi que les modifications sont bien dans tes fichiers locaux
   - Vérifie avec `git status` ou ouvre le fichier directement

## 📝 Résumé Rapide

**Pour déployer une modification :**
```bash
cd toki-app
npx expo export --platform web    # 1. Build
cp -r dist/* web-build/           # 2. Copie
firebase deploy --only hosting    # 3. Déploie
```

**Pour vérifier :**
1. Va sur `https://feed-toki.web.app`
2. Rafraîchis (F5)
3. Teste la fonctionnalité modifiée

## 🤔 Questions Fréquentes

**Q: Pourquoi les changements ne sont pas automatiques ?**
R: Pour des raisons de sécurité et de contrôle. Tu veux tester avant de déployer, et éviter de casser le site avec du code buggé.

**Q: Combien de temps prend un déploiement ?**
R: Environ 1-3 minutes (build + upload)

**Q: Les données des utilisateurs sont-elles affectées ?**
R: Non ! Seul le code de l'application est déployé. Les données Firebase (Firestore) restent intactes.

**Q: Dois-je déployer après chaque petite modification ?**
R: Non, tu peux accumuler plusieurs modifications et déployer quand tu es prêt. Mais ne laisse pas trop de temps entre les déploiements.

**Q: Comment revenir à une version précédente ?**
R: Tu peux voir l'historique dans Firebase Console et restaurer une version précédente si nécessaire.

