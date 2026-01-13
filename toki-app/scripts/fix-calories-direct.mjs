/**
 * Script pour corriger les calories des aliments du 10 janvier
 * 
 * Usage: node scripts/fix-calories-direct.mjs
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import * as readline from 'readline';

// Configuration Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDdwZ7MjBnKDwdKqIjJR_KP7rVTQ2hn4HI",
  authDomain: "feed-toki.firebaseapp.com",
  projectId: "feed-toki",
  storageBucket: "feed-toki.firebasestorage.app",
  messagingSenderId: "653996266147",
  appId: "1:653996266147:web:5a2d3e3d3a9d3e3d3a9d3e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Corrections des calories pour les aliments du 10 janvier
const corrections = {
  'poutine': { calories: 750, protein: 25, carbs: 80, fat: 40 },
  'bière': { calories: 150, protein: 1, carbs: 13, fat: 0 },
  'biere': { calories: 150, protein: 1, carbs: 13, fat: 0 },
  'bloody caesar': { calories: 150, protein: 1, carbs: 8, fat: 0 },
  'bloody': { calories: 150, protein: 1, carbs: 8, fat: 0 },
  'caesar': { calories: 150, protein: 1, carbs: 8, fat: 0 },
  'cornichon frit': { calories: 300, protein: 3, carbs: 30, fat: 18 },
  'cornichon': { calories: 300, protein: 3, carbs: 30, fat: 18 },
  'tarte au pacane': { calories: 500, protein: 6, carbs: 65, fat: 25 },
  'tarte aux pacanes': { calories: 500, protein: 6, carbs: 65, fat: 25 },
  'pacane': { calories: 500, protein: 6, carbs: 65, fat: 25 },
};

async function promptCredentials() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('Email: ', (email) => {
      rl.question('Mot de passe: ', (password) => {
        rl.close();
        resolve({ email, password });
      });
    });
  });
}

async function findAndFixFoods() {
  console.log('\n🔍 Recherche des aliments dans globalFoods...\n');
  
  const globalFoodsRef = collection(db, 'globalFoods');
  const snapshot = await getDocs(globalFoodsRef);
  
  let fixed = 0;
  const foodsToFix = [];
  
  for (const foodDoc of snapshot.docs) {
    const data = foodDoc.data();
    const name = (data.name || '').toLowerCase().trim();
    const currentCalories = data.calories_kcal || data.calories || 0;
    
    // Chercher si cet aliment est dans nos corrections
    for (const [targetName, correction] of Object.entries(corrections)) {
      if (name.includes(targetName)) {
        if (currentCalories > correction.calories + 100) {
          foodsToFix.push({
            id: foodDoc.id,
            name: data.name,
            oldCalories: currentCalories,
            newCalories: correction.calories,
            correction
          });
        }
        break;
      }
    }
  }
  
  if (foodsToFix.length === 0) {
    console.log('✅ Aucun aliment à corriger trouvé (ou déjà corrigés).');
    console.log(`   Total aliments scannés: ${snapshot.docs.length}`);
    return;
  }
  
  console.log(`📝 ${foodsToFix.length} aliment(s) à corriger:\n`);
  
  for (const food of foodsToFix) {
    console.log(`   • ${food.name}`);
    console.log(`     Anciennes calories: ${food.oldCalories} kcal`);
    console.log(`     Nouvelles calories: ${food.newCalories} kcal`);
    console.log('');
    
    try {
      await updateDoc(doc(db, 'globalFoods', food.id), {
        calories_kcal: food.correction.calories,
        calories: food.correction.calories,
        protein_g: food.correction.protein,
        protein: food.correction.protein,
        carbs_g: food.correction.carbs,
        carbs: food.correction.carbs,
        fat_g: food.correction.fat,
        fat: food.correction.fat,
      });
      console.log(`     ✅ Corrigé!`);
      fixed++;
    } catch (error) {
      console.log(`     ❌ Erreur: ${error.message}`);
    }
  }
  
  console.log(`\n========================================`);
  console.log(`✅ ${fixed} aliment(s) corrigé(s)`);
  console.log(`\n💡 Rafraîchis l'app (hard refresh) pour voir les nouvelles moyennes.`);
}

async function main() {
  console.log('🔧 Script de correction des calories FeedToki');
  console.log('=============================================\n');
  
  console.log('Connecte-toi avec ton compte admin FeedToki:\n');
  
  const { email, password } = await promptCredentials();
  
  try {
    console.log('\n🔐 Connexion en cours...');
    await signInWithEmailAndPassword(auth, email, password);
    console.log('✅ Connecté!\n');
    
    await findAndFixFoods();
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
  
  process.exit(0);
}

main();
