// Script de test pour le parser IA amélioré
// Usage: npx ts-node scripts/test-ai-parser.ts

import { parseMealDescription } from '../lib/ai-meal-parser';

const testCases = [
  // Cas de base
  '2 toasts au beurre de peanut',
  'deux toasts au beurre de peanut',
  'toast au beurre de peanut',
  '1 toast au beurre de peanut',
  
  // Plats composés avec quantités
  '3 cigares au chou',
  '2 dolma',
  '1 poutine complète',
  'poutine au poulet',
  
  // Plusieurs aliments
  'poulet et riz',
  '2 toasts au beurre de peanut et une pomme',
  'poulet, riz et brocoli',
  '1 portion de poulet et 200g de riz',
  
  // Aliments simples avec quantités
  '200g de poulet',
  '1 tasse de riz',
  '2 pommes',
  'trois oeufs',
  
  // Cas complexes
  'j\'ai mangé 2 toasts au beurre de peanut ce matin',
  'pour le déjeuner: 2 toasts avec beurre de peanut et un café',
  '2x toast au beurre de peanut',
  
  // Cas limites
  'toast',
  'rien',
  'j\'ai faim',
];

async function runTests() {
  console.log('🧪 Tests du Parser IA Amélioré\n');
  console.log('='.repeat(60));
  
  let passed = 0;
  let failed = 0;
  
  for (const testCase of testCases) {
    console.log(`\n📝 Test: "${testCase}"`);
    try {
      const result = await parseMealDescription(testCase);
      
      if (result.error) {
        console.log(`   ❌ Erreur: ${result.error}`);
        failed++;
      } else if (result.items.length === 0) {
        console.log(`   ⚠️  Aucun aliment détecté`);
        failed++;
      } else {
        console.log(`   ✅ ${result.items.length} aliment(s) détecté(s):`);
        result.items.forEach((item, idx) => {
          console.log(`      ${idx + 1}. ${item.name}${item.quantity ? ` (${item.quantity})` : ''} [confiance: ${(item.confidence || 0).toFixed(2)}]`);
        });
        passed++;
      }
    } catch (error: any) {
      console.log(`   ❌ Exception: ${error.message}`);
      failed++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 Résultats: ${passed} réussis, ${failed} échoués sur ${testCases.length} tests`);
  console.log(`   Taux de succès: ${((passed / testCases.length) * 100).toFixed(1)}%\n`);
}

// Exécuter les tests
runTests().catch(console.error);

