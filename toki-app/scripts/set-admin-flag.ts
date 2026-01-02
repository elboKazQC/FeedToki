/**
 * Script pour ajouter le flag isAdmin aux profils administrateurs
 * Usage: npx ts-node scripts/set-admin-flag.ts
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDpRzpFR-i_6MCP5dMpvXtzxjrmYxdKRTM",
  authDomain: "feed-toki.firebaseapp.com",
  projectId: "feed-toki",
  storageBucket: "feed-toki.firebasestorage.app",
  messagingSenderId: "936904189160",
  appId: "1:936904189160:web:6d8504e13e67a9300e555d",
  measurementId: "G-3G8CEV84ZM"
};

const ADMIN_EMAILS = [
  'vcasaubon@noovelia.com',
  'casaubonvincent@gmail.com',
];

async function setAdminFlags() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  console.log('🔍 Recherche des utilisateurs admin...');

  // Récupérer tous les utilisateurs
  const { collection, getDocs } = await import('firebase/firestore');
  const usersRef = collection(db, 'users');
  const snapshot = await getDocs(usersRef);

  let updated = 0;
  let errors = 0;

  for (const userDoc of snapshot.docs) {
    const userData = userDoc.data();
    const email = userData.email;

    if (email && ADMIN_EMAILS.includes(email.toLowerCase().trim())) {
      const userId = userDoc.id;
      console.log(`✅ Admin trouvé: ${email} (${userId})`);

      try {
        await setDoc(doc(db, 'users', userId), { isAdmin: true }, { merge: true });
        console.log(`   ✓ Flag isAdmin ajouté`);
        updated++;
      } catch (error) {
        console.error(`   ✗ Erreur:`, error);
        errors++;
      }
    }
  }

  console.log(`\n✅ Terminé: ${updated} profil(s) mis à jour, ${errors} erreur(s)`);
  process.exit(0);
}

setAdminFlags().catch(error => {
  console.error('❌ Erreur:', error);
  process.exit(1);
});
