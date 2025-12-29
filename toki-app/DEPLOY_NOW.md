# 🚀 Déploiement - Mises à Jour Récentes

## ✅ Changements Prêts pour Déploiement

### 1. Parser IA Amélioré
- ✅ Détection de quantités améliorée
- ✅ Support de plusieurs aliments dans une phrase
- ✅ Plats composés avec quantités multiples
- ✅ Variations linguistiques étendues

### 2. Validation & Robustesse
- ✅ Module de validation centralisé (`lib/validation.ts`)
- ✅ Validation de tous les inputs utilisateur
- ✅ Gestion des cas limites (données corrompues)
- ✅ Messages d'erreur clairs en français

### 3. Sprites Dragon
- ✅ Composant `DragonDisplay` avec animations
- ✅ 12 sprites dragon renommés et activés
- ✅ Transitions entre niveaux
- ✅ Animations de level up

---

## 📋 Déploiement Manuel

### Option 1: Via Terminal (Recommandé)

**Si le build fonctionne:**
```bash
cd toki-app
npx expo export --platform web --output-dir web-build
firebase deploy --only hosting
```

**Si erreur de permissions:**
1. Ferme tous les processus qui utilisent les dossiers (VS Code, Explorer, etc.)
2. Réessaie le build
3. Ou utilise l'option 2 ci-dessous

### Option 2: Via Script

**Windows:**
```bash
cd toki-app
.\deploy.bat
```

**Linux/Mac:**
```bash
cd toki-app
chmod +x deploy.sh
./deploy.sh
```

### Option 3: Build dans un Dossier Temporaire

Si les permissions persistent:
```bash
cd toki-app
npx expo export --platform web --output-dir temp-build
# Copier manuellement temp-build vers web-build
# Puis: firebase deploy --only hosting
```

---

## 🔍 Vérification Post-Déploiement

Après déploiement, vérifie:

1. **Parser IA:**
   - Va sur l'app web
   - Teste "2 toasts au beurre de peanut"
   - Devrait détecter correctement

2. **Validation:**
   - Essaie d'entrer un poids invalide (ex: 500 kg)
   - Devrait afficher un message d'erreur clair

3. **Sprites Dragon:**
   - Les images dragon devraient s'afficher (pas les emojis)
   - Animations lors des level ups

---

## 📝 Notes

- Les **données Firebase** ne sont **PAS** affectées
- Seul le **code** est mis à jour
- Les utilisateurs doivent **rafraîchir** la page (F5)

---

**URL de déploiement:** https://feed-toki.web.app

