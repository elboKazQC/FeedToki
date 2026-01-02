/**
 * Script de test pour vérifier que Sentry capture les erreurs
 * Usage: npx ts-node scripts/test-sentry.ts
 * 
 * Ce script utilise l'API HTTP de Sentry directement (pas besoin de @sentry/react-native)
 */

import * as fs from 'fs';
import * as path from 'path';

// Charger les variables d'environnement depuis .env.production
const envPath = path.join(__dirname, '..', '.env.production');
let SENTRY_DSN: string | undefined;

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const match = envContent.match(/EXPO_PUBLIC_SENTRY_DSN=(.+)/);
  if (match) {
    SENTRY_DSN = match[1].trim();
  }
}

// Fallback sur variable d'environnement système
SENTRY_DSN = SENTRY_DSN || process.env.EXPO_PUBLIC_SENTRY_DSN;

if (!SENTRY_DSN) {
  console.error('❌ EXPO_PUBLIC_SENTRY_DSN non configuré');
  console.log('💡 Assure-toi que la variable est définie dans .env.production');
  process.exit(1);
}

// Parser le DSN: https://key@host/projectId
const dsnMatch = SENTRY_DSN.match(/https:\/\/([^@]+)@([^/]+)\/(.+)/);
if (!dsnMatch) {
  console.error('❌ Format de DSN invalide');
  process.exit(1);
}

const [, publicKey, host, projectId] = dsnMatch;
const sentryUrl = `https://${host}/api/${projectId}/store/`;

console.log('🔧 Configuration Sentry:');
console.log(`   Host: ${host}`);
console.log(`   Project ID: ${projectId}`);
console.log('');

// Créer le payload Sentry
const event = {
  message: {
    message: '🧪 Erreur de test Sentry - FeedToki',
  },
  level: 'error',
  platform: 'node',
  environment: 'test',
  tags: {
    test: 'true',
    source: 'test-script',
  },
  extra: {
    message: 'Ceci est une erreur de test pour vérifier que Sentry fonctionne',
    timestamp: new Date().toISOString(),
    script: 'test-sentry.ts',
  },
  exception: {
    values: [
      {
        type: 'Error',
        value: '🧪 Erreur de test Sentry - FeedToki',
        stacktrace: {
          frames: [
            {
              filename: 'test-sentry.ts',
              function: 'test',
              lineno: 1,
              colno: 1,
            },
          ],
        },
      },
    ],
  },
  timestamp: Math.floor(Date.now() / 1000),
};

// Créer l'en-tête d'authentification Sentry
const authHeader = Buffer.from(JSON.stringify({
  sentry_key: publicKey,
  sentry_version: '7',
})).toString('base64');

console.log('📤 Envoi de l\'erreur de test à Sentry...');

// Envoyer à Sentry
fetch(sentryUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${publicKey}, sentry_client=test-script/1.0`,
  },
  body: JSON.stringify(event),
})
  .then(async (response) => {
    if (response.ok) {
      const eventId = response.headers.get('X-Sentry-Id');
      console.log('✅ Erreur envoyée avec succès !');
      console.log(`📋 Event ID: ${eventId}`);
      console.log('');
      console.log('🔍 Vérifie ton dashboard Sentry pour voir l\'erreur:');
      console.log('   https://feed-toki.sentry.io/');
      console.log('');
      console.log('✅ Test terminé !');
      process.exit(0);
    } else {
      const text = await response.text();
      console.error('❌ Erreur lors de l\'envoi:');
      console.error(`   Status: ${response.status} ${response.statusText}`);
      console.error(`   Response: ${text}`);
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('❌ Erreur réseau:');
    console.error(`   ${error.message}`);
    process.exit(1);
  });
