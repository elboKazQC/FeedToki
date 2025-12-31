// Script de test pour le scanner de code-barres
// Usage: npm run test:barcode
// 
// Ce script démarre un serveur web local et ouvre une page de test
// dans le navigateur pour tester le décodage avec l'image img_1343.jpg

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

const PORT = 3001;
const TEST_IMAGE_PATH = path.join(__dirname, '../test-images/img_1343.jpg');

// Vérifier que l'image existe
if (!fs.existsSync(TEST_IMAGE_PATH)) {
  console.error(`❌ Image de test non trouvée: ${TEST_IMAGE_PATH}`);
  console.error('   Assurez-vous que l\'image img_1343.jpg est dans toki-app/test-images/');
  process.exit(1);
}

// Créer le serveur HTTP
const server = http.createServer((req, res) => {
  const url = req.url || '/';
  
  // Servir la page de test HTML
  if (url === '/' || url === '/test.html') {
    const htmlPath = path.join(__dirname, 'test-barcode-scanner.html');
    if (fs.existsSync(htmlPath)) {
      const html = fs.readFileSync(htmlPath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } else {
      res.writeHead(404);
      res.end('Page de test non trouvée');
    }
  }
  // Servir l'image de test
  else if (url === '/test-images/img_1343.jpg') {
    try {
      const image = fs.readFileSync(TEST_IMAGE_PATH);
      res.writeHead(200, { 'Content-Type': 'image/jpeg' });
      res.end(image);
    } catch (error) {
      res.writeHead(404);
      res.end('Image non trouvée');
    }
  }
  // Servir les fichiers statiques nécessaires (si besoin)
  else {
    res.writeHead(404);
    res.end('Fichier non trouvé');
  }
});

server.listen(PORT, () => {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 Serveur de test du scanner de code-barres démarré');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\n📸 Image de test: ${TEST_IMAGE_PATH}`);
  console.log(`   Code-barres attendu: 0 55653 68450 3`);
  console.log(`\n🌐 Ouvrez votre navigateur à l'adresse:`);
  console.log(`   http://localhost:${PORT}/test.html`);
  console.log(`\n💡 Appuyez sur Ctrl+C pour arrêter le serveur\n`);
  
  // Essayer d'ouvrir automatiquement le navigateur (optionnel)
  const { exec } = require('child_process');
  const platform = process.platform;
  let command = '';
  
  if (platform === 'win32') {
    command = `start http://localhost:${PORT}/test.html`;
  } else if (platform === 'darwin') {
    command = `open http://localhost:${PORT}/test.html`;
  } else {
    command = `xdg-open http://localhost:${PORT}/test.html`;
  }
  
  if (command) {
    exec(command, (error: any) => {
      if (error) {
        console.log('   (Ouverture automatique échouée, ouvrez manuellement)');
      }
    });
  }
});

// Gérer l'arrêt propre
process.on('SIGINT', () => {
  console.log('\n\n🛑 Arrêt du serveur...');
  server.close(() => {
    console.log('✅ Serveur arrêté');
    process.exit(0);
  });
});
