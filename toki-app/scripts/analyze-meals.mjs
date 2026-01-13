/**
 * Script pour analyser les repas avec des calories anormalement élevées
 * 
 * Usage: node scripts/analyze-meals.mjs
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore';
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

function question(rl, prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('🔧 Analyse des repas FeedToki');
  console.log('==============================\n');
  
  const email = await question(rl, 'Email: ');
  const password = await question(rl, 'Mot de passe: ');
  
  try {
    console.log('\n🔐 Connexion...');
    const userCred = await signInWithEmailAndPassword(auth, email, password);
    const userId = userCred.user.uid;
    console.log('✅ Connecté! UserID:', userId);
    
    // Charger les repas
    console.log('\n📥 Chargement des repas...');
    const mealsRef = collection(db, 'users', userId, 'meals');
    const snapshot = await getDocs(mealsRef);
    
    console.log(`   ${snapshot.docs.length} repas trouvés\n`);
    
    // Analyser chaque repas
    const problematicMeals = [];
    
    for (const mealDoc of snapshot.docs) {
      const data = mealDoc.data();
      const date = data.createdAt ? new Date(data.createdAt).toLocaleDateString('fr-CA') : 'Date inconnue';
      
      // Calculer les calories totales
      let totalCalories = 0;
      const items = data.items || [];
      
      for (const item of items) {
        // Les calories sont dans l'aliment lui-même ou dans globalFoods
        const itemCals = item.calories_kcal || item.calories || 0;
        const multiplier = item.multiplier || 1.0;
        totalCalories += itemCals * multiplier;
      }
      
      // Si > 2500 cal pour un repas, c'est suspect
      if (totalCalories > 2500 || date.includes('2026-01-10')) {
        problematicMeals.push({
          id: mealDoc.id,
          date,
          label: data.label || 'Sans nom',
          items: items.length,
          totalCalories: Math.round(totalCalories),
          data
        });
      }
    }
    
    if (problematicMeals.length === 0) {
      console.log('✅ Aucun repas suspect trouvé (> 2500 cal).');
      rl.close();
      process.exit(0);
      return;
    }
    
    console.log(`⚠️ ${problematicMeals.length} repas suspect(s) trouvé(s):\n`);
    
    for (let i = 0; i < problematicMeals.length; i++) {
      const meal = problematicMeals[i];
      console.log(`[${i + 1}] ${meal.date} - "${meal.label}"`);
      console.log(`    ID: ${meal.id}`);
      console.log(`    Calories: ${meal.totalCalories} kcal`);
      console.log(`    Items: ${meal.items}`);
      
      // Afficher les items
      if (meal.data.items) {
        console.log('    Détails:');
        for (const item of meal.data.items) {
          const cals = item.calories_kcal || item.calories || 0;
          const mult = item.multiplier || 1.0;
          console.log(`      - ${item.foodId || item.name}: ${cals} kcal × ${mult} = ${Math.round(cals * mult)} kcal`);
        }
      }
      console.log('');
    }
    
    // Demander quoi faire
    const action = await question(rl, 'Action? (d = supprimer, f = fixer multiplier à 1, s = skip): ');
    
    if (action === 'd') {
      const num = await question(rl, 'Numéro du repas à supprimer (ou "all"): ');
      
      if (num === 'all') {
        for (const meal of problematicMeals) {
          await deleteDoc(doc(db, 'users', userId, 'meals', meal.id));
          console.log(`✅ Supprimé: ${meal.label} (${meal.date})`);
        }
      } else {
        const idx = parseInt(num) - 1;
        if (idx >= 0 && idx < problematicMeals.length) {
          const meal = problematicMeals[idx];
          await deleteDoc(doc(db, 'users', userId, 'meals', meal.id));
          console.log(`✅ Supprimé: ${meal.label} (${meal.date})`);
        }
      }
    } else if (action === 'f') {
      const num = await question(rl, 'Numéro du repas à fixer (ou "all"): ');
      
      const fixMeal = async (meal) => {
        // Remettre tous les multipliers à 1.0
        const newItems = meal.data.items.map(item => ({
          ...item,
          multiplier: 1.0
        }));
        
        await updateDoc(doc(db, 'users', userId, 'meals', meal.id), {
          items: newItems
        });
        console.log(`✅ Fixé: ${meal.label} (${meal.date}) - multipliers remis à 1.0`);
      };
      
      if (num === 'all') {
        for (const meal of problematicMeals) {
          await fixMeal(meal);
        }
      } else {
        const idx = parseInt(num) - 1;
        if (idx >= 0 && idx < problematicMeals.length) {
          await fixMeal(problematicMeals[idx]);
        }
      }
    }
    
    console.log('\n✅ Terminé! Rafraîchis l\'app pour voir les changements.');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
  
  rl.close();
  process.exit(0);
}

main();
