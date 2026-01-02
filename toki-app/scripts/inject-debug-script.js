// Script pour injecter le script de diagnostic dans le HTML généré par Expo
const fs = require('fs');
const path = require('path');

const WEB_BUILD_DIR = path.join(__dirname, '..', 'web-build');
const DEBUG_SCRIPT = `
<script>
(function() {
  'use strict';
  var LOG_SERVER = 'http://192.168.1.243:3001/logs';
  var logBuffer = []; // Tableau pour stocker tous les logs
  var errorCount = 0; // Compteur d'erreurs
  var isSending = false; // Indicateur d'envoi en cours
  
  // Fonction pour stocker les logs en mémoire (au lieu d'envoyer automatiquement)
  function storeLog(level, message, metadata) {
    try {
      var log = {
        timestamp: new Date().toISOString(),
        level: level,
        message: message,
        userAgent: navigator.userAgent,
        platform: 'web',
        metadata: metadata || {}
      };
      logBuffer.push(log);
      
      // Incrémenter le compteur d'erreurs si c'est une erreur
      if (level === 'error') {
        errorCount++;
        updateErrorButton();
      }
    } catch (e) {
      console.error('[Debug] Erreur stockage log:', e);
    }
  }
  
  // Fonction pour envoyer tous les logs en batch
  function sendAllLogs() {
    if (isSending || logBuffer.length === 0) {
      return;
    }
    
    isSending = true;
    var button = document.getElementById('__error_report_button');
    if (button) {
      button.innerHTML = '📤 Envoi...';
      button.disabled = true;
    }
    
    var logsToSend = logBuffer.slice(); // Copie du buffer
    var sentCount = 0;
    var failedCount = 0;
    
    // Fonction pour envoyer un log avec timeout et retry
    function sendSingleLog(log, index) {
      return new Promise(function(resolve) {
        var timeoutId = setTimeout(function() {
          failedCount++;
          resolve();
        }, 5000); // Timeout de 5 secondes
        
        fetch(LOG_SERVER, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(log),
          keepalive: true,
          signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined
        }).then(function(response) {
          clearTimeout(timeoutId);
          if (response.ok) {
            sentCount++;
          } else {
            console.warn('[Debug] Échec envoi log, status:', response.status);
            failedCount++;
          }
          resolve();
        }).catch(function(error) {
          clearTimeout(timeoutId);
          console.error('[Debug] Erreur envoi log:', error);
          failedCount++;
          resolve();
        });
      });
    }
    
    // Envoyer les logs séquentiellement pour éviter la surcharge
    var sendPromises = [];
    logsToSend.forEach(function(log, index) {
      sendPromises.push(
        new Promise(function(resolve) {
          setTimeout(function() {
            sendSingleLog(log, index).then(resolve);
          }, index * 50); // Délai de 50ms entre chaque envoi
        })
      );
    });
    
    Promise.all(sendPromises).then(function() {
      isSending = false;
      
      // Ne vider le buffer que si tous les logs ont été envoyés avec succès
      if (failedCount === 0) {
        logBuffer = [];
        errorCount = 0;
      }
      
      // Mettre à jour le bouton
      if (button) {
        if (failedCount === 0) {
          button.innerHTML = '✅ Envoyé (' + sentCount + ')';
          button.style.background = '#22c55e';
          setTimeout(function() {
            button.remove();
          }, 3000);
        } else {
          button.innerHTML = '⚠️ ' + sentCount + '/' + logsToSend.length;
          button.style.background = '#f59e0b';
          button.disabled = false;
        }
      }
      
      // Afficher un message de confirmation
      if (failedCount === 0) {
        showMessage('✅ ' + sentCount + ' log(s) envoyé(s) avec succès');
      } else {
        showMessage('⚠️ ' + sentCount + ' log(s) envoyé(s), ' + failedCount + ' échec(s). Réessayez.');
      }
    }).catch(function(error) {
      console.error('[Debug] Erreur lors de l\'envoi des logs:', error);
      isSending = false;
      if (button) {
        button.innerHTML = '❌ Erreur';
        button.style.background = '#dc2626';
        button.disabled = false;
      }
      showMessage('❌ Erreur lors de l\'envoi des logs. Vérifiez votre connexion.');
    });
  }
  
  // Fonction pour afficher un message temporaire
  function showMessage(text) {
    try {
      var msg = document.createElement('div');
      msg.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:100000;' +
        'background:#22c55e;color:#fff;padding:12px 24px;border-radius:8px;' +
        'font-size:14px;font-weight:bold;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
      msg.textContent = text;
      document.body.appendChild(msg);
      setTimeout(function() {
        msg.remove();
      }, 3000);
    } catch (e) {}
  }
  
  // Fonction pour créer/mettre à jour le bouton flottant
  function updateErrorButton() {
    if (errorCount === 0) {
      var existing = document.getElementById('__error_report_button');
      if (existing) {
        existing.remove();
      }
      return;
    }
    
    var existing = document.getElementById('__error_report_button');
    if (existing) {
      existing.innerHTML = '🚨 Erreur<br><small>' + errorCount + '</small>';
      return;
    }
    
    var btn = document.createElement('button');
    btn.id = '__error_report_button';
    btn.innerHTML = '🚨 Erreur<br><small>' + errorCount + '</small>';
    btn.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:99998;' +
      'background:#dc2626;color:#fff;border:none;border-radius:50px;' +
      'padding:12px 20px;font-size:14px;font-weight:bold;cursor:pointer;' +
      'box-shadow:0 4px 12px rgba(0,0,0,0.3);touch-action:manipulation;';
    btn.onclick = function(e) {
      e.stopPropagation();
      sendAllLogs();
    };
    
    if (document.body) {
      document.body.appendChild(btn);
    } else {
      document.addEventListener('DOMContentLoaded', function() {
        document.body.appendChild(btn);
      });
    }
  }
  
  // Fonction pour afficher l'overlay d'erreur avec bouton d'envoi
  function showOverlay(text) {
    try {
      var existing = document.getElementById('__debug_overlay');
      if (existing) existing.remove();
      
      var d = document.createElement('div');
      d.id = '__debug_overlay';
      d.style.cssText = 'position:fixed;z-index:99999;left:0;top:0;right:0;background:rgba(0,0,0,0.9);color:#fff;padding:12px;font-size:14px;font-family:monospace;max-height:50vh;overflow:auto;word-break:break-all;line-height:1.4;';
      
      var content = document.createElement('div');
      content.style.cssText = 'margin-bottom:12px;';
      content.textContent = text;
      d.appendChild(content);
      
      var closeBtn = document.createElement('button');
      closeBtn.textContent = '✕ Fermer';
      closeBtn.style.cssText = 'position:absolute;top:12px;right:12px;background:#dc2626;color:#fff;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-size:12px;';
      closeBtn.onclick = function() { d.remove(); };
      d.appendChild(closeBtn);
      
      var sendBtn = document.createElement('button');
      sendBtn.textContent = '📤 Envoyer les logs (' + logBuffer.length + ')';
      sendBtn.style.cssText = 'background:#22c55e;color:#fff;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:bold;margin-top:12px;width:100%;';
      sendBtn.onclick = function(e) {
        e.stopPropagation();
        sendAllLogs();
        d.remove();
      };
      d.appendChild(sendBtn);
      
      if (document.body) {
        document.body.appendChild(d);
      } else {
        document.addEventListener('DOMContentLoaded', function() {
          document.body.appendChild(d);
        });
      }
    } catch (e) {
      console.error('[Debug] Erreur affichage overlay:', e);
    }
  }
  
  // Capturer les erreurs JavaScript
  window.addEventListener('error', function(event) {
    var txt = '[ERREUR JS]\\n' + (event.message || String(event.error)) + 
              '\\n\\nFichier: ' + (event.filename || 'inconnu') + 
              ':' + (event.lineno || '?') + ':' + (event.colno || '?') +
              '\\n\\nStack:\\n' + (event.error && event.error.stack ? event.error.stack : 'Pas de stack trace');
    showOverlay(txt);
    storeLog('error', '[HTML] Erreur JS: ' + (event.message || String(event.error)), {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error && event.error.stack ? event.error.stack : undefined
    });
  }, true);
  
  // Capturer les promesses rejetées
  window.addEventListener('unhandledrejection', function(event) {
    var reason = event.reason && (event.reason.stack || event.reason.message || String(event.reason));
    var txt = '[PROMESSE REJETÉE]\\n' + reason;
    showOverlay(txt);
    storeLog('error', '[HTML] Promesse rejetée: ' + reason, {
      stack: event.reason instanceof Error ? event.reason.stack : undefined
    });
  });
  
  console.log('[HTML Diagnostic] Script de diagnostic actif (mode manuel - pas d\\'envoi automatique)');
})();
</script>
`;

function injectScriptIntoHTML(htmlPath) {
  try {
    let html = fs.readFileSync(htmlPath, 'utf8');
    
    // Injecter le script juste après l'ouverture de <head>
    if (html.includes('</head>')) {
      html = html.replace('</head>', DEBUG_SCRIPT + '</head>');
      fs.writeFileSync(htmlPath, html, 'utf8');
      console.log(`✅ Script injecté dans: ${path.basename(htmlPath)}`);
      return true;
    } else if (html.includes('<head>')) {
      html = html.replace('<head>', '<head>' + DEBUG_SCRIPT);
      fs.writeFileSync(htmlPath, html, 'utf8');
      console.log(`✅ Script injecté dans: ${path.basename(htmlPath)}`);
      return true;
    } else {
      console.warn(`⚠️  Pas de <head> trouvé dans: ${path.basename(htmlPath)}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Erreur lors de l'injection dans ${htmlPath}:`, error.message);
    return false;
  }
}

// Trouver tous les fichiers HTML dans web-build
function findHTMLFiles(dir) {
  const files = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...findHTMLFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.html')) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Erreur lors de la lecture de ${dir}:`, error.message);
  }
  return files;
}

// Exécuter l'injection
console.log('🔧 Injection du script de diagnostic dans les fichiers HTML...\n');

if (!fs.existsSync(WEB_BUILD_DIR)) {
  console.error(`❌ Le répertoire ${WEB_BUILD_DIR} n'existe pas!`);
  console.error('   Exécutez d\'abord: npx expo export --platform web --output-dir web-build');
  process.exit(1);
}

const htmlFiles = findHTMLFiles(WEB_BUILD_DIR);
if (htmlFiles.length === 0) {
  console.error(`❌ Aucun fichier HTML trouvé dans ${WEB_BUILD_DIR}`);
  process.exit(1);
}

console.log(`📁 ${htmlFiles.length} fichier(s) HTML trouvé(s)\n`);

let successCount = 0;
for (const htmlFile of htmlFiles) {
  if (injectScriptIntoHTML(htmlFile)) {
    successCount++;
  }
}

console.log(`\n✅ ${successCount}/${htmlFiles.length} fichier(s) HTML modifié(s) avec succès`);
