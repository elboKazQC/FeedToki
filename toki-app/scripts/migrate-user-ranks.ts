// Script pour calculer et ajouter userRank aux utilisateurs existants
// Usage: npx ts-node scripts/migrate-user-ranks.ts

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, query, orderBy, getDocs, doc, setDoc } from 'firebase/firestore';

// Configuration Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDpRzpFR-i_6MCP5dMpvXtzxjrmYxdKRTM",
  authDomain: "feed-toki.firebaseapp.com",
  projectId: "feed-toki",
  storageBucket: "feed-toki.firebasestorage.app",
  messagingSenderId: "936904189160",
  appId: "1:936904189160:web:6d8504e13e67a9300e555d",
  measurementId: "G-3G8CEV84ZM"
};

// Initialize client-side Firebase if not already
let dbClient: any;
if (getApps().length === 0) {
  initializeApp(firebaseConfig);
}
dbClient = getFirestore();

async function migrateUserRanks() {
  if (!dbClient) {
    console.error('Firestore client-side not initialized. Cannot run migration.');
    return;
  }

  console.log('🔄 Démarrage de la migration des userRank...\n');

  try {
    const usersRef = collection(dbClient, 'users');
    const q = query(usersRef, orderBy('createdAt', 'asc'));
    const querySnapshot = await getDocs(q);

    console.log(`📊 Total utilisateurs trouvés: ${querySnapshot.docs.length}\n`);

    let rank = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const userDoc of querySnapshot.docs) {
      rank++;
      const userId = userDoc.id;
      const userData = userDoc.data();

      // Vérifier si userRank existe déjà
      if (userData.userRank && typeof userData.userRank === 'number') {
        console.log(`⏭️  Utilisateur ${userId} (Rang ${rank}): userRank déjà présent (${userData.userRank}), ignoré`);
        skipped++;
        continue;
      }

      // Vérifier si createdAt existe
      if (!userData.createdAt) {
        console.warn(`⚠️  Utilisateur ${userId} (Rang ${rank}): createdAt manquant, ignoré`);
        skipped++;
        continue;
      }

      try {
        // Mettre à jour le profil avec le rank
        await setDoc(doc(dbClient, 'users', userId), { userRank: rank }, { merge: true });
        console.log(`✅ Utilisateur ${userId}: userRank = ${rank}`);
        updated++;
      } catch (error) {
        console.error(`❌ Erreur pour utilisateur ${userId}:`, error);
        errors++;
      }
    }

    console.log('\n📋 Résumé de la migration:');
    console.log(`   ✅ Mis à jour: ${updated}`);
    console.log(`   ⏭️  Ignorés (déjà présent): ${skipped}`);
    console.log(`   ❌ Erreurs: ${errors}`);
    console.log(`   📊 Total: ${querySnapshot.docs.length}`);
    console.log('\n✅ Migration terminée!');
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    process.exit(1);
  }
}

// Exécuter la migration
migrateUserRanks()
  .then(() => {
    console.log('\n🎉 Script terminé avec succès!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Erreur fatale:', error);
    process.exit(1);
  });
