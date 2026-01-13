/**
 * Script pour corriger les calories du repas du 10 janvier
 * 
 * À exécuter avec: npx ts-node scripts/fix-calories-jan10.ts
 * OU: Copier le code de updateFoods() dans la console Firebase
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, getDoc, collection, getDocs } from 'firebase/firestore';

// Configuration Firebase (depuis firebase-config.ts)
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

// Corrections des calories pour les aliments du 10 janvier
// Valeurs réalistes basées sur des portions standards
const corrections = {
  'poutine': { calories: 750, protein: 25, carbs: 80, fat: 40 },
  'bière': { calories: 150, protein: 1, carbs: 13, fat: 0 },
  'bloody caesar': { calories: 150, protein: 1, carbs: 8, fat: 0 },
  'cornichon frit': { calories: 300, protein: 3, carbs: 30, fat: 18 },
  'tarte au pacane': { calories: 500, protein: 6, carbs: 65, fat: 25 },
  'tarte aux pacanes': { calories: 500, protein: 6, carbs: 65, fat: 25 },
};

async function findAndFixFoods() {
  console.log('🔍 Recherche des aliments dans globalFoods...\n');
  
  const globalFoodsRef = collection(db, 'globalFoods');
  const snapshot = await getDocs(globalFoodsRef);
  
  let fixed = 0;
  let notFound = 0;
  
  for (const foodDoc of snapshot.docs) {
    const data = foodDoc.data();
    const name = (data.name || '').toLowerCase().trim();
    
    // Chercher si cet aliment est dans nos corrections
    for (const [targetName, correction] of Object.entries(corrections)) {
      if (name.includes(targetName) || targetName.includes(name)) {
        const oldCalories = data.calories_kcal || data.calories || 0;
        
        if (oldCalories > correction.calories + 100) {
          console.log(`📝 ${data.name}`);
          console.log(`   ID: ${foodDoc.id}`);
          console.log(`   Anciennes calories: ${oldCalories} kcal`);
          console.log(`   Nouvelles calories: ${correction.calories} kcal`);
          
          // Appliquer la correction
          await updateDoc(doc(db, 'globalFoods', foodDoc.id), {
            calories_kcal: correction.calories,
            protein_g: correction.protein,
            carbs_g: correction.carbs,
            fat_g: correction.fat,
            // Aussi mettre à jour les anciens champs si présents
            calories: correction.calories,
            protein: correction.protein,
            carbs: correction.carbs,
            fat: correction.fat,
          });
          
          console.log(`   ✅ Corrigé!\n`);
          fixed++;
        } else {
          console.log(`ℹ️ ${data.name} - calories OK (${oldCalories} kcal)`);
        }
        break;
      }
    }
  }
  
  console.log(`\n========================================`);
  console.log(`✅ ${fixed} aliment(s) corrigé(s)`);
  console.log(`ℹ️ Total analysés: ${snapshot.docs.length}`);
  console.log(`\n💡 Conseil: Rafraîchis l'app et va dans Stats pour voir les nouvelles moyennes.`);
}

findAndFixFoods().catch(console.error);
