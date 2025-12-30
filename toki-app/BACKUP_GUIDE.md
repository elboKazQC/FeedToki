# Guide de Backup et Restauration - FeedToki

## Backup Firestore

Firestore effectue des backups automatiques, mais il est recommandé de faire des backups manuels avant des changements importants.

### Méthode 1: Export via Firebase Console (Recommandé)

1. Aller sur [Firebase Console](https://console.firebase.google.com)
2. Sélectionner le projet FeedToki
3. Aller dans **Firestore Database** > **Options** > **Export**
4. Choisir les collections à exporter (ou toutes)
5. Choisir un bucket Cloud Storage ou créer un nouveau
6. Cliquer sur **Exporter**

L'export sera disponible dans Cloud Storage au format JSON.

### Méthode 2: Export via Firebase CLI

```bash
# Installer Firebase CLI si pas déjà fait
npm install -g firebase-tools

# Se connecter
firebase login

# Exporter toutes les collections
firebase firestore:export gs://[BUCKET_NAME]/[PATH]

# Exemple avec bucket spécifique
firebase firestore:export gs://feed-toki-backups/firestore-export-$(date +%Y%m%d)
```

### Méthode 3: Script Automatisé

Créer un script `scripts/backup-firestore.sh`:

```bash
#!/bin/bash
BUCKET_NAME="feed-toki-backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
EXPORT_PATH="gs://${BUCKET_NAME}/firestore-export-${TIMESTAMP}"

echo "Export Firestore vers ${EXPORT_PATH}..."
firebase firestore:export "${EXPORT_PATH}"

echo "✅ Backup terminé: ${EXPORT_PATH}"
```

## Restauration Firestore

### Restaurer depuis un Export

**ATTENTION:** La restauration va **remplacer** toutes les données existantes!

1. Aller sur Firebase Console > Firestore > Options > Importer
2. Sélectionner le fichier d'export depuis Cloud Storage
3. Choisir les collections à restaurer
4. Cliquer sur **Importer**

### Restaurer via CLI

```bash
# Restaurer depuis un export
firebase firestore:import gs://[BUCKET_NAME]/[PATH]
```

## Backup AsyncStorage (Mode Local)

Si vous utilisez le mode local (sans Firebase), les données sont stockées dans AsyncStorage du navigateur.

### Export Manuel (Développeur)

1. Ouvrir la console du navigateur (F12)
2. Exécuter:
```javascript
// Lister toutes les clés
const keys = await AsyncStorage.getAllKeys();
console.log('Clés:', keys);

// Exporter toutes les données
const data = {};
for (const key of keys) {
  data[key] = await AsyncStorage.getItem(key);
}
console.log('Données exportées:', JSON.stringify(data, null, 2));

// Copier le JSON et le sauvegarder dans un fichier
```

### Restaurer AsyncStorage

```javascript
// Dans la console du navigateur
const backupData = { /* coller le JSON exporté */ };
for (const [key, value] of Object.entries(backupData)) {
  await AsyncStorage.setItem(key, value);
}
console.log('✅ Données restaurées');
```

## Backup des Variables d'Environnement

**IMPORTANT:** Ne jamais commit les vraies clés dans Git!

1. Sauvegarder `.env.production` dans un gestionnaire de mots de passe (1Password, LastPass, etc.)
2. Ou créer un fichier sécurisé hors du projet
3. Documenter quelles variables sont nécessaires dans `.env.production.example`

## Plan de Backup Recommandé

### Backup Quotidien (Automatisé)

- Firestore: Backup automatique de Google (activé par défaut)
- Cloud Storage: Exporter mensuellement ou avant changements majeurs

### Backup Avant Changements Majeurs

- Exporter Firestore manuellement
- Sauvegarder `.env.production`
- Tagger une version dans Git

### Backup Mensuel

- Export complet Firestore
- Vérifier que les backups Cloud Storage sont accessibles
- Tester une restauration sur un environnement de test (si disponible)

## Récupération en Cas de Problème

### Données Corrompues

1. Identifier la date du dernier backup valide
2. Restaurer depuis ce backup
3. Vérifier que les données sont correctes
4. Continuer normalement

### Suppression Accidentelle

1. Aller dans Firebase Console > Firestore
2. Vérifier l'historique des modifications récentes
3. Si disponible, utiliser "Point-in-time recovery" (disponible avec certaines configurations)
4. Sinon, restaurer depuis le dernier backup

### Perte de Clés API

1. Régénérer les clés API (OpenAI, Firebase, etc.)
2. Mettre à jour `.env.production`
3. Redéployer l'application
4. Vérifier que tout fonctionne

## Vérification de l'Intégrité des Backups

Périodiquement, tester la restauration:

1. Créer un environnement de test
2. Restaurer un backup récent
3. Vérifier que les données sont complètes et cohérentes
4. Tester les fonctionnalités principales

---

**Note:** Pour une application en production avec de nombreux utilisateurs, considérer:
- Backups automatiques quotidiens
- Point-in-time recovery (Firestore)
- Monitoring des backups
- Tests de restauration réguliers

---

**Dernière mise à jour:** 27 janvier 2025


