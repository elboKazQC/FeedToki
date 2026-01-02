/**
 * Script pour vérifier la structure d'un document utilisateur dans Firestore
 * et s'assurer qu'il a tous les champs nécessaires pour les abonnements
 * 
 * Usage: npx ts-node scripts/verify-user-structure.ts [userId]
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

// Initialiser Firebase Admin
const serviceAccountPath = path.join(__dirname, '../serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ serviceAccountKey.json non trouvé');
  console.error('   Téléchargez-le depuis Firebase Console > Project Settings > Service Accounts');
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// User ID à vérifier (par défaut: l'utilisateur de test)
const USER_ID = process.argv[2] || 'cRHlBQJshyR9uDx1FpPMMruaaOW2';

interface UserDocument {
  userId?: string;
  email?: string;
  displayName?: string;
  createdAt?: admin.firestore.Timestamp | string;
  subscription?: {
    tier?: string;
    status?: string;
    subscriptionStartDate?: string;
    subscriptionEndDate?: string;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    createdAt?: string;
  };
  userRank?: number;
  isAdmin?: boolean;
  onboardingCompleted?: boolean;
  weeklyCalorieTarget?: number;
  dailyPointsBudget?: number;
  maxPointsCap?: number;
  [key: string]: any;
}

async function verifyUserStructure() {
  console.log('════════════════════════════════════════');
  console.log('Vérification de la structure utilisateur');
  console.log('════════════════════════════════════════');
  console.log('');
  console.log(`📋 User ID: ${USER_ID}`);
  console.log('');

  try {
    // Récupérer le document utilisateur
    const userRef = db.doc(`users/${USER_ID}`);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.error('❌ Utilisateur non trouvé dans Firestore');
      console.error(`   User ID: ${USER_ID}`);
      console.error('');
      console.error('💡 Solutions:');
      console.error('   1. Vérifier que l\'utilisateur existe dans Firebase Authentication');
      console.error('   2. Vérifier que le document a été créé dans Firestore');
      console.error('   3. Si l\'utilisateur a été créé avant la migration vers Firestore,');
      console.error('      il faut peut-être migrer les données depuis AsyncStorage');
      process.exit(1);
    }

    console.log('✅ Utilisateur trouvé dans Firestore');
    console.log('');

    const userData = userDoc.data() as UserDocument;
    
    // Afficher tous les champs présents
    console.log('📋 Champs présents dans le document:');
    const fields = Object.keys(userData).sort();
    fields.forEach(field => {
      const value = userData[field];
      const type = typeof value;
      const preview = type === 'object' && value !== null 
        ? (Array.isArray(value) ? `[array: ${value.length}]` : '{object}')
        : String(value).substring(0, 50);
      console.log(`   - ${field}: ${type} = ${preview}`);
    });
    console.log('');

    // Vérifier les champs essentiels
    console.log('🔍 Vérification des champs essentiels:');
    console.log('');

    const checks: Array<{ field: string; required: boolean; present: boolean; value?: any }> = [
      { field: 'userId', required: true, present: !!userData.userId, value: userData.userId },
      { field: 'email', required: false, present: !!userData.email, value: userData.email },
      { field: 'displayName', required: false, present: !!userData.displayName, value: userData.displayName },
      { field: 'createdAt', required: false, present: !!userData.createdAt, value: userData.createdAt },
      { field: 'userRank', required: false, present: userData.userRank !== undefined, value: userData.userRank },
      { field: 'subscription', required: false, present: !!userData.subscription, value: userData.subscription },
    ];

    let hasErrors = false;
    checks.forEach(check => {
      const status = check.present ? '✅' : (check.required ? '❌' : '⚠️');
      const required = check.required ? ' (requis)' : ' (optionnel)';
      console.log(`   ${status} ${check.field}${required}`);
      if (!check.present && check.required) {
        hasErrors = true;
      }
      if (check.present && check.value !== undefined) {
        console.log(`      Valeur: ${JSON.stringify(check.value).substring(0, 100)}`);
      }
    });
    console.log('');

    // Vérifier la structure de l'abonnement si présent
    if (userData.subscription) {
      console.log('📋 Structure de l\'abonnement:');
      const sub = userData.subscription;
      const subChecks: Array<{ field: string; required: boolean; present: boolean; value?: any }> = [
        { field: 'tier', required: true, present: !!sub.tier, value: sub.tier },
        { field: 'status', required: true, present: !!sub.status, value: sub.status },
        { field: 'subscriptionStartDate', required: false, present: !!sub.subscriptionStartDate, value: sub.subscriptionStartDate },
        { field: 'subscriptionEndDate', required: false, present: !!sub.subscriptionEndDate, value: sub.subscriptionEndDate },
        { field: 'stripeCustomerId', required: false, present: !!sub.stripeCustomerId, value: sub.stripeCustomerId },
        { field: 'stripeSubscriptionId', required: false, present: !!sub.stripeSubscriptionId, value: sub.stripeSubscriptionId },
        { field: 'createdAt', required: true, present: !!sub.createdAt, value: sub.createdAt },
      ];

      subChecks.forEach(check => {
        const status = check.present ? '✅' : (check.required ? '❌' : '⚠️');
        const required = check.required ? ' (requis)' : ' (optionnel)';
        console.log(`   ${status} subscription.${check.field}${required}`);
        if (check.present && check.value !== undefined) {
          console.log(`      Valeur: ${check.value}`);
        }
      });
      console.log('');
    } else {
      console.log('⚠️  Aucun abonnement trouvé dans le document');
      console.log('   C\'est normal si l\'utilisateur n\'a pas encore d\'abonnement');
      console.log('');
    }

    // Vérifier si le document peut être mis à jour avec un abonnement
    console.log('🔧 Test de mise à jour:');
    console.log('   Le document peut être mis à jour avec un abonnement via:');
    console.log('   userRef.update({ subscription: {...} })');
    console.log('   OU');
    console.log('   userRef.set({ subscription: {...} }, { merge: true })');
    console.log('');

    if (hasErrors) {
      console.log('❌ Des champs requis sont manquants');
      console.log('');
      console.log('💡 Solutions:');
      console.log('   1. Vérifier que l\'utilisateur a complété l\'onboarding');
      console.log('   2. Vérifier que la migration vers Firestore a été effectuée');
      console.log('   3. Créer manuellement les champs manquants si nécessaire');
      process.exit(1);
    } else {
      console.log('✅ Structure du document valide');
      console.log('');
      console.log('💡 Le document peut recevoir un abonnement via le webhook Stripe');
      console.log('   ou via la fonction createSubscriptionManually');
      console.log('');
      console.log('════════════════════════════════════════');
      console.log('✅ SUCCÈS!');
      console.log('════════════════════════════════════════');
    }
  } catch (error: any) {
    console.error('❌ Erreur lors de la vérification:', error);
    console.error('   Message:', error.message);
    process.exit(1);
  }
}

// Exécuter le script
verifyUserStructure()
  .then(() => {
    console.log('');
    console.log('✨ Script terminé');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });
