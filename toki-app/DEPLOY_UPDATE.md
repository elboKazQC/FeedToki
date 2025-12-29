# 🚀 Guide Rapide : Déployer les Mises à Jour

## Résumé

Les modifications que nous avons faites sont dans ton code **local** mais pas encore sur la version web déployée. Pour que les changements soient visibles sur `https://feed-toki.web.app`, il faut :

1. **Build** l'application web
2. **Déployer** sur Firebase Hosting

## 📋 Commandes à exécuter

### Étape 1 : Build l'application web

```bash
cd toki-app
npx expo export:web
```

⏱️ **Temps estimé :** 1-2 minutes

Cette commande génère les fichiers statiques dans le dossier `web-build/`

### Étape 2 : Déployer sur Firebase Hosting

```bash
firebase deploy --only hosting
```

⏱️ **Temps estimé :** 1-2 minutes

Cette commande envoie les fichiers de `web-build/` sur Firebase Hosting.

### ✅ Vérification

Après le déploiement, attend 1-2 minutes puis :
1. Va sur `https://feed-toki.web.app`
2. Rafraîchis la page (F5 ou Ctrl+R)
3. Les changements devraient être visibles

## 🔄 Workflow Complet

```bash
# 1. Aller dans le dossier de l'app
cd toki-app

# 2. Build
npx expo export:web

# 3. Déployer
firebase deploy --only hosting

# ✅ C'est fait !
```

## ⚠️ Important

- Les **données Firebase** (Firestore) ne sont **PAS** affectées par le déploiement
- Seul le **code de l'app** est mis à jour
- Les utilisateurs devront **rafraîchir la page** pour voir les changements

## 🐛 Si ça ne fonctionne pas

1. Vérifier que Firebase CLI est installé : `firebase --version`
2. Vérifier que tu es connecté : `firebase login`
3. Vérifier les erreurs dans la console pendant le build




