/**
 * Script pour vérifier la configuration de l'abonnement
 * Vérifie que l'abonnement existe dans Firestore et que la configuration est correcte
 * 
 * Usage: npx ts-node scripts/verify-subscription-setup.ts
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

const USER_ID = 'cRHlBQJshyR9uDx1FpPMMruaaOW2';
const EXPECTED_CUSTOMER_ID = 'cus_TiDXZZf5MqNgtk';
const EXPECTED_SUBSCRIPTION_ID = 'sub_1SknCIGdme3i0KJAW3s35lNa';

// Initialiser Firebase Admin
const serviceAccountPath = path.join(__dirname, '../serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.log('⚠️  serviceAccountKey.json non trouvé');
  console.log('   Ce script nécessite serviceAccountKey.json pour vérifier Firestore');
  console.log('   Vous pouvez quand même vérifier manuellement dans Firebase Console');
  console.log('');
  console.log('📋 Vérification manuelle:');
  console.log(`   1. Ouvrir: https://console.firebase.google.com/project/feed-toki/firestore/data/~2Fusers~2F${USER_ID}`);
  console.log('   2. Vérifier que le champ "subscription" existe');
  console.log('   3. Vérifier que subscription.tier = "paid"');
  console.log('   4. Vérifier que subscription.status = "active"');
  process.exit(0);
}

const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function verifySubscription() {
  console.log('════════════════════════════════════════');
  console.log('Vérification de la configuration');
  console.log('════════════════════════════════════════');
  console.log('');

  try {
    // Vérifier que l'utilisateur existe
    const userRef = db.doc(`users/${USER_ID}`);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.error('❌ Utilisateur non trouvé dans Firestore');
      console.error(`   User ID: ${USER_ID}`);
      console.log('');
      console.log('📋 Actions:');
      console.log('   1. Vérifier que l\'utilisateur existe dans Firebase Authentication');
      console.log('   2. Vérifier que le document existe dans Firestore');
      process.exit(1);
    }

    console.log('✅ Utilisateur trouvé dans Firestore');

    const userData = userDoc.data();
    const subscription = userData?.subscription;

    if (!subscription) {
      console.error('❌ Abonnement non trouvé');
      console.log('');
      console.log('📋 Actions:');
      console.log('   1. Créer l\'abonnement via Firebase Console');
      console.log('   2. Voir: docs/GUIDE_CREATION_ABONNEMENT_FIRESTORE.md');
      console.log(`   3. OU utiliser la fonction createSubscriptionManually si vous êtes admin`);
      process.exit(1);
    }

    console.log('✅ Abonnement trouvé');
    console.log('');

    // Vérifier les champs
    const checks = [
      { field: 'tier', expected: 'paid', actual: subscription.tier },
      { field: 'status', expected: 'active', actual: subscription.status },
      { field: 'stripeCustomerId', expected: EXPECTED_CUSTOMER_ID, actual: subscription.stripeCustomerId },
      { field: 'stripeSubscriptionId', expected: EXPECTED_SUBSCRIPTION_ID, actual: subscription.stripeSubscriptionId },
    ];

    let allValid = true;
    console.log('📋 Vérification des champs:');
    for (const check of checks) {
      const isValid = check.actual === check.expected;
      const icon = isValid ? '✅' : '❌';
      console.log(`   ${icon} ${check.field}: ${check.actual} ${isValid ? '' : `(attendu: ${check.expected})`}`);
      if (!isValid) allValid = false;
    }

    // Vérifier les dates
    console.log('');
    console.log('📅 Vérification des dates:');
    if (subscription.subscriptionStartDate) {
      const startDate = new Date(subscription.subscriptionStartDate);
      console.log(`   ✅ subscriptionStartDate: ${startDate.toISOString()}`);
    } else {
      console.log('   ❌ subscriptionStartDate manquant');
      allValid = false;
    }

    if (subscription.subscriptionEndDate) {
      const endDate = new Date(subscription.subscriptionEndDate);
      const now = new Date();
      const isFuture = endDate > now;
      const icon = isFuture ? '✅' : '⚠️';
      console.log(`   ${icon} subscriptionEndDate: ${endDate.toISOString()} ${isFuture ? '(dans le futur)' : '(expiré)'}`);
      if (!isFuture) {
        console.log('   ⚠️  L\'abonnement est expiré - l\'accès premium ne fonctionnera pas');
      }
    } else {
      console.log('   ❌ subscriptionEndDate manquant');
      allValid = false;
    }

    console.log('');

    if (allValid) {
      console.log('════════════════════════════════════════');
      console.log('✅ Configuration valide!');
      console.log('════════════════════════════════════════');
      console.log('');
      console.log('📋 Prochaines étapes:');
      console.log('   1. Tester l\'accès premium dans l\'app');
      console.log('   2. Tester le webhook Stripe');
    } else {
      console.log('════════════════════════════════════════');
      console.log('⚠️  Configuration incomplète');
      console.log('════════════════════════════════════════');
      console.log('');
      console.log('📋 Actions:');
      console.log('   1. Corriger les champs manquants ou incorrects');
      console.log('   2. Voir: docs/GUIDE_CREATION_ABONNEMENT_FIRESTORE.md');
    }
  } catch (error: any) {
    console.error('❌ Erreur lors de la vérification:', error);
    console.error('   Message:', error.message);
    process.exit(1);
  }
}

verifySubscription()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });
