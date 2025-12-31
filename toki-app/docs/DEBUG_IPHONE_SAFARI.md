# Guide : Accéder à la Console Safari sur iPhone

## 📱 Pour débugger FeedToki sur iPhone Safari

### Méthode 1 : Safari sur Mac (Recommandé - macOS uniquement)

**Prérequis :**
- Un Mac avec Safari
- Ton iPhone connecté au même réseau Wi‑Fi que le Mac
- Safari activé sur les deux appareils

**Étapes :**

1. **Sur ton iPhone :**
   - Va dans **Réglages** > **Safari** > **Avancé**
   - Active **Inspecteur Web**

2. **Sur ton Mac :**
   - Ouvre Safari
   - Va dans **Safari** > **Préférences** > **Avancé**
   - Coche **Afficher le menu Développement dans la barre de menus**

3. **Connecter les appareils :**
   - Sur ton iPhone, ouvre FeedToki dans Safari
   - Sur ton Mac, dans Safari, va dans **Développement** > **[Nom de ton iPhone]** > **[Onglet FeedToki]**
   - La console Safari s'ouvre et affiche tous les logs en temps réel !

### Méthode 1b : Windows - Chrome DevTools (Alternative)

**Prérequis :**
- Windows avec Chrome installé
- Ton iPhone connecté au même réseau Wi‑Fi que ton PC
- Chrome sur iPhone (optionnel, mais Safari fonctionne aussi)

**Étapes :**

1. **Sur ton iPhone :**
   - Ouvre FeedToki dans Safari (ou Chrome)
   - Note l'adresse IP de ton iPhone : **Réglages** > **Wi‑Fi** > Clique sur le réseau > Note l'**Adresse IP**

2. **Sur ton PC Windows :**
   - Ouvre Chrome
   - Va sur `chrome://inspect` dans la barre d'adresse
   - Coche **Découvrir les cibles réseau**
   - Clique sur **Configurer** et ajoute le port : `9222`
   - Sur ton iPhone, ouvre Safari et va sur `http://[IP_DE_TON_PC]:9222` (remplace par l'IP de ton PC)
   - Tu devrais voir ton iPhone apparaître dans la liste
   - Clique sur **inspect** pour ouvrir DevTools

**⚠️ Note :** Cette méthode nécessite que ton iPhone et ton PC soient sur le même réseau Wi‑Fi.

### Méthode 2 : RemoteDebug iOS WebKit Adapter (Windows - Plus simple)

**Prérequis :**
- Windows avec Node.js installé
- Ton iPhone et ton PC sur le même réseau Wi‑Fi

**Étapes :**

1. **Installer l'outil :**
   ```bash
   npm install -g remotedebug-ios-webkit-adapter
   ```

2. **Sur ton iPhone :**
   - Va dans **Réglages** > **Safari** > **Avancé**
   - Active **Inspecteur Web**

3. **Sur ton PC :**
   - Ouvre un terminal
   - Lance : `remotedebug-ios-webkit-adapter`
   - Ouvre Chrome et va sur `chrome://inspect`
   - Tu devrais voir ton iPhone dans la liste
   - Clique sur **inspect** pour ouvrir DevTools

### Méthode 3 : Erlywarn (Application iOS)

**Étapes :**

1. Télécharge **Erlywarn** depuis l'App Store (gratuit)
2. Ouvre Erlywarn sur ton iPhone
3. Va dans FeedToki dans Safari
4. Erlywarn capture automatiquement les erreurs JavaScript

### Méthode 4 : Logs dans l'application (Recommandé pour Windows) ✅

FeedToki enregistre automatiquement **tous les événements importants** dans Firebase :
- ✅ Code-barres scannés
- ✅ Produits trouvés ou non trouvés
- ✅ Erreurs de décodage
- ✅ Tentatives de scan
- ✅ Scores de netteté

**Comment accéder aux logs :**

1. **Va sur [Firebase Console](https://console.firebase.google.com)**
2. **Sélectionne le projet `feed-toki`**
3. **Va dans Firestore Database** (menu de gauche)
4. **Ouvre la collection `user_logs`**
5. **Filtre par ton `userId`** :
   - Clique sur "Ajouter un filtre"
   - Champ : `userId`
   - Opérateur : `==`
   - Valeur : Ton `userId` (tu peux le trouver dans l'URL de l'app ou dans les logs)

**Ou utilise cette requête dans la console :**
```javascript
// Dans Firebase Console > Firestore > user_logs
// Ajoute un filtre :
userId == "TON_USER_ID_ICI"
```

**Types de logs capturés pour le scanner :**
- `barcode-scanner` - Tous les événements du scanner
- `info` - Scans réussis, produits trouvés
- `warn` - Produits non trouvés, échecs de décodage
- `error` - Erreurs techniques

**Exemple de log :**
```json
{
  "userId": "cRHlBQJshyR9uDx1FpPMMruaaOW2",
  "level": "info",
  "message": "Code-barres décodé avec succès: 3017620422003",
  "context": "barcode-scanner",
  "data": "{\"barcode\":\"3017620422003\",\"attempt\":1,\"method\":\"cloud/quagga/zxing\",\"blurScore\":75}",
  "timestamp": "2024-12-31T03:50:00Z"
}
```

### Méthode 5 : Alertes visuelles (Temporaire - Windows compatible)

Pour débugger rapidement, tu peux ajouter des `alert()` dans le code :
```javascript
alert('Code-barres scanné: ' + barcode);
```

⚠️ **Note :** Les `alert()` bloquent l'interface, donc à utiliser seulement pour le debugging.

---

## 🔍 Que chercher dans les logs ?

Quand le scanner ne fonctionne pas, cherche ces messages :

- `[BarcodeScanner]` - Logs du scanner
- `[AddEntry]` - Logs de l'ajout d'entrée
- `Code-barres scanné:` - Confirmation du scan
- `Produit trouvé:` ou `Produit non trouvé` - Résultat de la recherche
- `Erreur` - Toutes les erreurs

---

## 💡 Astuces pour Windows

**Option la plus simple :**
- Utilise les **logs Firebase** (Méthode 4) - Pas besoin de Mac, fonctionne sur Windows
- Tous les logs importants sont automatiquement enregistrés dans Firebase Console

**Option pour voir les logs en temps réel :**
- Utilise **RemoteDebug iOS WebKit Adapter** (Méthode 2) - Fonctionne sur Windows
- Ou utilise **Chrome DevTools** avec réseau local (Méthode 1b)

**Option cloud (si tu n'as pas accès au même réseau) :**
- Utilise un service cloud comme **BrowserStack** ou **Sauce Labs** (gratuit pour tests)
- Ou demande à quelqu'un avec un Mac de te connecter

---

**Dernière mise à jour :** Décembre 2024
