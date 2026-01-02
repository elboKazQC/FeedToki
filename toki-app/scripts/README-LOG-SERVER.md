# Serveur de Logs pour Safari Mobile

Ce serveur permet de recevoir et afficher en temps réel tous les logs depuis Safari mobile pour diagnostiquer les problèmes de page blanche.

## Démarrage

### Option 1 : Script Windows (recommandé)

```batch
scripts\start-log-server.bat
```

### Option 2 : Ligne de commande

```bash
cd toki-app
node scripts/log-server.js
```

## Configuration

1. **Trouver l'IP de votre PC Windows :**
   - Ouvrir CMD
   - Exécuter : `ipconfig`
   - Chercher "Adresse IPv4" (ex: `192.168.1.100`)

2. **Configurer la variable d'environnement :**
   - Le fichier `.env.production` est déjà configuré avec l'IP : `192.168.1.243`
   - Si vous devez changer l'IP, modifier : `EXPO_PUBLIC_LOG_SERVER=http://VOTRE_IP:3001/logs`
   - Exemple : `EXPO_PUBLIC_LOG_SERVER=http://192.168.1.243:3001/logs`

3. **Redémarrer l'application :**
   - Rebuild et redéployer avec la nouvelle variable d'environnement

## Utilisation

1. **Démarrer le serveur de logs** sur votre PC Windows
2. **Ouvrir l'application** sur Safari mobile (même réseau WiFi)
3. **Observer les logs** en temps réel dans la console du serveur
4. **Analyser les logs** pour identifier où l'application bloque

## Types de logs capturés

- ✅ `console.log`, `console.warn`, `console.error`, `console.info`
- ✅ Erreurs JavaScript synchrones (`window.error`)
- ✅ Promesses rejetées non gérées (`unhandledrejection`)
- ✅ Erreurs de ressources (polices, images, scripts)
- ✅ Requêtes réseau (`fetch`, `XMLHttpRequest`)

## Fichiers de logs

Les logs sont sauvegardés dans : `toki-app/safari-logs.jsonl`

Format : JSON Lines (une ligne JSON par log)

## Endpoints

- `POST /logs` : Recevoir les logs
- `GET /stats` : Statistiques des logs reçus

## Désactiver le logging

Pour désactiver le remote logging en production :
- Ne pas définir `EXPO_PUBLIC_LOG_SERVER` (ou le laisser vide)
- Le système fonctionnera normalement sans envoyer de logs
