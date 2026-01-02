/**
 * Script pour créer un abonnement manuellement dans Firestore
 * Utilise Firebase Admin SDK directement
 * 
 * Usage: node scripts/create-subscription-direct.js
 * 
 * Prérequis: Avoir le fichier serviceAccountKey.json dans toki-app/
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialiser Firebase Admin
const serviceAccountPath = path.join(__dirname, '../serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ serviceAccountKey.json non trouvé');
  console.error('   Téléchargez-le depuis Firebase Console > Project Settings > Service Accounts');
  console.error('   OU utilisez Firebase CLI: firebase firestore:set users/USER_ID/subscription {...}');
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// Informations fournies
const SUBSCRIPTION_ID = 'sub_1SknCIGdme3i0KJAW3s35lNa';
const CUSTOMER_ID = 'cus_TiDXZZf5MqNgtk';
const USER_ID = 'cRHlBQJshyR9uDx1FpPMMruaaOW2';

async function createSubscriptionManually() {
  console.log('════════════════════════════════════════');
  console.log('Création manuelle d\'abonnement');
  console.log('════════════════════════════════════════');
  console.log('');
  console.log('📋 Informations:');
  console.log(`   User ID: ${USER_ID}`);
  console.log(`   Customer ID: ${CUSTOMER_ID}`);
  console.log(`   Subscription ID: ${SUBSCRIPTION_ID}`);
  console.log('');

  try {
    // Vérifier que l'utilisateur existe
    const userRef = db.doc(`users/${USER_ID}`);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.error('❌ Utilisateur non trouvé dans Firestore');
      console.error(`   User ID: ${USER_ID}`);
      process.exit(1);
    }

    console.log('✅ Utilisateur trouvé dans Firestore');

    // Créer l'abonnement avec les dates par défaut (1 mois)
    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + 1);

    const subscriptionData = {
      tier: 'paid',
      status: 'active',
      subscriptionStartDate: now.toISOString(),
      subscriptionEndDate: endDate.toISOString(),
      stripeCustomerId: CUSTOMER_ID,
      stripeSubscriptionId: SUBSCRIPTION_ID,
      createdAt: now.toISOString(),
    };

    // Mettre à jour l'utilisateur avec l'abonnement
    await userRef.update({ subscription: subscriptionData });

    console.log('');
    console.log('✅ Abonnement créé avec succès!');
    console.log('');
    console.log('📋 Détails de l\'abonnement:');
    console.log(`   Tier: ${subscriptionData.tier}`);
    console.log(`   Status: ${subscriptionData.status}`);
    console.log(`   Start Date: ${subscriptionData.subscriptionStartDate}`);
    console.log(`   End Date: ${subscriptionData.subscriptionEndDate}`);
    console.log(`   Stripe Customer ID: ${subscriptionData.stripeCustomerId}`);
    console.log(`   Stripe Subscription ID: ${subscriptionData.stripeSubscriptionId}`);
    console.log('');

    // Vérifier que l'abonnement a été créé
    const updatedUserDoc = await userRef.get();
    const updatedUserData = updatedUserDoc.data();
    const createdSubscription = updatedUserData?.subscription;

    if (createdSubscription) {
      console.log('✅ Vérification: Abonnement présent dans Firestore');
      console.log('');
      console.log('════════════════════════════════════════');
      console.log('✅ SUCCÈS!');
      console.log('════════════════════════════════════════');
    } else {
      console.error('❌ Erreur: Abonnement non trouvé après création');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Erreur lors de la création de l\'abonnement:', error);
    console.error('   Message:', error.message);
    process.exit(1);
  }
}

// Exécuter le script
createSubscriptionManually()
  .then(() => {
    console.log('');
    console.log('✨ Script terminé');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });
