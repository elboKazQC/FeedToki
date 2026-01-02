// Serveur simple pour recevoir les logs depuis Safari mobile
// Usage: node scripts/log-server.js

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3001;
const LOG_FILE = path.join(__dirname, '..', 'safari-logs.jsonl');

// Créer le fichier de log s'il n'existe pas
if (!fs.existsSync(LOG_FILE)) {
  fs.writeFileSync(LOG_FILE, '');
}

const logs = [];
let logCount = 0;

// Fonction pour formater les logs dans la console
function formatLog(log) {
  const timestamp = new Date(log.timestamp).toLocaleTimeString('fr-FR');
  const level = log.level.toUpperCase().padEnd(5);
  const message = log.message.substring(0, 100); // Limiter à 100 caractères pour l'affichage
  
  let color = '\x1b[0m'; // Reset
  switch (log.level) {
    case 'error':
      color = '\x1b[31m'; // Rouge
      break;
    case 'warn':
      color = '\x1b[33m'; // Jaune
      break;
    case 'info':
      color = '\x1b[36m'; // Cyan
      break;
    default:
      color = '\x1b[0m'; // Normal
  }

  return `${color}[${timestamp}] [${level}]${'\x1b[0m'} ${message}`;
}

const server = http.createServer((req, res) => {
  // CORS headers pour permettre les requêtes depuis Safari mobile
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/logs') {
    let body = '';
    
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const log = JSON.parse(body);
        logCount++;
        logs.push(log);
        
        // Afficher dans la console avec formatage
        console.log(formatLog(log));
        
        // Afficher la stack trace si présente
        if (log.stack) {
          console.log('\x1b[31m' + 'Stack trace:' + '\x1b[0m');
          console.log(log.stack.split('\n').slice(0, 5).join('\n')); // Limiter à 5 lignes
        }
        
        // Afficher les métadonnées si présentes
        if (log.metadata && Object.keys(log.metadata).length > 0) {
          console.log('\x1b[36m' + 'Metadata:' + '\x1b[0m', JSON.stringify(log.metadata, null, 2));
        }
        
        // Afficher l'URL si présente
        if (log.url) {
          console.log('\x1b[36m' + 'URL:' + '\x1b[0m', log.url);
        }
        
        console.log(''); // Ligne vide pour séparer les logs
        
        // Sauvegarder dans fichier (format JSONL - une ligne par log)
        fs.appendFileSync(LOG_FILE, JSON.stringify(log) + '\n');
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, count: logCount }));
      } catch (error) {
        console.error('❌ Erreur parsing log:', error);
        console.error('Body reçu:', body.substring(0, 200));
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
      }
    });
  } else if (req.method === 'GET' && req.url === '/stats') {
    // Endpoint pour obtenir les statistiques
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      totalLogs: logCount,
      errors: logs.filter(l => l.level === 'error').length,
      warnings: logs.filter(l => l.level === 'warn').length,
      lastLog: logs[logs.length - 1] || null,
    }));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('📊 Serveur de logs démarré');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`🌐 URL: http://0.0.0.0:${PORT}/logs`);
  console.log(`📝 Logs sauvegardés dans: ${LOG_FILE}`);
  console.log(`📊 Statistiques: http://0.0.0.0:${PORT}/stats`);
  console.log('');
  console.log('En attente de logs depuis Safari mobile...');
  console.log('');
  console.log('💡 Pour trouver l\'IP de votre PC Windows:');
  console.log('   - Ouvrir CMD et exécuter: ipconfig');
  console.log('   - Chercher "Adresse IPv4" (ex: 192.168.1.100)');
  console.log('   - Configurer EXPO_PUBLIC_LOG_SERVER=http://VOTRE_IP:3001/logs');
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
});

// Gestion propre de l'arrêt
process.on('SIGINT', () => {
  console.log('\n\n📊 Arrêt du serveur de logs...');
  console.log(`✅ Total de logs reçus: ${logCount}`);
  console.log(`📝 Logs sauvegardés dans: ${LOG_FILE}`);
  server.close(() => {
    process.exit(0);
  });
});
