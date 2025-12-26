#!/usr/bin/env ts-node
/**
 * simulate.ts
 * Simulateur offline du système de points Toki.
 * 
 * Usage:
 *   npx ts-node scripts/simulate.ts [--weeks 12] [--seed 123]
 * 
 * Objectif:
 *   Valider que le système de points conduit à une perte de poids
 *   quand l'utilisateur respecte le budget quotidien.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  createProfiles,
  runSimulation,
  auditFoodDb,
  SimulationResult,
  FoodAuditItem,
} from './simulate-utils';

// ============================================================================
// CONFIG
// ============================================================================

interface Config {
  weeks: number;
  seed: number;
}

function parseArgs(): Config {
  const args = process.argv.slice(2);
  let weeks = 8; // défaut
  let seed = Date.now();

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--weeks' && args[i + 1]) {
      weeks = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--seed' && args[i + 1]) {
      seed = parseInt(args[i + 1], 10);
      i++;
    }
  }

  return { weeks, seed };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('🐉 Toki Points System Simulator\n');

  const config = parseArgs();
  console.log(`📊 Configuration:`);
  console.log(`   Weeks: ${config.weeks}`);
  console.log(`   Seed: ${config.seed}\n`);

  // Créer profils
  const profiles = createProfiles();
  console.log(`👥 Profiles: ${profiles.map((p) => p.name).join(', ')}\n`);

  // Lancer simulations
  const results: SimulationResult[] = [];
  for (const profile of profiles) {
    console.log(`🔄 Running simulation for ${profile.name}...`);
    const result = runSimulation(profile, config.weeks, config.seed);
    results.push(result);
  }

  console.log('\n✅ Simulations completed!\n');

  // Afficher rapports
  printReport(results);

  // Audit food database
  console.log('\n' + '='.repeat(80));
  console.log('🔍 FOOD DATABASE AUDIT');
  console.log('='.repeat(80) + '\n');
  auditReport();

  // Sauvegarder résultats
  saveResults(results, config);

  console.log('\n✨ Done!\n');
}

// ============================================================================
// RAPPORTS
// ============================================================================

function printReport(results: SimulationResult[]) {
  console.log('='.repeat(80));
  console.log('📈 SIMULATION RESULTS');
  console.log('='.repeat(80) + '\n');

  for (const result of results) {
    const { profile, summary } = result;

    console.log(`👤 ${profile.name.toUpperCase()}`);
    console.log('─'.repeat(60));
    console.log(`   Compliance Rate: ${(profile.complianceRate * 100).toFixed(0)}%`);
    console.log(`   Cheats/Week: ${profile.cheatsPerWeek}`);
    console.log(`   Points Budget: ${profile.pointsPerDay} pts/day (cap: ${profile.maxCap})`);
    console.log(`   Weekly Target: ${profile.weeklyTarget.toLocaleString()} kcal`);
    console.log();

    console.log(`📊 Results:`);
    console.log(`   Initial Weight: ${summary.initialWeight.toFixed(1)} kg`);
    console.log(`   Final Weight:   ${summary.finalWeight.toFixed(1)} kg`);
    console.log(
      `   Weight Change:  ${summary.totalWeightChange >= 0 ? '+' : ''}${summary.totalWeightChange.toFixed(2)} kg`
    );
    console.log();

    console.log(`📉 Daily Averages:`);
    console.log(`   Calories: ${summary.avgCaloriesPerDay.toFixed(0)} kcal/day`);
    console.log(`   Points:   ${summary.avgPointsPerDay.toFixed(1)} pts/day`);
    console.log(
      `   Over Budget: ${summary.daysOverBudget}/${summary.totalDays} days (${((summary.daysOverBudget / summary.totalDays) * 100).toFixed(0)}%)`
    );
    console.log();

    // Évaluation
    const expectedLossKg = calculateExpectedLoss(profile, summary.totalDays);
    const actualLossKg = -summary.totalWeightChange;
    const delta = actualLossKg - expectedLossKg;

    console.log(`🎯 Expected Loss: ${expectedLossKg.toFixed(2)} kg`);
    console.log(`🎯 Actual Loss:   ${actualLossKg.toFixed(2)} kg`);
    console.log(
      `🎯 Delta:         ${delta >= 0 ? '+' : ''}${delta.toFixed(2)} kg ${getDeltaEmoji(delta)}`
    );
    console.log();

    if (profile.complianceRate >= 0.7 && actualLossKg < expectedLossKg * 0.5) {
      console.log(`⚠️  WARNING: User respected budget but lost less than expected!`);
      console.log(`    → Points system may be too permissive or food costs underestimated.\n`);
    } else if (profile.complianceRate < 0.5 && actualLossKg > expectedLossKg * 0.3) {
      console.log(`⚠️  WARNING: User cheated frequently but still lost significant weight!`);
      console.log(`    → Points system may be too restrictive.\n`);
    } else {
      console.log(`✅ Results align with expected behavior.\n`);
    }

    console.log('─'.repeat(60) + '\n');
  }
}

function calculateExpectedLoss(profile: any, days: number): number {
  // Déficit hebdo = TDEE×7 - weeklyTarget
  const weeklyDeficit = profile.tdeeKcal * 7 - profile.weeklyTarget;
  const weeks = days / 7;
  const totalDeficit = weeklyDeficit * weeks;
  return totalDeficit / 7700; // kcal → kg
}

function getDeltaEmoji(delta: number): string {
  if (Math.abs(delta) < 0.5) return '✅';
  if (Math.abs(delta) < 1.5) return '⚠️';
  return '🚨';
}

// ============================================================================
// AUDIT FOOD DB
// ============================================================================

function auditReport() {
  const audit = auditFoodDb();

  console.log('🚨 TOP 15 - WORST RATIOS (Most Expensive per Calorie)');
  console.log('─'.repeat(80));
  printAuditTable(audit.worst);
  console.log();

  console.log('🎁 TOP 15 - BEST RATIOS (Most Advantageous / Too Cheap)');
  console.log('─'.repeat(80));
  printAuditTable(audit.best);
  console.log();

  if (audit.suspicious.length > 0) {
    console.log('⚠️  SUSPICIOUS ITEMS');
    console.log('─'.repeat(80));
    printAuditTable(audit.suspicious);
    console.log();
  } else {
    console.log('✅ No suspicious items detected.\n');
  }
}

function printAuditTable(items: FoodAuditItem[]) {
  console.log(
    `${'Name'.padEnd(30)} ${'Points'.padEnd(8)} ${'Cal'.padEnd(8)} ${'Cal/Pt'.padEnd(10)} ${'Issue'.padEnd(20)}`
  );
  console.log('─'.repeat(80));

  items.forEach((item) => {
    const name = item.name.length > 28 ? item.name.slice(0, 25) + '...' : item.name;
    const calPerPt =
      item.points > 0 ? item.calPerPoint.toFixed(0) : `${item.calories} (free)`;
    console.log(
      `${name.padEnd(30)} ${item.points.toString().padEnd(8)} ${item.calories.toString().padEnd(8)} ${calPerPt.padEnd(10)} ${item.issue || ''}`
    );
  });
}

// ============================================================================
// SAVE RESULTS
// ============================================================================

function saveResults(results: SimulationResult[], config: Config) {
  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `results_${timestamp}.json`;
  const filepath = path.join(outputDir, filename);

  const data = {
    config,
    timestamp: new Date().toISOString(),
    results: results.map((r) => ({
      profile: r.profile,
      summary: r.summary,
      // days: r.days, // Optionnel: trop volumineux
    })),
    audit: auditFoodDb(),
  };

  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`💾 Results saved to: ${filepath}`);
}

// ============================================================================
// RUN
// ============================================================================

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
