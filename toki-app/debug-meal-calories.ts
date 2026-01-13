/**
 * Script de diagnostic pour analyser les calories d'un repas
 * Affiche les détails exacts: items, multipliers, calories calculées
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { MealEntry } from './lib/stats';
import { FOOD_DB } from './lib/food-db';
import { loadCustomFoods } from './lib/custom-foods';

export async function analyzeRepasOfJanvier10(userId: string) {
  try {
    // Charger les données AsyncStorage
    const entriesKey = `feedtoki_entries_${userId}_v1`;
    const raw = await AsyncStorage.getItem(entriesKey);
    
    if (!raw) {
      console.log('❌ Aucun repas trouvé');
      return;
    }
    
    const entries: MealEntry[] = JSON.parse(raw);
    
    // Chercher le repas du 10 janvier 2026
    const targetDate = '2026-01-10';
    const mealOnJan10 = entries.find(e => e.createdAt.startsWith(targetDate));
    
    if (!mealOnJan10) {
      console.log(`❌ Aucun repas trouvé pour ${targetDate}`);
      console.log('Repas disponibles:');
      entries.slice(0, 5).forEach(e => {
        console.log(`  - ${e.createdAt}: ${e.label}`);
      });
      return;
    }
    
    console.log('\n🍽️  DIAGNOSTIC REPAS DU 10 JANVIER');
    console.log('='.repeat(60));
    console.log(`Label: ${mealOnJan10.label}`);
    console.log(`Date: ${mealOnJan10.createdAt}`);
    console.log(`Nombre d'items: ${mealOnJan10.items?.length || 0}`);
    console.log('');
    
    if (!mealOnJan10.items || mealOnJan10.items.length === 0) {
      console.log('❌ Pas d\'items dans ce repas!');
      return;
    }
    
    // Charger les aliments personnalisés
    const customFoods = await loadCustomFoods(userId);
    const allFoods = [...FOOD_DB, ...customFoods];
    
    // Analyser chaque item
    let totalCalories = 0;
    console.log('DÉTAILS DES ITEMS:');
    console.log('-'.repeat(60));
    
    mealOnJan10.items.forEach((item, idx) => {
      const food = allFoods.find(f => f.id === item.foodId);
      const multiplier = item.multiplier || 1.0;
      const baseCalories = food?.calories_kcal || 0;
      const itemCalories = baseCalories * multiplier;
      
      console.log(`\n${idx + 1}. ${item.foodId}`);
      console.log(`   Aliment trouvé: ${food?.name || '❌ NOT FOUND'}`);
      console.log(`   Calories base: ${baseCalories} kcal`);
      console.log(`   Multiplier: ${multiplier}x`);
      console.log(`   Grammes: ${item.portionGrams}g`);
      console.log(`   TOTAL ITEM: ${itemCalories} kcal`);
      
      totalCalories += itemCalories;
    });
    
    console.log('\n' + '='.repeat(60));
    console.log(`TOTAL CALCULÉ: ${Math.round(totalCalories)} kcal`);
    console.log(`TOTAL AFFICHAGE APP: ? kcal`);
    console.log('');
    
    // Vérifier si les multipliers sont bizarres
    const multipliers = mealOnJan10.items.map(i => i.multiplier || 1.0);
    const avgMultiplier = multipliers.reduce((a, b) => a + b, 0) / multipliers.length;
    
    if (avgMultiplier > 1.5) {
      console.log(`⚠️  ATTENTION: Multiplier moyen = ${avgMultiplier.toFixed(2)}x (normal = 1.0x)`);
      console.log('   Cela explique pourquoi les calories sont multipliées par 2.5!');
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

// Pour exécuter dans l'app:
// await analyzeRepasOfJanvier10('YOUR_USER_ID');
