# Guide de Migration et Mises à Jour - Toki

## 🔄 Migration des Données Locales vers Firebase

### Problème
Quand tu te connectes avec Firebase sur le web, tu n'as pas tes données locales car :
- **Données locales** = stockées dans AsyncStorage du navigateur (uniquement sur cet appareil)
- **Données Firebase** = stockées dans Firestore (cloud, accessible partout)

### Solution : Migration Manuelle

#### Option 1 : Via la Console du Navigateur (Rapide)

1. Ouvre la console du navigateur (F12)
2. Colle ce code et exécute-le :

```javascript
// Récupérer ton userId Firebase
const auth = firebase.auth();
const user = auth.currentUser;
const userId = user.uid;
console.log('User ID:', userId);

// Forcer la migration
(async () => {
  const { migrateToFirestore } = await import('./lib/migrate-to-firestore');
  
  // Réinitialiser le flag de migration
  await AsyncStorage.removeItem('toki_firestore_migration_completed');
  
  // Lancer la migration
  const result = await migrateToFirestore(userId);
  console.log('Résultat migration:', result);
})();
```

#### Option 2 : Ajouter un Bouton dans l'App

Un bouton "Migrer mes données locales" peut être ajouté dans les paramètres.

---

## 🚀 Mises à Jour du Code

### ⚡ Mode Développement (localhost)

**Quand tu modifies le code :**
- ✅ **Changements automatiques** : Expo détecte les changements et recharge l'app
- ✅ **Hot Reload** : Les modifications apparaissent instantanément
- ✅ **Pas besoin de rebuild** : Juste sauvegarder le fichier

**Commandes :**
```bash
npm start
# ou
npx expo start
```

**URL :** `http://localhost:8081` (ou l'IP de ton ordinateur sur le réseau local)

---

### 🌐 Mode Production (Déployé sur Firebase/Vercel)

**Quand tu modifies le code :**
- ❌ **Pas automatique** : Les changements ne sont pas visibles immédiatement
- ✅ **Il faut rebuild et redéployer** : Processus en 3 étapes

**Processus de mise à jour :**

1. **Modifier le code** (comme d'habitude)

2. **Build l'application :**
   ```bash
   cd toki-app
   npx expo export:web
   ```
   Cela génère les fichiers dans `web-build/`

3. **Déployer sur Firebase :**
   ```bash
   firebase deploy --only hosting
   ```
   
   Ou sur Vercel :
   ```bash
   vercel --prod
   ```

4. **Attendre 1-2 minutes** : Firebase/Vercel met à jour l'URL

**Important :**
- Les utilisateurs devront **rafraîchir la page** (F5) pour voir les changements
- Les **données Firebase** ne sont pas affectées (elles restent intactes)
- Seul le **code de l'app** est mis à jour

---

## 📊 Résumé : Dev vs Prod

| Aspect | Développement (localhost) | Production (Firebase/Vercel) |
|--------|---------------------------|------------------------------|
| **Modifications de code** | Automatique (Hot Reload) | Manuel (rebuild + deploy) |
| **Temps de mise à jour** | Instantané | 1-2 minutes |
| **Données** | AsyncStorage local | Firestore cloud |
| **URL** | `localhost:8081` | `feed-toki.web.app` |
| **Accès** | Uniquement ton réseau | Partout dans le monde |

---

## 🔍 Vérifier si la Migration a Fonctionné

1. Ouvre la console du navigateur (F12)
2. Regarde les logs : tu devrais voir `[Migration] Données migrées avec succès`
3. Vérifie dans Firebase Console > Firestore :
   - Collection `users` > ton `userId` > sous-collections `meals`, `points`, etc.

---

## ⚠️ Problèmes Courants

### "Migration déjà effectuée" mais pas de données

**Solution :** Réinitialiser le flag de migration :
```javascript
await AsyncStorage.removeItem('toki_firestore_migration_completed');
```

### Données locales avec un autre userId

**Solution :** Les données locales utilisent peut-être `guest` ou un autre ID. Vérifie dans la console :
```javascript
// Voir toutes les clés AsyncStorage
Object.keys(await AsyncStorage.getAllKeys()).filter(k => k.includes('feedtoki'))
```

---

## 💡 Bonnes Pratiques

1. **Avant de déployer :** Toujours tester en local d'abord
2. **Après déploiement :** Vérifier que l'app fonctionne sur l'URL de production
3. **Backup :** Firebase fait des backups automatiques, mais tu peux exporter manuellement depuis Firebase Console
4. **Migration :** Faire la migration une seule fois, puis toutes les nouvelles données vont automatiquement dans Firestore

