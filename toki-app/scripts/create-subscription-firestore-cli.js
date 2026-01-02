/**
 * Script pour créer un abonnement dans Firestore via Firebase CLI
 * Utilise firebase-tools pour créer directement le document
 * 
 * Usage: node scripts/create-subscription-firestore-cli.js
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const USER_ID = 'cRHlBQJshyR9uDx1FpPMMruaaOW2';
const CUSTOMER_ID = 'cus_TiDXZZf5MqNgtk';
const SUBSCRIPTION_ID = 'sub_1SknCIGdme3i0KJAW3s35lNa';

// Dates basées sur la date de création Stripe (2026-01-01 14:49:54 UTC)
const NOW = '2026-01-01T14:49:54.000Z';
const END_DATE = '2026-02-01T14:49:54.000Z';

const subscriptionData = {
  tier: 'paid',
  status: 'active',
  subscriptionStartDate: NOW,
  subscriptionEndDate: END_DATE,
  stripeCustomerId: CUSTOMER_ID,
  stripeSubscriptionId: SUBSCRIPTION_ID,
  createdAt: NOW,
};

console.log('════════════════════════════════════════');
console.log('Création d\'abonnement dans Firestore');
console.log('════════════════════════════════════════');
console.log('');
console.log('📋 Informations:');
console.log(`   User ID: ${USER_ID}`);
console.log(`   Customer ID: ${CUSTOMER_ID}`);
console.log(`   Subscription ID: ${SUBSCRIPTION_ID}`);
console.log('');

// Créer un fichier JSON temporaire
const tempFile = path.join(__dirname, 'subscription-temp.json');
fs.writeFileSync(tempFile, JSON.stringify(subscriptionData, null, 2));

console.log('📝 Données de l\'abonnement:');
console.log(JSON.stringify(subscriptionData, null, 2));
console.log('');

try {
  console.log('🔄 Création de l\'abonnement dans Firestore...');
  console.log('');
  console.log('⚠️  NOTE: Cette commande nécessite Firebase CLI et une connexion active.');
  console.log('   Si cela ne fonctionne pas, utilisez Firebase Console manuellement.');
  console.log('');
  console.log('📋 Commande à exécuter:');
  console.log(`   firebase firestore:set users/${USER_ID} subscription ${tempFile} --project feed-toki`);
  console.log('');
  console.log('   OU via Firebase Console:');
  console.log('   1. Ouvrir: https://console.firebase.google.com/project/feed-toki/firestore/data/~2Fusers~2F' + USER_ID);
  console.log('   2. Ajouter le champ "subscription" (type: map)');
  console.log('   3. Ajouter les sous-champs selon subscription-data.json');
  console.log('');
  
  // Essayer d'exécuter la commande
  try {
    const command = `firebase firestore:set users/${USER_ID} subscription ${tempFile} --project feed-toki`;
    console.log('🔄 Exécution de la commande...');
    execSync(command, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    console.log('');
    console.log('✅ Abonnement créé avec succès!');
  } catch (error) {
    console.log('⚠️  La commande Firebase CLI a échoué.');
    console.log('   Cela peut être normal si vous n\'êtes pas connecté ou si la commande n\'est pas disponible.');
    console.log('');
    console.log('📋 Utilisez plutôt Firebase Console:');
    console.log(`   1. Ouvrir: https://console.firebase.google.com/project/feed-toki/firestore/data/~2Fusers~2F${USER_ID}`);
    console.log('   2. Cliquer sur le document');
    console.log('   3. Ajouter le champ "subscription" (type: map)');
    console.log('   4. Ajouter les sous-champs:');
    Object.entries(subscriptionData).forEach(([key, value]) => {
      console.log(`      - ${key}: ${value}`);
    });
    console.log('');
    console.log('   OU copier-coller le contenu de subscription-data.json');
  }
  
  // Nettoyer le fichier temporaire
  if (fs.existsSync(tempFile)) {
    fs.unlinkSync(tempFile);
  }
  
  console.log('════════════════════════════════════════');
  console.log('✅ Instructions affichées');
  console.log('════════════════════════════════════════');
} catch (error) {
  console.error('❌ Erreur:', error.message);
  process.exit(1);
}
